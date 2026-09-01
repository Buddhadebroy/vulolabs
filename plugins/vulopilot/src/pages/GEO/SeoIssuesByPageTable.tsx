/* global appLocalizer */
import React from 'react';
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { CardComponent, InformationItemComponent, ModuleGuardComponent, NoticeManager, SectionComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { SEO_ISSUE_QUERY_PARAM } from '../../services/seoIssueEditorTarget';
import {
	FindingSeverity,
	PRIORITY_SEVERITIES,
	Priority,
	PageRow,
	VisibilityCell,
	worstFinding,
	worstSeverity,
} from './seoIssuesShared';

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

/**
 * The fields of zyra TableCard's own internal query state this table reads
 * back out of its `onQueryUpdate` callback — same "declare our own subset
 * locally" workaround `useApiList.ts`'s own `TableCardQuery` already
 * documents (zyra's own published `QueryProps` type doesn't declare
 * `searchValue`, even though TableCard.tsx really does set it there — see
 * that hook's own docblock). Filtered/sorted client-side here (all rows are
 * already loaded into `rows`/`visibleRows`, not paginated from the server),
 * unlike `useApiList.ts`'s own server-side `search`/`orderby` params.
 * `orderby`/`order` mirror TableCard's own real header-click sort — the
 * `visibility_score` column's `isSortable: true` below is the only sortable
 * column this table has right now.
 */
interface TableCardQuery {
	searchValue?: string;
	orderby?: string;
	order?: string;
}

/** Same navigate-and-highlight deep link `post-editor/index.tsx` reads — deliberately NOT the existing in-place "Fix with AI" (RecentContentCard.tsx/FindingsTable.tsx/IssueDetailPanel.tsx's immediate AI-apply, which `SeoSiteWideIssuesTable.tsx` uses instead since its findings have no page to navigate to). This one takes the user to the editor, opens the "VuloPilot SEO" sidebar, and — where a mapping exists (seoIssueEditorTarget.ts) — switches to the right tab and highlights the specific field/checklist row, so they see exactly what to fix before anything is changed. */
const buildFixWithAiLink = (editLink: string, scannerId: string): string =>
	`${editLink}&${SEO_ISSUE_QUERY_PARAM}=${encodeURIComponent(scannerId)}`;

/**
 * zyra `Table.tsx`'s own expand/collapse state (`expandedRows`) is fully
 * internal — the only way to toggle it from outside is a real click on the
 * chevron `<i>` it renders itself inside `td.admin-column.expand` (see
 * that component's own source). Per direct instruction, that chevron is
 * hidden (`.seo-issues-by-page-card .admin-column.expand { display: none }`
 * in SeoVisibility.scss) and clicking anywhere else in a page row should
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
 * Same Title Case formatting the old standalone "Status" column used for
 * both a page's own `status` and a finding's `severity` (e.g.
 * 'in_progress' -> 'In Progress') — extracted so it can be reused for
 * InformationItemComponent's own `badges` prop on the title cell now that
 * Status is one of those badges rather than its own column.
 */
const formatStatusLabel = (value: string): string =>
	String(value)
		.toLowerCase()
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');

/**
 * Same "N issue(s)"/"No issues" badge the old standalone "Issues" column
 * used to build for a page row — extracted for the same reason as
 * formatStatusLabel above.
 */
const buildIssuesBadge = (
	rowFindings: PageRow['findings']
): { text: string; className: string } =>
	0 === rowFindings.length
		? { text: __('No issues', 'vulopilot'), className: 'badge-publish' }
		: {
				text: sprintf(
					_n('%d issue', '%d issues', rowFindings.length, 'vulopilot'),
					rowFindings.length
				),
				className: `badge-${worstSeverity(rowFindings)}`,
			};

interface SeoIssuesByPageTableProps {
	rows: PageRow[];
	activeScannerIds: 'all' | string[];
	/** IssuesSection.tsx's own real `IssuesSummaryCards` priority tile — `'all'`/`'high'`/`'medium'`/`'low'`, folded against each finding's own real severity via `PRIORITY_SEVERITIES`. */
	activePriority: Priority;
	scannerLabelMap: Map<string, string>;
	isLoading: boolean;
	hasError: boolean;
	onRetry: () => void;
	/** "SEO Issues" by default — IssuesSection.tsx's own AEO/GEO callers pass "AEO Issues"/"GEO Issues" so this column reads correctly for whichever real check set is showing. */
	issuesColumnLabel?: string;
	/** Only set when `IssuesSection.tsx` itself got a `pageAnalysis` prop (GeoTab.tsx/AeoTab.tsx) — adds the real deterministic visibility-% column, merging what used to be the standalone "Page-by-page analysis" table's own scope into this one. Undefined for SeoIssuesSection.tsx's own SEO usage, which never shows this column. */
	visibilityColumnLabel?: string;
	/** Only set alongside `visibilityColumnLabel` — shows a real "Export CSV" action in this card's header, same shape the old standalone table's own button used. */
	onExportCsv?: () => void;
	/** Only set by `SeoIssuesSection.tsx`'s own SEO usage — adds a real "Analyze" row action opening SeoTab.tsx's own PageAnalysisPanel for that page. `undefined` for AeoTab.tsx's/GeoTab.tsx's own `pageAnalysis` usage, which has no such panel. */
	onAnalyze?: (postId: number) => void;
}

/**
 * Page/post-wise table — the other of the two real tables that replace the
 * old combined "All SEO Issues" card, split apart per direct instruction.
 * Purely presentational for its data: `rows` comes from
 * `SeoIssuesSection.tsx`'s own single fetch (client-side-joined onto real
 * `wp/v2/posts`/`pages` rows there, same technique `RecentContentCard.tsx`
 * already established for "Content → Recent Content") — this table only
 * renders it, filtered by `activeScannerIds`. No local mutation happens
 * here: "Fix with AI"/"Edit"/"View" all navigate/open rather than change
 * data, so there's nothing to optimistically remove.
 *
 * Deliberately does NOT reuse SectionedIssuesTable.tsx (grouped by issue
 * type) — that component is shared, as-is, by Security/Accessibility/
 * Performance and must keep working unchanged; this is a new, separate
 * component.
 *
 * The visibility-score column (`visibility_score`, only rendered when
 * `visibilityColumnLabel` is set — i.e. GeoTab.tsx's/AeoTab.tsx's own
 * "AI Visibility"/"Answer Readiness" usage) is real-sortable
 * (`isSortable: true`, direct instruction: "sort option beside AI
 * Visibility"). zyra `Table.tsx` itself never resorts `rows` on a header
 * click — it only flips that header's own arrow icon and reports the new
 * `orderby`/`order` back out via `onQueryUpdate` — so `sortBy`/`sortOrder`
 * state here actually reorders `visibleRows` before it's handed to
 * `TableCard`, same "read TableCard's own query back out" pattern this
 * table's `searchValue` already established. Rows with no real score
 * (`null`/`undefined`, `VisibilityCell`'s own "—" case) always sort last,
 * in either direction.
 *
 * Row expansion uses zyra `TableCard`'s own native `expandable` prop
 * (`row.variation: FindingRow[]`) rather than an absolute-positioned
 * popover — clicking a page's issue count reveals its findings as real
 * inline sub-rows directly beneath it in the table (chevron hidden, whole
 * row is the click target), not a floating panel. Expand/collapse state
 * itself is fully internal to zyra's `Table` component — nothing to track
 * here.
 */
const SeoIssuesByPageTable = ({
	rows,
	activeScannerIds,
	activePriority,
	scannerLabelMap,
	isLoading,
	hasError,
	onRetry,
	issuesColumnLabel = __('SEO Issues', 'vulopilot'),
	visibilityColumnLabel,
	onExportCsv,
	onAnalyze,
}: SeoIssuesByPageTableProps) => {
	/** This table's OWN "Search pages…" box (TableCard's built-in search, filtering by PAGE title). */
	const [searchValue, setSearchValue] = useState('');
	/** This table's OWN sort state, read back out of TableCard's `onQueryUpdate` (same callback `searchValue` above already uses) — only ever `'visibility_score'` right now, the one sortable column. `null` until the header is clicked once. */
	const [sortBy, setSortBy] = useState<string | null>(null);
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

	/**
	 * The category tab bar/priority stat cards (both owned by
	 * IssuesSection.tsx) narrow which PAGES appear (`rowMatchesFilter`
	 * below), but every render that shows a row's OWN issues — the "N
	 * issues" badge, the expanded sub-rows, "Fix with AI"'s target — must
	 * narrow to the SAME matching findings too. Earlier versions of this
	 * table always used the full, unfiltered `row.findings` there, so e.g.
	 * filtering to "Thin Content" correctly hid pages with no thin-content
	 * finding, but a page that matched still showed its full issue
	 * count/list (SEO, images, etc. all mixed in) instead of isolating to
	 * the one that matched the filter — the reported bug, confirmed live (a
	 * "Thin Content" filter still showed "18 issues"/"34 issues" badges).
	 *
	 * `isAnyFilterActive` is what keeps a merged-in page with zero findings
	 * (GeoTab.tsx's/AeoTab.tsx's own `pageAnalysis` mode) visible under the
	 * true baseline "nothing filtered" state — once any real filter is
	 * active, a page needs at least one matching finding to stay visible,
	 * same as before this priority dimension existed.
	 */
	const isAnyFilterActive = 'all' !== activeScannerIds || 'all' !== activePriority;

	const findingMatchesActiveFilters = (finding: PageRow['findings'][number]): boolean =>
		('all' === activeScannerIds || activeScannerIds.includes(finding.scanner_id)) &&
		('all' === activePriority || PRIORITY_SEVERITIES[activePriority].includes(finding.severity));

	const getRowFindings = (row: PageRow) =>
		isAnyFilterActive ? row.findings.filter(findingMatchesActiveFilters) : row.findings;

	const buildVariationRows = (row: PageRow): FindingRow[] =>
		getRowFindings(row).map((finding) => ({
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

	const rowMatchesFilter = (row: PageRow): boolean =>
		!isAnyFilterActive || getRowFindings(row).length > 0;

	const rowMatchesSearch = (row: PageRow): boolean =>
		'' === searchValue.trim() ||
		row.title.toLowerCase().includes(searchValue.trim().toLowerCase());

	/**
	 * `Table.tsx` itself never resorts `rows` — clicking a sortable header
	 * only flips its own arrow icon and reports the new `orderby`/`order`
	 * back out via `onQueryUpdate` (confirmed by reading zyra's own
	 * `Table.tsx` source); the actual reordering is left to whoever owns the
	 * data, same as `searchValue` above. Missing scores (`null`/`undefined`,
	 * `VisibilityCell`'s own "—" case) always sort to the end regardless of
	 * direction — there's no real percentage to rank them by.
	 */
	const sortRowsByVisibility = (unsorted: PageRow[]): PageRow[] => {
		if ('visibility_score' !== sortBy) {
			return unsorted;
		}

		const direction = 'asc' === sortOrder ? 1 : -1;

		return [...unsorted].sort((a, b) => {
			const scoreA = a.visibilityScore;
			const scoreB = b.visibilityScore;

			if (null == scoreA && null == scoreB) {
				return 0;
			}
			if (null == scoreA) {
				return 1;
			}
			if (null == scoreB) {
				return -1;
			}

			return (scoreA - scoreB) * direction;
		});
	};

	const visibleRows = sortRowsByVisibility(
		rows.filter((row) => rowMatchesFilter(row) && rowMatchesSearch(row))
	);

	const handleFixWithAi = (row: PageRow) => {
		const rowFindings = getRowFindings(row);
		const scannerIds = Array.from(new Set(rowFindings.map((finding) => finding.scanner_id)));
		const primary = 1 === scannerIds.length ? rowFindings[0] : worstFinding(rowFindings);

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
			<CardComponent title={__('Pages & Posts', 'vulopilot')} titleIcon="error">
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load these issues', 'vulopilot')}
					desc={__(
						'Something went wrong fetching this data. Please try again.',
						'vulopilot'
					)}
				/>
				<ButtonInput
					buttons={{
						text: __('Retry', 'vulopilot'),
						icon: 'update',
						onClick: onRetry,
					}}
				/>
			</CardComponent>
		);
	}

	return (
		<>
			<SectionComponent
				title={__('Pages & Posts', 'vulopilot')}
				desc={__('Findings from your most recent scans, grouped by check.', 'vulopilot')}
			/>
			{/*
			 * The "nice work, nothing to fix" empty state only replaces the
			 * whole card when there's truly nothing to show *and* no active
			 * search — swapping out the real `<TableCard>` for a search-in-
			 * progress query would take the search box (rendered by
			 * TableCard itself, not this component) down with it, leaving
			 * someone who searched away every row with no way to see or
			 * clear what they typed. A search that matches nothing instead
			 * falls through to TableCard's own `emptyMessage` below, which
			 * keeps the search box live.
			 */}
			{!isLoading && 0 === visibleRows.length && '' === searchValue.trim() ? (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing here right now', 'vulopilot')}
					desc={
						!isAnyFilterActive
							? sprintf(
									/* translators: %s: e.g. "SEO", "AEO", "GEO" — issuesColumnLabel with " Issues" stripped off. */
									__(
										'No open %s issues on any page or post right now — nice work.',
										'vulopilot'
									),
									issuesColumnLabel.replace(/ Issues$/, '')
								)
							: __(
									'No pages or posts currently have this specific issue.',
									'vulopilot'
								)
					}
				/>
			) : (
				<TableCard
					showMenu={false}
					expandable
					hideHeader
					className="transparent-table"
					search={{ placeholder: __('Search pages…', 'vulopilot') }}
					buttonActions={
						onExportCsv
							? [
									{
										label: __('Export CSV', 'vulopilot'),
										icon: 'download',
										onClick: onExportCsv,
									},
								]
							: undefined
					}
					onQueryUpdate={(query: TableCardQuery) => {
						setSearchValue(query.searchValue ?? '');
						setSortBy(query.orderby || null);
						setSortOrder('asc' === query.order ? 'asc' : 'desc');
					}}
					headers={{
						title: {
							label: __('Page', 'vulopilot'),
							width: '65%',
							/**
							 * Status and Issues used to be their own columns —
							 * consolidated here as InformationItemComponent's own
							 * `badges` prop instead (per direct instruction), same
							 * "title + badges, no separate status/category column"
							 * shape IssuesList.tsx's own issue rows already use.
							 */
							render: (row: TableRow) =>
								isFindingRow(row) ? (
									<div className="seo-issues-finding-title">
										<span className="seo-issues-finding-arrow">
											↳
										</span>
										<InformationItemComponent
											title={row.title}
											badges={[
												{
													text: formatStatusLabel(row.severity),
													className: `badge-${row.severity}`,
												},
												{
													text: row.scannerLabel,
													className: 'badge-info',
												},
											]}
										/>
									</div>
								) : (
									<div
										className="seo-issues-row-expand-trigger"
										onClick={toggleRowExpansion}
									>
										<InformationItemComponent
											title={row.title || __('(no title)', 'vulopilot')}
											titleLink={row.editLink}
											badges={[
												{
													text: formatStatusLabel(row.status),
													className: `badge-${String(row.status).toLowerCase()}`,
												},
												buildIssuesBadge(getRowFindings(row)),
											]}
											descriptions={[
												{
													icon: 'calendar',
													label: __('Updated', 'vulopilot'),
													value: new Date(row.date).toLocaleDateString(),
												},
											]}
										/>
									</div>
								),
						},
						...(visibilityColumnLabel
							? {
									visibility_score: {
										label: visibilityColumnLabel,
										width: '3rem',
										isSortable: true,
										render: (row: TableRow) =>
											isFindingRow(row) ? null : (
												<span
													className="seo-issues-row-expand-trigger"
													onClick={toggleRowExpansion}
												>
													<VisibilityCell
														score={row.visibilityScore}
													/>
												</span>
											),
									},
								}
							: {}),
						action: {
							label: __('Action', 'vulopilot'),
							// Native `type: 'action'` + `type: 'button'`
							// actions (TableRowActions.tsx) instead of a
							// hand-built `<BadgeComponent>` in `render` —
							// same real Analyze/Fix with AI/Edit/View
							// actions. Analyze/Fix with AI only apply to some
							// rows (a finding sub-row has no post of its own
							// to "Analyze"; a merged page row can legitimately
							// have zero matching findings for "Fix with AI"
							// to open) — `hidden` (zyra's own real per-row
							// action visibility, added for this conversion)
							// drops them from THIS row's action list
							// entirely, rather than a disabled/no-op button
							// standing in for "not applicable here".
							type: 'action',
							actions: [
								{
									type: 'button',
									label: __('Analyze', 'vulopilot'),
									
									icon: 'search',
									hidden: (row) =>
										!onAnalyze ||
										isFindingRow(row as unknown as TableRow),
									onClick: (row) =>
										onAnalyze?.(
											(row as unknown as PageRow).id
										),
								},
								
								{
									type: 'button',
									label: __('Edit', 'vulopilot'),
									color: 'text-green',
									icon: 'edit',
									onClick: (row) => {
										window.location.href = (
											row as unknown as TableRow
										).editLink;
									},
								},
								{
									type: 'button',
									label: __('View', 'vulopilot'),
									color: 'text-blue',
									icon: 'eye',
									onClick: (row) => {
										const typedRow = row as unknown as TableRow;
										if (typedRow.viewLink) {
											window.open(
												typedRow.viewLink,
												'_blank',
												'noreferrer'
											);
										}
									},
								},
								{
									type: 'button',
									label: __('Fix with AI', 'vulopilot'),
									color: 'orange-bg',
									icon: 'ai',
									hidden: (row) => {
										const typedRow = row as unknown as TableRow;
										return (
											!isFindingRow(typedRow) &&
											0 === getRowFindings(typedRow).length
										);
									},
									onClick: (row) => {
										const typedRow = row as unknown as TableRow;
										if (isFindingRow(typedRow)) {
											window.location.href = typedRow.fixWithAiLink;
										} else {
											handleFixWithAi(typedRow);
										}
									},
								},
							],
						},
					}}
					rows={visibleRows.map((row) => ({
						...row,
						variation: buildVariationRows(row),
					}))}
					ids={visibleRows.map((row) => row.id)}
					totalRows={visibleRows.length}
					isLoading={isLoading}
					emptyMessage={
						'' !== searchValue.trim()
							? sprintf(
									/* translators: %s: the search text typed into the "Search pages…" box above. */
									__('No pages or posts match "%s".', 'vulopilot'),
									searchValue.trim()
								)
							: __('No pages or posts match this filter.', 'vulopilot')
					}
				/>
			)}
		</>
	);
};

export default SeoIssuesByPageTable;
