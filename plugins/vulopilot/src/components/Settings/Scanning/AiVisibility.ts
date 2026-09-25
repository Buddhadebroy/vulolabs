import { createElement } from 'react';
import { __ } from '@wordpress/i18n';
import AiVisibilityScansHeader from './AiVisibilityScansHeader';

const STATUS_LABELS = { active: __('Active', 'vulopilot'), inactive: __('Inactive', 'vulopilot') };

/**
 * Settings → Scanning → AI Visibility.
 *
 * Redesigned to match a mockup: a 5-row `type: 'expandable-panel'` field
 * (`ai_visibility_scans`) up top - same real zyra component
 * Notifications/VisibilityAlerts.ts's own `visibility_alerts` field
 * already uses for its 3 rows - each row a real, honest scan-category
 * toggle, followed by the tab's pre-existing fields appended below
 * (llms.txt, Crawler Traffic - "Competitor URLs" and "Business"/
 * "Services"/"Locations" used to live here too, both moved out to
 * Settings → Get Started → Business Information per direct
 * instruction - "Competitor URLs" by way of the now-deleted Settings →
 * Scanning → Brand Intelligence tab, which it moved through before
 * landing there for good).
 *
 * "Restore Defaults" is AiVisibilityScansHeader.tsx - a real, scoped
 * reset (`POST /settings/reset-ai-visibility-scans`), not a UI-only
 * component field, since it needs to persist server-side and refresh
 * SettingContext in place. Set as this tab's own top-level `settingAction`
 * (per direct instruction, same as AiCrawlerAlerts.ts's own "Send Test
 * Alert" - see that file's own docblock), not Settings.tsx's GetForm() special-casing this
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
	groupBySections: true,
	hideSettingHeader: true,
	headerIcon: 'global-community',
	submitUrl: 'settings',
	settingAction: createElement(AiVisibilityScansHeader),
	modal: [
		{
			key: 'general_settings',
			type: 'section',
			icon: 'setting',
			title: __('AI Visibility scan', 'vulopilot'),
			desc: __('Controls how VuloPilot monitors your site for issues that affect whether AI assistants reference or recommend it.', 'vulopilot'),
		},
		{
			key: 'ai_visibility_scans',
			type: 'expandable-panel',
			label: 'AI Visibility Scans',
			className: 'full-width',
			row: false,
			modal: [
				{
					id: 'entity',
					icon: 'centralized-connections yellow',
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
					icon: 'calendar pink',
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
								"Pages not updated within this window are flagged and score lower on the GEO AI score's Content Freshness.",
								'vulopilot'
							),
						},
					],
				},
				{
					id: 'answer_first',
					icon: 'live-chat lime',
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
					icon: 'security orange',
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
		// "Competitor URLs" (`geo_competitor_urls`) moved out to Settings →
		// Get Started → Business Information, right below "Tracked
		// competitors" per direct instruction - see that file's own
		// docblock (moved there from the now-deleted Settings → Scanning →
		// Brand Intelligence tab, which it moved through first).
		{
			key: 'aeo-section-llms-txt',
			type: 'section',
			icon: 'document',
			title: __('llms.txt', 'vulopilot'),
			desc: __(
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
				"Creates a Markdown index at /llms.txt, giving AI systems a structured list of your selected content.",
				'vulopilot'
			),
			options: [
				{ key: 'enable_llms_txt', label: '', value: 'enable_llms_txt' },
			],
			moduleEnabled: 'answer-engine-optimization',
		},
		{
			key: 'llms_auto_regen',
			type: 'checkbox',
			look: 'toggle',
			label: __('Auto-regenerate on publish', 'vulopilot'),
			settingDescription: __(
				'Rebuild llms.txt whenever a page, post, or product is published or updated - requires the GEO module (Modules page) to be active.',
				'vulopilot'
			),
			options: [
				{ key: 'llms_auto_regen', label: '', value: 'llms_auto_regen' },
			],
			dependent: { key: 'enable_llms_txt', value: 'enable_llms_txt', set: true },
			moduleEnabled: 'answer-engine-optimization',
		},
		{
			key: 'llms_include_types',
			// `type: 'checkbox'` + `selectDeselect: true` - real
			// InputRenderer-native multicheckbox rendering (a real checkbox
			// per option, each independently on/off) instead of the former
			// `choice-toggle` segmented-pill look, same conversion
			// Sitemap.ts's own "Post types in sitemap"/"Taxonomies in
			// sitemap" fields already got.
			type: 'checkbox',
			selectDeselect: true,
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
			moduleEnabled: 'answer-engine-optimization',
			dependent: { key: 'enable_llms_txt', value: 'enable_llms_txt', set: true },
		},
		{
			// Not a real, independently-writable field here - the actual
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
			message: __('Content-freshness thresholds feed your GEO/AEO score . Get alerted when it drops under <a href="?page=vulopilot#&tab=settings&subtab=notifications">Notifications → Visibility Alerts</a>.',
				'vulopilot'
			),
			moduleEnabled: 'geo-analysis',
		},
		// "Business"/"Services"/"Locations" (entity_business_type/
		// entity_service_pages/entity_business_locations, plus the
		// Knowledge Graph Health drop-threshold notice that followed them)
		// moved out to Settings → Get Started → Business Information per
		// direct instruction - see GetStarted/BusinessInformation.ts's
		// own docblock.
		{
			key: 'crawler-traffic',
			type: 'section',
			icon: 'setting',
			title: __('Crawler Traffic', 'vulopilot'),
			desc: __('Monitor visits from recognized AI crawlers to understand their activity on your website and spot unusual drops.', 'vulopilot'),
		},
		{
			key: 'enable_crawler_tracking',
			type: 'checkbox',
			look: 'toggle',
			label: __('Log AI crawler visits', 'vulopilot'),
			settingDescription: __(
				'Records visits from recognized AI bot (GPTBot, ClaudeBot, PerplexityBot, and others), helping you track which crawlers access your website.',
				'vulopilot'
			),
			options: [
				{
					key: 'enable_crawler_tracking',
					label: '',
					value: 'enable_crawler_tracking',
				},
			],
			moduleEnabled: 'ai-crawler-tracking',
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
			moduleEnabled: 'ai-crawler-tracking',
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
			moduleEnabled: 'ai-crawler-tracking',
		},
	],
};
