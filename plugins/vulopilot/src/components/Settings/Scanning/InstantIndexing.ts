import { __ } from '@wordpress/i18n';

/**
 * New Scanning → Instant Indexing (IndexNow) tab. Only `id`/`priority`/
 * `headerTitle`/`headerIcon` are actually used for navigation —
 * Settings.tsx's GetForm() special-cases `currentTab === 'indexnow'` to
 * render IndexNowPanel.tsx instead of InputRenderer (same escape hatch
 * 'ai-providers'/'import-export' already use), since this tab's "Submit
 * URLs" and "History" cards are real actions/logs, not persisted settings
 * fields.
 *
 * `modal` below still lists `indexnow_api_key`/`indexnow_post_types` (the
 * two fields of this tab that ARE real flat settings, unlike AI provider
 * configs which live in their own table) purely so Settings.tsx's existing
 * per-tab seeding logic (`fieldKeys` from `modal[].key`) populates
 * SettingContext with their current values before IndexNowPanel reads them
 * via `useSetting()` — the same `useSetting()`-inside-a-hand-built-
 * component approach LlmsTxtCard.tsx already uses.
 */
export default {
	id: 'indexnow',
	// Sorts between Webmaster Tools (2.2) and Geo (3).
	priority: 2.3,
	headerTitle: __('Instant Indexing', 'vulopilot'),
	headerIcon: 'web-page-website',
	submitUrl: 'settings',
	modal: [
		{ key: 'indexnow_api_key', type: 'text', label: '' },
		{ key: 'indexnow_post_types', type: 'checkbox', label: '', options: [] },
	],
};
