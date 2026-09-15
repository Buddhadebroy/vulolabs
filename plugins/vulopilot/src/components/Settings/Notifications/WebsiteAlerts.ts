import { __ } from '@wordpress/i18n';

/**
 * Settings → Notifications → Website Alerts ("Critical issue alerts").
 *
 * Real backend: Services\ScanPersistenceListener::maybe_notify_critical_findings() —
 * already emailed on any critical-severity finding, any category, before
 * this tab existed.
 *
 * This tab used to open with its own `notify_on_critical_findings` master
 * "Enabled" toggle above "Notify me about" — removed per direct
 * instruction. That was the only real UI control for that backend option
 * anywhere in this codebase (confirmed: no other Settings tab reads or
 * writes it), so removing it means critical-issue notifications now always
 * follow whatever `notify_on_critical_findings` defaults to server-side
 * (Utill::VULOPILOT_SETTINGS_DEFAULTS) — there's no way left to turn the
 * whole category off from the UI, only to adjust which types/channels it
 * uses below.
 *
 * "Notify me about" is a real zyra `type: 'setting-row'` field (per direct
 * instruction — same field type SecurityAlerts.ts's own
 * `security_alert_types` already uses, `control: { checkbox: true }` per
 * row since none of these five have their own sub-configuration) —
 * `critical_alert_types` (Utill::VULOPILOT_SETTINGS_DEFAULTS) is still a
 * flat array of enabled type keys, unchanged from when this was a plain
 * `type: 'checkbox'` field — only the row-list presentation changed. Four
 * map to real finding categories (ScanPersistenceListener::CRITICAL_ALERT_CATEGORIES);
 * 'other' is the honest catch-all for every category not called out by its
 * own row (woocommerce, database, links, and the rest) — see that
 * constant's own docblock.
 *
 * "Notification channel" mirrors AiCrawlerAlerts.ts's own
 * `crawler_alert_channels` field, its own independent
 * `critical_alert_channels` key — 'dashboard' defaults off here (unlike
 * the other three Notifications tabs): a critical finding already gets a
 * real, permanent `vulopilot_scan_findings` row of its own, so a duplicate
 * activity-log entry is more optional than for a score-drop/crawler-alert
 * event that leaves no other record. No 'mobile' option for the same
 * reason those tabs already document — no real push-delivery mechanism
 * exists anywhere in this codebase yet.
 */
export default {
	id: 'website-alerts',
	priority: 5,
	headerTitle: __('Critical issue alerts', 'vulopilot'),
	headerDescription: __(
		'Get notified immediately when critical issues are found on your website.',
		'vulopilot'
	),
	headerIcon: 'warning',
	submitUrl: 'settings',
	modal: [
		{
			// zyra's real `type: 'setting-row'` field (per direct
			// instruction) — see this file's own docblock for why
			// `control: { checkbox: true }` fits this flat multi-select
			// array field, same shape SecurityAlerts.ts's own
			// `security_alert_types` already uses. `label` now renders for
			// real (fixed at the source — see AiCrawlerAlerts.ts's own
			// `crawler_alerts` field docblock), so the old
			// "website-alerts-notify-section" SectionComponent field that
			// used to fake this heading is gone.
			label: __('Notify me about', 'vulopilot'),
			key: 'critical_alert_types',
			type: 'setting-row',
			rows: [
				{
					valueKey: 'security',
					icon: 'security red',
					title: __('Security vulnerabilities', 'vulopilot'),
					desc: __(
						'High-risk security vulnerabilities and malware infections.',
						'vulopilot'
					),
					control: { checkbox: true },
				},
				{
					valueKey: 'availability',
					icon: 'error red',
					title: __('Website down', 'vulopilot'),
					desc: __(
						'Your website is not accessible or is returning errors.',
						'vulopilot'
					),
					control: { checkbox: true },
				},
				{
					valueKey: 'performance',
					icon: 'bar-chart orange',
					title: __('Critical performance issues', 'vulopilot'),
					desc: __(
						'Severe performance problems affecting your site speed or Core Web Vitals.',
						'vulopilot'
					),
					control: { checkbox: true },
				},
				{
					valueKey: 'seo',
					icon: 'search blue',
					title: __('SEO indexing problems', 'vulopilot'),
					desc: __(
						'Pages blocked from indexing or major crawling issues.',
						'vulopilot'
					),
					control: { checkbox: true },
				},
				{
					valueKey: 'other',
					icon: 'database gray',
					title: __('Data or functionality issues', 'vulopilot'),
					desc: __(
						'Problems affecting important site data or core functionality.',
						'vulopilot'
					),
					control: { checkbox: true },
				},
			],
		},
		{
			key: 'critical_alert_channels',
			type: 'checkbox',
			label: __('Notification channel', 'vulopilot'),
			options: [
				{ key: 'email', value: 'email', label: __('Email', 'vulopilot') },
				{ key: 'dashboard', value: 'dashboard', label: __('In-dashboard', 'vulopilot') },
			],
		},
		{
			key: 'website-alerts-notice',
			type: 'notice',
			noticeType: 'info',
			label: '',
			message: __(
				'You\'ll be notified instantly when any critical issue is detected. Mobile push notifications aren\'t available yet — Email and In-dashboard are the two real delivery channels today.',
				'vulopilot'
			),
		},
	],
};
