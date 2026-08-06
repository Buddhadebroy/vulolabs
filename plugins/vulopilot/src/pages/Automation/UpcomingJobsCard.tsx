import React from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { TRIGGER_TYPE_LABELS, SCHEDULE_TRIGGER_TYPES } from './automationLabels';

interface AutomationRow {
	id: number;
	name: string;
	trigger_type: string;
	status: 'enabled' | 'disabled';
}

/**
 * "Upcoming Jobs" — the mockup shows specific clock times per job. No REST
 * surface exposes wp-cron's actual next-run timestamp for automation
 * triggers (they fire via raw `wp_schedule_event`, not the
 * `vulopilot_scheduled_jobs` table Reports' scheduled-report feature reads,
 * and building one is out of this page's scope), so this shows each
 * enabled schedule-based automation's real cadence (Hourly/Daily/Weekly/
 * Monthly) instead of a fabricated time.
 */
const UpcomingJobsCard = () => {
	const { data, isLoading } = useApiList<AutomationRow>('automations', {
		per_page: 100,
	});

	const scheduled = data.filter(
		(automation) =>
			automation.status === 'enabled' &&
			SCHEDULE_TRIGGER_TYPES.includes(automation.trigger_type)
	);

	return (
		<CardComponent
			className="upcoming-jobs-card"
			titleIcon="clock"
			title={__('Upcoming Jobs', 'vulopilot')}
		>
			{!isLoading && scheduled.length === 0 ? (
				<ModuleGuardComponent
					icon="clock"
					title={__('No scheduled automations yet', 'vulopilot')}
					desc={__(
						'Create an hourly, daily, weekly, or monthly automation to see it here.',
						'vulopilot'
					)}
				/>
			) : (
				<ul className="upcoming-jobs-list">
					{scheduled.map((automation) => (
						<li key={automation.id}>
							<span className="upcoming-jobs-name">
								{automation.name}
							</span>
							<span className="admin-badge blue">
								{TRIGGER_TYPE_LABELS[automation.trigger_type] ??
									automation.trigger_type}
							</span>
						</li>
					))}
				</ul>
			)}
		</CardComponent>
	);
};

export default UpcomingJobsCard;
