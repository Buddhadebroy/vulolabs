import { __ } from '@wordpress/i18n';

// Shared by every field below the master "Enabled" toggle — same
// `dependent` shape Scanning/SeoContent.ts's own html-sitemap-shortcode-notice
// already uses, factored out here since this one condition is reused by
// several fields rather than one.
const MASTER_ENABLED_DEPENDENT = { key: 'email_on_crawler_alerts', value: 'email_on_crawler_alerts', set: true };

// Shared by the 3 expandable-panel rows that offer a real frequency choice
// (blocked/access limited/new crawler) — CrawlerAlertMonitor::gate_by_frequency().
const FREQUENCY_OPTIONS = [
	{ label: __('Immediately', 'vulopilot'), value: 'immediate' },
	{ label: __('Daily digest', 'vulopilot'), value: 'daily_digest' },
	{ label: __('Weekly digest', 'vulopilot'), value: 'weekly_digest' },
];

/**
 * Settings → Notifications → AI Crawler Alerts.
 *
 * Real backend: vulopilot-pro's CrawlerAlertMonitor runs 5 checks once
 * daily (CrawlerAlertScheduler) — see that class's own docblock for the
 * full detail on each. Every row below toggles a real, independently-gated
 * setting that class reads; nothing here is decorative. `email_on_crawler_alerts`
 * is the existing master switch (already used by Free's own copy under
 * this same key before this tab existed) — every field below it is
 * `dependent` on it (the tab shows just the master switch until it's
 * turned on, matching CrawlerAlertMonitor::run_daily_check()'s own real
 * effect: it returns before any per-row check fires while that's off).
 *
 * "Notify me about" is a real zyra `type: 'expandable-panel'` field (per
 * direct instruction — same component BrandIntelligence.ts's own "Tracked
 * competitors" already uses, here with a fixed, non-addable set of 5
 * methods instead of a user-added list) — one unified panel group covering
 * every alert type: blocked, access limited, traffic drop, inactive,
 * new-crawler-detected. Each is one collapsible panel item: click "Enable"
 * to turn it on, then "Settings" to expand it and see/pick its own
 * control. That field's own value shape is one nested object keyed by
 * alert type (`{ [id]: { ...formFields } }`, `crawler_alerts` in
 * Utill::VULOPILOT_SETTINGS_DEFAULTS), not N flat settings — see that
 * constant's own docblock.
 *
 * "AI crawler traffic drop" is a panel item like the other 4, but its
 * `formFields` is a single real `type: 'notice'` linking to Scanning → AI
 * Visibility rather than a functional dropdown — its % threshold
 * (`crawler_volume_drop_threshold_percent`) is also independently exposed
 * on that other, pre-existing tab, so this panel only nests its own
 * `enable` (safe — that specific key isn't shared with anything else);
 * duplicating the threshold itself into a second control here would risk
 * the two drifting out of sync.
 *
 * "Send Test Alert" + the persisted "Last test alert sent on ..." line
 * needs live state (an API call, and a value that must survive a page
 * refresh) InputRenderer's own declarative fields can't provide — same
 * "hand-built escape-hatch panel appended after InputRenderer's own
 * fields" shape Settings.tsx's own GetForm() already uses for Backups'
 * BackupStoragePanel.tsx, appended here for 'ai-crawler-alerts' the same
 * way. See CrawlerAlertTestPanel.tsx's own docblock.
 */
