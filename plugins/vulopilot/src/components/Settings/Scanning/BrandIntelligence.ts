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
			// `title` (the competitor's own real name/brand, editable
			// inline via `editableFields`) plus a real `url` field per
			// competitor (`addNewTemplate.formFields`, the same
			// declarative-field escape hatch BackupStoragePanel.tsx's own
			// `ExpandablePanelInput` methods use for their own per-method
			// fields — confirmed by reading the installed zyra bundle:
			// `buildMethodFromTemplate()` seeds `init[field.key] = ''` for
			// every `formFields` entry, and each renders through the same
			// field-type registry every other `modal` field here does, so
			// `type: 'text'` is a real, editable text input, not a
			// label-only display) — per direct instruction ("pass the url
			// also not only title"). Not yet read by any real PHP consumer
			// (unlike Scanning → AI Visibility's own `geo_competitor_urls`,
			// which vulopilot-pro's BrandCompetitorAnalyzer/
			// ContentGapAnalyzer/CompetitorVisibilityAnalyzer already read)
			// — BrandCompetitorAnalyzer's own docblock explicitly flags
			// needing "each competitor's own real brand name as a search
			// term, not just their URL" as a distinct, still-open gap for
			// real off-site Share of Voice tracking; this field now
			// captures exactly that pairing (name + URL) so a future pass
			// can wire it in, without duplicating `geo_competitor_urls`'s
			// own bare-URL shape.
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
				formFields: [
					{
						key: 'url',
						type: 'text',
						label: __('Competitor URL', 'vulopilot'),
						placeholder: 'https://example.com/',
					},
				],
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
