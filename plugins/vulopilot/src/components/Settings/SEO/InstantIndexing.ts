import { __ } from '@wordpress/i18n';

/**
 * Settings → SEO → Instant Indexing (IndexNow).
 */
export default {
	id: 'indexnow',
	priority: 3,
	headerTitle: __('Instant Indexing', 'vulopilot'),
	headerDescription: __(
		'Submit new and updated URLs to search engines the moment they\'re published.',
		'vulopilot'
	),
	headerIcon: 'web-page-website',
	groupBySections: true,
	hideSettingHeader: true,
	submitUrl: 'settings',
	modal: [
		{ key: 'indexnow_api_key', type: 'text', label: '' },
		{ key: 'indexnow_post_types', type: 'checkbox', label: '', options: [] },
	],
};
