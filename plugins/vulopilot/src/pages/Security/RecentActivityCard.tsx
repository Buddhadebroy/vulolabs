/* global vulopilotAppLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { toHistoryRow } from '../../services/historyTypes';
import HistoryTimeline from '../Reports/HistoryTimeline';

interface ActivityLogRow {
	id: number;
	message: string;
	created_at: string;
	/** Real column on every `activity-logs` row (a plain `SELECT *`) - this local interface just didn't type it before, since nothing here read it. */
	event_type: string;
}

const SECURITY_ACTIVITY_EVENT_TYPES = [
	'scan.completed.security',
	'security.alert',
	'security.new_user',
].join(',');

/**
 * The only event types above that Reports → History lists (Reports\Rest\History's
 * EVENT_TYPES_BY_CATEGORY: scans and AI actions).
 */
const HISTORY_LISTED_EVENT_TYPES = ['scan.completed', 'scan.completed.security'];

/**
 * "Recent Activity" - `GET activity-logs` is real and generic (`ActivityLogs.php`).
 */
const RecentActivityCard = () => {
	const { data, isLoading } = useApiList<ActivityLogRow>('activity-logs', {
		event_type: SECURITY_ACTIVITY_EVENT_TYPES,
		per_page: 4,
	});
	// Purely local UI state - this card shows no side detail panel for a selected row (unlike
	// HistoryTab.tsx's own real use of this same selection).
	const [selectedRow, setSelectedRow] = useState<ReturnType<
		typeof toHistoryRow
	> | null>(null);
	const historyRows = data.map(toHistoryRow);

	return (
		<CardComponent
			id="security-recent-activity-card"
			title={__('Recent Activity', 'vulopilot')}
			titleIcon="clock"
			desc={__('Your last 4 real security-related events.', 'vulopilot')}
			isLoading={isLoading}
		>
			{!isLoading && data.length === 0 && (
				<ModuleGuardComponent
					icon="info"
					title={__('No recent security activity', 'vulopilot')}
					desc={__(
						'Security-related activity will appear here as it happens.',
						'vulopilot'
					)}
				/>
			)}
			{!isLoading && data.length > 0 && (
				<HistoryTimeline
					rows={historyRows}
					total={historyRows.length}
					selectedRow={selectedRow}
					onSelectRow={setSelectedRow}
					isLoadingMore={false}
					onLoadMore={() => {}}
					// "More Details" opens this exact row in Reports → History (this card has no
					// detail panel of its own): the row's own id rides along as
					// `vulopilot_history_id`.
					onArrowClick={(row) => {
						if (!HISTORY_LISTED_EVENT_TYPES.includes(row.event_type)) {
							setSelectedRow(row);
							return;
						}

						window.open(
							`${vulopilotAppLocalizer.admin_url}#&tab=reports&subtab=history&vulopilot_history_id=${row.id}`,
							'_self'
						);
					}}
				/>
			)}
		</CardComponent>
	);
};

export default RecentActivityCard;
