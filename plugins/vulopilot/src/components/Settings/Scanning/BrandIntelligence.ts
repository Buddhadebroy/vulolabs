import { __ } from '@wordpress/i18n';

/**
 * New Scanning → Brand Intelligence tab
 * (BRAND-INTELLIGENCE-MODULE.md). Only one new scan-behavior setting here
 * — `brand_about_page_min_words`, read by this module's own
 * AboutPageAnalysisScanner. `flag_missing_schema` (read by this module's
 * OrganizationSchemaScanner too) already lives under Scanning → SEO and
 * isn't duplicated here; `geo_competitor_urls` (read by vulopilot-pro's
 * BrandCompetitorAnalyzer) already lives under Scanning → GEO. The alert
 * threshold for Brand Score drops follows Scanning → GEO's own
 * `geo_drop_threshold` placement convention below.
 */
export default {
	id: 'brand-intelligence',
	// Sorts after Content Intelligence (2.4), before GEO (3).
	priority: 4,
	headerTitle: __('Brand Intelligence', 'vulopilot'),
	headerDescription: __(
		'Brand visibility tracking and trust-signal checks.',
		'vulopilot'
	),
	groupBySections: true,
	hideSettingHeader: true,
	headerIcon: 'person',
	submitUrl: 'settings',
	modal: [
		{
			key: 'general_settings',
			type: 'section',
			icon: 'person',
			title: __('Tracked competitors', 'vulopilot'),
			desc: __(
		'Used to calculate Share of Voice on the Brand Visibility page.',
		'vulopilot'
	),
		},
		{
			key: 'tracked_competitors',
			type: 'expandable-panel',
			className: 'full-width',
			label: __('', 'vulopilot'),
			addNewBtn: true,
			addNewTemplate: {
				label: 'New competitors',
				editableFields: {
					title: true,
					description: false,
				},
				disableBtn: false,
			}
		},
		{
			key: 'brand-section-about-page',
			type: 'section',
			title: __('About Page', 'vulopilot'),
			icon: 'web-page-website',
			desc: __(
				'Controls the Brand page\'s About Page Analysis finding — evaluated only for sites that already have an About-shaped page.',
				'vulopilot'
			),
		},
		{
			key: 'brand_about_page_min_words',
			type: 'number',
			size: 10,
			label: __('Minimum About page word count', 'vulopilot'),
			settingDescription: __(
				'An About page under this word count is flagged as too thin to be a genuine trust signal.',
				'vulopilot'
			),
		},
		{
			// Not a real, independently-writable field here — see
			// AiVisibility.ts's own `aeo-drop-threshold-note` for the full
			// reasoning; same treatment, scoped to `visibility_alerts.brand`
			// instead of `.geo`.
			key: 'brand-drop-threshold-note',
			type: 'notice',
			noticeType: 'info',
			label: '',
			message: __(
				'Brand score drop alerts (and their threshold) are configured under <a href="?page=vulopilot#&tab=settings&subtab=visibility-alerts">Notifications → Visibility Alerts</a>.',
				'vulopilot'
			),
		},
	],
};
