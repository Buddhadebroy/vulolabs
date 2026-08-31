import { createElement } from 'react';
import { __ } from '@wordpress/i18n';
import AiVisibilityScansHeader from './AiVisibilityScansHeader';

const STATUS_LABELS = { active: __('Active', 'vulopilot'), inactive: __('Inactive', 'vulopilot') };

/**
 * Settings → Scanning → AI Visibility.
 *
 * Redesigned to match a mockup: a 5-row `type: 'expandable-panel'` field
 * (`ai_visibility_scans`) up top — same real zyra component
 * Notifications/VisibilityAlerts.ts's own `visibility_alerts` field
 * already uses for its 3 rows — each row a real, honest scan-category
 * toggle, followed by the tab's pre-existing fields appended below
 * (Competitor URLs, llms.txt, entity Services/Locations, Crawler Traffic).
 *
 * Real backend: 7 previously-flat settings (`flag_missing_semantic`,
 * `flag_weak_entity`, `minimum_entity_mentions`, `flag_missing_ai_summary`,
 * `answer_first_words`, `min_data_points`, `stale_content_months`) were
 * migrated into this one nested `ai_visibility_scans` setting
 * (Utill::VULOPILOT_SETTINGS_DEFAULTS's own docblock has the full
 * migration list) — each row's `enable` is a REAL on/off switch its own
 * PHP scanner now checks:
 *   - 'structure'    → Scanners\Basic\GeoSemanticStructureScanner
 *   - 'entity'       → GeoAnalysis\GeoAnalyzer (entity_coverage AI dimension)
 *   - 'freshness'    → vulopilot-pro's GeoInsights\Scanners\StaleContentScanner
 *     (a genuinely NEW gate — this scanner always ran before)
 *   - 'answer_first' → Scanners\Basic\GeoSummaryBlockScanner
 *   - 'evidence'     → Scanners\Basic\GeoCitationOpportunityScanner
 *     (also a genuinely NEW gate — this scanner always ran before)
 * Each row's own threshold (min_mentions/stale_months/min_words/
 * min_data_points) lives in that same panel item's `formFields`, not a
 * separate flat setting duplicating the same value.
 *
 * "Restore Defaults" is AiVisibilityScansHeader.tsx — a real, scoped
 * reset (`POST /settings/reset-ai-visibility-scans`), not a UI-only
 * component field, since it needs to persist server-side and refresh
 * SettingContext in place. Set as this tab's own top-level `settingAction`
 * (per direct instruction, same as ContentSearch.ts's own "Restore
 * Defaults" and AiCrawlerAlerts.ts's own "Send Test Alert" — see either
 * file's own docblock), not Settings.tsx's GetForm() special-casing this
 * tab id anymore: `settingAction` is NavigatorComponent.tsx's own per-tab
 * header action slot (`renderSettingHeaderInfo()`'s `<SectionComponent
 * rightContent={activeFile.settingAction} />`, rendered once above every
 * tab's own fields using this exact settings object's own `headerTitle`/
 * `headerDescription`), so this now sits right next to "AI Visibility"
 * itself instead of as a bare block above the fields.
 */
