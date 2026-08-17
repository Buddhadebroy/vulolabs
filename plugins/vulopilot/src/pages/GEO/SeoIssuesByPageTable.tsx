/* global appLocalizer */
import React from 'react';
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	InformationItemComponent,
	ModuleGuardComponent,
	NoticeManager,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { SEO_SECTIONS } from './seoSections';
import { SEO_ISSUE_QUERY_PARAM } from '../../services/seoIssueEditorTarget';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/** Every real SEO scanner id this table covers — SeoTab.tsx's own SEO_SECTIONS, the same source of truth its category tiles/score already agree with. */
const ALL_SEO_SCANNER_IDS = Array.from(
	new Set(SEO_SECTIONS.flatMap((section) => section.scannerIds))
);

const FINDINGS_PAGE_SIZE = 100;
/** Safety ceiling for the pagination loop below — a real site would need >1,000 open SEO findings to ever hit this. */
const MAX_FINDINGS = 1000;

type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface RawFinding {
	id: number;
	title: string;
	severity: FindingSeverity;
	status: 'open' | 'resolved' | 'ignored' | 'snoozed';
	scanner_id: string;
	object_type: string;
	object_ref: string;
}

interface FindingsResponse {
	data: RawFinding[];
	total: number;
}

interface FindingGroupRow {
	scanner_id: string;
	label: string;
	count: number;
}

interface WpRestPost {
	id: number;
	title: { rendered: string };
	status: string;
	date: string;
	link: string;
}

interface PageRow {
	id: number;
	isFinding?: false;
	title: string;
	status: string;
	date: string;
	editLink: string;
	viewLink: string | null;
	findings: RawFinding[];
}

/**
 * One inline sub-row under a page's row — zyra `TableCard`'s own native
 * `expandable` mechanism (`row.variation: FindingRow[]`), which renders
 * real sibling `<tr class="admin-row variation-row">`s directly in the
 * table body via the same column `render`/`statusClass` functions as the
 * parent row, not a floating popover (confirmed by reading zyra's own
 * `Table.tsx` source — `expandedRows` state and the chevron toggle are
 * fully internal to that component). Every field below exists specifically
 * so those shared column functions resolve to something sensible for a
 * single finding rather than a whole page (see `isFindingRow()`).
 */
interface FindingRow {
	id: number;
	isFinding: true;
	title: string;
	severity: FindingSeverity;
	status: FindingSeverity;
	scanner_id: string;
	scannerLabel: string;
	editLink: string;
	fixWithAiLink: string;
	viewLink: string | null;
}

type TableRow = PageRow | FindingRow;

const isFindingRow = (row: TableRow): row is FindingRow => true === row.isFinding;

const SEVERITY_RANK: Record<FindingSeverity, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
	info: 4,
};

const worstFinding = (findings: RawFinding[]): RawFinding =>
	findings.reduce(
		(worst, finding) =>
			SEVERITY_RANK[finding.severity] < SEVERITY_RANK[worst.severity]
				? finding
				: worst,
		findings[0]
	);

const worstSeverity = (findings: RawFinding[]): FindingSeverity =>
	worstFinding(findings).severity;

/** `GET /findings` is hard-capped at 100 rows/request server-side (AbstractRepository::find_all()) — loops on the response's own `total` rather than assuming a larger per_page is honored, so a site with >100 real open SEO findings doesn't silently under-report. */
const fetchAllOpenSeoFindings = async (): Promise<RawFinding[]> => {
	const scannerParam = ALL_SEO_SCANNER_IDS.join(',');
	let page = 1;
	let all: RawFinding[] = [];

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const response = await getApiResponse<FindingsResponse>(
			getApiLink(
				appLocalizer,
				`findings?scanner_id=${scannerParam}&status=open&per_page=${FINDINGS_PAGE_SIZE}&page=${page}&orderby=id&order=desc`
			),
			nonceHeaders
		);

		if (!response) {
			throw new Error('findings fetch failed');
		}

		all = all.concat(response.data ?? []);

		const gotFullPage = (response.data ?? []).length === FINDINGS_PAGE_SIZE;
		const moreRemain = all.length < (response.total ?? 0);

		if (!gotFullPage || !moreRemain || all.length >= MAX_FINDINGS) {
			break;
		}

		page += 1;
	}

	return all;
};

