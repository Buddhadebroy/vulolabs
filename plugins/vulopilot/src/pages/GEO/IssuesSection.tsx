/* global appLocalizer */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { TabsComponent } from '@zyra/components';
import {
	PageRow,
	RawFinding,
	bucketFindingsByPage,
	buildEditLink,
	fetchOpenFindingsFor,
	fetchPagesByIds,
	nonceHeaders,
} from './seoIssuesShared';
import SeoSiteWideIssuesTable from './SeoSiteWideIssuesTable';
import SeoIssuesByPageTable from './SeoIssuesByPageTable';

interface FindingGroupRow {
	scanner_id: string;
	label: string;
	count: number;
}

export interface IssuesSectionCategory {
	key: string;
	scannerIds: string[];
}

interface CategoryFocus {
	/** A real category `key` from `categories`, or the literal `'all'` to reset back to the unfiltered view — same "View All" case the AEO/GEO tiles' own "View All"/"Fix Automatically" shortcuts need, which no SEO call site exercises today (every SEO category tile passes its own real key). */
	key: string;
	token: number;
}

interface IssuesSectionProps {
	/** Every real scanner id this section covers — `SeoTab.tsx` passes SEO_SECTIONS' own ids, AeoTab.tsx/GeoTab.tsx pass their own AEO_SECTIONS/GEO_TOPICS ids. Drives both the findings fetch and the filter pills' own scope. */
	scannerIds: string[];
	/** Only needed if `categoryFocus` is ever set to a real category key (not just `'all'`) — resolves that key down to its own scannerIds, same role `SEO_SECTIONS` plays for SeoTab.tsx's own category tiles. */
	categories?: IssuesSectionCategory[];
	categoryFocus?: CategoryFocus | null;
	/** "SEO Issues" by default — AeoTab.tsx/GeoTab.tsx pass "AEO Issues"/"GEO Issues" so the Pages & Posts table's own issues-count column reads correctly for whichever real check set it's showing. */
	issuesColumnLabel?: string;
}

/**
 * Generalized from `SeoIssuesSection.tsx` (now a thin SEO-defaults wrapper
 * around this) per direct instruction — AEO's and GEO's own "All Issues"
 * tables should have the exact same real structure SEO's already has
 * (a per-scanner filter-pill tab bar, a "Site-wide Issues" table, and a
 * "Pages & Posts" table with real inline expandable findings), not the
 * differently-shaped `SectionedFindingsTab.tsx` those two tabs used before
 * — see AeoTab.tsx's/GeoTab.tsx's own docblocks for exactly what this
 * replaced there. Orchestrates the two real tables `SeoSiteWideIssuesTable.tsx`/
 * `SeoIssuesByPageTable.tsx` render side by side: one real fetch+bucket
 * (findings → `{byPostId, siteWide}` → `rows`) both tables render, passed
 * down as props, so the filter pills' own counts (recomputed from that
 * exact same deduped data) always match what clicking a pill actually
 * reveals — same reasoning `SeoIssuesSection.tsx`'s own original docblock
 * gave for centralizing the fetch here instead of each table fetching
 * independently.
 *
 * `categoryFocus` lets the host tab's own topic tiles/"Fix These
 * First"/"View All" shortcuts drive this section from outside: a fresh
 * `{key, token}` (a new `token` even for the same `key` twice in a row, so
 * re-clicking the same tile still re-triggers the scroll+filter) switches
 * the active filter to that category's real scanner ids (via `categories`)
 * and scrolls this section into view — `key: 'all'` is the one case with
 * no matching category (resets back to the unfiltered view instead of
 * filtering to nothing), which only AEO's/GEO's own "View All"/"Fix
 * Automatically" shortcuts ever pass; no SEO category tile does today.
 */
