import { __ } from '@wordpress/i18n';

// Shared by every field below the master "Enabled" toggle — same
// `dependent` shape AiCrawlerAlerts.ts's own MASTER_ENABLED_DEPENDENT
// already uses, this tab's own master switch key instead.
const MASTER_ENABLED_DEPENDENT = { key: 'notify_on_critical_findings', value: 'notify_on_critical_findings', set: true };

/**
 * Settings → Notifications → Website Alerts ("Critical issue alerts").
 *
 * Real backend: Services\ScanPersistenceListener::maybe_notify_critical_findings() —
 * already emailed on any critical-severity finding, any category, before
 * this tab existed (Alert Preferences' own "Email me on critical findings"
 * is this same key's summary toggle, same "master switch lives on both its
 * own tab and a shorter summary elsewhere" shape `email_on_crawler_alerts`
 * already established). `notify_on_critical_findings` stays this tab's own
 * master switch — no new key invented for it.
 *
 * "Notify me about" is a real `type: 'checkbox'` field (not an
 * `expandable-panel` — none of these five have their own
 * sub-configuration, so a plain checklist is the honest fit, same choice
 * SecurityAlerts.ts's own "Notify me about" already makes) —
 * `critical_alert_types` (Utill::VULOPILOT_SETTINGS_DEFAULTS) is a flat
 * array of enabled type keys. Four map to real finding categories
 * (ScanPersistenceListener::CRITICAL_ALERT_CATEGORIES); 'other' is the
 * honest catch-all for every category not called out by its own row
 * (woocommerce, database, links, and the rest) — see that constant's own
 * docblock.
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
			key: 'notify_on_critical_findings',
			type: 'checkbox',
			look: 'toggle',
			label: __('Enabled', 'vulopilot'),
			settingDescription: __(
				'Master switch for every critical issue alert below — turn this off to silence all of them at once.',
				'vulopilot'
			),
			options: [
				{ key: 'notify_on_critical_findings', label: '', value: 'notify_on_critical_findings' },
			],
		},
		{
			key: 'website-alerts-notify-section',
			type: 'section',
			title: __('Notify me about', 'vulopilot'),
			dependent: MASTER_ENABLED_DEPENDENT,
		},
		{
			key: 'critical_alert_types',
			type: 'checkbox',
			label: '',
			dependent: MASTER_ENABLED_DEPENDENT,
			options: [
				{
					key: 'security',
					value: 'security',
					label: __('Security vulnerabilities', 'vulopilot'),
					desc: __(
						'High-risk security vulnerabilities and malware infections.',
						'vulopilot'
					),
				},
				{
					key: 'availability',
					value: 'availability',
					label: __('Website down', 'vulopilot'),
					desc: __(
						'Your website is not accessible or is returning errors.',
						'vulopilot'
					),
				},
				{
					key: 'performance',
					value: 'performance',
					label: __('Critical performance issues', 'vulopilot'),
					desc: __(
						'Severe performance problems affecting your site speed or Core Web Vitals.',
						'vulopilot'
					),
				},
				{
					key: 'seo',
					value: 'seo',
					label: __('SEO indexing problems', 'vulopilot'),
					desc: __(
						'Pages blocked from indexing or major crawling issues.',
						'vulopilot'
					),
				},
				{
					key: 'other',
					value: 'other',
					label: __('Data or functionality issues', 'vulopilot'),
					desc: __(
						'Problems affecting important site data or core functionality.',
						'vulopilot'
					),
				},
			],
		},
		{
			key: 'website-alerts-channel-section',
			type: 'section',
			title: __('Notification channel', 'vulopilot'),
			dependent: MASTER_ENABLED_DEPENDENT,
		},
		{
			key: 'critical_alert_channels',
			type: 'checkbox',
			label: '',
			dependent: MASTER_ENABLED_DEPENDENT,
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
			dependent: MASTER_ENABLED_DEPENDENT,
		},
	],
};
