import { __ } from '@wordpress/i18n';
import SiteVerificationPanel from './SiteVerificationPanel';

/**
 * Settings → Connections → Site Verification.
 *
 * `PanelComponent` escape hatch (Settings.tsx's own GetForm(), same
 * mechanism Connections/AiProviders.ts/GoogleServices.ts already use) —
 * SiteVerificationPanel.tsx manages its own per-provider "Verify" action
 * and honest status pills, which don't fit InputRenderer's static
 * declarative fields. `modal` still lists the real underlying keys purely
 * so Settings.tsx's own per-tab seeding logic (`fieldKeys` from
 * `modal[].key`) populates SettingContext with their current values before
 * the panel reads/writes them via `useSetting()` — same role GoogleServices.ts's
 * own `modal` array plays. See SiteVerificationPanel.tsx's own docblock
 * for the real backend (Services\WebmasterToolsManager) and why "Verify"
 * is an honest self-check rather than a call to Google/Bing/Pinterest.
 */
export default {
	id: 'site-verification',
	priority: 4,
	headerTitle: __('Site Verification', 'vulopilot'),
	headerDescription: __(
		'Verify your website ownership on different platforms. This helps VuloPilot access more data and provide better insights.',
		'vulopilot'
	),
	headerIcon: 'check',
	submitUrl: 'settings',
	modal: [
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
	],
	PanelComponent: SiteVerificationPanel,
};
