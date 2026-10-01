import { createElement, Fragment, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import CrawlerAlertTestPanel from './CrawlerAlertTestPanel';

const THRESHOLD_OPTIONS = [5, 10, 20, 30].map((points) => ({
	label: sprintf(/* translators: %d: real threshold percent. */ __('%d%% or more', 'vulopilot'), points),
	value: String(points),
}));

const FREQUENCY_OPTIONS = [
	{ label: __('Immediately', 'vulopilot'), value: 'immediate' },
	{ label: __('Daily digest', 'vulopilot'), value: 'daily_digest' },
	{ label: __('Weekly digest', 'vulopilot'), value: 'weekly_digest' },
];

// Shared by every row's own `control.toggleStatusLabel` below - "On"/"Off", rather than SettingToggle's own default
// "Enabled"/"Disabled" flip text.
const TOGGLE_STATUS_LABEL = { on: __('On', 'vulopilot'), off: __('Off', 'vulopilot') };

const DAYS_OPTIONS = [
	{ label: __('3 days', 'vulopilot'), value: '3' },
	{ label: __('7 days', 'vulopilot'), value: '7' },
	{ label: __('14 days', 'vulopilot'), value: '14' },
	{ label: __('30 days', 'vulopilot'), value: '30' },
];

interface CrawlerAlertRow {
	/** This row's own key within the `crawler_alerts` value object - SettingRowComponent's own `valueKey`. */
	valueKey: string;
	icon: string;
	title: string;
	desc: ReactNode;
	/**
	 * zyra's real declarative `SettingRowControl` shape (`{ toggle?, select? }`).
	 */
	control: {
		toggle: boolean;
		// zyra's own SettingRowControl.toggleStatusLabel - a real on/off pair for each row's own
		// toggle (SettingToggle's own `statusLabel`).
		toggleStatusLabel?: { on: string; off: string };
		select?: { key: string; label: string; options: { label: string; value: string }[] };
	};
}

/**
 * Same 5 alert types the old `type: 'expandable-panel'` field listed - copy/values ported
 * verbatim.
 */
const CRAWLER_ALERT_ROWS: CrawlerAlertRow[] = [
	{
		valueKey: 'blocked',
		icon: 'lock red',
		title: __('AI crawler blocked', 'vulopilot'),
		desc: __(
			'When a known AI bot keeps visiting a page your robots.txt disallows specifically for it.',
			'vulopilot'
		),
		control: {
			toggle: true,
			toggleStatusLabel: TOGGLE_STATUS_LABEL,
			select: { key: 'frequency', label: __('Notify if', 'vulopilot'), options: FREQUENCY_OPTIONS },
		},
	},
	{
		valueKey: 'access_limited',
		// Was `icon: 'warning'` in the old expandable-panel item.
		icon: 'error red',
		title: __('AI crawler access limited', 'vulopilot'),
		desc: __(
			"When a bot's recent requests are disproportionately hitting missing (404) pages on your site.",
			'vulopilot'
		),
		control: {
			toggle: true,
			toggleStatusLabel: TOGGLE_STATUS_LABEL,
			select: { key: 'frequency', label: __('Notify if', 'vulopilot'), options: FREQUENCY_OPTIONS },
		},
	},
	{
		valueKey: 'traffic_drop',
		icon: 'bar-chart blue',
		title: __('AI crawler traffic drop', 'vulopilot'),
		// `createElement()` (not JSX) - this is a plain `.ts` file, not `.tsx`, same as every
		// other settings-schema file in this folder.
		desc: createElement(
			Fragment,
			null,
			__(
				'When visits from AI crawlers drop by a certain percentage vs. their trailing 7-day average.',
				'vulopilot'
			),
			' ',
			createElement(
				'a',
				{ href: '?page=vulopilot#&tab=settings&subtab=ai-visibility' },
				__('Set the % threshold under Scanning → AI Visibility.', 'vulopilot')
			)
		),
		control: { toggle: true, toggleStatusLabel: TOGGLE_STATUS_LABEL },
	},
	{
		valueKey: 'inactive',
		icon: 'clock lime',
		title: __('AI crawler inactive', 'vulopilot'),
		desc: __(
			'When a bot that has visited before goes quiet - only re-notifies if it comes back and then goes quiet again.',
			'vulopilot'
		),
		control: {
			toggle: true,
			toggleStatusLabel: TOGGLE_STATUS_LABEL,
			select: {
				key: 'days_threshold',
				label: __('Notify if inactive for', 'vulopilot'),
				options: DAYS_OPTIONS,
			},
		},
	},
	{
		valueKey: 'new_bot',
		icon: 'plus green',
		title: __('New AI crawler detected', 'vulopilot'),
		desc: __('When a bot starts visiting your website for the first time.', 'vulopilot'),
		control: {
			toggle: true,
			toggleStatusLabel: TOGGLE_STATUS_LABEL,
			select: { key: 'frequency', label: __('Notify if', 'vulopilot'), options: FREQUENCY_OPTIONS },
		},
	},
];

/**
 * Settings → Notifications, one flat tab (a single file, so it has no inner sub-nav).
 */
export default {
	id: 'notifications',
	priority: 6,
	headerTitle: __('Notifications', 'vulopilot'),
	headerDescription: __(
		'Configure where VuloPilot sends notifications, and what it should alert you about.',
		'vulopilot'
	),
	headerIcon: 'mail',
	submitUrl: 'settings',
	hideSettingHeader: true,
	groupBySections: true,
	settingAction: createElement(CrawlerAlertTestPanel),
	modal: [
		{
			key: 'email-settings-section',
			type: 'section',
			icon: 'mail',
			title: __('Email Settings', 'vulopilot'),
			desc: __(
				'The email address where you want to receive VuloPilot notifications, and the sender details they\'re sent from.',
				'vulopilot'
			),
		},
		{
			// "Send Test Email" - back to a real declarative `type: 'button'` field.
			key: 'send_test_email',
			type: 'button',
			name: __('Send Test Email', 'vulopilot'),
			label: ' ',
			position: 'right',
			rightIcon: 'send',
			color: 'text-purple',
			apilink: 'settings/test-email',
			method: 'POST',
		},
		{
			key: 'notification_email',
			type: 'email',
			size: 30,
			label: __('Notification email', 'vulopilot'),
			placeholder: __('noreply@yourstore.com', 'vulopilot'),
			settingDescription: __(
				'Where critical findings and automation failures are sent. Falls back to the site admin email when left blank.',
				'vulopilot'
			),
		},
		{
			key: 'email_from_name',
			type: 'text',
			size: 30,
			label: __('Sender name', 'vulopilot'),
			settingDescription: __(
				'The name VuloPilot\'s own emails (notifications, automation actions, scheduled reports) are sent from. Defaults to your site name.',
				'vulopilot'
			),
		},
		{
			key: 'email_from_address',
			type: 'email',
			label: __('Sender email', 'vulopilot'),
			size: 30,
			placeholder: __('noreply@yourstore.com', 'vulopilot'),
			settingDescription: __(
				'The address VuloPilot\'s own emails are sent from. Leave blank to use your site\'s default mail sender.',
				'vulopilot'
			),
		},
		{
			// Same real `type: 'notice'` field Scanning/SeoContent.ts's own
			// sitemap tips already use.
			key: 'send-test-email-notice',
			type: 'notice',
			noticeType: 'info',
			title: __('Why send a test email?', 'vulopilot'),
			message: __(
				'This helps you confirm that notifications are delivered to the right inbox and that your email settings are correct.',
				'vulopilot'
			),
		},
		// One shared "Notification channels" control for all four alert
		// sections below - see this file's own docblock.
		{
			key: 'notification-settings-section',
			type: 'section',
			icon: 'mail',
			title: __('Notification channels', 'vulopilot'),
			desc: __(
				'Choose how you want to receive notifications for all alert types below — by email, inside your WordPress dashboard, or both.',
				'vulopilot'
			),
		},
		{
			key: 'alert_channels',
			type: 'checkbox',
			options: [
				{ key: 'email', value: 'email', label: __('Email', 'vulopilot') },
				{ key: 'dashboard', value: 'dashboard', label: __('In-dashboard', 'vulopilot') },
			],
		},
		{
			key: 'alert-channels-notice',
			type: 'notice',
			noticeType: 'info',
			label: '',
			message: __(
				'Applies to every alert type below. Mobile push notifications aren\'t available yet - Email and In-dashboard are the two real delivery channels today.',
				'vulopilot'
			),
		},
		{
			key: 'ai_crawler_alerts_section',
			type: 'section',
			icon: 'setting',
			title: __('AI Crawler Alerts', 'vulopilot'),
			desc: __(
				'Get notified when AI crawlers (like GPTBot or ClaudeBot) are blocked, limited, or stop visiting your website — so you know if AI systems are losing access to your content.',
				'vulopilot'
			),
		},
		{
			label: __('Notify me about', 'vulopilot'),
			row: false,
			key: 'crawler_alerts',
			type: 'setting-row',
			rows: CRAWLER_ALERT_ROWS,
		},

		{
			key: 'security_alerts_section',
			type: 'section',
			icon: 'setting',
			title: __('Security Alerts', 'vulopilot'),
			desc: __(
				'Stay on top of security risks and suspicious activity on your website, such as failed logins, malware, or unexpected file changes.',
				'vulopilot'
			),
		},
		{
			label: __('Notify me about', 'vulopilot'),
			key: 'security_alert_types',
			row: false,
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
			key: 'visibility_alerts_section',
			type: 'section',
			icon: 'bar-chart',
			title: __('Visibility Alerts', 'vulopilot'),
			desc: __(
				'Catch it early when your visibility scores drop, so you can fix the underlying issue before it affects how often AI systems reference your site.',
				'vulopilot'
			),
		},

		{
			// zyra's real `type: 'setting-row'` field - one flat row per score type, each with its
			// own threshold select and on/off toggle both visible at once.
			label: __('Notify me when', 'vulopilot'),
			row: false,
			key: 'visibility_alerts',
			type: 'setting-row',
			rows: [
				{
					valueKey: 'geo',
					icon: 'ai green',
					title: __('AI visibility score drop', 'vulopilot'),
					desc: __(
						'When your overall AI visibility score drops by the selected percentage.',
						'vulopilot'
					),
					control: {
						toggle: true,
						toggleStatusLabel: TOGGLE_STATUS_LABEL,
						select: {
							key: 'threshold',
							label: __('Notify me if score drops by', 'vulopilot'),
							options: THRESHOLD_OPTIONS,
						},
					},
				},
				{
					valueKey: 'brand',
					icon: 'announcement red',
					title: __('Brand score drop', 'vulopilot'),
					desc: __(
						'When your brand visibility score drops by the selected percentage.',
						'vulopilot'
					),
					control: {
						toggle: true,
						toggleStatusLabel: TOGGLE_STATUS_LABEL,
						select: {
							key: 'threshold',
							label: __('Notify me if score drops by', 'vulopilot'),
							options: THRESHOLD_OPTIONS,
						},
					},
				},
				{
					valueKey: 'kg',
					icon: 'intelligence yellow',
					title: __('Knowledge Graph score drop', 'vulopilot'),
					desc: __(
						'When your Knowledge Graph score drops by the selected percentage.',
						'vulopilot'
					),
					control: {
						toggle: true,
						toggleStatusLabel: TOGGLE_STATUS_LABEL,
						select: {
							key: 'threshold',
							label: __('Notify me if score drops by', 'vulopilot'),
							options: THRESHOLD_OPTIONS,
						},
					},
				},
			],
		},
		{
			key: 'critical_issue_alerts_section',
			type: 'section',
			icon: 'error',
			title: __('Critical issue alerts', 'vulopilot'),
			desc: __(
				'Hear about the highest-severity problems on your website right away — sent immediately, regardless of your other notification settings.',
				'vulopilot'
			),
		},
		{
			// zyra's real `type: 'setting-row'` field - see this file's own docblock for why
			// `control: { checkbox: true }` fits this flat multi-select array field.
			label: __('Notify me about', 'vulopilot'),
			key: 'critical_alert_types',
			row: false,
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
	],
};
