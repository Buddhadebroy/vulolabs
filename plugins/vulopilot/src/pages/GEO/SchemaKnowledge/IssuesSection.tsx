/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { ColumnComponent, ModuleGuardComponent } from '@zyra/components';
import { TableCard } from '@zyra/table';
import type { FindingGroup } from '../../AIAssistant/issuesTypes';
import { CATEGORY_LABELS, formatAffected } from '../../AIAssistant/issuesTypes';
import IssuesSummaryCards, { Priority } from '../../AIAssistant/IssuesSummaryCards';
import IssueDetailPanel from '../../AIAssistant/IssueDetailPanel';

/**
 * Real scanner ids behind every schema/entity-adjacent finding this
 * codebase already produces — `schema` (category `schema`),
 * `structured-data`/`sitewide-structured-data` (category `seo`),
 * `organization-schema`/`author-schema` (category `brand`). Sent as
 * `GET /findings/groups`' own `scanner_id` param (comma-separated, same
 * `parse_comma_separated_list()` handling GET /findings' `scanner_id`
 * already uses) rather than a `category` filter: these 5 scanners don't
 * share one category, and every category they DO belong to (`seo`/`brand`)
 * also holds many unrelated scanners (thin-content, broken-links, brand
 * visibility, …) a `category` filter would incorrectly pull in too.
 */
const SCHEMA_ISSUE_SCANNER_IDS = [
	'schema',
	'structured-data',
	'sitewide-structured-data',
	'organization-schema',
	'author-schema',
];

interface GroupsResponse {
	data: FindingGroup[];
	total: number;
	priority_counts: { high: number; medium: number; low: number };
}

/**
 * "Issues" section of the merged "Schema & Knowledge" tab — "Schema
 * Problems", real open findings from the 5 schema-related scanners above,
 * grouped by issue type (`GET /findings/groups?scanner_id=…`,
 * FindingRepository::get_finding_groups()'s now scanner_id-scoped grouping)
 * rather than one row per individual finding. Rebuilt to match AI Copilot's
 * own Issues table (IssuesList.tsx) exactly — the same real
 * IssuesSummaryCards stat tiles (Total/High/Medium/Low, each a real filter),
 * the same Issue/Affected/Action columns (InformationItemComponent +
 * badges, "View" opening a detail panel instead of inline per-row Fix/
 * Resolve/Ignore), and the same real side IssueDetailPanel (fully generic,
 * reused as-is — its own "Fix with AI"/"Resolve all"/"Ignore all" already
 * act on every open finding in whichever group is selected, and it already
 * owns its own Pro popup for "Fix with AI" when OneClickFix isn't active).
 * No category tab bar here (unlike IssuesList.tsx's All/SEO/AI Visibility/…
 * tabs) — this section is already fully scoped to the 5 scanner ids above,
 * so there is no wider "category" dimension left to filter by.
 */
