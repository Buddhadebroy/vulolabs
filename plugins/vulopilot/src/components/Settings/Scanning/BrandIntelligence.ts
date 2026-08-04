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
	headerIcon: 'person',
	submitUrl: 'settings',
	modal: [
		{
			key: 'tracked_competitors',
			type: 'expandable-panel',
			label: __('Tracked competitors', 'multivendorx'),
			settingDescription: __(
				'Used to calculate Share of Voice on the Brand Visibility page.',
				'multivendorx'
			),
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
			desc: __(
				'Controls the Brand page\'s About Page Analysis finding — evaluated only for sites that already have an About-shaped page.',
				'vulopilot'
			),
		},
		{
			key: 'brand_about_page_min_words',
			type: 'number',
			label: __('Minimum About page word count', 'vulopilot'),
			desc: __(
				'An About page under this word count is flagged as too thin to be a genuine trust signal.',
				'vulopilot'
			),
		},
		{
			key: 'brand-section-alerts',
			type: 'section',
			title: __('Alerts', 'vulopilot'),
		},
		{
			key: 'brand_drop_threshold',
			type: 'number',
			label: __('Brand score drop alert threshold (points)', 'vulopilot'),
			desc: __(
				'Used by the "Email me when Brand score drops" notification in the Notifications tab.',
				'vulopilot'
			),
		},
	],
};
