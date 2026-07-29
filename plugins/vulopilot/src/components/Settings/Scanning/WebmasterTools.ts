import { __ } from '@wordpress/i18n';

/**
 * New Scanning → Webmaster Tools tab. Real backing:
 * Services\WebmasterToolsManager outputs one `<meta>` tag per non-empty
 * provider code on `wp_head` (same self-registers-own-hook/setting-gates-
 * output shape as CanonicalUrlManager/SocialMetaTagsManager), plus
 * `webmaster_custom_tags`' free-form textarea, sanitized down to `<meta>`
 * tags only before being echoed — never trusted verbatim.
 *
 * Six separate flat text fields (one per provider) rather than the
 * mockup's one `webmasterCodes` state object — this codebase's settings
 * option is a single flat key/value map with no existing precedent for a
 * nested per-field object (confirmed via Utill.php's own
 * VULOPILOT_SETTINGS_DEFAULTS — every setting is a top-level scalar/array),
 * so each provider gets its own top-level key instead of introducing a new
 * nesting convention for just this one tab.
 */
export default {
	id: 'webmaster-tools',
	// Sorts between Sitemap (2.1) and Geo (3).
	priority: 2.2,
	headerTitle: __('Webmaster Tools', 'vulopilot'),
	headerIcon: 'admin-site-alt3',
	submitUrl: 'settings',
	modal: [
		{
			key: 'webmaster-section-verification',
			type: 'section',
			title: __('Webmaster Tools', 'vulopilot'),
			desc: __(
				'Enter verification codes for third-party webmaster tools. Each one is rendered as its own <meta> tag on every page.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster_google_verification',
			type: 'text',
			label: __('Google Search Console', 'vulopilot'),
			desc: __(
				'Enter your Google Search Console verification ID. Rendered as <meta name="google-site-verification" content="...">.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster_bing_verification',
			type: 'text',
			label: __('Bing Webmaster Tools', 'vulopilot'),
			desc: __(
				'Enter your Bing Webmaster Tools verification ID. Rendered as <meta name="msvalidate.01" content="...">.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster_baidu_verification',
			type: 'text',
			label: __('Baidu Webmaster Tools', 'vulopilot'),
			desc: __(
				'Enter your Baidu Webmaster Tools verification ID. Rendered as <meta name="baidu-site-verification" content="...">.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster_yandex_verification',
			type: 'text',
			label: __('Yandex Verification ID', 'vulopilot'),
			desc: __(
				'Enter your Yandex.Webmaster verification ID. Rendered as <meta name="yandex-verification" content="...">.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster_pinterest_verification',
			type: 'text',
			label: __('Pinterest Verification ID', 'vulopilot'),
			desc: __(
				'Enter your Pinterest account verification ID. Rendered as <meta property="p:domain_verify" content="...">.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster_norton_verification',
			type: 'text',
			label: __('Norton Safe Web Verification ID', 'vulopilot'),
			desc: __(
				'Enter your Norton Safe Web ownership verification ID. Rendered as <meta name="norton-safeweb-site-verification" content="...">.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster-section-custom',
			type: 'section',
			title: __('Custom Webmaster Tags', 'vulopilot'),
		},
		{
			key: 'webmaster_custom_tags',
			type: 'textarea',
			label: __('Custom webmaster tags', 'vulopilot'),
			desc: __(
				'Enter your own custom webmaster tags. Only <meta> tags are allowed — anything else is stripped out before being added to the page.',
				'vulopilot'
			),
		},
	],
};