export default {
	id: 'ai-visibility',
	priority: 1,
	headerTitle: __('AI Visibility', 'vulopilot'),
	headerDescription: __(
		'These scans help your content get understood by AI systems and shown in AI results.',
		'vulopilot'
	),
	headerIcon: 'global-community',
	submitUrl: 'settings',
	settingAction: createElement(AiVisibilityScansHeader),
	modal: [
		{
			key: 'ai_visibility_scans',
			type: 'expandable-panel',
			label: '',
			modal: [
				{
					id: 'structure',
					icon: 'editor-list',
					label: __('AI-readable structure', 'vulopilot'),
					desc: __(
						'Check if your pages use clear structure that AI systems can easily read and understand.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: STATUS_LABELS,
					formFields: [],
				},
				{
					id: 'entity',
					icon: 'centralized-connections',
					label: __('Entity clarity', 'vulopilot'),
					desc: __(
						'Analyze how clearly your brand, people, products, and topics are defined and connected.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: STATUS_LABELS,
					formFields: [
						{
							key: 'min_mentions',
							type: 'number',
							size: 5,
							label: __('Minimum entity mentions', 'vulopilot'),
							settingDescription: __(
								"Pages with fewer mentions of their primary entity than this are flagged as low-clarity.",
								'vulopilot'
							),
						},
					],
				},
				{
					id: 'freshness',
					icon: 'calendar',
					label: __('Content freshness', 'vulopilot'),
					desc: __(
						'Check how up-to-date your content is and how often it gets refreshed.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: STATUS_LABELS,
					formFields: [
						{
							key: 'stale_months',
							type: 'number',
							size: 5,
							label: __('Flag content older than (months)', 'vulopilot'),
							settingDescription: __(
								"Pages not updated within this window are flagged (Pro) and score lower on the GEO AI score's Content Freshness.",
								'vulopilot'
							),
						},
					],
				},
				{
					id: 'answer_first',
					icon: 'live-chat',
					label: __('Answer-first content', 'vulopilot'),
					desc: __(
						'Identify if your content answers real questions in a clear and direct way.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: STATUS_LABELS,
					formFields: [
						{
							key: 'min_words',
							type: 'number',
							size: 5,
							label: __('Answer-first threshold (words)', 'vulopilot'),
							settingDescription: __(
								"Flag a page if its core answer doesn't appear within this many words from the top.",
								'vulopilot'
							),
						},
					],
				},
				{
					id: 'evidence',
					icon: 'security',
					label: __('Evidence checks', 'vulopilot'),
					desc: __(
						'Check if your content includes citations, sources, and verifiable evidence.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: STATUS_LABELS,
					formFields: [
						{
							key: 'min_data_points',
							type: 'number',
							size: 5,
							label: __('Minimum data points per 500 words', 'vulopilot'),
							settingDescription: __(
								"Pages with fewer stats, numbers, or cited facts than this score lower on the GEO AI score's Data Point & Evidence Density.",
								'vulopilot'
							),
						},
					],
				},
			],
		},
		{
			key: 'ai-visibility-scans-notice',
			type: 'notice',
			noticeType: 'info',
			title: __('Why these scans matter', 'vulopilot'),
			message: __(
				'Strong AI visibility increases your chances of being referenced in AI answers and recommendations.',
				'vulopilot'
			),
		},
		{
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
			key: 'aeo-section-llms-txt',
			type: 'section',
			title: __('llms.txt', 'vulopilot'),
			settingDescription: __(
				'A Markdown index of your key pages, served at /llms.txt for AI systems to read instead of crawling your whole site.',
				'vulopilot'
			),
		},
		{
			key: 'enable_llms_txt',
			type: 'checkbox',
			look: 'toggle',
			label: __('Generate llms.txt', 'vulopilot'),
			settingDescription: __(
				"Available at your site's /llms.txt once enabled.",
				'vulopilot'
			),
			options: [
				{ key: 'enable_llms_txt', label: '', value: 'enable_llms_txt' },
			],
		},
		{
			key: 'llms_auto_regen',
			type: 'checkbox',
			look: 'toggle',
			label: __('Auto-regenerate on publish', 'vulopilot'),
			settingDescription: __(
				'Rebuild llms.txt whenever a page, post, or product is published or updated — requires the GEO module (Modules page) to be active.',
				'vulopilot'
			),
			options: [
				{ key: 'llms_auto_regen', label: '', value: 'llms_auto_regen' },
			],
			dependent: { key: 'enable_llms_txt', value: 'enable_llms_txt', set: true },
		},
		{
			key: 'llms_include_types',
			type: 'choice-toggle',
			label: __('Included content types', 'vulopilot'),
			settingDescription: __(
				'Which content types are listed in llms.txt.',
				'vulopilot'
			),
			options: [
				{ key: 'pages', label: __('Pages', 'vulopilot'), value: 'pages' },
				{ key: 'posts', label: __('Posts', 'vulopilot'), value: 'posts' },
				{ key: 'products', label: __('Products', 'vulopilot'), value: 'products' },
			],
			dependent: { key: 'enable_llms_txt', value: 'enable_llms_txt', set: true },
		},
		{
			// Not a real, independently-writable field here — the actual
			// enable/threshold live in the real, single nested
			// `visibility_alerts.geo` setting
			// (Utill::VULOPILOT_SETTINGS_DEFAULTS), edited on its own
			// dedicated Notifications tab instead. Same
			// "real `type: 'notice'` pointing elsewhere rather than a
			// second control duplicating the same setting" reasoning
			// AiCrawlerAlerts.ts's own traffic-drop-threshold-note
			// documents, just in the opposite direction (that one points
			// off this tab; this one points onto Notifications).
			key: 'aeo-drop-threshold-note',
			type: 'notice',
			noticeType: 'info',
			label: '',
			message: __(
				'GEO/AEO score drop alerts (and their threshold) are configured under <a href="?page=vulopilot#&tab=settings&subtab=visibility-alerts">Notifications → Visibility Alerts</a>.',
				'vulopilot'
			),
			moduleEnabled: 'geo',
		},
		{
			// Business Identity & Schema's own "Business Profile" card
			// (BusinessProfileCard.tsx) shows this back as-is under
			// "Business type" — real, owner-provided, same "no existing
			// concept to derive this automatically, so it's an
			// owner-curated field, empty (not fabricated) until set"
			// posture Services\EntityExtractor's own docblock already
			// establishes for `entity_service_pages`/`entity_business_locations`
			// below. A free-text field, not a fixed schema.org @type
			// picker — this only ever reaches the client as plain display
			// text (`Controllers\EntityExtraction::get_items()`), it
			// isn't written into any real Organization/LocalBusiness
			// JSON-LD anywhere in this codebase.
			key: 'entity-section-business',
			type: 'section',
			title: __('Business', 'vulopilot'),
			settingDescription: __(
				'What kind of business this is — shown on the Business Profile card, not written into any structured data.',
				'vulopilot'
			),
		},
		{
			key: 'entity_business_type',
			type: 'text',
			label: __('Business type', 'vulopilot'),
			settingDescription: __(
				'e.g. Software Company, Online Store, Consulting Agency.',
				'vulopilot'
			),
		},
		{
			key: 'entity-section-services',
			type: 'section',
			title: __('Services', 'vulopilot'),
			settingDescription: __(
				'One published page per line — a URL or a numeric page ID. Pages that don\'t resolve are skipped.',
				'vulopilot'
			),
		},
		{
			key: 'entity_service_pages',
			type: 'textarea',
			label: __('Service pages', 'vulopilot'),
			settingDescription: __(
				'e.g. https://example.com/consulting/ or just the page ID.',
				'vulopilot'
			),
		},
		{
			key: 'entity-section-locations',
			type: 'section',
			title: __('Locations', 'vulopilot'),
			settingDescription: __(
				'One location per line, as "Name | Address".',
				'vulopilot'
			),
		},
		{
			key: 'entity_business_locations',
			type: 'textarea',
			label: __('Business locations', 'vulopilot'),
			settingDescription: __(
				'e.g. Downtown Store | 123 Main St, Springfield.',
				'vulopilot'
			),
		},
		{
			// Not a real, independently-writable field here — see this
			// file's own `aeo-drop-threshold-note` above for the full
			// reasoning; same treatment, scoped to `visibility_alerts.kg`
			// instead of `.geo`.
			key: 'kg-health-drop-threshold-note',
			type: 'notice',
			noticeType: 'info',
			label: '',
			message: __(
				'Knowledge Graph Health drop alerts (and their threshold) are configured under <a href="?page=vulopilot#&tab=settings&subtab=visibility-alerts">Notifications → Visibility Alerts</a>.',
				'vulopilot'
			),
		},
		{
			key: 'crawler-traffic',
			type: 'section',
			title: __('Crawler Traffic', 'vulopilot'),
			settingDescription: __('', 'vulopilot'),
		},
		{
			key: 'enable_crawler_tracking',
			type: 'checkbox',
			look: 'toggle',
			label: __('Log AI crawler visits', 'vulopilot'),
			settingDescription: __(
				'No human visitor data is collected — only known AI bot user agents (GPTBot, ClaudeBot, PerplexityBot, and others).',
				'vulopilot'
			),
			options: [
				{
					key: 'enable_crawler_tracking',
					label: '',
					value: 'enable_crawler_tracking',
				},
			],
		},
		{
			key: 'log_retention',
			type: 'select',
			label: __('Log retention', 'vulopilot'),
			size: 7,
			settingDescription: __(
				'How long AI crawler visit logs are kept before automatic cleanup. VuloPilot Pro extends this further (Historical Logs).',
				'vulopilot'
			),
			options: [
				{ label: __('7 days', 'vulopilot'), value: '7' },
				{ label: __('30 days', 'vulopilot'), value: '30' },
				{ label: __('90 days', 'vulopilot'), value: '90' },
				{ label: __('1 year', 'vulopilot'), value: '365' },
			],
		},
		{
			key: 'crawler_volume_drop_threshold_percent',
			type: 'number',
			size: 5,
			label: __(
				'Crawl volume drop alert threshold (%)',
				'vulopilot'
			),
			settingDescription: __(
				'Used by the "Email me on AI crawler alerts" notification in the Notifications tab, when today\'s AI crawler visit volume falls this much below the trailing 7-day average.',
				'vulopilot'
			),
		},
	],
};
