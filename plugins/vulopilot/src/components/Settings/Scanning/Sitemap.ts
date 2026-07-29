/* global appLocalizer */
import { __ } from '@wordpress/i18n';

/**
 * New dedicated Scanning → Sitemap tab (previously the "XML Sitemap" card
 * lived inside Scanning → SEO — moved out here to match the mockup's own
 * tab boundary; Seo.ts's own docblock notes the move).
 *
 * Real backing:
 * - `sitemap_enabled`/`sitemap_ping_search_engines`/`sitemap_links_per_page`/
 *   `sitemap_exclude_posts`/`sitemap_exclude_terms`/`sitemap_xml_post_types`/
 *   `sitemap_xml_taxonomies`: real filters over WordPress core's own native
 *   `/wp-sitemap.xml` (`wp_sitemaps_enabled`, `wp_sitemaps_max_urls`,
 *   `wp_sitemaps_posts_query_args`, `wp_sitemaps_taxonomies_query_args`,
 *   `wp_sitemaps_post_types`, `wp_sitemaps_taxonomies`) via
 *   Services\SitemapManager — not a from-scratch generator.
 * - `sitemap_html_post_types`/`sitemap_html_taxonomies`/`html_sitemap_*`:
 *   a real, independent `[vulopilot_html_sitemap]` shortcode via
 *   Services\HtmlSitemapRenderer.
 * - `sitemap_include_images`/`sitemap_include_featured_images`: NOT
 *   implemented — WordPress core's native sitemaps have no `<image:image>`
 *   extension support at all, and adding one means building a second,
 *   competing sitemap implementation (SitemapManager.php's own docblock
 *   explains why that's out of scope here). Persisted only, same honest
 *   "round-trips through Settings but nothing reads it yet" posture Seo.ts's
 *   Redirects & 404s section already takes for its own not-yet-built
 *   features.
 *
 * `sitemap_xml_post_types`/`sitemap_html_post_types`/`sitemap_xml_taxonomies`/
 * `sitemap_html_taxonomies` reuse Geo.ts's `llms_include_types` shape (a
 * `checkbox` field with multiple `options`, no `look: 'toggle'`) as four
 * separate multi-select pill groups, rather than the mockup's one-row-
 * per-type/two-toggle-columns grid layout — this codebase has no existing
 * "checkbox table" field anywhere else to build against, and the type/
 * taxonomy list here is small enough (4 entries each) that four flat
 * multi-selects cover the same real functionality without introducing an
 * unproven, unprecedented input shape.
 */
