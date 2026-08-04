import { __ } from '@wordpress/i18n';

export default {
	id: 'ai-visibility',
	priority: 1,
	headerTitle: __('AI Visibility', 'vulopilot'),
	headerIcon: 'global-community',
	submitUrl: 'settings',
	modal: [
		{
			key: 'geo-section',
			type: 'section',
			title: __('GEO', 'vulopilot'),
		},
		{
			key: 'geo_competitor_urls',
			type: 'textarea',
			label: __('Competitor URLs', 'vulopilot'),
			desc: __(
				'One competitor URL per line. Powers the GEO page\'s Competitor Visibility comparison (VuloPilot Pro).',
				'vulopilot'
			),
			moduleEnabled: 'geo',
		},
		{
			key: 'semantic_html',
			type: 'section',
			title: __('Structure & semantic HTML', 'vulopilot'),
			desc: __(
				"Controls the GEO page's 'Structure' findings group.",
				'vulopilot'
			),
		},
		{
			key: 'flag_missing_semantic',
			type: 'checkbox',
			look: 'toggle',
			label: __('Flag missing semantic HTML', 'vulopilot'),
			desc: __( "", 'vulopilot' ),
			options: [
				{ key: 'flag_missing_semantic', label: '', value: 'flag_missing_semantic' },
			],
		},
		{
			key: 'entity-section',
			type: 'section',
			title: __('Entity coverage', 'vulopilot'),
			desc: __(
				"Feeds VuloPilot Pro's per-post GEO AI Score — doesn't affect the GEO page's free 'Entities & Trust' findings list below, which checks author info and naming consistency instead.",
				'vulopilot'
			),
		},
		{
			key: 'flag_weak_entity',
			type: 'checkbox',
			look: 'toggle',
			label: __('Flag weak entity coverage', 'vulopilot'),
			desc: __(
				"Pages that don't clearly identify their primary entity (product, service, or organization).",
				'vulopilot'
			),
			options: [
				{ key: 'flag_weak_entity', label: '', value: 'flag_weak_entity' },
			],
		},
		{
			key: 'minimum_entity_mentions',
			type: 'number',
			label: __('Minimum entity mentions', 'vulopilot'),
			desc: __(
				"Pages with fewer mentions of their primary entity than this are flagged as low-clarity.",
				'vulopilot'
			),
		},
		{
			key: 'freshness-section',
			type: 'section',
			title: __('Freshness', 'vulopilot'),
		},
		{
			key: 'stale_content_months',
			type: 'number',
			label: __('Flag content older than (months)', 'vulopilot'),
			desc: __(
				"Pages not updated within this window score lower on the GEO AI score's Content Freshness (Pro).",
				'vulopilot'
			),
		},
		{
			key: 'aeo-section',
			type: 'section',
			title: __('AEO', 'vulopilot'),
		},
		{
            key: 'aeo-section-llms-txt',
            type: 'section',
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
            desc: __(
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
            desc: __(
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
            desc: __(
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
            key: 'llms_txt_content',
            type: 'textarea',
            label: __('llms.txt content', 'vulopilot'),
            desc: __(
                'Pre-filled with an auto-generated index of your published pages and posts — edit and it saves automatically, just like every other setting here, and is written straight to the live /llms.txt file.',
                'vulopilot'
            ),
            dependent: { key: 'enable_llms_txt', value: 'enable_llms_txt', set: true },
        },
        {
            key: 'aeo-section-ai-summary',
            type: 'section',
            title: __('AI summary & answer structure', 'vulopilot'),
        },
        {
            key: 'flag_missing_ai_summary',
            type: 'checkbox',
            look: 'toggle',
            label: __('Flag pages missing an AI summary block', 'vulopilot'),
            desc: __(
                'Pages with no clear, extractable answer near the top of the content.',
                'vulopilot'
            ),
            options: [
                { key: 'flag_missing_ai_summary', label: '', value: 'flag_missing_ai_summary' },
            ],
        },
        {
            key: 'answer_first_words',
            type: 'number',
            label: __('Answer-first threshold (words)', 'vulopilot'),
            desc: __(
                "Flag a page if its core answer doesn't appear within this many words from the top.",
                'vulopilot'
            ),
            dependent: { key: 'flag_missing_ai_summary', value: 'flag_missing_ai_summary', set: true },
        },
        {
            key: 'aeo-section-evidence',
            type: 'section',
            title: __('Evidence & freshness', 'vulopilot'),
        },
        {
            key: 'min_data_points',
            type: 'number',
            label: __('Minimum data points per 500 words', 'vulopilot'),
            desc: __(
                "Pages with fewer stats, numbers, or cited facts than this score lower on the GEO AI score's Data Point & Evidence Density (Pro).",
                'vulopilot'
            ),
        },
        {
            key: 'aeo-section-alerts',
            type: 'section',
            title: __('Alerts', 'vulopilot'),
        },
        {
            key: 'aeo_drop_threshold',
            type: 'number',
            label: __('GEO/AEO score drop alert threshold (points)', 'vulopilot'),
            desc: __(
                'Used by the "Email me when GEO score drops" notification in the Notifications tab.',
                'vulopilot'
            ),
            moduleEnabled: 'geo',
        },
		{
			key: 'entity-extraction-section',
			type: 'section',
			title: __('Entity Extraction', 'vulopilot'),
		},
		{
			key: 'entity-section-services',
			type: 'section',
			title: __('Services', 'vulopilot'),
			desc: __(
				'One published page per line — a URL or a numeric page ID. Pages that don\'t resolve are skipped.',
				'vulopilot'
			),
		},
		{
			key: 'entity_service_pages',
			type: 'textarea',
			label: __('Service pages', 'vulopilot'),
			desc: __(
				'e.g. https://example.com/consulting/ or just the page ID.',
				'vulopilot'
			),
		},
		{
			key: 'entity-section-locations',
			type: 'section',
			title: __('Locations', 'vulopilot'),
			desc: __(
				'One location per line, as "Name | Address".',
				'vulopilot'
			),
		},
		{
			key: 'entity_business_locations',
			type: 'textarea',
			label: __('Business locations', 'vulopilot'),
			desc: __(
				'e.g. Downtown Store | 123 Main St, Springfield.',
				'vulopilot'
			),
		},
		{
			key: 'entity-section-alerts',
			type: 'section',
			title: __('Alerts', 'vulopilot'),
		},
		{
			key: 'kg_health_drop_threshold',
			type: 'number',
			label: __(
				'Knowledge Graph Health drop alert threshold (points)',
				'vulopilot'
			),
			desc: __(
				'Used by the "Email me when Knowledge Graph Health drops" notification in the Notifications tab.',
				'vulopilot'
			),
		},
		{
			key: 'crawler-traffic-section',
			type: 'section',
			title: __('Crawler Traffic', 'vulopilot'),
		},
		{
			key: 'crawler-traffic',
			type: 'section',
			title: __('Crawler Traffic', 'vulopilot'),
			desc: __('', 'vulopilot'),
		},
		{
			key: 'enable_crawler_tracking',
			type: 'checkbox',
			look: 'toggle',
			label: __('Log AI crawler visits', 'vulopilot'),
			desc: __(
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
			desc: __(
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
			key: 'crawler-analytics-section-alerts',
			type: 'section',
			title: __('Alerts', 'vulopilot'),
			desc: __(
				'Read by vulopilot-pro\'s AI Crawler Alerts — sitewide AI crawler visit-volume monitoring, not per-page findings.',
				'vulopilot'
			),
		},
		{
			key: 'crawler_volume_drop_threshold_percent',
			type: 'number',
			label: __(
				'Crawl volume drop alert threshold (%)',
				'vulopilot'
			),
			desc: __(
				'Used by the "Email me on AI crawler alerts" notification in the Notifications tab, when today\'s AI crawler visit volume falls this much below the trailing 7-day average.',
				'vulopilot'
			),
		},
	],
};
