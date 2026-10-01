import { __ } from '@wordpress/i18n';
import IntegrationsPanel from './IntegrationsPanel';

/**
 * Settings → Integrations.
 */
export default {
	id: 'integrations',
	priority: 7,
	headerTitle: __('Integrations', 'vulopilot'),
	headerDescription: __(
		'Connect VuloPilot to AI services, Google services, and verify your site ownership.',
		'vulopilot'
	),
	hideSettingHeader: true,
	groupBySections: true,
	headerIcon: 'link',
	submitUrl: 'settings',
	modal: [
		// Google Services.
		{ key: 'ga_install_tracking_code', type: 'checkbox', label: '', options: [] },
		{ key: 'ga_anonymize_ip', type: 'checkbox', label: '', options: [] },
		{ key: 'ga_self_hosted_js', type: 'checkbox', label: '', options: [] },
		{ key: 'ga_exclude_logged_in_users', type: 'checkbox', label: '', options: [] },
		// Tag Manager (TagManagerPanel.tsx) - moved in from Scanning → SEO
		// & Content, rendered above Webmaster Tools.
		{ key: 'tag_manager_enabled', type: 'checkbox', label: '', options: [] },
		{ key: 'tag_manager_container_id', type: 'text', label: '' },
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
		// PageSpeed Insights (PageSpeedStatusPanel.tsx) - moved here, rendered after Webmaster Tools above.
		{ key: 'psi_api_key', type: 'text', label: '' },
		{ key: 'psi_daily_limit', type: 'text', label: '' },
	],
	PanelComponent: IntegrationsPanel,
};
