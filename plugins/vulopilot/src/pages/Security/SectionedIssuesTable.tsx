/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	ColumnComponent,
	ContainerComponent,
	InformationItemComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { TableCard } from '@zyra/table';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import { CATEGORY_LABELS, formatAffected } from '../AIAssistant/issuesTypes';
import IssuesSummaryCards, { Priority } from '../AIAssistant/IssuesSummaryCards';
import IssueDetailPanel from '../AIAssistant/IssueDetailPanel';
import ProLockedCard from '../../components/ProLockedCard';
import type { FindingsSection } from './SectionedFindingsTab';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

const PER_PAGE = 10;

/** Real sum of `.count` across every group whose scanner_id is in `scannerIds` — same technique useWooCommerceFindingGroups.ts's own `sumGroupCounts()` already established. */
const sumGroupCounts = (groups: FindingGroup[], scannerIds: string[]): number =>
	groups
		.filter((group) => scannerIds.includes(group.scanner_id))
		.reduce((total, group) => total + group.count, 0);

/** Worst-severity-first, ties broken by real affected count — same ORDER BY FindingRepository::get_finding_groups() itself uses server-side, reproduced client-side since this component paginates the already-fetched group list rather than re-querying per page. */
const SEVERITY_RANK: Record<FindingGroup['severity'], number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
	info: 4,
};

/** Same 3-tier critical→high/info→low fold Findings.php's own `PRIORITY_SEVERITY_RANKS` uses for `GET /findings/groups`' `priority` param — reproduced client-side since this component filters/counts an already-fetched group list rather than re-querying per priority tier. */
const PRIORITY_SEVERITIES: Record<Exclude<Priority, 'all'>, FindingGroup['severity'][]> = {
	high: ['critical', 'high'],
	medium: ['medium'],
	low: ['low', 'info'],
};

export type SectionedIssuesTab = 'all' | 'important' | string;

interface SectionedIssuesTableProps {
	/** DOM anchor id for the whole merged table — what a "Review Issues"-style button elsewhere on the tab scrolls to. */
	id: string;
	/** Card title, e.g. "All Security Issues". */
	title: string;
	sections: FindingsSection[];
	/**
	 * The full real scope of "All", when it's wider than the union of
	 * `sections`' own scanner ids — Security's own 4 named sections
	 * (Login & Accounts/Website Exposure/Browser Protection/SSL & Secure
	 * Connection) don't cover every scanner SecurityTab.tsx's own
	 * `SECURITY_FINDINGS_SCANNER_IDS` counts (e.g. `core-file-integrity`
	 * has no dedicated section of its own, same reason this tab's old
	 * catch-all "Security Findings" section used to exist). Omit when `sections`' own union
	 * genuinely already is everything (Site Health/Files & Plugins/
	 * Accessibility, whose hero cards already compute their own totals the
	 * same union way — see SiteHealthTab.tsx's/FilesPluginsTab.tsx's own
	 * `ALL_SCANNER_IDS`).
	 */
	allScannerIds?: string[];
	activeTab: SectionedIssuesTab;
	onTabChange: (tab: SectionedIssuesTab) => void;
}

