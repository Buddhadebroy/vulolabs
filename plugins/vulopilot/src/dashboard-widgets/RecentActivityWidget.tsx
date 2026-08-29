/* global appLocalizer */
import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { useApiList } from '../services/useApiList';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

interface ActivityLogRow {
	id: number;
	message: string;
	created_at: string;
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
		return sprintf(
			/* translators: %d: minutes since this real event happened. */
			__('%dm ago', 'vulopilot'),
			minutes
		);
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return sprintf(
			/* translators: %d: hours since this real event happened. */
			__('%dh ago', 'vulopilot'),
			hours
		);
	}
	const days = Math.floor(hours / 24);
	return sprintf(
		/* translators: %d: days since this real event happened. */
		__('%dd ago', 'vulopilot'),
		days
	);
};

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
			headerAction={
				<a
					href={`${appLocalizer.admin_url}#&tab=reports&subtab=activity`}
					className="vital-pulse-full-report-link"
				>
					{__('View all activity ›', 'vulopilot')}
				</a>
			}
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
		</DashboardWidget>
	);
};

export default RecentActivityWidget;
