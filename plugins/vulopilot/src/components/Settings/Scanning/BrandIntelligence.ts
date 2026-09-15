import { __ } from '@wordpress/i18n';

/**
 * New Scanning → Brand Intelligence tab
 * (BRAND-INTELLIGENCE-MODULE.md). Only one new scan-behavior setting here
 * — `brand_about_page_min_words`, read by this module's own
 * AboutPageAnalysisScanner. `flag_missing_schema` (read by this module's
 * OrganizationSchemaScanner too) already lives under Scanning → SEO and
 * isn't duplicated here. `geo_competitor_urls` (read by vulopilot-pro's
 * BrandIntelligence\BrandCompetitorAnalyzer, ContentIntelligence\
 * ContentGapAnalyzer, and GeoInsights\CompetitorVisibilityAnalyzer) used
 * to live under Scanning → AI Visibility — moved here, right below
 * "Tracked competitors," per direct instruction; see that field's own
 * docblock below for why its `moduleEnabled` gate didn't move to match.
 * The alert threshold for Brand Score drops follows Scanning → GEO's own
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
			// Moved here from Settings → Scanning → AI Visibility
			// (`geo_competitor_urls`, same key, same real backend — this is
			// a pure UI relocation) per direct instruction. Still gated
			// `moduleEnabled: 'geo'` (the free, always-active GEO module,
			// not a Pro one) rather than `brand-intelligence` — this field
			// is shared by three different Pro modules'
			// analyzers (BrandIntelligence\BrandCompetitorAnalyzer,
			// ContentIntelligence\ContentGapAnalyzer, GeoInsights\
			// CompetitorVisibilityAnalyzer, per this file's own top
			// docblock), so gating it to just one of them would be wrong.
			//
			// The name+URL `tracked_competitors` `ExpandablePanelInput`
			// that used to sit here (right below the "Tracked competitors"
			// section header, above this field) was removed entirely per a
			// later, separate direct instruction — it was never read by
			// any real PHP consumer (see this file's own git history), so
			// this bare-URL field is now the section's only real setting.
			key: 'geo_competitor_urls',
			type: 'textarea',
			label: __('Competitor URLs', 'vulopilot'),
			settingDescription: __(
				'One competitor URL per line. Powers the GEO page\'s Competitor Visibility comparison (VuloPilot Pro).',
				'vulopilot'
			),
			moduleEnabled: 'geo',
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
