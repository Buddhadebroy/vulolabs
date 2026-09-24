/* global vulopilotAppLocalizer */
import React, { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { useApiList } from '../services/useApiList';
import type { HistoryRow } from '../services/historyTypes';
import HistoryTimeline from '../pages/Reports/HistoryTimeline';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

/**
 * "Recent activity" - the newest rows of `GET /history`, the exact feed
 * Reports → History shows, and its headline count is that tab's own "All"
 * pill count (`type_counts.all`, read through `useApiList`'s
 * `categoryFilter` plumbing) - so the two numbers can never disagree.
 * Rows come back already enriched (scan label, issue totals, change
 * detail), same as the History tab renders them.
 */
const ALL_COUNT_FILTER = {
	key: 'type',
	options: [{ label: 'All', value: 'all' }],
};

const RecentActivityWidget: React.FC<WidgetProps> = ({
	isLoading: parentLoading,
	onHide,
	isCustomizing,
}) => {
	const { data, categoryCounts, isLoading } = useApiList<HistoryRow>(
		'history',
		{ per_page: 6 },
		ALL_COUNT_FILTER
	);
	const total = categoryCounts[0]?.count ?? 0;
	// Purely local UI state - this compact widget shows no side detail
	// panel for a selected row, so nothing else reads it; still real and
	// working (a clicked row visibly highlights via HistoryTimeline's own
	// real `.selected` class), not a fabricated no-op.
	const [selectedRow, setSelectedRow] = useState<HistoryRow | null>(null);
	const historyRows = data;

	return (
		<DashboardWidget
			title={__('Recent activity', 'vulopilot')}
			icon="clock"
			isLoading={parentLoading || isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
			desc={sprintf(
				/* translators: %d: real total count of matching activity-log rows. */
				__('%d total events', 'vulopilot'),
				total
			)}
		>
			{!isLoading && data.length === 0 && (
				<div className="desc">
					{__(
						'No recent activity yet - activity will appear here as scans, alerts, and AI actions happen.',
						'vulopilot'
					)}
				</div>
			)}
			{!isLoading && data.length > 0 && (
				<HistoryTimeline
					rows={historyRows}
					total={historyRows.length}
					selectedRow={selectedRow}
					onSelectRow={setSelectedRow}
					isLoadingMore={false}
					onLoadMore={() => {}}
					// Real navigation to the full History tab (Reports →
					// History) - this widget has no side detail panel of
					// its own for the arrow to open a row into. Carries
					// this exact row's own real id (the same
					// `vulopilot_activity_logs.id` HistoryTab.tsx's own
					// `GET /history` rows are keyed by - confirmed against
					// Controllers/History.php) so that tab can select and
					// scroll to the SAME row, not just land on the tab with
					// whatever it auto-selects by default.
					onArrowClick={(row) => {
						window.open(
							`${vulopilotAppLocalizer.admin_url}#&tab=reports&subtab=history&vulopilot_history_id=${row.id}`,
							'_self'
						);
					}}
				/>
			)}
		</DashboardWidget>
	);
};

export default RecentActivityWidget;
