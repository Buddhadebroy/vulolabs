import { __ } from '@wordpress/i18n';

/**
 * New Scanning → Crawler Analytics tab (AI-CRAWLER-ANALYTICS-MODULE.md).
 * `flag_ai_crawler_blocked_pages` (read by
 * Scanners\Basic\AiCrawlerBlockedPagesScanner) already lives under
 * Scanning → SEO and isn't duplicated here, since that scanner's category
 * is 'seo' and its findings appear on the SEO page's Robots.txt section —
 * same "settings tab matches the finding's own category/page" convention
 * SEO.tsx's own docblock documents. The one setting genuinely new to this
 * tab is the alert threshold, following Scanning → GEO/Brand
 * Intelligence's own `geo_drop_threshold`/`brand_drop_threshold` placement
 * convention: the toggle lives in Notifications, the threshold lives here.
 */
export default {
	id: 'crawler-analytics',
	// Sorts after Brand Intelligence (2.5), before GEO (3).
	priority: 2.75,
	headerTitle: __('Crawler Analytics', 'vulopilot'),
	headerIcon: 'globe',
	submitUrl: 'settings',
	modal: [
		{
			key: 'crawler-traffic',
			type: 'section',
			title: __('Crawler Traffic', 'vulopilot'),
			desc: __('', 'vulopilot'),
		},
		{
			key: 'log_ai_crawler_visits',
			type: 'checkbox',
			look: 'toggle',
			label: __('Log AI crawler visits', 'vulopilot'),
			desc: __(
				'No human visitor data is collected — only known AI bot user agents (GPTBot, ClaudeBot, PerplexityBot, and others).',
				'vulopilot'
			),
			options: [
				{
					key: 'log_ai_crawler_visits',
					label: '',
					value: 'log_ai_crawler_visits',
				},
			],
		},
		{
			key: 'log_retention',
			type: 'select',
			label: __('Log retention', 'vulopilot'),
			desc: __(
				'Free keeps the last 7 days. Longer retention needs the AI Crawler Intelligence Pro tier',
				'vulopilot'
			),
			options: [
				{ label: __('7 days', 'vulopilot'), value: '7' },
				{ label: __('30 days', 'vulopilot'), value: '30' },
				{ label: __('90 days', 'vulopilot'), value: '90' },
				{ label: __('1 year', 'vulopilot'), value: '1' },
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
