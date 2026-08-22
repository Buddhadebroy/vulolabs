import { __ } from '@wordpress/i18n';
import GoogleServicesPanel from './GoogleServicesPanel';

/**
 * Settings → Connections → Google Services.
 *
 * Previously Settings → Scanning → Google Services — moved into this
 * Connections folder per direct instruction, alongside AI Providers/
 * Webhooks/External Services, mirroring Settings/Connections/AiProviders.ts's
 * own "one folder, several sub-tab files" shape. `id` is unchanged
 * ('google-services'), so KeywordsTab.tsx's own
 * `?page=vulopilot#&tab=settings&subtab=google-services` deep link still
 * resolves correctly — NavigatorComponent routes by leaf file id, not
 * folder path.
 *
 * `PanelComponent` is the same generic escape hatch Settings.tsx's own
 * GetForm() already uses for Connections/AiProviders.ts and
 * vulopilot-pro's Licensing tab — a real OAuth connect/disconnect flow
 * with live per-service pickers doesn't fit the per-field auto-save model
 * at all.
 *
 * `modal` still lists the 4 real tracking-code toggles
 * (`ga_install_tracking_code`/`ga_anonymize_ip`/`ga_self_hosted_js`/
 * `ga_exclude_logged_in_users` — Utill.php's own
 * VULOPILOT_SETTINGS_DEFAULTS, read by Services\GoogleAnalyticsTracker)
 * purely so Settings.tsx's existing per-tab seeding logic (`fieldKeys`
 * from `modal[].key`) populates SettingContext with their current values
 * before GoogleServicesPanel.tsx reads/writes them via `useSetting()`. The
 * connection itself (tokens, selected Site/Property/Account) is
 * deliberately NOT here — it lives in its own `vulopilot_google_connection`
 * option via Controllers\GoogleServices (see GoogleServicesConnection's
 * own docblock).
 */
export default {
	id: 'google-services',
	priority: 2,
	headerTitle: __( 'Google Services', 'vulopilot' ),
	headerDescription: __(
		'Connect your Google account to allow VuloPilot to fetch real data from Google services.',
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
	PanelComponent: GoogleServicesPanel,
};
