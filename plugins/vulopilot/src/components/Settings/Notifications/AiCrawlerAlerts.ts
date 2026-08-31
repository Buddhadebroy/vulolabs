import { createElement, Fragment, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import CrawlerAlertTestPanel from '../CrawlerAlertTestPanel';

// Shared by every field below the master "Enabled" toggle — same
// `dependent` shape Scanning/SeoContent.ts's own html-sitemap-shortcode-notice
// already uses, factored out here since this one condition is reused by
// several fields rather than one.
const MASTER_ENABLED_DEPENDENT = { key: 'email_on_crawler_alerts', value: 'email_on_crawler_alerts', set: true };

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
	control: { toggle: boolean; select?: { key: string; label: string; options: { label: string; value: string }[] } };
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
		control: { toggle: true },
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
 * setting that class reads; nothing here is decorative. `email_on_crawler_alerts`
 * is the existing master switch (already used by Free's own copy under
 * this same key before this tab existed) — every field below it is
 * `dependent` on it (the tab shows just the master switch until it's
 * turned on, matching CrawlerAlertMonitor::run_daily_check()'s own real
 * effect: it returns before any per-row check fires while that's off).
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
	id: 'ai-crawler-alerts',
	priority: 2,
	headerTitle: __('AI Crawler Alerts', 'vulopilot'),
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
	settingAction: createElement(CrawlerAlertTestPanel),
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
			label: __('', 'vulopilot'),
			key: 'crawler_alerts',
			type: 'setting-row',
			dependent: MASTER_ENABLED_DEPENDENT,
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
