/* global vulopilotAppLocalizer */
import React, { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { useApiList } from '../services/useApiList';
import type { HistoryRow } from '../services/historyTypes';
import HistoryTimeline from '../pages/Reports/HistoryTimeline';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

/**
 * "Recent activity" - the newest rows of `GET /history`, the exact feed Reports → History shows.
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
	// Purely local UI state - this compact widget shows no side detail panel for a selected row, so
	// nothing else reads it.
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
					// Real navigation to the full History tab (Reports → History).
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
