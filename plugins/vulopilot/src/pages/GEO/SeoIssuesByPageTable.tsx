/* global appLocalizer */
import React from 'react';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { getApiLink, getApiResponse, sendApiResponse, useOutsideClick } from '@zyra/core';
import {
	CardComponent,
	InformationItemComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
	TabsComponent,
	TooltipComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { SEO_SECTIONS } from './seoSections';
import { SEO_ISSUE_QUERY_PARAM } from '../../services/seoIssueEditorTarget';
import ShowProPopup from '../../components/Popup/Popup';

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

	return { byPostId, siteWide: dedupeSiteWideFindings(siteWide) };
};

/**
 * Repeated scans create a new "open" Finding row instead of superseding the
 * prior one for the same scanner_id+object_ref (a real, pre-existing gap in
 * the scan/rescan pipeline, confirmed via direct DB query — e.g. the same
 * "No canonical URL tag found" row existing 7+ times with different `id`s).
 * Site-wide findings are the most visibly affected (only ~6 real distinct
 * site-wide checks exist, so duplicates repeat densely in a short list) —
 * deduped here per direct instruction, keeping the most recent (highest
 * `id`) copy of each distinct `scanner_id`+`title` pair so a real status
 * change action (Resolve/Ignore/Fix) targets the current row, not a stale
 * one. Per-page findings aren't deduped here — out of scope for this
 * instruction, and the underlying data-quality issue is unchanged.
 */
