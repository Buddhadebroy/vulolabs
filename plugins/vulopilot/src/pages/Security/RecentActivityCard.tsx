/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';

interface ActivityLogRow {
	id: number;
	message: string;
	created_at: string;
}

const timeAgo = (dateString: string): string => {
	const seconds = Math.max(
		0,
		Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
	);

	if (seconds < 60) {
		return __('just now', 'vulopilot');
	}
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
};

/**
 * Every real, security-scoped `event_type` this table actually carries.
 * `security.alert`/`security.new_user` (vulopilot-pro's own
 * SecurityMonitoring\AlertDispatcher) only ever log when Pro is licensed
 * AND the site has turned on Settings → Notifications → Security Alerts
 * (`security_alerts_enabled`, default OFF) — on a Free-only install, an
 * unlicensed Pro install, or a licensed-but-unconfigured one (the large
 * majority of real sites), those two event types never fire at all, no
 * matter how many open security findings exist. `scan.completed.security`
 * (Services\ScanPersistenceListener, Free, always on) is the fix: a real
 * row every time a security/ssl-category scanner finishes, findings or
 * not, zero configuration required — see that method's own docblock.
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
 * "Recent Activity" — `GET activity-logs` is real and generic
 * (`ActivityLogs.php`), filtered to `SECURITY_ACTIVITY_EVENT_TYPES` above
 * so this stays genuinely security-scoped rather than showing every SEO/
 * accessibility/performance scan too. Honest empty state when nothing's
 * logged yet, rather than silently falling back to an unfiltered generic
 * feed that would misrepresent this section's "security" framing. "View
 * all activity" links to the real, unfiltered Activity page — a *subtab*
 * of "Reports" (`?page=vulopilot#&tab=reports&subtab=activity`,
 * ActivityTab.tsx inside Reports.tsx), not its own top-level `#&tab=activity`
 * route — that flat route was fully removed when Activity got folded into
 * Reports as a subtab; `#&tab=activity` alone matches nothing in
 * `routes.ts` and silently renders a blank page (confirmed live). Same
 * `#&tab=reports&subtab=activity` shape TodaysTasksWidget.tsx's own
 * "View all" link already uses correctly.
 */
const RecentActivityCard = () => {
	const { data, isLoading } = useApiList<ActivityLogRow>('activity-logs', {
		event_type: SECURITY_ACTIVITY_EVENT_TYPES,
		per_page: 4,
	});

	return (
		<CardComponent
			title={__('Recent Activity', 'vulopilot')}
			titleIcon="clock"
			desc={__('Your last 4 real security-related events.', 'vulopilot')}
			isLoading={isLoading}
			action={
				<ButtonInput
					buttons={{
						text: __('View all activity', 'vulopilot'),
						color: 'text-purple',
						onClick: () => {
							window.open(
								`${appLocalizer.admin_url}#&tab=reports&subtab=activity`,
								'_self'
							);
						},
					}}
				/>
			}
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
				<ul className="activity-log">
					{data.map((row) => (
						<li key={row.id} className='activity'>
							<div className="title">
								{row.message}
							</div>
							<span>
								{timeAgo(row.created_at)}
							</span>
						</li>
					))}
				</ul>
			)}
		</CardComponent>
	);
};

export default RecentActivityCard;
