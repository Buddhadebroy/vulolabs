import { __ } from '@wordpress/i18n';
import { NoticeComponent } from '@zyra/components';

const SCHEDULED_REPORTS_URL =
	'?page=vulopilot#&tab=reports&subtab=scheduled-reports';

/**
 * The mockup's closing "Keep everyone updated automatically" banner — a
 * real link to the new "Scheduled Reports" tab (Reports.tsx), where
 * ReportSchedulesSummary.tsx's own real weekly/monthly status cards (and,
 * with Pro's Advanced Reports module, the real create/edit schedule UI)
 * already live.
 *
 * `type="banner"` + `displayPosition="inline"` — zyra's own
 * NoticeComponent.tsx docblock cites this exact banner as the reference its
 * trailing `actionLabel`/`onAction` slot was built to match. Two visual
 * trade-offs accepted going through the shared component instead of custom
 * markup: NoticeComponent's icon is always `adminfont-${type}`, and
 * `adminfont-banner` isn't a real glyph (only `adminfont-alarm`, this
 * banner's original icon, is), so no icon renders now; `actionLabel` is
 * plain text with no icon slot, so the button's "calendar" icon is gone
 * too. Both explicitly accepted over adding a new escape-hatch prop.
 */
const ScheduleReportBanner = () => (
	<NoticeComponent
		type="banner"
		displayPosition="inline"
		title={__('Keep everyone updated automatically', 'vulopilot')}
		message={__(
			'Schedule reports to send to yourself or your team. Choose the frequency, recipients, and what to include.',
			'vulopilot'
		)}
		actionLabel={__('Schedule a Report', 'vulopilot')}
		onAction={() => {
			window.location.href = SCHEDULED_REPORTS_URL;
		}}
	/>
);

export default ScheduleReportBanner;
