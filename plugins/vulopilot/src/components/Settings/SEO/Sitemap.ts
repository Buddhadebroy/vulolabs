import { __ } from '@wordpress/i18n';
import SitemapPanel from './SitemapPanel';

/**
 * Settings → SEO → Sitemap.
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