/**
 * One real, unified issues table — same design as AI Copilot's own
 * "Issues" tab (src/pages/AIAssistant/IssuesList.tsx), adapted here per
 * direct instruction: real `GET /findings/groups` rows (one row per issue
 * *type* — "8 images are missing alt text" is one row for 8 real
 * findings, not 8 rows), a real Total/High/Medium/Low priority filter
 * (IssuesSummaryCards.tsx, reused as-is — fully generic, no AI-Assistant-
 * specific coupling), and a real side detail panel (IssueDetailPanel.tsx,
 * also reused as-is) with "Fix with AI"/"Resolve all"/"Ignore all" bulk
 * actions scoped to the selected group, instead of FindingsTable's own
 * one-row-per-individual-finding grid with inline per-row Fix/Resolve/
 * Ignore/Reopen/Snooze actions. That per-row/bulk-select functionality is
 * intentionally traded away here for design parity with the reference
 * page — per-group bulk actions in the side panel already cover the same
 * ground (act on every open finding in a group at once).
 *
 * The scanner_id-based category tab bar above the table (All/Important/
 * one per `sections` entry) stays this component's own existing,
 * already-correct `activeTab`/`onTabChange` wiring rather than switching
 * to TableCard's native `categoryCounts` click mechanism — IssuesList.tsx's
 * own version of that mechanism is wired up cosmetically
 * (`activeCategory`/`categoryCounts` render the pill bar) but its
 * `onQueryUpdate` handler never actually reads the `categoryFilter` field
 * TableCard would hand back on a click, so category-switching there
 * doesn't reliably drive a real refetch. Reproducing that same disconnect
 * here would trade a working interaction for a broken-looking one just to
 * match a pill shape, so this keeps its own controlled state instead
 * (still needed anyway for cross-component deep-links like
 * VulnerabilitiesFoundCard's row clicks).
 *
 * Deliberately fetches `GET /findings/groups` once, with no `category`
 * filter, and does every category/priority/pagination slice client-side
 * against that one result — several of Security's own scanners have a raw
 * `category` column that isn't literally `security` (RestApiScanner is
 * `rest-api`, SslMonitoringScanner is `ssl`), and the real total group
 * count site-wide (~40) is small enough that one broad fetch plus
 * client-side slicing is simpler and cheaper than real server-side paging
 * across every possible category/priority/scanner_id combination.
 */
