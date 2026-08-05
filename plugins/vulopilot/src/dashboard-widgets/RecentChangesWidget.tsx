import React from 'react';
import { __ } from '@wordpress/i18n';
import { ActivityListComponent, ModuleGuardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useApiList } from '../services/useApiList';
import { formatWpDate } from '../services/formatWpDate';
import { WidgetProps } from './types';

interface ActivityLogRow {
	id: number;
	event_type: string;
	message: string;
	actor_type: 'user' | 'system' | 'automation';
	created_at: string;
}

const EVENT_ICONS: Record<string, string> = {
	scan: 'search',
	content: 'edit',
	schema: 'code',
	performance: 'performance',
};

/**
 * "Recent Changes" — the mockup's 4-column grid of AI-attributed site
 * changes with an "Undo" link per row. Reads the same `/activity-logs`
 * endpoint RecentActivityWidget/TodaysTasksWidget use, filtered to
 * `actor_type=automation` (the closest existing field to "AI-attributed"
 * — there's no separate 'ai' actor type) so this widget shows a distinct
 * subset rather than duplicating RecentActivityWidget's unfiltered list.
 *
 * Undo is rendered but disabled: there's no revert capability for
 * arbitrary AI/automation actions in this codebase yet, so the control is
 * honestly inert (with a tooltip explaining why) rather than a button
 * that does nothing when clicked.
 */
const RecentChangesWidget: React.FC<WidgetProps> = ({
	onHide,
	isCustomizing,
}) => {
	const { data, isLoading, error, refetch } = useApiList<ActivityLogRow>(
		'activity-logs',
		{ actor_type: 'automation', per_page: 4 }
	);

	return (
		<DashboardWidget
			title={__('Recent Changes', 'vulopilot')}
			icon="update"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			{error ? (
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load recent changes', 'vulopilot')}
					desc={error}
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={refetch}
				/>
			) : data.length === 0 ? (
				<ModuleGuardComponent
					icon="update"
					title={__('No AI changes yet', 'vulopilot')}
					desc={__(
						'Changes VuloPilot makes automatically will show up here.',
						'vulopilot'
					)}
				/>
			) : (
				<ActivityListComponent
					isLoading={isLoading}
					items={data.map((row) => ({
						id: String(row.id),
						icon: EVENT_ICONS[row.event_type] ?? 'update',
						title: row.message,
						badge: <span className="admin-badge blue">AI</span>,
						timestamp: formatWpDate(row.created_at),
						action: {
							label: __('Undo', 'vulopilot'),
							icon: 'undo',
							disabled: true,
							disabledReason: __(
								"Undo isn't available yet for this change.",
								'vulopilot'
							),
						},
					}))}
				/>
			)}
		</DashboardWidget>
	);
};

export default RecentChangesWidget;
