import React from 'react';
import { __ } from '@wordpress/i18n';
import { ListComponent, ModuleGuardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useApiList } from '../services/useApiList';
import { formatWpDate } from '../services/formatWpDate';
import { WidgetProps } from './types';

interface ActivityLogRow {
	id: number;
	event_type: string;
	message: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	created_at: string;
}

/**
 * UNUSED — no longer registered in registry.ts's MOCKUP_WIDGETS (removed
 * per direct instruction once confirmed as a real content duplicate of
 * RecentActivityWidget: this widget's own `/activity-logs` call has no
 * `event_type` filter, so on a real site it surfaces whatever's most
 * recent in the log — in practice the same `scan.completed` rows
 * RecentActivityWidget's own curated event-type list already shows,
 * confirmed live showing identical rows side by side on the Dashboard).
 * Its id (`todays-tasks`) was also dropped from `Utill::DASHBOARD_WIDGET_IDS`,
 * so it can't be re-added via "Customize dashboard" either. Left in place
 * rather than deleted, same "supersede don't delete" posture this codebase
 * already applies elsewhere.
 *
 * "Today's Tasks" — the mockup mixes completed items ("Scan completed")
 * with pending/scheduled ones ("Plugin update pending", "Weekly report at
 * 6 PM"). Nothing in this codebase tracks upcoming/scheduled tasks (only
 * `/activity-logs`, a record of things that already happened), so this
 * widget only ever shows real completed activity — same
 * `/activity-logs` endpoint RecentActivityWidget already uses, just a
 * shorter list read as "today's" instead of "recent".
 */
const TodaysTasksWidget: React.FC<WidgetProps> = ({
	onHide,
	isCustomizing,
}) => {
	const { data, isLoading, error, refetch } = useApiList<ActivityLogRow>(
		'activity-logs',
		{ per_page: 4 }
	);

	return (
		<DashboardWidget
			title={__("Today's Tasks", 'vulopilot')}
			icon="clock"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
			headerAction={
				<a href="?page=vulopilot#&tab=reports&subtab=activity">
					{__('Show details', 'vulopilot')}{' '}
					<i className="adminfont-arrow-right" />
				</a>
			}
		>
			{error ? (
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load tasks', 'vulopilot')}
					desc={error}
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={refetch}
				/>
			) : data.length === 0 ? (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing has happened yet today', 'vulopilot')}
					desc={__(
						'Completed scans, automations, and AI actions will show up here.',
						'vulopilot'
					)}
				/>
			) : (
				<ListComponent
					className="mini-card report"
					items={data.map((row) => ({
						id: String(row.id),
						title: row.message,
						icon: 'plus yellow',
						tags: (
							<span className="desc">
								{formatWpDate(row.created_at)}
							</span>
						),
					}))}
				/>
			)}
		</DashboardWidget>
	);
};

export default TodaysTasksWidget;
