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
 * "Recent Activity" — `GET activity-logs` is real and generic
 * (`ActivityLogs.php`), but does accept an `event_type` param server-side
 * that no page's UI exposes yet — `AlertDispatcher.php` logs a real
 * `security.alert` event type, so filtering to it here is genuinely
 * security-scoped with zero new backend work. Honest empty state when
 * nothing's logged yet, rather than silently falling back to an
 * unfiltered generic feed that would misrepresent this section's
 * "security" framing. "View all activity" links to the real, unfiltered
 * Activity page.
 */
const RecentActivityCard = () => {
	const { data, isLoading } = useApiList<ActivityLogRow>('activity-logs', {
		event_type: 'security.alert',
		per_page: 4,
	});

	return (
		<CardComponent
			title={__('Recent Activity', 'vulopilot')}
			titleIcon="clock"
			isLoading={isLoading}
			action={
				<ButtonInput
					buttons={{
						text: __('View all activity', 'vulopilot'),
						onClick: () => {
							window.open(
								`${appLocalizer.admin_url}#&tab=activity`,
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
				<ul className="security-recent-activity-list">
					{data.map((row) => (
						<li key={row.id}>
							<span className="security-recent-activity-message">
								{row.message}
							</span>
							<span className="security-recent-activity-time">
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