/**
 * Splits findings into per-page buckets (keyed by real numeric post/page
 * id) and a `siteWide` bucket for anything not tied to one specific page.
 * DuplicateContentScanner's own `object_ref` is a comma-joined list of
 * post ids (one duplicate-title finding genuinely spans multiple posts) —
 * split and attached to EACH matching page here, which is more correct
 * than Findings.php::add_page_field()'s own `is_numeric()` check (which
 * fails on a comma string and falls back to "Site-wide" — a real,
 * pre-existing quirk in that shared controller, not fixed here since it
 * backs other tables too). SitemapScanner/RobotsTxtScanner write
 * `object_type: 'url'` — genuinely site-wide, never forced onto a page.
 */
const bucketFindingsByPage = (
	findings: RawFinding[]
): { byPostId: Map<number, RawFinding[]>; siteWide: RawFinding[] } => {
	const byPostId = new Map<number, RawFinding[]>();
	const siteWide: RawFinding[] = [];

	findings.forEach((finding) => {
		if ('post' !== finding.object_type) {
			siteWide.push(finding);
			return;
		}

		const postIds = finding.object_ref
			.split(',')
			.map((part) => Number(part.trim()))
			.filter((id) => Number.isFinite(id) && id > 0);

		if (0 === postIds.length) {
			siteWide.push(finding);
			return;
		}

		postIds.forEach((postId) => {
			byPostId.set(postId, [...(byPostId.get(postId) || []), finding]);
		});
	});

	return { byPostId, siteWide };
};

/** Fetches only the specific posts/pages that actually have an open finding (via WP core's own `include` param), rather than every post/page on the site — this table's scope is bounded by real issue count, not total site content. */
const fetchPagesByIds = async (
	endpoint: 'posts' | 'pages',
	ids: number[]
): Promise<WpRestPost[]> => {
	if (0 === ids.length) {
		return [];
	}

	const chunks: number[][] = [];
	for (let i = 0; i < ids.length; i += 100) {
		chunks.push(ids.slice(i, i + 100));
	}

	const chunkResults = await Promise.all(
		chunks.map((chunk) =>
			getApiResponse<WpRestPost[]>(
				getApiLink(
					appLocalizer,
					`${endpoint}?include=${chunk.join(',')}&per_page=100&_fields=id,title,status,date,link`,
					'wp/v2'
				),
				nonceHeaders
			).catch(() => [] as WpRestPost[])
		)
	);

	return chunkResults.flat();
};

const buildEditLink = (postId: number): string =>
	`${appLocalizer.site_url}/wp-admin/post.php?post=${postId}&action=edit`;

/** Same navigate-and-highlight deep link `post-editor/index.tsx` reads — deliberately NOT the existing in-place "Fix with AI" (RecentContentCard.tsx/FindingsTable.tsx/IssueDetailPanel.tsx's immediate AI-apply). This one takes the user to the editor, opens the "VuloPilot SEO" sidebar, and — where a mapping exists (seoIssueEditorTarget.ts) — switches to the right tab and highlights the specific field/checklist row, so they see exactly what to fix before anything is changed. */
const buildFixWithAiLink = (editLink: string, scannerId: string): string =>
	`${editLink}&${SEO_ISSUE_QUERY_PARAM}=${encodeURIComponent(scannerId)}`;

const STATUS_ICON: Record<FindingSeverity, string> = {
	critical: '✕',
	high: '✕',
	medium: '!',
	low: '!',
	info: 'i',
};

interface RowAction {
	label: string;
	icon: string;
	onClick: () => void;
}

/**
 * zyra `Table.tsx`'s own variation-row rendering path only checks
 * `header.render` — unlike the parent-row path, it has no special case for
 * `header.type === 'action'`, and `TableRowActions` (the component that
 * special case would use) isn't exported from `@zyra/table`'s public API
 * to reuse here. Using `type: 'action'` on the shared `action` header would
 * silently render nothing for finding sub-rows (confirmed live — verified
 * via a real click test). A small local action-icon row, driven by
 * `render` (checked on both paths), sidesteps that gap for both row kinds
 * with one implementation.
 */
