/* global appLocalizer */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { TabsComponent } from '@zyra/components';
import IssuesSummaryCards, { Priority } from '../AIAssistant/IssuesSummaryCards';
import {
	PRIORITY_SEVERITIES,
	PageRow,
	RawFinding,
	bucketFindingsByPage,
	buildEditLink,
	fetchAllPagesWithScores,
	fetchOpenFindingsFor,
	fetchPagesByIds,
	nonceHeaders,
} from './seoIssuesShared';
import SeoSiteWideIssuesTable from './SeoSiteWideIssuesTable';
import SeoIssuesByPageTable from './SeoIssuesByPageTable';

interface FindingGroupRow {
	scanner_id: string;
	label: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	count: number;
}

export interface IssuesSectionCategory {
	key: string;
	title: string;
	scannerIds: string[];
}

/** `GET /findings/groups`' own raw per-scanner counts, summed across whichever scanner ids matter for a given tab/tile — same convention (and the same real duplicate-row caveat) `SectionedIssuesTable.tsx`'s own local copy already documents; kept here rather than shared so this file doesn't reach into Security's own module for one helper. */
const sumGroupCounts = (groups: FindingGroupRow[], scannerIds: string[]): number =>
	groups
		.filter((group) => scannerIds.includes(group.scanner_id))
		.reduce((total, group) => total + group.count, 0);

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
	/**
	 * When set, this section also becomes GeoTab.tsx's/AeoTab.tsx's own
	 * standalone "Page-by-page analysis"/"Page-by-Page Answer Readiness"
	 * table, merged into "Pages & Posts" per direct instruction rather than
	 * showing the same pages twice: every published page/post (not just
	 * ones with an open finding right now) via `GET /geo-analysis/pages`,
	 * with a real deterministic visibility % column and an Export CSV
	 * action. Omitted entirely by `SeoIssuesSection.tsx`'s own SEO usage,
	 * which keeps its original findings-only scope (only pages that
	 * actually have an open SEO finding, no visibility column, no export).
	 */
	pageAnalysis?: {
		/** Defaults to "AI Visibility". */
		scoreColumnLabel?: string;
		/** Defaults to 'page-analysis.csv'. */
		exportFilename?: string;
	};
	/**
	 * Real `scrollToId()` target for GeoTab.tsx's/AeoTab.tsx's own "View
	 * all"/"View page-by-page breakdown" shortcuts — applied directly to
	 * this section's own root `<div>` rather than left for the host tab to
	 * wrap in its own `<div id="...">`. That wrapping was a real,
	 * confirmed-live layout bug: this section's own outer `.seo-issues-section`
	 * already fills its flex-row parent (see SeoVisibility.scss's own rule
	 * for that class), but an *extra* unstyled wrapper div around it becomes
	 * the actual flex-item instead, and — having no sizing of its own —
	 * only claims its content's natural width, leaving the rest of that row
	 * empty. SeoTab.tsx's own usage never had this problem since it renders
	 * `<SeoIssuesSection>` with no such wrapper.
	 */
	id?: string;
	/** Only passed by `SeoIssuesSection.tsx`'s own SEO usage — see `SeoIssuesByPageTable.tsx`'s own `onAnalyze` prop docblock. */
	onAnalyze?: (postId: number) => void;
}

