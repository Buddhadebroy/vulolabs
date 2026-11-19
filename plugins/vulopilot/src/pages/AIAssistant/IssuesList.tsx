/* global vulopilotAppLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, scrollToId } from '@zyra/core';
import { TableCard } from '@zyra/table';
import { ButtonInput } from '@zyra/inputs';
import { EmptyState, Segmented } from '../../components/ui';
import IssueDetailPanel from '../../components/Issues/IssueDetailPanel';
import {
	CATEGORY_LABELS,
	CATEGORY_TABS,
	FindingGroup,
	findTabIdForCategory,
	formatAffected,
	groupKey,
	issueIconFor,
} from '../../components/Issues/issuesTypes';
import { columns, tableRows } from '../../services/tableColumns';

type Priority = 'all' | 'high' | 'medium' | 'low';

interface GroupsResponse {
	data: FindingGroup[];
	total: number;
	priority_counts: { high: number; medium: number; low: number };
	category_counts: Record<string, number>;
}

interface IssuesListProps {
	/** Presets the matching tab and auto-selects that group once loaded. */
	initialScannerId?: string;
	initialCategory?: string;
}

/** AI Copilot's Issues section: a priority filter, the table of issue groups, and the chosen group's details. */
const IssuesList: React.FC<IssuesListProps> = ({
	initialScannerId,
	initialCategory,
}) => {
	const [activeTabId, setActiveTabId] = useState(
		initialCategory ? findTabIdForCategory(initialCategory) : 'all'
	);
	const [activePriority, setActivePriority] = useState<Priority>('all');
	// Matches TableCard's initial { paged: 1, per_page: 10 } state.
	const [paged, setPaged] = useState(1);
	const [perPage, setPerPage] = useState(10);

	const [data, setData] = useState<FindingGroup[]>([]);
	const [total, setTotal] = useState(0);
	const [priorityCounts, setPriorityCounts] = useState({
		high: 0,
		medium: 0,
		low: 0,
	});
	const [categoryCounts, setCategoryCounts] = useState<
		Record<string, number>
	>({});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [reloadToken, setReloadToken] = useState(0);
	const [selectedGroup, setSelectedGroup] = useState<FindingGroup | null>(
		null
	);

	const activeTab = CATEGORY_TABS.find((tab) => tab.id === activeTabId);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setError(null);

		const params = new URLSearchParams();
		params.set('page', String(paged));
		params.set('per_page', String(perPage));

		if (activeTab) {
			params.set('category', activeTab.categories.join(','));
		}

		if ('all' !== activePriority) {
			params.set('priority', activePriority);
		}

		const baseUrl = getApiLink(vulopilotAppLocalizer, 'findings/groups');
		const separator = baseUrl.includes('?') ? '&' : '?';
		const url = `${baseUrl}${separator}${params.toString()}`;

		getApiResponse<GroupsResponse>(url, {
			headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce },
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
				setCategoryCounts(response.category_counts ?? {});

				setSelectedGroup((current) => {
					if (
						current &&
						response.data.some(
							(group) => groupKey(group) === groupKey(current)
						)
					) {
						return (
							response.data.find(
								(group) => groupKey(group) === groupKey(current)
							) ?? current
						);
					}

					if (initialScannerId) {
						const match = response.data.find(
							(group) => group.scanner_id === initialScannerId
						);

						if (match) {
							return match;
						}
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
	}, [activeTabId, activePriority, paged, perPage, reloadToken]);

	const refetch = () => setReloadToken((n) => n + 1);

	/** Toggles the detail panel open/closed for a group row. */
	const selectGroup = (group: FindingGroup) => {
		setSelectedGroup((current) => {
			if (current && groupKey(group) === groupKey(current)) {
				return null;
			}

			scrollToId('ai-copilot-issue-detail-panel');
			return group;
		});
	};

	const handlePriorityChange = (priority: Priority) => {
		setActivePriority(priority);
		setPaged(1);
	};

	const tableCategoryCounts = [
		{
			value: 'all',
			label: __('All', 'vulopilot'),
			count: Object.values(categoryCounts).reduce(
				(sum, count) => sum + count,
				0
			),
		},
		...CATEGORY_TABS.map((tab) => ({
			value: tab.id,
			label: tab.label,
			count: tab.categories.reduce(
				(sum, category) =>
					sum + (categoryCounts[category] ?? 0),
				0
			),
		})),
	];

	const priorityTotal = priorityCounts.high + priorityCounts.medium + priorityCounts.low;
	const countOf = (label: string, count: number) =>
		/* translators: 1: priority such as "High", 2: number of issues. */
		count > 0 ? sprintf(__('%1$s %2$d', 'vulopilot'), label, count) : label;

	let content;

	if (error) {
		content = (
			<section className="vp-card">
				<div className="vp-card-body">
					<EmptyState
						icon="error"
						tone="red"
						title={__('Could not load issues', 'vulopilot')}
						text={error}
						action={
							<ButtonInput
								buttons={{ text: __('Try again', 'vulopilot'), icon: 'refresh', color: 'purple', onClick: refetch }}
							/>
						}
					/>
				</div>
			</section>
		);
	} else if (!isLoading && 0 === data.length) {
		const isFiltered = 'all' !== activePriority || 'all' !== activeTabId;

		content = (
			<section className="vp-card">
				<div className="vp-card-body">
					<EmptyState
						icon="check"
						tone="green"
						title={isFiltered ? __('Nothing matches this filter', 'vulopilot') : __("You're all caught up", 'vulopilot')}
						text={
							isFiltered
								? __('No open issues in this view. Other areas may still have some.', 'vulopilot')
								: __('Issues appear here once a scan finds something worth fixing.', 'vulopilot')
						}
						action={
							isFiltered && (
								<ButtonInput
									buttons={{
										text: __('Show all issues', 'vulopilot'),
										color: 'purple',
										onClick: () => {
											setActiveTabId('all');
											handlePriorityChange('all');
										},
									}}
								/>
							)
						}
					/>
				</div>
			</section>
		);
	} else {
		content = (
			<div className="vp-row is-side vp-issues-row">
				<div className="vp-issues-table">
				<TableCard
					showMenu={false}
					hideHeader={true}
					categoryCounts={tableCategoryCounts}
					activeCategory={activeTabId}
					activeRowId={selectedGroup ? groupKey(selectedGroup) : undefined}
					// Toggles the detail panel open/closed.
					onRowClick={(row: Record<string, unknown>) => {
						selectGroup(row as unknown as FindingGroup);
					}}
					headers={columns({
						issue: {
							key: 'label',
							type: 'info',
							label: __('Issue', 'vulopilot'),
							width: '60%',
							iconKey: 'categoryIcon',
							descriptionKey: 'descriptionText',
							badgesKey: 'issueBadges',
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
							label: __('Details', 'vulopilot'),
							type: 'action',
							actions: [
								{
									type: 'button',
									label: (row) =>
										selectedGroup &&
										groupKey(row as unknown as FindingGroup) ===
											groupKey(selectedGroup)
											? __('Showing', 'vulopilot')
											: __('More Details', 'vulopilot'),
									color: (row) =>
										selectedGroup &&
										groupKey(row as unknown as FindingGroup) ===
											groupKey(selectedGroup)
											? 'text-green'
											: 'text-purple',
									icon: (row) =>
										selectedGroup &&
										groupKey(row as unknown as FindingGroup) ===
											groupKey(selectedGroup)
											? 'eye'
											: 'pagination-next-arrow',
									onClick: (row) => {
										selectGroup(row as unknown as FindingGroup);
									},
								},
							],
						},
					})}
					rows={tableRows(data.map((row) => ({
						...row,
						// Tries SCANNER_ICONS[scanner_id] first, falls back to CATEGORY_ICONS[category].
						categoryIcon: issueIconFor(
							row.category,
							row.scanner_id
						),
						descriptionText:
							(row.sample?.description?.length ?? 0) > 80
								? `${row.sample?.description?.slice(0, 80)}...`
								: row.sample?.description || '',
						issueBadges: [
							{
								text: CATEGORY_LABELS[row.category] ?? row.category,
								color: `badge-${row.category}`,
							},
							{ text: row.severity, color: `badge-${row.severity}` },
						],
					})))}
					ids={data.map((row) => groupKey(row))}
					totalRows={total}
					isLoading={isLoading}
					onQueryUpdate={(query: {
						paged?: number | string;
						per_page?: number | string;
						categoryFilter?: string;
					}) => {
						setPaged(Number(query.paged) || 1);
						setPerPage(Number(query.per_page) || 10);
						if (
							query.categoryFilter &&
							query.categoryFilter !== activeTabId
						) {
							setActiveTabId(query.categoryFilter);
						}
					}}
					emptyMessage={__(
						'AI suggestions appear here once a scan finds something worth fixing.',
						'vulopilot'
					)}
				/>
				</div>
				<div id="ai-copilot-issue-detail-panel" className="vp-issues-detail">
					<IssueDetailPanel group={selectedGroup} onActionComplete={refetch} />
				</div>
			</div>
		);
	}

	return (
		<section className="vp-issues" id="ai-copilot-issues-section" aria-label={__('Issues', 'vulopilot')}>
			<div className="vp-section-head">
				<div>
					<h2>{__('Issues', 'vulopilot')}</h2>
					<p>{__('Findings from your latest scans, grouped by check. Pick one to see what to do.', 'vulopilot')}</p>
				</div>
				<Segmented
					label={__('Priority', 'vulopilot')}
					size="sm"
					value={activePriority}
					onChange={(next) => handlePriorityChange(next as Priority)}
					options={[
						{ value: 'all', label: countOf(__('All', 'vulopilot'), priorityTotal) },
						{ value: 'high', label: countOf(__('High', 'vulopilot'), priorityCounts.high) },
						{ value: 'medium', label: countOf(__('Medium', 'vulopilot'), priorityCounts.medium) },
						{ value: 'low', label: countOf(__('Low', 'vulopilot'), priorityCounts.low) },
					]}
				/>
			</div>
			{content}
		</section>
	);
};

export default IssuesList;
