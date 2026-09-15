import { __ } from '@wordpress/i18n';
import ConnectionsPanel from './GetStarted/ConnectionsPanel';

/**
 * Settings → Get Started — a flat top-level tab (no inner sub-tab bar),
 * per direct instruction ("remove Connections this sub tab"). This folder
 * used to have its own single inner sub-tab, GetStarted/Connections.ts
 * (itself the result of an earlier merge of 5 separate sub-tabs — see this
 * plugin's git history/that file's own former docblock) — with only ever
 * one real sub-tab under it, the extra tab-bar row it produced (a bar with
 * nothing to actually switch between) was pure UI noise. Moved up to this
 * flat file instead (`templateService.ts`'s own file-vs-folder distinction
 * — a `.ts` file directly under `Settings/` is a flat top-level tab, one
 * nested in a subfolder becomes a folder tab with its own inner bar), so
 * "Get Started" now behaves the same way `Settings/Modules.ts`/
 * `Settings/DeveloperTools.ts` already do: one top-level tab, straight to
 * content, no redundant single-item sub-tab bar.
 *
 * `ConnectionsPanel.tsx` and the real per-provider panel components it
 * composes (`AiProvidersPanel.tsx`/`GoogleServicesPanel.tsx`/
 * `PageSpeedStatusPanel.tsx`/`SiteVerificationPanel.tsx`) stay in the
 * `GetStarted/` folder — they're plain `.tsx` components, not settings-tab
 * configs (`templateService.ts`'s own `require.context` only scans
 * `.ts$` files), so keeping them there doesn't resurrect a phantom folder
 * tab the way leaving a `.ts` config file in that folder would.
 *
 * `id: 'connections'` is kept exactly as-is — real navigation across this
 * plugin already links to `?page=vulopilot#&tab=settings&subtab=connections`
 * (VisibilityBySourceCard.tsx, CrawlRobotsSitemapSection.tsx,
 * PerformanceScoreCard.tsx, SlowPagesTab.tsx, Modules/index.ts's own
 * `settingsLink`), and `getSettingById()` (`@zyra/core`) resolves a
 * `subtab` by this real `id` alone, recursing through folders — it has no
 * concept of "which folder a tab used to live in," so moving this file up
 * a level changes nothing about those links.
 *
 * `modal` below is the same union of real flat setting keys the old
 * Connections.ts carried — still needed even though `PanelComponent`
 * bypasses InputRenderer entirely, purely so Settings.tsx's own per-tab
 * seeding logic (`fieldKeys` from `modal[].key`) populates SettingContext
 * with their current values before ConnectionsPanel.tsx's own components
 * mount and read them via `useSetting()`.
 */
export default {
	id: 'connections',
	priority: 1,
	headerTitle: __('Get Started', 'vulopilot'),
	headerDescription: __(
		'Connect VuloPilot to AI providers, Google services, PageSpeed Insights, and verify your site ownership.',
		'vulopilot'
	),
	headerIcon: 'link',
	submitUrl: 'settings',
	modal: [
		// Google Services.
		{ key: 'ga_install_tracking_code', type: 'checkbox', label: '', options: [] },
		{ key: 'ga_anonymize_ip', type: 'checkbox', label: '', options: [] },
		{ key: 'ga_self_hosted_js', type: 'checkbox', label: '', options: [] },
		{ key: 'ga_exclude_logged_in_users', type: 'checkbox', label: '', options: [] },
		// PageSpeed Insights.
		{ key: 'psi_api_key', type: 'text', label: '' },
		{ key: 'psi_daily_limit', type: 'text', label: '' },
		// Site Verification.
		{ key: 'webmaster_google_verification', type: 'text', label: '' },
		{ key: 'webmaster_google_verified_at', type: 'text', label: '' },
		{ key: 'webmaster_bing_verification', type: 'text', label: '' },
		{ key: 'webmaster_bing_verified_at', type: 'text', label: '' },
		{ key: 'webmaster_pinterest_verification', type: 'text', label: '' },
		{ key: 'webmaster_pinterest_verified_at', type: 'text', label: '' },
		{ key: 'webmaster_baidu_verification', type: 'text', label: '' },
		{ key: 'webmaster_yandex_verification', type: 'text', label: '' },
		{ key: 'webmaster_norton_verification', type: 'text', label: '' },
		{ key: 'webmaster_custom_tags', type: 'textarea', label: '' },
		// Preferences.
		{ key: 'site_tone', type: 'text', label: '' },
	],
	PanelComponent: ConnectionsPanel,
};