/**
 * Generalized from `SeoIssuesSection.tsx` (now a thin SEO-defaults wrapper
 * around this) per direct instruction — AEO's and GEO's own "All Issues"
 * tables should have the exact same real structure SEO's already has, not
 * the differently-shaped `SectionedFindingsTab.tsx` those two tabs used
 * before — see AeoTab.tsx's/GeoTab.tsx's own docblocks for exactly what
 * this replaced there. The filter bar itself was rebuilt a *third* time
 * (direct instruction — "I want the table filters like this", pointing at
 * a screenshot of `SectionedIssuesTable.tsx`'s own real filter bar, the
 * same component Security/Accessibility/WooCommerce's own unified issues
 * tables already use): a real `TabsComponent` All/Important/one-per-category
 * tab row, plus `IssuesSummaryCards.tsx` (reused as-is — genuinely generic,
 * no AI-Assistant-specific coupling) for the All Issues/High/Medium/Low
 * priority stat cards, replacing this file's own second version (a search
 * box + a category `<select>` + individual severity pills) so this
 * section's own filter bar matches that established, already-styled
 * pattern exactly rather than a bespoke one. Free-text search and 5-level
 * (not 3-tier-folded) severity are a real loss from that second version —
 * nothing in the reference screenshot has either, so neither survived this
 * pass; say so if you want free-text search back alongside this.
 * `GeoFixTheseFirstCard.tsx`'s/`GeoByTopicGrid.tsx`'s own "View
 * pages"/"View issues" shortcuts still only ever resolve up to a *category*
 * key (see GeoTab.tsx's own `onSelectScanner`), never a bare scanner id, so
 * per-scanner-only filtering remains something nothing here has ever
 * needed.
 *
 * Orchestrates the two real tables `SeoSiteWideIssuesTable.tsx`/
 * `SeoIssuesByPageTable.tsx` render side by side: one real fetch+bucket
 * (findings → `{byPostId, siteWide}` → `rows`) both tables render, passed
 * down as props. The tab bar's/stat cards' own counts are deliberately the
 * raw `GET /findings/groups` counts (`sumGroupCounts()`), not a recount
 * from that bucketed data — same convention (and the same real
 * duplicate-scan-row caveat) `SectionedIssuesTable.tsx`'s own identical tab
 * bar/stat cards already accept, kept consistent here rather than more
 * precise but visually inconsistent with that reference.
 *
 * `categoryFocus` lets the host tab's own topic tiles/"Fix These
 * First"/"View All" shortcuts drive this section from outside: a fresh
 * `{key, token}` (a new `token` even for the same `key` twice in a row, so
 * re-clicking the same tile still re-triggers the scroll+filter) switches
 * the active tab to that category (via `categories`) and scrolls this
 * section into view — `key: 'all'` is the one case with no matching
 * category (resets back to the "All" tab instead of filtering to nothing),
 * which only AEO's/GEO's own "View All"/"Fix Automatically" shortcuts ever
 * pass; no SEO category tile does today.
 */
