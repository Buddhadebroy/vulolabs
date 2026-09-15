import { __ } from '@wordpress/i18n';

/**
 * Settings → Notifications → Security Alerts.
 *
 * Real backend: vulopilot-pro's SecurityMonitoring\AlertDispatcher, hooked
 * on `vulopilot_scan_completed` (every row below except "New user created")
 * and a real `user_register` hook (that one — a genuine WP event, not a
 * scan finding). The old `security_alerts_enabled` master switch (and every
 * field's own `dependent` gate on it) was removed per direct instruction —
 * Settings → Scanning → Security only ever had a hidden seed stub for that
 * key (`label: ''`), never a real visible duplicate toggle, so every row
 * below is now always visible/active instead of hidden behind a switch with
 * no real way to turn it on. This tab intentionally doesn't duplicate that
 * other tab's `security_alert_email`/`security_alert_min_severity` fields —
 * the notice at the bottom links there instead of a second copy of the same
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
			label: __('Notify me about', 'vulopilot'),
			key: 'security_alert_types',
			type: 'setting-row',
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
			key: 'security_alert_channels',
			type: 'checkbox',
			label: __('Notification channels', 'vulopilot'),
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
		},
	],
};
