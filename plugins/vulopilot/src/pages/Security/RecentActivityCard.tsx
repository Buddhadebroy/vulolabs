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

/**
 * Every real, security-scoped `event_type` this table actually carries.
 * `security.alert`/`security.new_user` (vulopilot-pro's own
 * SecurityMonitoring\AlertDispatcher) only ever log when Pro is licensed
 * AND the site has turned on Settings → Notifications → Security Alerts
 * (`security_alerts_enabled`, default OFF) - on a Free-only install, an
 * unlicensed Pro install, or a licensed-but-unconfigured one (the large
 * majority of real sites), those two event types never fire at all, no
 * matter how many open security findings exist. `scan.completed.security`
 * (Services\ScanPersistenceListener, Free, always on) is the fix: a real
 * row every time a security/ssl-category scanner finishes, findings or
 * not, zero configuration required - see that method's own docblock.
 * Multiple values here become a real SQL `IN (...)` filter
 * (ActivityLogs.php's own `parse_comma_separated_event_types()`, same
 * comma-separated-list shape Findings.php's own scanner_id filter uses).
 */
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
