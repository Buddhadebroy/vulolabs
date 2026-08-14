import { __ } from '@wordpress/i18n';

/**
 * New Scanning → Google Services tab — one real Google OAuth 2.0
 * connection covering Search Console, Analytics (GA4), and AdSense
 * (KeywordsTab.tsx's own "Go to Settings" button lands here directly,
 * `?page=vulopilot#&tab=settings&subtab=google-services`). Only `id`/
 * `priority`/`headerTitle`/`headerIcon` are actually used for navigation —
 * Settings.tsx's GetForm() special-cases `currentTab === 'google-services'`
 * to render GoogleServicesPanel.tsx instead of InputRenderer (same escape
 * hatch 'ai-providers'/'indexnow' already use), since a real OAuth
 * connect/disconnect flow with live per-service pickers doesn't fit the
 * per-field auto-save model at all.
 *
 * `modal` still lists the 4 real tracking-code toggles
 * (`ga_install_tracking_code`/`ga_anonymize_ip`/`ga_self_hosted_js`/
 * `ga_exclude_logged_in_users` — Utill.php's own
 * VULOPILOT_SETTINGS_DEFAULTS, read by Services\GoogleAnalyticsTracker)
 * purely so Settings.tsx's existing per-tab seeding logic (`fieldKeys`
 * from `modal[].key`) populates SettingContext with their current values
 * before GoogleServicesPanel.tsx reads/writes them via `useSetting()` —
 * the same `useSetting()`-inside-a-hand-built-component approach
 * IndexNowPanel.tsx/LlmsTxtCard.tsx already establish. The connection
 * itself (Client ID/Secret, tokens, selected Site/Property/Account) is
 * deliberately NOT here — it lives in its own `vulopilot_google_connection`
 * option via Controllers\GoogleServices, kept out of this wholesale-
 * round-tripping flat settings option entirely (see
 * GoogleServicesConnection's own docblock).
 *
 * Sits right after "Titles & meta" (seo-content, priority 2) and before
 * Instant Indexing (2.3) — the other real "Google-facing" integration on
 * this settings page, distinct from seo-content's own
 * `webmaster_google_verification` field (a static ownership-proof meta
 * tag, not a live data connection).
 */
export default {
	id: 'google-services',
	priority: 2.15,
	headerTitle: __('Google Services', 'vulopilot'),
	headerDescription: __(
		'Connect a Google account so VuloPilot can read this site’s real Search Console, Analytics, and AdSense data.',
		'vulopilot'
	),
	headerIcon: 'search-discovery',
	submitUrl: 'settings',
	modal: [
		{ key: 'ga_install_tracking_code', type: 'checkbox', label: '', options: [] },
		{ key: 'ga_anonymize_ip', type: 'checkbox', label: '', options: [] },
		{ key: 'ga_self_hosted_js', type: 'checkbox', label: '', options: [] },
		{ key: 'ga_exclude_logged_in_users', type: 'checkbox', label: '', options: [] },
	],
};
