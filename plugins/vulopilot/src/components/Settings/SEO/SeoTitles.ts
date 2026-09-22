import { __ } from '@wordpress/i18n';
import SeoTitlesPanel from './SeoTitlesPanel';

/**
 * Settings → SEO → SEO Titles.
 *
 * Moved into the new top-level "SEO" group folder (alongside Sitemap and
 * Instant Indexing) out of the old "Get Started"/Business Visibility
 * folder, which is gone now that every one of its sub-tabs moved
 * elsewhere. Renamed from "Title Formats" (`id: 'title-formats'`) to "SEO
 * Titles" (`id: 'seo-titles'`) as part of that same restructure - no other
 * `subtab=title-formats` deep link existed anywhere else in this codebase
 * (re-verified via grep), so nothing else needed updating for the id
 * change.
 *
 * `PanelComponent` escape hatch (Settings.tsx's own GetForm(), same
 * mechanism GetStarted/AiProviders.ts and GetStarted/GoogleServices.ts
 * already use) - SeoTitlesPanel.tsx manages its own explicit "Save
 * Changes" action (rather than InputRenderer's own per-field autosave) and
 * a live preview, which don't fit InputRenderer's static declarative
 * fields. `modal` still lists the real underlying keys purely so
 * Settings.tsx's own per-tab seeding logic (`fieldKeys` from
 * `modal[].key`) populates SettingContext with their current values before
 * the panel reads/writes them via `useSetting()` - same role
 * SiteVerification.ts's own `modal` array plays.
 *
 * Real backend: Services\TitleFormatter (`pre_get_document_title` for the
 * title, `wp_head` for a real `<meta name="description">`) - see that
 * class's own docblock for exactly how each `title_format_*`/
 * `description_format_*` template resolves, and why `post`/`page`
 * descriptions defer to a real `post_excerpt` first.
 */
export default {
	id: 'seo-titles',
	priority: 1,
	headerTitle: __('SEO Titles', 'vulopilot'),
	headerDescription: __(
		'Configure how your page titles and descriptions are formatted across your website.',
		'vulopilot'
	),
	hideSettingHeader: true,
	headerIcon: 'document',
	submitUrl: 'settings',
	modal: [
		{ key: 'site_identity_enabled', type: 'text', label: '' },
		{ key: 'title_separator', type: 'text', label: '' },
		{ key: 'title_format_home', type: 'text', label: '' },
		{ key: 'title_format_post', type: 'text', label: '' },
		{ key: 'title_format_page', type: 'text', label: '' },
		{ key: 'title_format_category', type: 'text', label: '' },
		{ key: 'title_format_tag', type: 'text', label: '' },
		{ key: 'title_format_search', type: 'text', label: '' },
		{ key: 'title_format_archive', type: 'text', label: '' },
		{ key: 'description_format_home', type: 'text', label: '' },
		{ key: 'description_format_post', type: 'text', label: '' },
		{ key: 'description_format_page', type: 'text', label: '' },
		{ key: 'description_format_category', type: 'text', label: '' },
		{ key: 'description_format_tag', type: 'text', label: '' },
		{ key: 'description_format_search', type: 'text', label: '' },
		{ key: 'description_format_archive', type: 'text', label: '' },
	],
	PanelComponent: SeoTitlesPanel,
};
