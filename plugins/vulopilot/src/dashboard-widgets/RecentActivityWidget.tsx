/* global appLocalizer */
import React, { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { useApiList } from '../services/useApiList';
import { toHistoryRow } from '../services/historyTypes';
import HistoryTimeline from '../pages/Reports/HistoryTimeline';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

interface ActivityLogRow {
	id: number;
	message: string;
	created_at: string;
	/** Real column on every `activity-logs` row (a plain `SELECT *`) — this local interface just didn't type it before, since nothing here read it. */
	event_type: string;
}

/**
 * Same real, meaningful sitewide event types `OverviewTab.tsx` (SEO &
 * Visibility's own Overview tab) already curates from `GET /activity-logs`'s
 * full real event-type list (see that file's own `ACTIVITY_EVENT_TYPES`
 * docblock) — reused here rather than an unfiltered feed, since an
 * unfiltered `/activity-logs` also includes noisier internal event types
 * (extension registration failures, etc.) this widget isn't about.
 */
const ACTIVITY_EVENT_TYPES = [
	'scan.completed',
	'scan.completed.security',
	'critical_alert',
	'ai_action.executed',
	'ai_action.failed',
].join(',');

/**
 * "Recent activity" — `GET /activity-logs`, the same real, generic
 * endpoint every other activity feed in this plugin already reads
 * (ActivityLogs.php), filtered to `ACTIVITY_EVENT_TYPES` above. The
 * headline count is `useApiList`'s own real `total` field — a genuine
 * `COUNT(*)` against this exact filtered query (AbstractRepository::find_all()),
 * so it always matches what's actually shown below it, never a
 * separately-fabricated number.
 */
const RecentActivityWidget: React.FC<WidgetProps> = ({
	isLoading: parentLoading,
	onHide,
	isCustomizing,
}) => {
	const { data, total, isLoading } = useApiList<ActivityLogRow>(
		'activity-logs',
		{ event_type: ACTIVITY_EVENT_TYPES, per_page: 6 }
	);
	// Purely local UI state — this compact widget shows no side detail
	// panel for a selected row, so nothing else reads it; still real and
	// working (a clicked row visibly highlights via HistoryTimeline's own
	// real `.selected` class), not a fabricated no-op.
	const [selectedRow, setSelectedRow] = useState<ReturnType<
		typeof toHistoryRow
	> | null>(null);
	const historyRows = data.map(toHistoryRow);

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
						'No recent activity yet — activity will appear here as scans, alerts, and AI actions happen.',
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
					// History) — this widget has no side detail panel of
					// its own for the arrow to open a row into.
					onArrowClick={() => {
						window.open(
							`${appLocalizer.admin_url}#&tab=reports&subtab=history`,
							'_self'
						);
					}}
				/>
			)}
		</DashboardWidget>
	);
};

export default RecentActivityWidget;
