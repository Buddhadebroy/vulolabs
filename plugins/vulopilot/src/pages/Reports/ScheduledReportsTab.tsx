import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import ReportSchedulesSummary from './ReportSchedulesSummary';

/**
 * Same slot ReportTab.tsx already registers Pro's Advanced Reports
 * schedule-management UI into (create/edit/delete a schedule, pick
 * recipients/cadence/format) — read again here so the "Scheduled Reports"
 * tab is a real, complete home for schedule management rather than only
 * the read-only summary cards below.
 */
const AdvancedReportsPanel = applyFilters(
	'vulopilot_reports_advanced_panel',
	null
) as ComponentType | null;

/**
 * "Scheduled Reports" tab of "Reports" — the mockup's own 3rd tab.
 * ReportSchedulesSummary.tsx (real weekly/monthly `last_run_at`/
 * `next_run_at`/`is_enabled` status, already built) plus the same
 * Pro-gated schedule-management panel ReportTab.tsx already surfaces —
 * this tab is a real, dedicated home for both rather than a new page
 * built from scratch.
 */
const ScheduledReportsTab = () => (
	<ContainerComponent general>
		<ColumnComponent>
			<h2 className="reports-schedules-tab-title">
				{__('Scheduled Reports', 'vulopilot')}
			</h2>
			<p className="reports-schedules-tab-desc">
				{__(
					'Automatic weekly and monthly reports, sent on their own schedule.',
					'vulopilot'
				)}
			</p>
			<ReportSchedulesSummary />
			{AdvancedReportsPanel && <AdvancedReportsPanel />}
		</ColumnComponent>
	</ContainerComponent>
);

export default ScheduledReportsTab;