/**
 * zyra `Table.tsx`'s own expand/collapse state (`expandedRows`) is fully
 * internal — the only way to toggle it from outside is a real click on the
 * chevron `<i>` it renders itself inside `td.admin-column.expand` (see
 * that component's own source). Per direct instruction, that chevron is
 * hidden (`.seo-issues-by-page-card .admin-column.expand { display: none }`
 * in GrowMyTraffic.scss) and clicking anywhere else in a page row should
 * expand it instead — so this walks up to the row and fires a real `click`
 * on that same (now-invisible) icon, which zyra's own internal handler
 * still picks up. A no-op for finding sub-rows (no `variation`, so no icon
 * is ever rendered there to find).
 */
const toggleRowExpansion = (event: React.MouseEvent<HTMLElement>) => {
	const rowEl = event.currentTarget.closest('tr.admin-row');
	const expandIcon = rowEl?.querySelector<HTMLElement>(':scope > td.admin-column.expand > i');
	expandIcon?.click();
};

const RowActionsMenu = ({ actions }: { actions: RowAction[] }) => (
	<div className="seo-issues-row-actions">
		{actions.map((action) => (
			<button
				key={action.label}
				type="button"
				className="seo-issues-row-action"
				title={action.label}
				onClick={action.onClick}
			>
				<i className={`adminfont-${action.icon}`} />
			</button>
		))}
	</div>
);

/**
 * "All SEO Issues" — page-wise, real `GET /findings` (paginated past the
 * server's own 100-row cap) joined client-side onto real `wp/v2/posts`/
 * `pages` rows (fetched via `include=`, scoped to only the pages that
 * actually have an open finding), same client-side-join technique
 * `RecentContentCard.tsx` already established for "Content → Recent
 * Content" — this table follows that exact pattern rather than a new
 * design, per direct instruction. Filter pills come from real
 * `GET /findings/groups` counts (server-side authoritative, not
 * recomputed here), scoped to SeoTab.tsx's own real 23-scanner-id
 * allowlist — dynamic, not hardcoded.
 *
 * Deliberately does NOT reuse SectionedIssuesTable.tsx (grouped by issue
 * type) — that component is shared, as-is, by Security/Accessibility/
 * Performance and must keep working unchanged; this is a new, separate
 * component swapped into SeoTab.tsx's body only.
 *
 * Row expansion uses zyra `TableCard`'s own native `expandable` prop
 * (`row.variation: FindingRow[]`) rather than the absolute-positioned
 * popover `RecentContentCard.tsx`'s own "N issues" toggle uses — per
 * direct follow-up instruction, clicking a page's issue count here reveals
 * its findings as real inline sub-rows directly beneath it in the table
 * (chevron-driven, indented), not a floating panel. Expand/collapse state
 * itself is fully internal to zyra's `Table` component — nothing to track
 * here.
 */
