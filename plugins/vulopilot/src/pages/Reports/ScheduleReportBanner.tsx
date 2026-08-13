import { __ } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';

const SCHEDULED_REPORTS_URL =
	'?page=vulopilot#&tab=reports&subtab=scheduled-reports';

/**
 * The mockup's closing "Keep everyone updated automatically" banner — a
 * real link to the new "Scheduled Reports" tab (Reports.tsx), where
 * ReportSchedulesSummary.tsx's own real weekly/monthly status cards (and,
 * with Pro's Advanced Reports module, the real create/edit schedule UI)
 * already live.
 */
const ScheduleReportBanner = () => (
	<div className="reports-schedule-banner">
		<i className="adminfont-alarm" />
		<div className="reports-schedule-banner-body">
			<p className="reports-schedule-banner-title">
				{__('Keep everyone updated automatically', 'vulopilot')}
			</p>
			<p className="reports-schedule-banner-desc">
				{__(
					'Schedule reports to send to yourself or your team. Choose the frequency, recipients, and what to include.',
					'vulopilot'
				)}
			</p>
		</div>
		<ButtonInput
			buttons={{
				text: __('Schedule a Report', 'vulopilot'),
				icon: 'calendar',
				color: 'purple-bg',
				onClick: () => {
					window.location.href = SCHEDULED_REPORTS_URL;
				},
			}}
		/>
	</div>
);

export default ScheduleReportBanner;
