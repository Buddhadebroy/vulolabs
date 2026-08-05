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
						icon: '',
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
