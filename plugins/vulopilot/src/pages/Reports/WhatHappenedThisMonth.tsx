import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent, BadgeComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';

interface ActivityLogRow {
	id: number;
	event_type: string;
	message: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	created_at: string;
}

const EVENT_ICONS: Record<string, string> = {
	scan_completed: 'search',
	content_updated: 'edit',
	automation_run: 'automation',
};

/**
 * "What happened this month?" — real, via the same `/activity-logs`
 * endpoint ActivityTab.tsx's full table already reads, scoped to the most
 * recent 8 entries rather than every field that table shows.
 */
const WhatHappenedThisMonth = () => {
	const { data, isLoading } = useApiList<ActivityLogRow>('activity-logs', {
		per_page: 8,
		orderby: 'created_at',
		order: 'desc',
	});

	return (
		<CardComponent
			className="reports-timeline-card"
			title={__('What happened this month?', 'vulopilot')}
			titleIcon="calendar"
			desc={__('The 8 most recent scans, content updates, and automation runs.', 'vulopilot')}
			isLoading={isLoading}
		>
			{!isLoading && data.length === 0 && (
				<ModuleGuardComponent
					icon="calendar"
					title={__('Nothing yet', 'vulopilot')}
					desc={__(
						'Actions across VuloPilot will show up here.',
						'vulopilot'
					)}
				/>
			)}
			{!isLoading && data.length > 0 && (
				<ul className="reports-timeline-list">
					{data.map((row) => (
						<li key={row.id} className="reports-timeline-row">
							<span className="reports-timeline-date">
								{formatWpDate(row.created_at)}
							</span>
							<i
								className={`adminfont-${EVENT_ICONS[row.event_type] || 'check'} reports-timeline-icon`}
							/>
							<span className="reports-timeline-message">
								{row.message}
							</span>
							<BadgeComponent
								color={`badge-${row.severity}`}
								text={row.severity}
							/>
						</li>
					))}
				</ul>
			)}
		</CardComponent>
	);
};

export default WhatHappenedThisMonth;