const dedupeSiteWideFindings = (findings: RawFinding[]): RawFinding[] => {
	const byKey = new Map<string, RawFinding>();

	findings.forEach((finding) => {
		const key = `${finding.scanner_id}:${finding.title}`;
		const existing = byKey.get(key);

		if (!existing || finding.id > existing.id) {
			byKey.set(key, finding);
		}
	});

	return Array.from(byKey.values());
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

/** What a registered fix handler resolves to — same shape RecentContentCard.tsx's own FixOutcome uses. */
interface FixOutcome {
	success: boolean;
	message: string;
}

/**
 * Real, immediate AI-apply "Fix" handler — the SAME `vulopilot_finding_fix_handler`
 * filter RecentContentCard.tsx/FindingsTable.tsx already read (registered by
 * vulopilot-pro's OneClickFix module when active, `null` otherwise). Used
 * here ONLY for the "Site-wide issues" block below: sitemap/robots.txt
 * findings aren't tied to any one page, so the navigate-to-editor-and-
 * highlight "Fix with AI" used for per-page rows/findings elsewhere in this
 * file has no page to navigate to — this is the same one-click-apply
 * mechanism used everywhere else in the app instead. Read fresh on every
 * click rather than cached, same reasoning as those call sites.
 */
const getFindingFixHandler = () => applyFilters('vulopilot_finding_fix_handler', null);

interface RowAction {
	label: string;
	icon: string;
	onClick: () => void;
}

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

/**
 * Same kebab-dropdown Action-column look "Content → Recent Content" uses
 * (`RecentContentCard.tsx`, via zyra `TableCard`'s own `type: 'action'` +
 * `TableRowActions`) — reimplemented locally, matching that component's
 * real markup/classes 1:1 (`table-action`/`inline-actions`/`action-icons`/
 * `action-dropdown`/`tooltip-name`, already globally styled by zyra's own
 * CSS, same as Recent Content's), rather than reused directly: zyra
 * `Table.tsx`'s variation-row rendering path only checks `header.render`,
 * not `header.type === 'action'` (that special case, and `TableRowActions`
 * itself, only exist on the parent-row path and aren't exported from
 * `@zyra/table`'s public API) — using `type: 'action'` here would silently
 * render nothing for this table's finding sub-rows (confirmed live). Driven
 * by `render` instead (checked on both paths), so both row kinds get the
 * same real Recent-Content-style menu.
 */
const RowActionsMenu = ({ actions }: { actions: RowAction[] }) => {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useOutsideClick(containerRef, () => {
		if (open) {
			setOpen(false);
		}
	});

	const showInline = actions.length <= 2;

	return (
		<div className="table-action" ref={containerRef}>
			{showInline ? (
				<div className="inline-actions">
					{actions.map((action) => (
						<TooltipComponent key={action.label} text={action.label}>
							<i
								onClick={action.onClick}
								className={`adminfont-${action.icon}`}
							/>
						</TooltipComponent>
					))}
				</div>
			) : (
				<div className="action-icons">
					<i
						className="adminfont-more-vertical"
						onClick={() => setOpen((current) => !current)}
					/>
					<div className={`action-dropdown ${open ? 'show' : 'hover'}`}>
						<ul>
							{actions.map((action) => (
								<li
									key={action.label}
									onClick={() => {
										action.onClick();
										setOpen(false);
									}}
								>
									<i className={`adminfont-${action.icon}`} />
									<span className="tooltip-name">{action.label}</span>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}
		</div>
	);
};

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
	const [fixingFindingId, setFixingFindingId] = useState<number | null>(null);
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

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

	/** Purely client-side, same as RecentContentCard.tsx's own `removeFindingLocally` — but filters the flat `siteWideFindings` list by finding id directly, since site-wide findings aren't nested under a page row here. */
	const removeSiteWideFindingLocally = (findingId: number) => {
		setSiteWideFindings((current) =>
			current.filter((finding) => finding.id !== findingId)
		);
	};

	const handleFixSiteWideFinding = (finding: RawFinding) => {
		const findingFixHandler = getFindingFixHandler();

		if ('function' !== typeof findingFixHandler) {
			setIsProPopupOpen(true);
			return;
		}

		setFixingFindingId(finding.id);

		Promise.resolve(findingFixHandler(finding) as Promise<FixOutcome> | undefined)
			.then((outcome) => {
				if (outcome?.message) {
					NoticeManager.add({
						uniqueKey: `seo-sitewide-fix-${finding.id}`,
						type: outcome.success ? 'success' : 'error',
						position: 'float',
						message: outcome.message,
					});
				}

				if (outcome?.success) {
					removeSiteWideFindingLocally(finding.id);
				}
			})
			.finally(() => setFixingFindingId(null));
	};

	/** Resolve/Ignore — the same real `POST /findings/{id} {status}` RecentContentCard.tsx's own `handleFindingStatus` calls (Findings.php::update_item() has no `object_type` restriction, so this works unmodified for site-wide findings). Every finding in this list is fetched with `status=open`, so there's no "Reopen" case to handle here — Resolve/Ignore are both one-way, removing the row locally on success. */
	const handleSiteWideFindingStatus = (
		finding: RawFinding,
		status: 'resolved' | 'ignored',
		successMessage: string
	) => {
		sendApiResponse(appLocalizer, getApiLink(appLocalizer, `findings/${finding.id}`), {
			status,
		}).then((response: unknown) => {
			if (response) {
				NoticeManager.add({
					uniqueKey: `seo-sitewide-${status}-${finding.id}`,
					type: 'success',
					position: 'float',
					message: successMessage,
				});
				removeSiteWideFindingLocally(finding.id);
			} else {
				NoticeManager.add({
					uniqueKey: `seo-sitewide-${status}-failed-${finding.id}`,
					type: 'error',
					position: 'float',
					message: __(
						'Could not update this finding. Please try again.',
						'vulopilot'
					),
				});
			}
		});
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
			<TabsComponent
				className="seo-issues-filter-tabs"
				activeIndex={Math.max(
					filterPills.findIndex((pill) => pill.id === activeFilter),
					0
				)}
				onTabChange={(index: number) => setActiveFilter(filterPills[index].id)}
				tabs={filterPills.map((pill) => ({
					label: sprintf('%1$s (%2$d)', pill.label, pill.count),
				}))}
			/>

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
								<span className="seo-issues-sitewide-text">
									{finding.title}
								</span>
								<RowActionsMenu
									actions={[
										{
											label: __('Resolve', 'vulopilot'),
											icon: 'check',
											onClick: () =>
												handleSiteWideFindingStatus(
													finding,
													'resolved',
													__('Finding marked as resolved.', 'vulopilot')
												),
										},
										{
											label:
												fixingFindingId === finding.id
													? __('Fixing…', 'vulopilot')
													: __('Fix with AI', 'vulopilot'),
											icon: 'ai',
											onClick: () => handleFixSiteWideFinding(finding),
										},
										{
											label: __('Ignore', 'vulopilot'),
											icon: 'eye-blocked',
											onClick: () =>
												handleSiteWideFindingStatus(
													finding,
													'ignored',
													__('Finding ignored.', 'vulopilot')
												),
										},
									]}
								/>
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

			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="one-click-fix" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</CardComponent>
	);
};

export default SeoIssuesByPageTable;
