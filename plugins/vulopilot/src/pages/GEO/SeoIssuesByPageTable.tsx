/* global appLocalizer */
import React from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { CardComponent, InformationItemComponent, ModuleGuardComponent, NoticeManager } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { SEO_ISSUE_QUERY_PARAM } from '../../services/seoIssueEditorTarget';
import {
	FindingSeverity,
	PageRow,
	RowActionsMenu,
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

/** Same navigate-and-highlight deep link `post-editor/index.tsx` reads — deliberately NOT the existing in-place "Fix with AI" (RecentContentCard.tsx/FindingsTable.tsx/IssueDetailPanel.tsx's immediate AI-apply, which `SeoSiteWideIssuesTable.tsx` uses instead since its findings have no page to navigate to). This one takes the user to the editor, opens the "VuloPilot SEO" sidebar, and — where a mapping exists (seoIssueEditorTarget.ts) — switches to the right tab and highlights the specific field/checklist row, so they see exactly what to fix before anything is changed. */
const buildFixWithAiLink = (editLink: string, scannerId: string): string =>
	`${editLink}&${SEO_ISSUE_QUERY_PARAM}=${encodeURIComponent(scannerId)}`;

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

interface SeoIssuesByPageTableProps {
	rows: PageRow[];
	activeScannerIds: 'all' | string[];
	scannerLabelMap: Map<string, string>;
	isLoading: boolean;
	hasError: boolean;
	onRetry: () => void;
	/** "SEO Issues" by default — IssuesSection.tsx's own AEO/GEO callers pass "AEO Issues"/"GEO Issues" so this column reads correctly for whichever real check set is showing. */
	issuesColumnLabel?: string;
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
	scannerLabelMap,
	isLoading,
	hasError,
	onRetry,
	issuesColumnLabel = __('SEO Issues', 'vulopilot'),
}: SeoIssuesByPageTableProps) => {
	/**
	 * The active filter pill narrows which PAGES appear (`rowMatchesFilter`
	 * below), but every render that shows a row's OWN issues — the "N
	 * issues" badge, the expanded sub-rows, "Fix with AI"'s target — must
	 * narrow to the SAME matching findings too. Previously those three
	 * always used the full, unfiltered `row.findings`, so e.g. filtering to
	 * "Thin Content" correctly hid pages with no thin-content finding, but
	 * a page that matched still showed its full issue count/list (SEO,
	 * images, etc. all mixed in) instead of isolating to the one that
	 * matched the filter — the reported bug, confirmed live (a "Thin
	 * Content" filter still showed "18 issues"/"34 issues" badges).
	 */
	const getRowFindings = (row: PageRow) =>
		'all' === activeScannerIds
			? row.findings
			: row.findings.filter((finding) => activeScannerIds.includes(finding.scanner_id));

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
		'all' === activeScannerIds ||
		row.findings.some((finding) => activeScannerIds.includes(finding.scanner_id));

	const visibleRows = rows.filter(rowMatchesFilter);

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
			<CardComponent title={__('Pages & Posts', 'vulopilot')}>
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
		<CardComponent
			className="seo-issues-by-page-card"
			title={__('Pages & Posts', 'vulopilot')}
			isLoading={isLoading}
		>
			{!isLoading && 0 === visibleRows.length ? (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing here right now', 'vulopilot')}
					desc={
						'all' === activeScannerIds
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
							label: issuesColumnLabel,
							render: (row: TableRow) => {
								if (isFindingRow(row)) {
									return (
										<span className="seo-issues-finding-scanner">
											{row.scannerLabel}
										</span>
									);
								}

								const rowFindings = getRowFindings(row);

								return (
									<span
										className={`admin-badge badge-${worstSeverity(rowFindings)} seo-issues-row-expand-trigger`}
										onClick={toggleRowExpansion}
									>
										{sprintf(
											_n(
												'%d issue',
												'%d issues',
												rowFindings.length,
												'vulopilot'
											),
											rowFindings.length
										)}
									</span>
								);
							},
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
					emptyMessage={__('No pages or posts match this filter.', 'vulopilot')}
				/>
			)}
		</CardComponent>
	);
};

export default SeoIssuesByPageTable;
