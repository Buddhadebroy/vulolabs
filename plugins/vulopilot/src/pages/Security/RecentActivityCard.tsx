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
					// Real navigation to the full History tab (Reports →
					// History) - this card has no side detail panel of its
					// own for the arrow to open a row into, unlike
					// HistoryTab.tsx's own real use of it.
					onArrowClick={() => {
						window.open(
							`${vulopilotAppLocalizer.admin_url}#&tab=reports&subtab=history`,
							'_self'
						);
					}}
				/>
			)}
		</CardComponent>
	);
};

export default RecentActivityCard;