const SectionedIssuesTable = ({
	id,
	title,
	sections,
	allScannerIds: allScannerIdsProp,
	activeTab,
	onTabChange,
}: SectionedIssuesTableProps) => {
	const [groups, setGroups] = useState<FindingGroup[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [reloadToken, setReloadToken] = useState(0);
	const [activePriority, setActivePriority] = useState<Priority>('all');
	const [paged, setPaged] = useState(1);
	const [selectedGroup, setSelectedGroup] = useState<FindingGroup | null>(
		null
	);

	useEffect(() => {
		setIsLoading(true);
		getApiResponse<{ data: FindingGroup[] }>(
			getApiLink(appLocalizer, 'findings/groups?per_page=200'),
			nonceHeaders
		)
			.then((response) => setGroups(response?.data ?? []))
			.finally(() => setIsLoading(false));
	}, [reloadToken]);

	const refetch = () => setReloadToken((current) => current + 1);

	// Resets the priority filter/pagination/selection whenever the active
	// tab changes, regardless of whether it changed via a click on this
	// component's own tab bar or an external deep-link (e.g.
	// AccessibilityChecksGrid.tsx's per-tile "Review" button calling the
	// parent's own setActiveTab directly) — a stale "High" priority filter
	// left over from a previous tab could otherwise silently hide every row
	// of a tab a user just jumped to from elsewhere on the page.
	useEffect(() => {
		setActivePriority('all');
		setPaged(1);
		setSelectedGroup(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeTab]);

	const allScannerIds =
		allScannerIdsProp ??
		Array.from(new Set(sections.flatMap((section) => section.scannerIds)));

	const importantScannerIds = groups
		.filter(
			(group) =>
				allScannerIds.includes(group.scanner_id) &&
				('critical' === group.severity || 'high' === group.severity)
		)
		.map((group) => group.scanner_id);

	const tabs: { id: SectionedIssuesTab; label: string; count: number }[] = [
		{
			id: 'all',
			label: __('All', 'vulopilot'),
			count: sumGroupCounts(groups, allScannerIds),
		},
		{
			id: 'important',
			label: __('Important', 'vulopilot'),
			count: sumGroupCounts(groups, importantScannerIds),
		},
		...sections.map((section) => ({
			id: section.key,
			label: section.title,
			count: sumGroupCounts(groups, section.scannerIds),
		})),
	];

	const scannerIdsForTab: Record<string, string[]> = {
		all: allScannerIds,
		important: importantScannerIds,
	};
	sections.forEach((section) => {
		scannerIdsForTab[section.key] = section.scannerIds;
	});

	const activeSection = sections.find((section) => section.key === activeTab);
	const isActiveSectionLocked = Boolean(
		activeSection?.locked && activeSection?.proModule
	);
	const activeScannerIds = scannerIdsForTab[activeTab] ?? allScannerIds;
	const tabGroups = groups.filter((group) =>
		activeScannerIds.includes(group.scanner_id)
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
	const activeTabTotal = tabGroups.reduce(
		(total, group) => total + group.count,
		0
	);

	const priorityFilteredGroups =
		'all' === activePriority
			? tabGroups
			: tabGroups.filter((group) =>
					PRIORITY_SEVERITIES[activePriority].includes(group.severity)
				);

	const sortedGroups = [...priorityFilteredGroups].sort((a, b) => {
		const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];

		return 0 !== severityDiff ? severityDiff : b.count - a.count;
	});

	const pageRows = sortedGroups.slice(
		(paged - 1) * PER_PAGE,
		paged * PER_PAGE
	);

	const handlePriorityChange = (priority: Priority) => {
		setActivePriority(priority);
		setPaged(1);
	};

	const handleActionComplete = () => {
		refetch();
		setSelectedGroup(null);
	};

	return (
		<div id={id} className="sectioned-issues-table">
			<div className="sectioned-issues-table-header">
				<div className="sectioned-issues-table-title">
					{title}
					<span className="admin-badge purple">{tabs[0].count}</span>
				</div>
			</div>
			<div className="sectioned-issues-tabs">
				{tabs.map((tab) => (
					<span
						key={tab.id}
						className={`sectioned-issues-tab ${activeTab === tab.id ? 'active' : ''}`}
						role="button"
						tabIndex={0}
						onClick={() => onTabChange(tab.id)}
					>
						{tab.label}
						<span className="sectioned-issues-tab-count">
							{tab.count}
						</span>
					</span>
				))}
			</div>

			<ContainerComponent>
				<ColumnComponent grid={8}>
					{isActiveSectionLocked ? (
						<ProLockedCard
							moduleName={activeSection!.proModule as string}
						/>
					) : (
						<>
							<IssuesSummaryCards
								total={activeTabTotal}
								priorityCounts={priorityCounts}
								isLoading={isLoading}
								activePriority={activePriority}
								onSelectPriority={handlePriorityChange}
							/>

							{!isLoading && 0 === sortedGroups.length ? (
								<ModuleGuardComponent
									icon="check"
									title={__('Nothing here right now', 'vulopilot')}
									desc={
										activeSection?.emptyMessage ||
										__(
											'No findings here yet — nothing to report.',
											'vulopilot'
										)
									}
								/>
							) : (
								<TableCard
									showMenu={false}
									hideHeader={true}
									className="transparent-table"
									headers={{
										issue: {
											label: __('Issue', 'vulopilot'),
											width: '45%',
											render: (row: FindingGroup) => (
												<InformationItemComponent
													title={row.label}
													descriptions={[
														{
															value: row.sample?.description || '',
														},
													]}
												/>
											),
										},
										category: {
											label: __('Category', 'vulopilot'),
											render: (row: FindingGroup) => (
												<span className="admin-badge blue">
													{CATEGORY_LABELS[row.category] ??
														row.category}
												</span>
											),
										},
										severity: {
											label: __('Priority', 'vulopilot'),
											type: 'status',
											statusClass: (row: FindingGroup) =>
												row.severity,
										},
										affected: {
											label: __('Affected', 'vulopilot'),
											render: (row: FindingGroup) =>
												formatAffected(
													row.count,
													row.object_type
												),
										},
										action: {
											type: 'action',
											label: __('Action', 'vulopilot'),
											actions: [
												{
													label: __('View', 'vulopilot'),
													icon: 'eye',
													onClick: (row: FindingGroup) =>
														setSelectedGroup(row),
												},
											],
										},
									}}
									rows={pageRows}
									ids={pageRows.map((row) => row.scanner_id)}
									totalRows={sortedGroups.length}
									isLoading={isLoading}
									onQueryUpdate={(query: {
										paged?: number | string;
									}) => setPaged(Number(query.paged) || 1)}
									emptyMessage={
										activeSection?.emptyMessage ||
										__(
											'No findings here yet — nothing to report.',
											'vulopilot'
										)
									}
								/>
							)}
						</>
					)}
				</ColumnComponent>

				<ColumnComponent grid={4}>
					<IssueDetailPanel
						group={selectedGroup}
						onActionComplete={handleActionComplete}
						onClose={() => setSelectedGroup(null)}
					/>
				</ColumnComponent>
			</ContainerComponent>
		</div>
	);
};

export default SectionedIssuesTable;