const IssuesSection = () => {
	const [activePriority, setActivePriority] = useState<Priority>('all');
	const [paged, setPaged] = useState(1);
	const [perPage, setPerPage] = useState(10);

	const [data, setData] = useState<FindingGroup[]>([]);
	const [total, setTotal] = useState(0);
	const [priorityCounts, setPriorityCounts] = useState({
		high: 0,
		medium: 0,
		low: 0,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [reloadToken, setReloadToken] = useState(0);
	const [selectedGroup, setSelectedGroup] = useState<FindingGroup | null>(
		null
	);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setError(null);

		const params = new URLSearchParams();
		params.set('scanner_id', SCHEMA_ISSUE_SCANNER_IDS.join(','));
		params.set('page', String(paged));
		params.set('per_page', String(perPage));

		if ('all' !== activePriority) {
			params.set('priority', activePriority);
		}

		const baseUrl = getApiLink(appLocalizer, 'findings/groups');
		const separator = baseUrl.includes('?') ? '&' : '?';
		const url = `${baseUrl}${separator}${params.toString()}`;

		getApiResponse<GroupsResponse>(url, {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				if (cancelled) {
					return;
				}

				if (!response) {
					setError(
						__(
							'Something went wrong while loading issues.',
							'vulopilot'
						)
					);
					setData([]);
					setTotal(0);
					return;
				}

				setData(response.data ?? []);
				setTotal(response.total ?? 0);
				setPriorityCounts(
					response.priority_counts ?? { high: 0, medium: 0, low: 0 }
				);

				setSelectedGroup((current) => {
					if (
						current &&
						response.data.some(
							(group) => group.scanner_id === current.scanner_id
						)
					) {
						return (
							response.data.find(
								(group) =>
									group.scanner_id === current.scanner_id
							) ?? current
						);
					}

					return response.data[0] ?? null;
				});
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activePriority, paged, perPage, reloadToken]);

	const refetch = () => setReloadToken((n) => n + 1);

	const handlePriorityChange = (priority: Priority) => {
		setActivePriority(priority);
		setPaged(1);
	};

	if (error) {
		return (
			<ModuleGuardComponent
				icon="error"
				title={__('Could not load findings', 'vulopilot')}
				desc={error}
				buttonText={__('Retry', 'vulopilot')}
				onButtonClick={refetch}
			/>
		);
	}

	return (
		<>
			{/* Real scroll target for "View all issues"/"Review" elsewhere
			on this page (`scrollToId('schema-knowledge-issues')`) — kept
			INSIDE this grid={8} column rather than as a wrapping element
			around both of this component's own columns, since a wrapping
			`<div>` there would put the grid={8}/grid={4} pair inside ITS
			OWN box instead of the page's shared `.container-wrapper` flex
			row they're meant to sit side by side in (SchemaKnowledgeTab.tsx
			used to wrap this whole component in exactly such a div, which
			broke that side-by-side layout — fixed by moving the id here
			instead). */}
			<ColumnComponent grid={8}>
				<div id="schema-knowledge-issues">
					<IssuesSummaryCards
						total={total}
						priorityCounts={priorityCounts}
						isLoading={isLoading}
						activePriority={activePriority}
						onSelectPriority={handlePriorityChange}
					/>

					{!isLoading && data.length === 0 ? (
						<ModuleGuardComponent
							icon="check"
							title={__('No schema issues right now', 'vulopilot')}
							desc={__(
								'No schema/structured-data findings yet — run a scan to check.',
								'vulopilot'
							)}
						/>
					) : (
						<TableCard
							showMenu={false}
							hideHeader={true}
							className="transparent-table"
							// Highlights the row whose details are showing in
							// the side panel — same real `activeRowId`/action-
							// toggle pairing IssuesList.tsx's own Issue/Affected/
							// Action table already uses.
							activeRowId={selectedGroup?.scanner_id}
							// Same toggle the action cell's own "More
							// Details"/"Showing" button already does — a
							// click anywhere on the row now opens/closes the
							// details panel too, not just that one small
							// button.
							onRowClick={(row: Record<string, unknown>) => {
								const group = row as unknown as FindingGroup;
								setSelectedGroup(
									group.scanner_id === selectedGroup?.scanner_id
										? null
										: group
								);
							}}
							headers={{
								issue: {
									// `type: 'info'`'s own `key` is the row field
									// that becomes the title (@zyra/table's
									// TableUtils.tsx) — `descriptionKey`/`badgesKey`
									// name the row fields that feed the rest, so
									// `tableRows` below precomputes both onto each
									// row rather than this column needing its own
									// per-row `render()` (same real
									// InformationItemComponent output as before,
									// just built by the shared column type now).
									key: 'label',
									type: 'info',
									label: __('Issue', 'vulopilot'),
									width: '65%',
									descriptionKey: 'descriptionText',
									badgesKey: 'issueBadges',
								},
								affected: {
									label: __('Affected', 'vulopilot'),
									width: '65%',
									render: (row: FindingGroup) =>										
										formatAffected(row.count, row.object_type),
								},
								action: {
									label: __('Action', 'vulopilot'),
									// `type: 'more-action'` no longer exists in
									// @zyra/table — `type: 'action'` now covers
									// that same single-toggle-button case via a
									// `type: 'button'` action whose label/icon
									// are functions of `row` (see that type's
									// own docblock, TableRowActions.tsx) — same
									// real "Showing"/"More Details" toggle
									// IssuesList.tsx's own Issues table already
									// uses.
									type: 'action',
									actions: [
										{
											type: 'button',
											label: (row) =>
												(row as unknown as FindingGroup)
													.scanner_id ===
												selectedGroup?.scanner_id
													? __('Showing', 'vulopilot')
													: __('More Details', 'vulopilot'),
											icon: (row) =>
												(row as unknown as FindingGroup)
													.scanner_id ===
												selectedGroup?.scanner_id
														? 'eye'
														: 'pagination-next-arrow',
											onClick: (row) => {
												const group = row as unknown as FindingGroup;
												setSelectedGroup(
													group.scanner_id === selectedGroup?.scanner_id
														? null
														: group
												);
											},
										},
									],
								},
							}}
							rows={data.map((row) => ({
								...row,
								descriptionText: row.sample?.description || '',
								issueBadges: [
									{
										text: CATEGORY_LABELS[row.category] ?? row.category,
										color: `badge-${row.category}`,
									},
									{
										text: row.severity,
										color: `badge-${row.severity}`,
									},
								],
							}))}
							ids={data.map((row) => row.scanner_id)}
							totalRows={total}
							isLoading={isLoading}
							onQueryUpdate={(query: {
								paged?: number | string;
								per_page?: number | string;
							}) => {
								setPaged(Number(query.paged) || 1);
								setPerPage(Number(query.per_page) || 10);
							}}
							emptyMessage={__(
								'No schema/structured-data findings yet — run a scan to check.',
								'vulopilot'
							)}
						/>
					)}
				</div>
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<IssueDetailPanel
					group={selectedGroup}
					onActionComplete={refetch}
					onClose={() => setSelectedGroup(null)}
				/>
			</ColumnComponent>
		</>
	);
};

export default IssuesSection;
