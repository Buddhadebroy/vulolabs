/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { ColumnComponent, ModuleGuardComponent, InformationItemComponent } from '@zyra/components';
import { TableCard } from '@zyra/table';
import './AICopilot.scss';
import IssuesSummaryCards, { Priority } from './IssuesSummaryCards';
import IssueDetailPanel from './IssueDetailPanel';
import {
	CATEGORY_ICONS,
	CATEGORY_LABELS,
	CATEGORY_TABS,
	FindingGroup,
	findTabIdForCategory,
	formatAffected,
} from './issuesTypes';

interface GroupsResponse {
	data: FindingGroup[];
	total: number;
	priority_counts: { high: number; medium: number; low: number };
	category_counts: Record<string, number>;
}

interface IssuesListProps {
	/** A real scanner_id/category from NeedsAttentionCard.tsx's own group rows — presets the matching tab and auto-selects that group once loaded. */
	initialScannerId?: string;
	initialCategory?: string;
}

/**
 * AI Copilot's Issues table — every open finding grouped by issue type
 * (`GET /findings/groups`, FindingRepository::get_finding_groups()), not
 * one row per individual finding: "8 images are missing alt text" is one
 * row for 8 real findings sharing the same scanner_id, matching the
 * mockup's own row shape. Stat cards + category tabs above the table and
 * a real detail panel to the side (IssuesSummaryCards.tsx/
 * IssueDetailPanel.tsx) are real, all backed by this same endpoint — the
 * stat tiles double as a real High/Medium/Low filter (same 3-tier bucket
 * FindingRepository::get_priority_counts() already uses for their own
 * counts), alongside the category tabs, both scoped server-side so the
 * table's own pagination footer always matches what's actually filtered.
 */
const IssuesList: React.FC<IssuesListProps> = ({
	initialScannerId,
	initialCategory,
}) => {
	const [activeTabId, setActiveTabId] = useState(
		initialCategory ? findTabIdForCategory(initialCategory) : 'all'
	);
	const [activePriority, setActivePriority] = useState<Priority>('all');
	// Matches TableCard's own initial `{ paged: 1, per_page: 10 }` state
	// (same reasoning useApiList.ts's own comment gives) — its first
	// mount-time onQueryUpdate call corrects this to whatever its page-size
	// selector actually shows, so the fetched row count and the "Showing X
	// to Y of Z" footer it renders always agree.
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
				setCategoryCounts(response.category_counts ?? {});

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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeTabId, activePriority, paged, perPage, reloadToken]);

	const refetch = () => setReloadToken((n) => n + 1);

	const handleTabChange = (tabId: string) => {
		setActiveTabId(tabId);
		setPaged(1);
	};

	const handlePriorityChange = (priority: Priority) => {
		setActivePriority(priority);
		setPaged(1);
	};

	if (error) {
		return (
			<ModuleGuardComponent
				icon="error"
				title={__('Could not load issues', 'vulopilot')}
				desc={error}
				buttonText={__('Retry', 'vulopilot')}
				onButtonClick={refetch}
			/>
		);
	}

	return (
		<>
			<ColumnComponent grid={8}>
				<IssuesSummaryCards
					total={total}
					priorityCounts={priorityCounts}
					isLoading={isLoading}
					activePriority={activePriority}
					onSelectPriority={handlePriorityChange}
				/>

				<div className="issues-category-tabs">
					<span
						className={`issues-category-tab ${'all' === activeTabId ? 'active' : ''}`}
						onClick={() => handleTabChange('all')}
					>
						{__('All', 'vulopilot')}
					</span>
					{CATEGORY_TABS.map((tab) => {
						const count = tab.categories.reduce(
							(sum, category) =>
								sum + (categoryCounts[category] ?? 0),
							0
						);

						return (
							<span
								key={tab.id}
								className={`issues-category-tab ${tab.id === activeTabId ? 'active' : ''}`}
								onClick={() => handleTabChange(tab.id)}
							>
								{tab.label}
								{count > 0 && (
									<span className="issues-category-tab-count">
										{count}
									</span>
								)}
							</span>
						);
					})}
				</div>

				{!isLoading && data.length === 0 ? (
					<ModuleGuardComponent
						icon="check"
						title={__('Nothing to suggest right now', 'vulopilot')}
						desc={__(
							'AI suggestions appear here once a scan finds something worth fixing.',
							'vulopilot'
						)}
					/>
				) : (
					<TableCard
						className="issues-table"
						showMenu={false}
						headers={{
							// issue: {
							// 	label: __('Issue', 'vulopilot'),
							// 	render: (row: FindingGroup) => (
							// 		<div
							// 			className={`issues-table-issue-cell ${selectedGroup?.scanner_id === row.scanner_id ? 'selected' : ''}`}
							// 			role="button"
							// 			tabIndex={0}
							// 			onClick={() => setSelectedGroup(row)}
							// 		>
							// 			<i
							// 				className={`issues-table-issue-icon adminfont-${CATEGORY_ICONS[row.category] ?? 'ai'}`}
							// 			/>
							// 			<div className="issues-table-issue-text">
							// 				<div className="issues-table-issue-title">
							// 					{row.label}
							// 				</div>
							// 				{row.sample?.description && (
							// 					<div className="issues-table-issue-desc">
							// 						{row.sample.description}
							// 					</div>
							// 				)}
							// 			</div>
							// 		</div>
							// 	),
							// },
							issue: {
								label: __('Issue', 'vulopilot'),
								width:'55%',
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
								// zyra's TableCard has no `type: 'badge'`
								// case (only 'status'/'date'/'currency' —
								// confirmed by reading its own renderCell()),
								// so 'status' is the real type that
								// produces an `admin-badge badge-{class}`
								// wrapper this file's own `.issues-table`
								// CSS below targets.
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
								label: 'Action',
								actions: [
									{
										label: 'View',
										icon: 'eye',
										onClick: (row: FindingGroup) => setSelectedGroup(row),
									},
								],
							},
						}}
						rows={data}
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
							'AI suggestions appear here once a scan finds something worth fixing.',
							'vulopilot'
						)}
					/>
				)}
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

export default IssuesList;
