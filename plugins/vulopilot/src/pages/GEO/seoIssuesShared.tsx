/* global appLocalizer */
import { useRef, useState } from '@wordpress/element';
import { getApiLink, getApiResponse, useOutsideClick } from '@zyra/core';
import { TooltipComponent } from '@zyra/components';
import { SEO_SECTIONS } from './seoSections';

/**
 * Truly shared pieces between `SeoSiteWideIssuesTable.tsx` and
 * `SeoIssuesByPageTable.tsx` — the two real tables `SeoIssuesSection.tsx`
 * renders side by side (split apart from one combined "All SEO Issues"
 * table per direct instruction). Only what BOTH genuinely need lives here;
 * each table's own page/post-specific or immediate-AI-apply-specific
 * pieces stay local to that table's own file.
 */

export const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/** Every real SEO scanner id either table covers — SeoTab.tsx's own SEO_SECTIONS, the same source of truth its category tiles/score already agree with. */
export const ALL_SEO_SCANNER_IDS = Array.from(
	new Set(SEO_SECTIONS.flatMap((section) => section.scannerIds))
);

const FINDINGS_PAGE_SIZE = 100;
/** Safety ceiling for the pagination loop below — a real site would need >1,000 open SEO findings to ever hit this. */
const MAX_FINDINGS = 1000;

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface RawFinding {
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

const SEVERITY_RANK: Record<FindingSeverity, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
	info: 4,
};

export const worstFinding = (findings: RawFinding[]): RawFinding =>
	findings.reduce(
		(worst, finding) =>
			SEVERITY_RANK[finding.severity] < SEVERITY_RANK[worst.severity]
				? finding
				: worst,
		findings[0]
	);

export const worstSeverity = (findings: RawFinding[]): FindingSeverity =>
	worstFinding(findings).severity;

/** `GET /findings` is hard-capped at 100 rows/request server-side (AbstractRepository::find_all()) — loops on the response's own `total` rather than assuming a larger per_page is honored, so a site with >100 real open SEO findings doesn't silently under-report. */
export const fetchAllOpenSeoFindings = async (): Promise<RawFinding[]> => {
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

/**
 * Splits findings into per-page buckets (keyed by real numeric post/page
 * id) and a `siteWide` bucket (deduped, see `dedupeSiteWideFindings`) for
 * anything not tied to one specific page. DuplicateContentScanner's own
 * `object_ref` is a comma-joined list of post ids (one duplicate-title
 * finding genuinely spans multiple posts) — split and attached to EACH
 * matching page here, which is more correct than
 * Findings.php::add_page_field()'s own `is_numeric()` check (which fails
 * on a comma string and falls back to "Site-wide" — a real, pre-existing
 * quirk in that shared controller, not fixed here since it backs other
 * tables too). SitemapScanner/RobotsTxtScanner write `object_type: 'url'`
 * — genuinely site-wide, never forced onto a page.
 */
export const bucketFindingsByPage = (
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

export interface WpRestPost {
	id: number;
	title: { rendered: string };
	status: string;
	date: string;
	link: string;
}

export interface PageRow {
	id: number;
	isFinding?: false;
	title: string;
	status: string;
	date: string;
	editLink: string;
	viewLink: string | null;
	findings: RawFinding[];
}

/** Fetches only the specific posts/pages that actually have an open finding (via WP core's own `include` param), rather than every post/page on the site — this table's scope is bounded by real issue count, not total site content. */
export const fetchPagesByIds = async (
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

export const buildEditLink = (postId: number): string =>
	`${appLocalizer.site_url}/wp-admin/post.php?post=${postId}&action=edit`;

export interface RowAction {
	label: string;
	icon: string;
	onClick: () => void;
}

/**
 * Same kebab-dropdown Action-column look "Content → Recent Content" uses
 * (`RecentContentCard.tsx`, via zyra `TableCard`'s own `type: 'action'` +
 * `TableRowActions`) — reimplemented locally, matching that component's
 * real markup/classes 1:1 (`table-action`/`inline-actions`/`action-icons`/
 * `action-dropdown`/`tooltip-name`, already globally styled by zyra's own
 * CSS, same as Recent Content's), rather than reused directly:
 * `TableRowActions` isn't exported from `@zyra/table`'s public API, and
 * `SeoIssuesByPageTable.tsx`'s own inline finding sub-rows need a `render`-
 * driven action column anyway (zyra `Table.tsx`'s variation-row rendering
 * path has no special case for `header.type === 'action'`, only the
 * parent-row path does) — so both tables use this same local component for
 * a consistent look either way.
 */
export const RowActionsMenu = ({ actions }: { actions: RowAction[] }) => {
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
