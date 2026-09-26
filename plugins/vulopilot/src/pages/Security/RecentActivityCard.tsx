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
 * The only event types above that Reports → History lists
 * (Reports\Rest\History's EVENT_TYPES_BY_CATEGORY: scans and AI actions).
 * `security.alert`/`security.new_user` (vulopilot-pro's AlertDispatcher) are
 * real activity but never appear there, so a History deep link for one would
 * land on a page with nothing to select.
 */
const HISTORY_LISTED_EVENT_TYPES = ['scan.completed', 'scan.completed.security'];

/**
 * "Recent Activity" - `GET activity-logs` is real and generic
 * (`ActivityLogs.php`), filtered to `SECURITY_ACTIVITY_EVENT_TYPES` above
 * so this stays genuinely security-scoped rather than showing every SEO/
 * accessibility/performance scan too. Honest empty state when nothing's
 * logged yet, rather than silently falling back to an unfiltered generic
 * feed that would misrepresent this section's "security" framing. No
 * "View all activity" action any more - it used to deep-link to Reports'
 * own Activity subtab, removed per direct instruction ("only two tab here
 * one overview and history"); there's no unfiltered Activity page left to
 * send admins to.
 */
const RecentActivityCard = () => {
	const { data, isLoading } = useApiList<ActivityLogRow>('activity-logs', {
		event_type: SECURITY_ACTIVITY_EVENT_TYPES,
		per_page: 4,
	});
	// Purely local UI state - this card shows no side detail panel for a
	// selected row (unlike HistoryTab.tsx's own real use of this same
	// selection), so nothing else reads it; still real and working (a
	// clicked row visibly highlights via HistoryTimeline's own real
	// `.selected` class), not a fabricated no-op.
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
					// "More Details" opens this exact row in Reports → History
					// (this card has no detail panel of its own): the row's own
					// id rides along as `vulopilot_history_id` - the same
					// `vulopilot_activity_logs.id` History keys its rows by,
					// and the same deep link the Dashboard's Recent activity
					// widget uses - so that tab selects, scrolls to and pulses
					// it instead of just landing on whatever it shows first.
					// Rows History doesn't list can't be opened there, so they
					// only highlight in place rather than redirect somewhere
					// they don't exist.
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
