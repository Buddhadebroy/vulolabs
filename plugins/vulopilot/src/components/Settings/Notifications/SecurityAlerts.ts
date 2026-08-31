import { __ } from '@wordpress/i18n';

// Shared by every field below the master "Enabled" toggle — same
// `dependent` shape AiCrawlerAlerts.ts's own MASTER_ENABLED_DEPENDENT
// already uses, this tab's own master switch key instead.
const MASTER_ENABLED_DEPENDENT = { key: 'security_alerts_enabled', value: 'security_alerts_enabled', set: true };

/**
 * Settings → Notifications → Security Alerts.
 *
 * Real backend: vulopilot-pro's SecurityMonitoring\AlertDispatcher, hooked
 * on `vulopilot_scan_completed` (every row below except "New user created")
 * and a real `user_register` hook (that one — a genuine WP event, not a
 * scan finding). `security_alerts_enabled` is the existing master switch —
 * already a real field on Settings → Scanning → Security ("Email me on new
 * security alerts") before this tab existed, same "master switch lives on
 * both its scanning-behavior tab and its own Notifications tab" shape
 * AiCrawlerAlerts.ts's own `email_on_crawler_alerts` already established
 * (that key is Alert Preferences' summary toggle *and* that tab's own
 * master switch). This tab intentionally doesn't duplicate that other
 * tab's `security_alert_email`/`security_alert_min_severity` fields — the
 * notice at the bottom links there instead of a second copy of the same
 * controls.
 *
 * "Notify me about" is a real zyra `type: 'setting-row'` field
 * (`components-settingrowcomponent--with-checkbox`, per direct
 * instruction) — one row per alert type, each with a plain checkbox
 * control (`control: { checkbox: true }`, SettingRowComponent's own
 * declarative shape for a flat multi-select array field — see that
 * component's own docblock for why this is a different value shape than
 * AiCrawlerAlerts.ts's `toggle`/`select` rows). `security_alert_types`
 * (Utill::VULOPILOT_SETTINGS_DEFAULTS) is still a flat array of enabled
 * type keys, same shape as `crawler_alert_channels` below — unchanged from
 * when this was a plain `type: 'checkbox'` field; only the row-list
 * presentation changed. Five of the six map to real scanner ids
 * AlertDispatcher::TYPE_SCANNER_MAP already defines; "New user created"
 * has no scanner behind it — see that constant's own docblock.
 *
 * "Notification channels" mirrors AiCrawlerAlerts.ts's own
 * `crawler_alert_channels` field exactly: real 'email'/'dashboard' values,
 * its own independent key (`security_alert_channels`) so this family of
 * alerts can be routed differently than crawler alerts. No 'mobile' option
 * for the same reason that file already documents — no real push-delivery
 * mechanism exists anywhere in this codebase yet, Pro or not; the notice
 * below says so rather than offering a checkbox that could never do
 * anything.
 */
export default {
	id: 'security-alerts',
	priority: 3,
	headerTitle: __('Security Alerts', 'vulopilot'),
	headerDescription: __(
		'Get notified about security risks and suspicious activity on your website.',
		'vulopilot'
	),
	headerIcon: 'security',
	submitUrl: 'settings',
	modal: [
		{
			key: 'security_alerts_enabled',
			type: 'checkbox',
			look: 'toggle',
			label: __('Enabled', 'vulopilot'),
			settingDescription: __(
				'Master switch for every Security Alert below — turn this off to silence all of them at once.',
				'vulopilot'
			),
			options: [
				{ key: 'security_alerts_enabled', label: '', value: 'security_alerts_enabled' },
			],
		},
		{
			key: 'security-alerts-notify-section',
			type: 'section',
			title: __('Notify me about', 'vulopilot'),
			dependent: MASTER_ENABLED_DEPENDENT,
		},
		{
			// zyra's real `type: 'setting-row'` field
			// (`components-settingrowcomponent--with-checkbox`, per direct
			// instruction) — see this file's own docblock for why
			// `control: { checkbox: true }` fits this flat multi-select
			// array field, unlike AiCrawlerAlerts.ts's per-type
			// toggle/select rows.
			key: 'security_alert_types',
			type: 'setting-row',
			dependent: MASTER_ENABLED_DEPENDENT,
			rows: [
				{
					valueKey: 'vulnerabilities',
					icon: 'security blue',
					title: __('Security vulnerabilities', 'vulopilot'),
					desc: __(
						'Critical WordPress core, theme, or plugin vulnerabilities.',
						'vulopilot'
					),
					control: { checkbox: true },
				},
				{
					valueKey: 'malware',
					icon: 'error red',
					title: __('Malware detected', 'vulopilot'),
					desc: __(
						'When malware, suspicious files, or malicious code is detected.',
						'vulopilot'
					),
					control: { checkbox: true },
				},
				{
					valueKey: 'failed_login',
					icon: 'lock lime',
					title: __('Failed login attempts', 'vulopilot'),
					desc: __(
						'Multiple failed login attempts or brute-force login activity.',
						'vulopilot'
					),
					control: { checkbox: true },
				},
				{
					valueKey: 'new_user',
					icon: 'profile yellow',
					title: __('New user created', 'vulopilot'),
					desc: __(
						'When a new administrator or user account is created.',
						'vulopilot'
					),
					control: { checkbox: true },
				},
				{
					valueKey: 'file_changes',
					icon: 'file-submission pink',
					title: __('File changes', 'vulopilot'),
					desc: __(
						'When core, plugin, or theme files are modified.',
						'vulopilot'
					),
					control: { checkbox: true },
				},
				{
					valueKey: 'ssl_certificate',
					icon: 'web-page-website red',
					title: __('SSL / Certificate issues', 'vulopilot'),
					desc: __(
						'When your SSL certificate is about to expire or has issues.',
						'vulopilot'
					),
					control: { checkbox: true },
				},
			],
		},
		{
			key: 'security-alerts-channels-section',
			type: 'section',
			title: __('Notification channels', 'vulopilot'),
			dependent: MASTER_ENABLED_DEPENDENT,
		},
		{
			key: 'security_alert_channels',
			type: 'checkbox',
			label: '',
			dependent: MASTER_ENABLED_DEPENDENT,
			options: [
				{ key: 'email', value: 'email', label: __('Email', 'vulopilot') },
				{ key: 'dashboard', value: 'dashboard', label: __('In-dashboard', 'vulopilot') },
			],
		},
		{
			key: 'security-alerts-notice',
			type: 'notice',
			noticeType: 'info',
			label: '',
			message: __(
				'You\'ll receive an alert as soon as a qualifying issue is found. The minimum severity and where alert emails are sent are configured under <a href="?page=vulopilot#&tab=settings&subtab=security-scanning">Settings → Security</a>. Mobile push notifications aren\'t available yet — Email and In-dashboard are the two real delivery channels today.',
				'vulopilot'
			),
			dependent: MASTER_ENABLED_DEPENDENT,
		},
	],
};
