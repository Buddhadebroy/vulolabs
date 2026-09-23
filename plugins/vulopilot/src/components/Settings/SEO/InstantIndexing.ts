import { __ } from '@wordpress/i18n';

/**
 * Settings → SEO → Instant Indexing (IndexNow). Originally moved here from
 * Scanning, then moved again from the old "Get Started"/Business
 * Visibility folder into the new top-level "SEO" group folder alongside
 * Sitemap and SEO Titles - same real `id: 'indexnow'` throughout, so the
 * existing `?...&subtab=indexnow` deep link still resolves
 * (`getSettingById()` recurses by id alone, with no concept of which
 * folder a tab lives in). `IndexNowPanel.tsx` moved alongside this file
 * into `SEO/` too.
 *
 * Only `id`/`priority`/`headerTitle`/`headerIcon` are actually used for
 * navigation - Settings.tsx's GetForm() special-cases `currentTab ===
 * 'indexnow'` to render IndexNowPanel.tsx instead of InputRenderer (same
 * escape hatch 'integrations' already uses), since this
 * tab's "Submit URLs" and "History" cards are real actions/logs, not
 * persisted settings fields.
 *
 * `modal` below still lists `indexnow_api_key`/`indexnow_post_types` (the
 * two fields of this tab that ARE real flat settings, unlike AI service
 * configs which live in their own table) purely so Settings.tsx's existing
 * per-tab seeding logic (`fieldKeys` from `modal[].key`) populates
 * SettingContext with their current values before IndexNowPanel reads them
 * via `useSetting()` - the same `useSetting()`-inside-a-hand-built-
 * component approach LlmsTxtCard.tsx already uses.
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
