import { __ } from '@wordpress/i18n';
import SitemapPanel from './SitemapPanel';

/**
 * Settings → SEO → Sitemap.
 *
 * `PanelComponent` escape hatch (Settings.tsx's own GetForm(), same
 * mechanism SeoTitles.ts/GetStarted/AiProviders.ts already use) -
 * SitemapPanel.tsx manages its own real per-field autosave and the
 * 2-column "How it works" sidebar layout, which don't fit InputRenderer's
 * static declarative fields (see that file's own docblock for exactly why
 * and how). `modal` still lists the real underlying keys purely so
 * Settings.tsx's own per-tab seeding logic (`fieldKeys` from
 * `modal[].key`) populates SettingContext with their current values
 * before the panel reads/writes them via `useSetting()` - same role
 * SeoTitles.ts's own `modal` array plays.
 *
 * Same real `sitemap_*`/`html_sitemap_*` keys and same `id: 'sitemap'`
 * throughout - unchanged backend (Controllers\RobotsSitemap/
 * Services\SitemapGenerator/Services\HtmlSitemapRenderer), only how the
 * UI for it renders/saves changed.
 */
export default {
	id: 'sitemap',
	priority: 2,
	headerTitle: __('Sitemap', 'vulopilot'),
	headerDescription: __(
		'Configure your XML sitemap (for search engines) and HTML sitemap (for visitors).',
		'vulopilot'
	),
	hideSettingHeader: true,
	headerIcon: 'editor-list',
	submitUrl: 'settings',
	modal: [
		{ key: 'sitemap_enabled', type: 'text', label: '' },
		{ key: 'sitemap_xml_post_types', type: 'text', label: '' },
		{ key: 'sitemap_xml_taxonomies', type: 'text', label: '' },
		{ key: 'sitemap_links_per_page', type: 'text', label: '' },
		{ key: 'sitemap_exclude_posts', type: 'text', label: '' },
		{ key: 'sitemap_exclude_terms', type: 'text', label: '' },
		{ key: 'sitemap_include_images', type: 'text', label: '' },
		{ key: 'sitemap_include_featured_images', type: 'text', label: '' },
		{ key: 'html_sitemap_enabled', type: 'text', label: '' },
		{ key: 'html_sitemap_display_format', type: 'text', label: '' },
		{ key: 'html_sitemap_sort_by', type: 'text', label: '' },
		{ key: 'html_sitemap_show_dates', type: 'text', label: '' },
		{ key: 'html_sitemap_item_titles', type: 'text', label: '' },
	],
	PanelComponent: SitemapPanel,
};
