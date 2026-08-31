import { __ } from '@wordpress/i18n';

/**
 * Settings → Connections → PageSpeed Insights.
 *
 * Moved from the old Settings → Scanning → Performance tab, same
 * "Connections folder, not Scanning" precedent GoogleServices.ts's own
 * docblock documents — `psi_api_key` is unchanged (Utill::VULOPILOT_SETTINGS_DEFAULTS,
 * read by Services\PageSpeedInsightsFetcher), just relocated and restyled
 * to match a mockup. `id` changed from the old tab's `'performance'` to
 * `'pagespeed-insights'` (this folder has no existing `'performance'` id to
 * collide with) — PerformanceScoreCard.tsx's/SlowPagesTab.tsx's own
 * "no PSI connected" deep links were updated to match.
 *
 * `psi_daily_limit` is a real, new setting (Utill::VULOPILOT_SETTINGS_DEFAULTS)
 * — a soft cap Services\PageSpeedInsightsFetcher now checks before every
 * real Google API call (cron and Test Connection alike), protecting the
 * site owner's own PSI quota. The mockup's "Connection Status" pill,
 * "Daily API Usage" bar, and "Test Connection" button are real too, but
 * rendered by PageSpeedStatusPanel.tsx (Settings.tsx's own GetForm(),
 * appended BEFORE this tab's fields) rather than declared here — they read
 * live state (`GET /settings/test-pagespeed`) and trigger a real API call
 * (`POST /settings/test-pagespeed`), neither of which fits a static
 * `modal[]` field.
 *
 * The mockup's "Default Strategy" and "Analysis Location" controls aren't
 * reproduced here — see PageSpeedStatusPanel.tsx's own docblock for why
 * neither has a real backend to bind to.
 */
export default {
	id: 'pagespeed-insights',
	priority: 3,
	headerTitle: __('PageSpeed Insights', 'vulopilot'),
	headerDescription: __(
		'Connect PageSpeed Insights API to analyze your site speed, Core Web Vitals, and get actionable optimization suggestions.',
		'vulopilot'
	),
	headerIcon: 'analytics',
	submitUrl: 'settings',
	modal: [
		{
			key: 'psi_api_key',
			type: 'password',
			size: 30,
			label: __('API Key', 'vulopilot'),
			settingDescription: __(
				'Enter your Google PageSpeed Insights API key.',
				'vulopilot'
			),
		},
		{
			key: 'psi_daily_limit',
			type: 'number',
			size: 30,
			label: __('Daily API Limit', 'vulopilot'),
			settingDescription: __(
				'Set the maximum number of requests VuloPilot can make per day. Leave at 0 for unlimited (subject to your API plan limits).',
				'vulopilot'
			),
		},
		{
			key: 'pagespeed-about-notice',
			type: 'notice',
			noticeType: 'info',
			message: __(
				'VuloPilot uses PageSpeed Insights API data to show speed reports under <a class="link-item">Improve My Speed.</a> <br/> <a class="link-item"> We only read performance data and never make changes to your site. </a>',
				'vulopilot'
			),
		},
	],
};