const SeoIssuesByPageTable = () => {
	const [rows, setRows] = useState<PageRow[]>([]);
	const [siteWideFindings, setSiteWideFindings] = useState<RawFinding[]>([]);
	const [groups, setGroups] = useState<FindingGroupRow[]>([]);
	const [activeFilter, setActiveFilter] = useState('all');
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);
	const [reloadToken, setReloadToken] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setHasError(false);

		(async () => {
			try {
				const findings = await fetchAllOpenSeoFindings();
				const { byPostId, siteWide } = bucketFindingsByPage(findings);
				const pageIds = Array.from(byPostId.keys());

				const [posts, pages] = await Promise.all([
					fetchPagesByIds('posts', pageIds),
					fetchPagesByIds('pages', pageIds),
				]);

				const builtRows: PageRow[] = [...posts, ...pages].map((post) => ({
					id: post.id,
					title: post.title.rendered,
					status: post.status,
					date: post.date,
					editLink: buildEditLink(post.id),
					viewLink: 'publish' === post.status ? post.link : null,
					findings: byPostId.get(post.id) || [],
				}));

				if (!cancelled) {
					setRows(
						builtRows.sort(
							(a, b) =>
								new Date(b.date).getTime() -
								new Date(a.date).getTime()
						)
					);
					setSiteWideFindings(siteWide);
				}
			} catch (error) {
				if (!cancelled) {
					setHasError(true);
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [reloadToken]);

	useEffect(() => {
		getApiResponse<{ data: FindingGroupRow[] }>(
			getApiLink(appLocalizer, 'findings/groups?per_page=100'),
			nonceHeaders
		)
			.then((response) =>
				setGroups(
					(response?.data ?? []).filter((group) =>
						ALL_SEO_SCANNER_IDS.includes(group.scanner_id)
					)
				)
			)
			.catch(() => setGroups([]));
	}, [reloadToken]);

	const refetch = () => setReloadToken((current) => current + 1);

	/** `GET /findings/groups`'s own real `label` per scanner id — reused here so a finding sub-row's issue-type chip reads the same human label as the filter pills above, instead of a raw scanner id. */
	const scannerLabelMap = new Map(groups.map((group) => [group.scanner_id, group.label]));

	const buildVariationRows = (row: PageRow): FindingRow[] =>
		row.findings.map((finding) => ({
			id: finding.id,
			isFinding: true,
			title: finding.title,
			severity: finding.severity,
			status: finding.severity,
			scanner_id: finding.scanner_id,
			scannerLabel: scannerLabelMap.get(finding.scanner_id) || finding.scanner_id,
			editLink: row.editLink,
			fixWithAiLink: buildFixWithAiLink(row.editLink, finding.scanner_id),
			viewLink: row.viewLink,
		}));

	const totalOpenIssues = groups.reduce((total, group) => total + group.count, 0);

	const filterPills: { id: string; label: string; count: number }[] = [
		{ id: 'all', label: __('All', 'vulopilot'), count: totalOpenIssues },
		...groups.map((group) => ({
			id: group.scanner_id,
			label: group.label,
			count: group.count,
		})),
	];

	const rowMatchesFilter = (row: PageRow): boolean =>
		'all' === activeFilter ||
		row.findings.some((finding) => finding.scanner_id === activeFilter);

	const visibleRows = rows.filter(rowMatchesFilter);
	const visibleSiteWide =
		'all' === activeFilter
			? siteWideFindings
			: siteWideFindings.filter((finding) => finding.scanner_id === activeFilter);

	const handleFixWithAi = (row: PageRow) => {
		const scannerIds = Array.from(new Set(row.findings.map((finding) => finding.scanner_id)));
		const primary = 1 === scannerIds.length ? row.findings[0] : worstFinding(row.findings);

		if (scannerIds.length > 1) {
			NoticeManager.add({
				uniqueKey: `seo-issues-fix-${row.id}`,
				type: 'info',
				position: 'float',
				message: sprintf(
					/* translators: %d: number of other open issues on this page. */
					_n(
						'Opening the highest-priority issue first — %d other issue on this page also needs attention.',
						'Opening the highest-priority issue first — %d other issues on this page also need attention.',
						scannerIds.length - 1,
						'vulopilot'
					),
					scannerIds.length - 1
				),
			});
		}

		window.location.href = buildFixWithAiLink(row.editLink, primary.scanner_id);
	};

	if (hasError) {
		return (
			<CardComponent title={__('All SEO Issues', 'vulopilot')}>
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load SEO issues', 'vulopilot')}
					desc={__(
						'Something went wrong fetching this data. Please try again.',
						'vulopilot'
					)}
				/>
				<ButtonInput
					buttons={{
						text: __('Retry', 'vulopilot'),
						icon: 'update',
						onClick: refetch,
					}}
				/>
			</CardComponent>
		);
	}

	return (
		<CardComponent
			className="seo-issues-by-page-card"
			title={__('All SEO Issues', 'vulopilot')}
			isLoading={isLoading}
		>
			<div className="sectioned-issues-tabs">
				{filterPills.map((pill) => (
					<span
						key={pill.id}
						className={`sectioned-issues-tab ${activeFilter === pill.id ? 'active' : ''}`}
						role="button"
						tabIndex={0}
						onClick={() => setActiveFilter(pill.id)}
					>
						{pill.label}
						<span className="sectioned-issues-tab-count">{pill.count}</span>
					</span>
				))}
			</div>

			{visibleSiteWide.length > 0 && (
				<div className="seo-issues-sitewide-block">
					<div className="seo-issues-sitewide-title">
						{__('Site-wide issues', 'vulopilot')}
					</div>
					<div className="desc">
						{__(
							"Not tied to a specific page — these affect the whole site (e.g. your XML sitemap or robots.txt).",
							'vulopilot'
						)}
					</div>
					<ul className="seo-issues-sitewide-list">
						{visibleSiteWide.map((finding) => (
							<li key={finding.id}>
								<span
									className={`admin-badge badge-${finding.severity}`}
								>
									{STATUS_ICON[finding.severity]}
								</span>
								<span>{finding.title}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{!isLoading && 0 === visibleRows.length && 0 === visibleSiteWide.length ? (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing here right now', 'vulopilot')}
					desc={
						'all' === activeFilter
							? __(
									'No open SEO issues on any page right now — nice work.',
									'vulopilot'
								)
							: __(
									'No pages currently have this specific issue.',
									'vulopilot'
								)
					}
				/>
			) : (
				<TableCard
					showMenu={false}
					expandable
					className="transparent-table"
					headers={{
						title: {
							label: __('Page', 'vulopilot'),
							width: '35%',
							render: (row: TableRow) =>
								isFindingRow(row) ? (
									<div className="seo-issues-finding-title">
										<span className="seo-issues-finding-arrow">
											↳
										</span>
										<span>{row.title}</span>
									</div>
								) : (
									<div
										className="seo-issues-row-expand-trigger"
										onClick={toggleRowExpansion}
									>
										<InformationItemComponent
											title={row.title || __('(no title)', 'vulopilot')}
											titleLink={row.editLink}
										/>
									</div>
								),
						},
						status: {
							label: __('Status', 'vulopilot'),
							render: (row: TableRow) => {
								const value = isFindingRow(row) ? row.severity : row.status;
								const formatted = String(value)
									.toLowerCase()
									.split(/[-_]/)
									.map(
										(word) =>
											word.charAt(0).toUpperCase() + word.slice(1)
									)
									.join(' ');

								return (
									<span
										className={`admin-badge badge-${String(value).toLowerCase()} ${isFindingRow(row) ? '' : 'seo-issues-row-expand-trigger'}`}
										onClick={
											isFindingRow(row) ? undefined : toggleRowExpansion
										}
									>
										{formatted}
									</span>
								);
							},
						},
						issues: {
							label: __('SEO Issues', 'vulopilot'),
							render: (row: TableRow) =>
								isFindingRow(row) ? (
									<span className="seo-issues-finding-scanner">
										{row.scannerLabel}
									</span>
								) : (
									<span
										className={`admin-badge badge-${worstSeverity(row.findings)} seo-issues-row-expand-trigger`}
										onClick={toggleRowExpansion}
									>
										{sprintf(
											_n(
												'%d issue',
												'%d issues',
												row.findings.length,
												'vulopilot'
											),
											row.findings.length
										)}
									</span>
								),
						},
						date: {
							label: __('Updated', 'vulopilot'),
							render: (row: TableRow) =>
								isFindingRow(row) ? null : (
									<span
										className="seo-issues-row-expand-trigger"
										onClick={toggleRowExpansion}
									>
										{new Date(row.date).toLocaleDateString()}
									</span>
								),
						},
						action: {
							label: __('Action', 'vulopilot'),
							render: (row: TableRow) => (
								<RowActionsMenu
									actions={[
										{
											label: __('Fix with AI', 'vulopilot'),
											icon: 'ai',
											onClick: () =>
												isFindingRow(row)
													? (window.location.href =
															row.fixWithAiLink)
													: handleFixWithAi(row),
										},
										{
											label: __('Edit', 'vulopilot'),
											icon: 'edit',
											onClick: () =>
												(window.location.href = row.editLink),
										},
										{
											label: __('View', 'vulopilot'),
											icon: 'eye',
											onClick: () => {
												if (row.viewLink) {
													window.open(
														row.viewLink,
														'_blank',
														'noreferrer'
													);
												}
											},
										},
									]}
								/>
							),
						},
					}}
					rows={visibleRows.map((row) => ({
						...row,
						variation: buildVariationRows(row),
					}))}
					ids={visibleRows.map((row) => row.id)}
					totalRows={visibleRows.length}
					isLoading={isLoading}
					emptyMessage={__('No pages match this filter.', 'vulopilot')}
				/>
			)}
		</CardComponent>
	);
};

export default SeoIssuesByPageTable;