const IssuesSection = ({
	scannerIds,
	categories = [],
	categoryFocus,
	issuesColumnLabel,
	pageAnalysis,
	id,
	onAnalyze,
}: IssuesSectionProps) => {
	const [rows, setRows] = useState<PageRow[]>([]);
	const [siteWideFindings, setSiteWideFindings] = useState<RawFinding[]>([]);
	const [groups, setGroups] = useState<FindingGroupRow[]>([]);
	const [activeTab, setActiveTab] = useState('all');
	const [activePriority, setActivePriority] = useState<Priority>('all');
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

				let builtRows: PageRow[];

				if (pageAnalysis) {
					// Merged mode (GeoTab.tsx/AeoTab.tsx): every published
					// page/post, not just ones with an open finding right
					// now — same real dataset the old standalone
					// "Page-by-page analysis" table showed.
					const pages = await fetchAllPagesWithScores(scannerIds);

					builtRows = pages.map((page) => ({
						id: page.post_id,
						title: page.title,
						status: page.status,
						date: page.date,
						editLink: page.edit_link,
						viewLink: 'publish' === page.status ? page.permalink : null,
						findings: byPostId.get(page.post_id) || [],
						visibilityScore: page.visibility_score,
					}));
				} else {
					const pageIds = Array.from(byPostId.keys());

					const [posts, pages] = await Promise.all([
						fetchPagesByIds('posts', pageIds),
						fetchPagesByIds('pages', pageIds),
					]);

					builtRows = [...posts, ...pages].map((post) => ({
						id: post.id,
						title: post.title.rendered,
						status: post.status,
						date: post.date,
						editLink: buildEditLink(post.id),
						viewLink: 'publish' === post.status ? post.link : null,
						findings: byPostId.get(post.id) || [],
					}));
				}

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

		setActiveTab(categoryFocus.key);
		sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		// Only a fresh external trigger (a new `token` each time) should
		// re-trigger this — not every re-render that happens to pass a new
		// `categoryFocus` object reference.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [categoryFocus?.token]);

	// Resets the priority filter whenever the active tab changes, whether it
	// changed via a click on this section's own tab bar or an external
	// deep-link (the effect above) — same reasoning SectionedIssuesTable.tsx's
	// own identical reset already documents: a stale "High" priority filter
	// left over from a previous tab could otherwise silently hide every row
	// of a tab someone just switched to.
	useEffect(() => {
		setActivePriority('all');
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeTab]);

	const refetch = () => setReloadToken((current) => current + 1);

	/** Same CSV shape the old standalone `GeoPageAnalysisTable.tsx` exported — kept identical (header row + escaping) so nothing about the exported file itself changes for anyone already relying on it, just where the button now lives. `undefined` (not called) unless `pageAnalysis` is set. */
	const exportCsv = pageAnalysis
		? () => {
				const scoreLabel = pageAnalysis.scoreColumnLabel || __('AI Visibility', 'vulopilot');
				const csvEscape = (value: string): string => `"${value.replace(/"/g, '""')}"`;
				const headerRow = ['Page', 'Status', 'Open Issues', `${scoreLabel} (%)`];
				const lines = [headerRow.map(csvEscape).join(',')];

				rows.forEach((row) => {
					const cells = [
						row.title,
						row.status,
						row.findings.length,
						row.visibilityScore ?? '',
					];
					lines.push(cells.map((cell) => csvEscape(String(cell))).join(','));
				});

				const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
				const url = URL.createObjectURL(blob);
				const anchor = document.createElement('a');
				anchor.href = url;
				anchor.download = pageAnalysis.exportFilename || 'page-analysis.csv';
				anchor.click();
				URL.revokeObjectURL(url);
			}
		: undefined;

	/** The expanded finding sub-rows' own scanner label (SeoIssuesByPageTable.tsx). */
	const scannerLabelMap = new Map(groups.map((group) => [group.scanner_id, group.label]));

	/** Every real scanner id within this section's own scope whose real severity is critical/high — same "Important" concept, same fold, SectionedIssuesTable.tsx's own tab bar already establishes. */
	const importantScannerIds = groups
		.filter(
			(group) =>
				scannerIds.includes(group.scanner_id) &&
				('critical' === group.severity || 'high' === group.severity)
		)
		.map((group) => group.scanner_id);

	/** All/Important/one per real `categories` entry — same real tab bar shape (and the same raw `GET /findings/groups` counts) SectionedIssuesTable.tsx's own Security/Accessibility/WooCommerce usage already establishes, reused here per direct instruction so this section's own filter bar matches that one exactly. */
	const tabs: { id: string; label: string; count: number }[] = [
		{ id: 'all', label: __('All', 'vulopilot'), count: sumGroupCounts(groups, scannerIds) },
		{
			id: 'important',
			label: __('Important', 'vulopilot'),
			count: sumGroupCounts(groups, importantScannerIds),
		},
		...categories.map((category) => ({
			id: category.key,
			label: category.title,
			count: sumGroupCounts(groups, category.scannerIds),
		})),
	];

	const scannerIdsForTab: Record<string, string[]> = {
		all: scannerIds,
		important: importantScannerIds,
	};
	categories.forEach((category) => {
		scannerIdsForTab[category.key] = category.scannerIds;
	});

	/** Resolves the active tab (`'all'`/`'important'`/a real `categories[].key`) down to the concrete scanner ids both tables — and the priority stat cards below — scope to. */
	const activeScannerIds: 'all' | string[] =
		'all' === activeTab ? 'all' : (scannerIdsForTab[activeTab] ?? []);

	const tabGroups = groups.filter(
		(group) => 'all' === activeScannerIds || activeScannerIds.includes(group.scanner_id)
	);

	const countByPriority = (priority: Exclude<Priority, 'all'>): number =>
		tabGroups
			.filter((group) => PRIORITY_SEVERITIES[priority].includes(group.severity))
			.reduce((total, group) => total + group.count, 0);

	const priorityCounts = {
		high: countByPriority('high'),
		medium: countByPriority('medium'),
		low: countByPriority('low'),
	};
	const activeTabTotal = tabGroups.reduce((total, group) => total + group.count, 0);

	return (
		<>
			<TabsComponent
				className="seo-issues-filter-tabs"
				activeIndex={Math.max(
					tabs.findIndex((tab) => tab.id === activeTab),
					0
				)}
				onTabChange={(index: number) => setActiveTab(tabs[index].id)}
				tabs={tabs.map((tab) => ({
					label: sprintf('%1$s (%2$d)', tab.label, tab.count),
				}))}
			/>
			<IssuesSummaryCards
				total={activeTabTotal}
				priorityCounts={priorityCounts}
				isLoading={isLoading}
				activePriority={activePriority}
				onSelectPriority={setActivePriority}
			/>
			<SeoSiteWideIssuesTable
				findings={siteWideFindings}
				activeScannerIds={activeScannerIds}
				activePriority={activePriority}
				isLoading={isLoading}
				hasError={hasError}
				onRetry={refetch}
			/>
			<SeoIssuesByPageTable
				rows={rows}
				activeScannerIds={activeScannerIds}
				activePriority={activePriority}
				scannerLabelMap={scannerLabelMap}
				isLoading={isLoading}
				hasError={hasError}
				onRetry={refetch}
				issuesColumnLabel={issuesColumnLabel}
				visibilityColumnLabel={pageAnalysis?.scoreColumnLabel || (pageAnalysis ? __('AI Visibility', 'vulopilot') : undefined)}
				onExportCsv={exportCsv}
				onAnalyze={onAnalyze}
			/>
		</>
	);
};

export default IssuesSection;