export default {
	id: 'sitemap',
	// Sorts between Seo (2) and Geo (3) — matches the mockup's own
	// Security/SEO/Sitemap/Webmaster/Instant Indexing/GEO tab order without
	// needing to renumber every existing Scanning/*.ts file's priority.
	priority: 2.1,
	headerTitle: __('Sitemap', 'vulopilot'),
	headerIcon: 'admin-links',
	submitUrl: 'settings',
	modal: [
		{
			key: 'sitemap-section-xml',
			type: 'section',
			title: __('XML Sitemap', 'vulopilot'),
		},
		{
			key: 'sitemap-notice',
			type: 'notice',
			noticeType: 'info',
			message: `${__('Your sitemap index can be found at', 'vulopilot')} ${appLocalizer.site_url}/wp-sitemap.xml`,
		},
		{
			key: 'sitemap_enabled',
			type: 'checkbox',
			look: 'toggle',
			label: __('Generate XML sitemap', 'vulopilot'),
			desc: __(
				'Available at yoursite.com/wp-sitemap.xml once enabled.',
				'vulopilot'
			),
			options: [
				{ key: 'sitemap_enabled', label: '', value: 'sitemap_enabled' },
			],
		},
		{
			key: 'sitemap_ping_search_engines',
			type: 'checkbox',
			look: 'toggle',
			label: __('Ping search engines on update', 'vulopilot'),
			desc: __(
				'Notifies Bing automatically when new content is published.',
				'vulopilot'
			),
			options: [
				{
					key: 'sitemap_ping_search_engines',
					label: '',
					value: 'sitemap_ping_search_engines',
				},
			],
			dependent: { key: 'sitemap_enabled', value: 'sitemap_enabled', set: true },
		},
		{
			key: 'sitemap_links_per_page',
			type: 'number',
			label: __('Links per sitemap', 'vulopilot'),
			desc: __('Max number of links on each sitemap page.', 'vulopilot'),
			dependent: { key: 'sitemap_enabled', value: 'sitemap_enabled', set: true },
		},
		{
			key: 'sitemap_exclude_posts',
			type: 'text',
			label: __('Exclude posts', 'vulopilot'),
			desc: __(
				'Post IDs to exclude from the sitemap, separated by commas. Applies across all included post types.',
				'vulopilot'
			),
			dependent: { key: 'sitemap_enabled', value: 'sitemap_enabled', set: true },
		},
		{
			key: 'sitemap_exclude_terms',
			type: 'text',
			label: __('Exclude terms', 'vulopilot'),
			desc: __(
				'Term IDs to exclude, separated by commas. Applies across all included taxonomies.',
				'vulopilot'
			),
			dependent: { key: 'sitemap_enabled', value: 'sitemap_enabled', set: true },
		},
		{
			key: 'sitemap-section-images',
			type: 'section',
			title: __('Images in sitemap', 'vulopilot'),
			desc: __(
				'Not yet implemented — WordPress core\'s native XML sitemap has no image entry support to hook into. These round-trip through Settings but have no effect on the sitemap output yet.',
				'vulopilot'
			),
		},
		{
			key: 'sitemap_include_images',
			type: 'checkbox',
			look: 'toggle',
			label: __('Images in sitemaps', 'vulopilot'),
			desc: __(
				"Include references to images from the post content in sitemaps — this helps search engines index the important images on your pages.",
				'vulopilot'
			),
			options: [
				{ key: 'sitemap_include_images', label: '', value: 'sitemap_include_images' },
			],
		},
		{
			key: 'sitemap_include_featured_images',
			type: 'checkbox',
			look: 'toggle',
			label: __('Include featured images', 'vulopilot'),
			desc: __(
				"Include the featured image too, even if it doesn't appear directly in the post content.",
				'vulopilot'
			),
			options: [
				{
					key: 'sitemap_include_featured_images',
					label: '',
					value: 'sitemap_include_featured_images',
				},
			],
			dependent: { key: 'sitemap_include_images', value: 'sitemap_include_images', set: true },
		},
		{
			key: 'sitemap-section-post-types',
			type: 'section',
			title: __('Post types & taxonomies in sitemap', 'vulopilot'),
			desc: __(
				'Which real post types/taxonomies are included in the XML sitemap vs. the [vulopilot_html_sitemap] shortcode below — a type can be in one, both, or neither. "Products"/"Product categories"/"Product tags" only take effect when WooCommerce is active.',
				'vulopilot'
			),
		},
		{
			key: 'sitemap_xml_post_types',
			type: 'checkbox',
			label: __('Post types in XML sitemap', 'vulopilot'),
			options: [
				{ key: 'post', label: __('Posts', 'vulopilot'), value: 'post' },
				{ key: 'page', label: __('Pages', 'vulopilot'), value: 'page' },
				{ key: 'attachment', label: __('Media', 'vulopilot'), value: 'attachment' },
				{ key: 'product', label: __('Products', 'vulopilot'), value: 'product' },
			],
		},
		{
			key: 'sitemap_html_post_types',
			type: 'checkbox',
			label: __('Post types in HTML sitemap', 'vulopilot'),
			options: [
				{ key: 'post', label: __('Posts', 'vulopilot'), value: 'post' },
				{ key: 'page', label: __('Pages', 'vulopilot'), value: 'page' },
				{ key: 'attachment', label: __('Media', 'vulopilot'), value: 'attachment' },
				{ key: 'product', label: __('Products', 'vulopilot'), value: 'product' },
			],
		},
		{
			key: 'sitemap_xml_taxonomies',
			type: 'checkbox',
			label: __('Taxonomies in XML sitemap', 'vulopilot'),
			options: [
				{ key: 'category', label: __('Categories', 'vulopilot'), value: 'category' },
				{ key: 'post_tag', label: __('Tags', 'vulopilot'), value: 'post_tag' },
				{ key: 'product_cat', label: __('Product Categories', 'vulopilot'), value: 'product_cat' },
				{ key: 'product_tag', label: __('Product Tags', 'vulopilot'), value: 'product_tag' },
			],
		},
		{
			key: 'sitemap_html_taxonomies',
			type: 'checkbox',
			label: __('Taxonomies in HTML sitemap', 'vulopilot'),
			options: [
				{ key: 'category', label: __('Categories', 'vulopilot'), value: 'category' },
				{ key: 'post_tag', label: __('Tags', 'vulopilot'), value: 'post_tag' },
				{ key: 'product_cat', label: __('Product Categories', 'vulopilot'), value: 'product_cat' },
				{ key: 'product_tag', label: __('Product Tags', 'vulopilot'), value: 'product_tag' },
			],
		},
		{
			key: 'sitemap-section-html',
			type: 'section',
			title: __('HTML Sitemap', 'vulopilot'),
		},
		{
			key: 'html_sitemap_enabled',
			type: 'checkbox',
			look: 'toggle',
			label: __('Enable HTML sitemap', 'vulopilot'),
			desc: __(
				'A human-readable page listing every included post, page, and taxonomy term.',
				'vulopilot'
			),
			options: [
				{ key: 'html_sitemap_enabled', label: '', value: 'html_sitemap_enabled' },
			],
		},
		{
			key: 'html-sitemap-shortcode-notice',
			type: 'notice',
			noticeType: 'info',
			message: __(
				'Use this shortcode to display the HTML sitemap anywhere on your site: [vulopilot_html_sitemap]',
				'vulopilot'
			),
			dependent: { key: 'html_sitemap_enabled', value: 'html_sitemap_enabled', set: true },
		},
		{
			key: 'html_sitemap_display_format',
			type: 'select',
			label: __('Display format', 'vulopilot'),
			desc: __('How you want to display the HTML sitemap.', 'vulopilot'),
			options: [
				{ label: __('List', 'vulopilot'), value: 'list' },
				{ label: __('Grid', 'vulopilot'), value: 'grid' },
			],
			dependent: { key: 'html_sitemap_enabled', value: 'html_sitemap_enabled', set: true },
		},
		{
			key: 'html_sitemap_sort_by',
			type: 'select',
			label: __('Sort by', 'vulopilot'),
			desc: __('How to sort the items in the HTML sitemap.', 'vulopilot'),
			options: [
				{ label: __('Published Date', 'vulopilot'), value: 'published_date' },
				{ label: __('Modified Date', 'vulopilot'), value: 'modified_date' },
				{ label: __('Title', 'vulopilot'), value: 'title' },
			],
			dependent: { key: 'html_sitemap_enabled', value: 'html_sitemap_enabled', set: true },
		},
		{
			key: 'html_sitemap_show_dates',
			type: 'checkbox',
			look: 'toggle',
			label: __('Show dates', 'vulopilot'),
			desc: __('Show published dates for each post & page.', 'vulopilot'),
			options: [
				{ key: 'html_sitemap_show_dates', label: '', value: 'html_sitemap_show_dates' },
			],
			dependent: { key: 'html_sitemap_enabled', value: 'html_sitemap_enabled', set: true },
		},
		{
			key: 'html_sitemap_item_titles',
			type: 'select',
			label: __('Item titles', 'vulopilot'),
			desc: __(
				'Show the post/term titles, or the SEO titles, in the HTML sitemap.',
				'vulopilot'
			),
			options: [
				{ label: __('Post/Term Titles', 'vulopilot'), value: 'post_title' },
				{ label: __('SEO Titles', 'vulopilot'), value: 'seo_title' },
			],
			dependent: { key: 'html_sitemap_enabled', value: 'html_sitemap_enabled', set: true },
		},
	],
};
