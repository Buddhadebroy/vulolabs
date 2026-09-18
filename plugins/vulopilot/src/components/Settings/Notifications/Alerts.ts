import { createElement, Fragment, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import CrawlerAlertTestPanel from '../CrawlerAlertTestPanel';
const THRESHOLD_OPTIONS = [5, 10, 20, 30].map((points) => ({
	label: sprintf(__('%d%% or more', 'vulopilot'), points),
	value: String(points),
}));
// ── "Notify me about" rows (type: 'setting-row') ────────────────────────
//
// Inlined here rather than in a separate file (per direct instruction) —
// a standalone file directly under components/Settings/ with no default
// export broke two require.context sweeps that assume every file there is
// either a settings-tab config or has *some* default export
// (templateService.ts's `contexts.settings` and searchIndex.ts's
// `contextSettings`, both walking this folder): the `undefined` node it
// produced crashed the whole Settings page (`getAvailableSettings()` →
// `getDefaultSettings()` reading `content.pro_dependent` on `undefined`)
// and could have surfaced as a phantom search result.

const FREQUENCY_OPTIONS = [
	{ label: __('Immediately', 'vulopilot'), value: 'immediate' },
	{ label: __('Daily digest', 'vulopilot'), value: 'daily_digest' },
	{ label: __('Weekly digest', 'vulopilot'), value: 'weekly_digest' },
];

// Shared by every row's own `control.toggleStatusLabel` below — "On"/"Off"
// per direct instruction, rather than SettingToggle's own default
// "Enabled"/"Disabled" flip text.
const TOGGLE_STATUS_LABEL = { on: __('On', 'vulopilot'), off: __('Off', 'vulopilot') };

const DAYS_OPTIONS = [
	{ label: __('3 days', 'vulopilot'), value: '3' },
	{ label: __('7 days', 'vulopilot'), value: '7' },
	{ label: __('14 days', 'vulopilot'), value: '14' },
	{ label: __('30 days', 'vulopilot'), value: '30' },
];

interface CrawlerAlertRow {
	/** This row's own key within the `crawler_alerts` value object — SettingRowComponent's own `valueKey`. */
	valueKey: string;
	icon: string;
	title: string;
	desc: ReactNode;
	/**
	 * zyra's real declarative `SettingRowControl` shape (`{ toggle?,
	 * select? }`) — `SettingRowComponent` builds the actual `SettingToggle`/
	 * `SelectInput` pair itself, bound to this row's own `valueKey` slice
	 * of the field's `value`/`onChange` (wired through by
	 * `SettingRowFieldComponent`, zyra's `type: 'setting-row'` field type
	 * — see this file's own docblock). No bespoke API-call component
	 * needed per row: persisting a row's toggle/select goes through
	 * InputRenderer's normal auto-save path, the same as every other
	 * field on this tab.
	 */
	control: {
		toggle: boolean;
		// zyra's own SettingRowControl.toggleStatusLabel — a real on/off
		// pair for each row's own toggle (SettingToggle's own
		// `statusLabel`), same shape email_on_crawler_alerts's own master
		// switch already uses via MultiCheckboxInput's `toggleStatusLabel`.
		toggleStatusLabel?: { on: string; off: string };
		select?: { key: string; label: string; options: { label: string; value: string }[] };
	};
}

/**
 * Same 5 alert types the old `type: 'expandable-panel'` field listed —
 * copy/values ported verbatim. `traffic_drop` alone has no `select` (its
 * old `formFields` entry was always just a `type: 'notice'` linking to
 * Scanning → AI Visibility rather than a functional dropdown; that link
 * now lives in this row's own `desc`).
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
		// Was `icon: 'warning'` in the old expandable-panel item — not a
		// real adminfont icon name (confirmed against fonts.scss); 'error'
		// is the closest real one.
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
		// `createElement()` (not JSX) — this is a plain `.ts` file, not
		// `.tsx`, same as every other settings-schema file in this folder;
		// TypeScript's default @babel/preset-typescript config (this
		// workspace's own @wordpress/babel-preset-default, no
		// `isTSX`/`allExtensions` override) only parses JSX inside `.tsx`.
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
			'When a bot that has visited before goes quiet — only re-notifies if it comes back and then goes quiet again.',
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
 * Settings → Notifications → AI Crawler Alerts.
 *
 * Real backend: vulopilot-pro's CrawlerAlertMonitor runs 5 checks once
 * daily (CrawlerAlertScheduler) — see that class's own docblock for the
 * full detail on each. Every row below toggles a real, independently-gated
 * setting that class reads; nothing here is decorative. The old
 * `email_on_crawler_alerts` master switch (and every field's own `dependent`
 * gate on it) was removed per direct instruction — it had no real duplicate
 * control anywhere else in this codebase, so every row below is now always
 * visible/active instead of hidden behind a switch with no other way to
 * turn it on.
 *
 * "Notify me about" is a real zyra `type: 'setting-row'` field
 * (`components-settingrowcomponent--with-select-and-toggle`, per direct
 * instruction) — one flat row per alert type: blocked, access limited,
 * traffic drop, inactive, new-crawler-detected. Each row's own
 * frequency/duration select and on/off toggle are both visible at once —
 * no expand/collapse step. `rows` is this file's own `CRAWLER_ALERT_ROWS`
 * above, using zyra's declarative `control: { toggle, select }` shape
 * (SettingRowComponent's own `resolveControl()` builds the real
 * `SettingToggle`/`SelectInput` pair and reads/writes each row's own
 * `valueKey` slice of this field's `value`/`onChange` itself) — so
 * persisting a row goes through InputRenderer's normal auto-save path,
 * same as every other field here, no bespoke API-call component needed.
 * That field's own value shape is still one nested object keyed by alert
 * type (`{ [valueKey]: { enable, frequency? | days_threshold? } }`,
 * `crawler_alerts` in Utill::VULOPILOT_SETTINGS_DEFAULTS), not N flat
 * settings — see that constant's own docblock.
 *
 * "AI crawler traffic drop" is a row like the other 4, but its `desc`
 * links to Scanning → AI Visibility rather than offering a functional
 * dropdown — its % threshold (`crawler_volume_drop_threshold_percent`) is
 * also independently exposed on that other, pre-existing tab, so this row
 * only ever writes its own `enable` (safe — that specific key isn't shared
 * with anything else); duplicating the threshold itself into a second
 * control here would risk the two drifting out of sync.
 *
 * "Send Test Alert" + the persisted "Last test alert sent on ..." line
 * needs live state (an API call, and a value that must survive a page
 * refresh) InputRenderer's own declarative fields can't provide, so it's
 * a hand-built component (CrawlerAlertTestPanel.tsx) rather than another
 * field type — set as this tab's own top-level `settingAction` (per
 * direct instruction), not a per-field `rightContent`. `settingAction` is
 * NavigatorComponent.tsx's own per-tab header action slot: its
 * `renderSettingHeaderInfo()` renders one `<SectionComponent
 * rightContent={activeFile.settingAction} />` above every tab's own
 * fields, using this exact settings object's `settingTitle ?? headerTitle`/
 * `settingSubTitle ?? headerDescription` as that header's own title/desc —
 * so this sits right next to "AI Crawler Alerts" itself, not down by
 * "Notification channels" or appended at the bottom of the tab the way
 * Backups' BackupStoragePanel.tsx is (via Settings.tsx's own GetForm()).
 * See CrawlerAlertTestPanel.tsx's own docblock.
 */
export default {
	id: 'alerts-settings',
	priority: 2,
	headerTitle: __('Alerts Settings', 'vulopilot'),
	headerDescription: __(
		'Get notified when AI crawlers are blocked, limited, or stop visiting your website.',
		'vulopilot'
	),
	headerIcon: 'ai',
	submitUrl: 'settings',
	// CrawlerAlertTestPanel.tsx's own "Send Test Alert" button + persisted
	// "Last test alert sent on ..." line — moved here (per direct
	// instruction) from the "Notification channels" section's own
	// `rightContent`. `settingAction` is NavigatorComponent.tsx's own
	// per-tab header action slot (`renderSettingHeaderInfo()`'s
	// `<SectionComponent rightContent={activeFile.settingAction} />`,
	// rendered once above every tab's own fields), so this now sits next
	// to the tab's own "AI Crawler Alerts" title instead of down by the
	// channels it tests.
	hideSettingHeader: true,
	groupBySections: true,
	settingAction: createElement(CrawlerAlertTestPanel),
	modal: [
		{
			key: 'general_settings',
			type: 'section',
			icon: 'setting',
			title: __('AI Crawler Alerts', 'vulopilot'),
			desc: __(
				'Get notified when AI crawlers are blocked, limited, or stop visiting your website.',
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
			// One multi-checkbox field, real values 'email'/'dashboard' —
			// see CrawlerAlertMonitor::send_alert()'s own docblock for what
			// each one actually does. No "Mobile" option here — there's no
			// real push-delivery mechanism anywhere in this codebase, so it
			// isn't offered as a control that could never do anything; the
			// notice below says so instead.
			key: 'crawler_alert_channels',
			type: 'checkbox',
			label: __('Notification channels', 'vulopilot'),
			options: [
				{ key: 'email', value: 'email', label: __('Email', 'vulopilot') },
				{ key: 'dashboard', value: 'dashboard', label: __('In-dashboard', 'vulopilot') },
			],
		},
		{
			// Same real `type: 'notice'` field Scanning/SeoContent.ts's own
			// sitemap tips already use.
			key: 'ai-crawler-alerts-notice',
			type: 'notice',
			noticeType: 'info',
			title: __('Why track AI crawlers?', 'vulopilot'),
			message: __(
				'AI crawlers help your content appear in AI search results. These alerts help you make sure they can still access and index your website. Mobile push notifications aren\'t available yet — Email and In-dashboard are the two real delivery channels today.',
				'vulopilot'
			),
		},

		{
			key: 'general_settings',
			type: 'section',
			icon: 'setting',
			title: __('Security Alerts', 'vulopilot'),
			desc: __(
				'Get notified about security risks and suspicious activity on your website.',
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
		{
			key: 'general_settings',
			type: 'section',
			icon: 'bar-chart',
			title: __('Visibility Alerts', 'vulopilot'),
			desc: __(
				'Get notified when your visibility scores drop so you can take action early.',
				'vulopilot'
			),
		},

		{
			// zyra's real `type: 'setting-row'` field (per direct
			// instruction) — one flat row per score type, each with its own
			// threshold select and on/off toggle both visible at once, no
			// expand/collapse step — same field type 'crawler_alerts' in
			// AiCrawlerAlerts.ts already uses. See this file's own docblock
			// for the value shape (unchanged from the old expandable-panel
			// field).
			label: __('Notify me when', 'vulopilot'),
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
			key: 'visibility_alert_channels',
			type: 'checkbox',
			label: __('Notification channels', 'vulopilot'),
			options: [
				{ key: 'email', value: 'email', label: __('Email', 'vulopilot') },
				{ key: 'dashboard', value: 'dashboard', label: __('In-dashboard', 'vulopilot') },
			],
		},
		{
			key: 'visibility-alerts-notice',
			type: 'notice',
			noticeType: 'info',
			title: __('Stay ahead of visibility drops', 'vulopilot'),
			message: __(
				'These alerts help you catch issues early before they impact your traffic, rankings, and AI visibility. Mobile push notifications aren\'t available yet — Email and In-dashboard are the two real delivery channels today.',
				'vulopilot'
			),
		},
		{
			key: 'general_settings',
			type: 'section',
			icon: 'error',
			title: __('Critical issue alerts', 'vulopilot'),
			desc: __(
				'Get notified immediately when critical issues are found on your website.',
				'vulopilot'
			),
		},
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
