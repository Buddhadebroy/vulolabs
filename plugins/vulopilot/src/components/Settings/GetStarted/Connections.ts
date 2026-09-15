import { __ } from '@wordpress/i18n';
import ConnectionsPanel from './ConnectionsPanel';

/**
 * Settings → Get Started → Connections.
 *
 * Replaces this folder's previous 5 separate sub-tabs — AiProviders.ts,
 * GoogleServices.ts, PageSpeedInsights.ts, SiteVerification.ts,
 * Preferences.ts (all deleted) — merged into this one tab per direct
 * instruction ("merge all tabs into one tab under get started called
 * connections"). See ConnectionsPanel.tsx's own docblock for how the real
 * components from those 5 tabs are composed here.
 *
 * `modal` below is the union of all 5 old tabs' own real flat keys —
 * still needed even though `PanelComponent` bypasses InputRenderer
 * entirely, purely so Settings.tsx's own per-tab seeding logic
 * (`fieldKeys` from `modal[].key`) populates SettingContext with their
 * current values before ConnectionsPanel.tsx's own components mount and
 * read them via `useSetting()` — same role every other `PanelComponent`
 * tab's own `modal` array already plays (see AiProviders.ts's own
 * docblock before this merge for the same reasoning). AI Providers itself
 * contributes no keys here — its config lives in its own encrypted-at-rest
 * `vulopilot_ai_provider_configs` table, not this plugin's flat settings
 * option row.
 */
export default {
	id: 'connections',
	priority: 1,
	headerTitle: __('Connections', 'vulopilot'),
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