const IssuesSection = ({
	scannerIds,
	categories = [],
	categoryFocus,
	issuesColumnLabel,
}: IssuesSectionProps) => {
	const [rows, setRows] = useState<PageRow[]>([]);
	const [siteWideFindings, setSiteWideFindings] = useState<RawFinding[]>([]);
	const [groups, setGroups] = useState<FindingGroupRow[]>([]);
	const [activeFilter, setActiveFilter] = useState('all');
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);
	const [reloadToken, setReloadToken] = useState(0);
	const sectionRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setHasError(false);

		(async () => {
			try {
				const findings = await fetchOpenFindingsFor(scannerIds);
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
								new Date(b.date).getTime() - new Date(a.date).getTime()
						)
					);
					setSiteWideFindings(siteWide);
				}
			} catch {
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
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `scannerIds` is a fresh array every render from every real call site (inline `.flatMap()`/literal); re-running on its own reference would refetch every render. Callers never change which scanner ids a given tab covers at runtime, so `reloadToken` (Retry) is the only real trigger this needs.
	}, [reloadToken]);

	useEffect(() => {
		getApiResponse<{ data: FindingGroupRow[] }>(
			getApiLink(appLocalizer, 'findings/groups?per_page=100'),
			nonceHeaders
		)
			.then((response) =>
				setGroups(
					(response?.data ?? []).filter((group) =>
						scannerIds.includes(group.scanner_id)
					)
				)
			)
			.catch(() => setGroups([]));
		// eslint-disable-next-line react-hooks/exhaustive-deps -- see the fetch effect above.
	}, [reloadToken]);

	useEffect(() => {
		if (!categoryFocus) {
			return;
		}

		setActiveFilter(
			'all' === categoryFocus.key ? 'all' : `category:${categoryFocus.key}`
		);
		sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		// Only a fresh external trigger (a new `token` each time) should
		// re-trigger this — not every re-render that happens to pass a new
		// `categoryFocus` object reference.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [categoryFocus?.token]);

	const refetch = () => setReloadToken((current) => current + 1);

	/** Only used for each pill's human `label` now — see `realScannerCounts` below for why its own `count` isn't used directly. */
	const scannerLabelMap = new Map(groups.map((group) => [group.scanner_id, group.label]));

	/**
	 * Real, displayed-count-accurate per-scanner totals — deliberately NOT
	 * `group.count` from `GET /findings/groups`. That raw aggregate counts
	 * every open Finding row server-side, including the exact duplicate
	 * rows the pre-existing scan/rescan pipeline gap creates
	 * (`bucketFindingsByPage`'s own docblock in seoIssuesShared.tsx) —
	 * `SeoSiteWideIssuesTable.tsx` dedupes those before display, so a pill
	 * built from the raw count would show a bigger number than what's
	 * actually visible for site-wide-only scanners. Recomputed here from
	 * the exact same bucketed+deduped `rows`/`siteWideFindings` both
	 * tables render.
	 */
	const realScannerCounts = new Map<string, number>();
	siteWideFindings.forEach((finding) => {
		realScannerCounts.set(
			finding.scanner_id,
			(realScannerCounts.get(finding.scanner_id) || 0) + 1
		);
	});
	rows.forEach((row) =>
		row.findings.forEach((finding) => {
			realScannerCounts.set(
				finding.scanner_id,
				(realScannerCounts.get(finding.scanner_id) || 0) + 1
			);
		})
	);

	const totalOpenIssues = Array.from(realScannerCounts.values()).reduce(
		(total, count) => total + count,
		0
	);

	const filterPills: { id: string; label: string; count: number }[] = [
		{ id: 'all', label: __('All', 'vulopilot'), count: totalOpenIssues },
		...groups.map((group) => ({
			id: `scanner:${group.scanner_id}`,
			label: group.label,
			count: realScannerCounts.get(group.scanner_id) || 0,
		})),
	];

	/** Resolves the active filter (`'all'`, `scanner:<id>`, or `category:<key>`) down to the concrete scanner ids both tables filter their findings by. */
	const activeScannerIds: 'all' | string[] = (() => {
		if ('all' === activeFilter) {
			return 'all';
		}

		if (activeFilter.startsWith('category:')) {
			const key = activeFilter.slice('category:'.length);
			const category = categories.find((candidate) => candidate.key === key);
			return category ? category.scannerIds : [];
		}

		return [activeFilter.slice('scanner:'.length)];
	})();

	return (
		<div className="seo-issues-section" ref={sectionRef}>
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

			<SeoSiteWideIssuesTable
				findings={siteWideFindings}
				activeScannerIds={activeScannerIds}
				isLoading={isLoading}
				hasError={hasError}
				onRetry={refetch}
			/>
			<SeoIssuesByPageTable
				rows={rows}
				activeScannerIds={activeScannerIds}
				scannerLabelMap={scannerLabelMap}
				isLoading={isLoading}
				hasError={hasError}
				onRetry={refetch}
				issuesColumnLabel={issuesColumnLabel}
			/>
		</div>
	);
};

export default IssuesSection;