export default {
	id: 'ai-crawler-alerts',
	priority: 3,
	headerTitle: __('AI Crawler Alerts', 'vulopilot'),
	headerDescription: __(
		'Get notified when AI crawlers are blocked, limited, or stop visiting your website.',
		'vulopilot'
	),
	headerIcon: 'ai',
	submitUrl: 'settings',
	modal: [
		{
			key: 'email_on_crawler_alerts',
			type: 'checkbox',
			look: 'toggle',
			label: __('Enabled', 'vulopilot'),
			settingDescription: __(
				'Master switch for every AI Crawler Alert below — turn this off to silence all of them at once.',
				'vulopilot'
			),
			options: [
				{ key: 'email_on_crawler_alerts', label: '', value: 'email_on_crawler_alerts' },
			],
		},
		{
			key: 'ai-crawler-alerts-notify-section',
			type: 'section',
			title: __('Notify me about', 'vulopilot'),
			dependent: MASTER_ENABLED_DEPENDENT,
		},
		{
			// zyra's real `expandable-panel` component (per direct
			// instruction) — one unified panel group for all 5 rows, a
			// fixed, non-addable set of methods (no `addNewBtn`), each
			// `disableBtn: true` so its header shows a real
			// Enable/Settings/Disable control instead of an always-on
			// toggle. Value shape: `{ blocked: {...}, access_limited: {...},
			// traffic_drop: {...}, inactive: {...}, new_bot: {...} }` — see
			// this file's own docblock and
			// Utill::VULOPILOT_SETTINGS_DEFAULTS's `crawler_alerts` entry.
			key: 'crawler_alerts',
			type: 'expandable-panel',
			label: '',
			dependent: MASTER_ENABLED_DEPENDENT,
			modal: [
				{
					id: 'blocked',
					icon: 'lock',
					label: __('AI crawler blocked', 'vulopilot'),
					desc: __(
						'When a known AI bot keeps visiting a page your robots.txt disallows specifically for it.',
						'vulopilot'
					),
					settingDescription: __(
						'When a known AI bot keeps visiting a page your robots.txt disallows specifically for it.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: { active: __('Enabled', 'vulopilot'), inactive: __('Disabled', 'vulopilot') },
					formFields: [
						{
							key: 'frequency',
							type: 'select',
							label: __('Notify if', 'vulopilot'),
							options: FREQUENCY_OPTIONS,
						},
					],
				},
				{
					id: 'access_limited',
					icon: 'warning',
					label: __('AI crawler access limited', 'vulopilot'),
					desc: __(
						"When a bot's recent requests are disproportionately hitting missing (404) pages on your site.",
						'vulopilot'
					),
					settingDescription: __(
						"When a bot's recent requests are disproportionately hitting missing (404) pages on your site.",
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: { active: __('Enabled', 'vulopilot'), inactive: __('Disabled', 'vulopilot') },
					formFields: [
						{
							key: 'frequency',
							type: 'select',
							label: __('Notify if', 'vulopilot'),
							options: FREQUENCY_OPTIONS,
						},
					],
				},
				{
					id: 'traffic_drop',
					icon: 'bar-chart',
					label: __('AI crawler traffic drop', 'vulopilot'),
					desc: __(
						'When visits from AI crawlers drop by a certain percentage vs. their trailing 7-day average.',
						'vulopilot'
					),
					settingDescription: __(
						'When visits from AI crawlers drop by a certain percentage vs. their trailing 7-day average.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: { active: __('Enabled', 'vulopilot'), inactive: __('Disabled', 'vulopilot') },
					formFields: [
						{
							// Not a real, independently-writable field here —
							// see this file's own docblock for why the actual
							// % threshold has to stay Scanning → AI
							// Visibility's own separate, pre-existing field
							// rather than a second control duplicating it.
							// Real `type: 'notice'`, same as the tab's own
							// "Why track AI crawlers?" card, with a real link
							// (NoticeFieldComponent's `message` renders via
							// `dangerouslySetInnerHTML`) to where that value
							// actually lives.
							key: 'traffic-drop-threshold-note',
							type: 'notice',
							noticeType: 'info',
							label: '',
							message: __(
								'The percentage threshold is configured under <a href="?page=vulopilot#&tab=settings&subtab=ai-visibility">Scanning → AI Visibility</a>.',
								'vulopilot'
							),
						},
					],
				},
				{
					id: 'inactive',
					icon: 'clock',
					label: __('AI crawler inactive', 'vulopilot'),
					desc: __(
						'When a bot that has visited before goes quiet — only re-notifies if it comes back and then goes quiet again.',
						'vulopilot'
					),
					settingDescription: __(
						'When a bot that has visited before goes quiet — only re-notifies if it comes back and then goes quiet again.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: { active: __('Enabled', 'vulopilot'), inactive: __('Disabled', 'vulopilot') },
					formFields: [
						{
							key: 'days_threshold',
							type: 'select',
							label: __('Notify if inactive for', 'vulopilot'),
							options: [
								{ label: __('3 days', 'vulopilot'), value: '3' },
								{ label: __('7 days', 'vulopilot'), value: '7' },
								{ label: __('14 days', 'vulopilot'), value: '14' },
								{ label: __('30 days', 'vulopilot'), value: '30' },
							],
						},
					],
				},
				{
					id: 'new_bot',
					icon: 'plus',
					label: __('New AI crawler detected', 'vulopilot'),
					desc: __('When a bot starts visiting your website for the first time.', 'vulopilot'),
					settingDescription: __(
						'When a bot starts visiting your website for the first time.',
						'vulopilot'
					),
					disableBtn: true,
					statusLabels: { active: __('Enabled', 'vulopilot'), inactive: __('Disabled', 'vulopilot') },
					formFields: [
						{
							key: 'frequency',
							type: 'select',
							label: __('Notify if', 'vulopilot'),
							options: FREQUENCY_OPTIONS,
						},
					],
				},
			],
		},
		{
			key: 'ai-crawler-alerts-channels-section',
			type: 'section',
			title: __('Notification channels', 'vulopilot'),
			dependent: MASTER_ENABLED_DEPENDENT,
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
			label: '',
			dependent: MASTER_ENABLED_DEPENDENT,
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
			dependent: MASTER_ENABLED_DEPENDENT,
		},
	],
};
