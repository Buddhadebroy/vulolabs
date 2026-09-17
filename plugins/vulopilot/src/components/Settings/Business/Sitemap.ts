/* global appLocalizer */
import { __ } from '@wordpress/i18n';

/**
 * Settings → Get Started → Sitemap.
 *
 * Moved out of Scanning → SEO & Content (SeoContent.ts's own former
 * "XML Sitemap"/"Post types & taxonomies in sitemap"/"HTML Sitemap"
 * sections, all 3 removed there) per direct instruction, into its own new
 * sub-tab here — same real `sitemap_*`/`html_sitemap_*` keys, unchanged
 * backend (Controllers\RobotsSitemap/Services\SitemapGenerator/
 * Services\HtmlSitemapRenderer), only where the UI for it lives moved.
 *
 * A plain declarative `modal` (InputRenderer), same shape
 * `BusinessInformation.ts` uses now — no hand-built `PanelComponent`
 * needed, every field here is a real `type: 'section'`/`'checkbox'`/
 * `'text'`/`'number'`/`'select'`/`'choice-toggle'`/`'notice'` InputRenderer
 * already supports natively, same as it did on the old tab.
 *
 * "Post types in sitemap"/"Taxonomies in sitemap" — one real control each,
 * not the former separate XML/HTML pair (`sitemap_html_post_types`/
 * `sitemap_html_taxonomies`, both removed) per direct instruction: the two
 * controls always had to be set to look the same to avoid a confusing
 * "included in one but not the other" state, so `sitemap_xml_post_types`/
 * `sitemap_xml_taxonomies` (kept, same real stored option keys — no
 * migration needed) now drive the HTML sitemap shortcode too —
 * HtmlSitemapRenderer.php reads them directly instead of its own former
 * separate keys.
 */
export default {
	id: 'sitemap',
	priority: 4,
	headerTitle: __('Sitemap', 'vulopilot'),
	headerDescription: __(
		'Configure your XML sitemap (for search engines) and HTML sitemap (for visitors).',
		'vulopilot'
	),
	groupBySections: true,
	hideSettingHeader: true,
	headerIcon: 'editor-list',
	submitUrl: 'settings',
	modal: [
		{
			key: 'sitemap-section-xml',
			type: 'section',
			icon: 'editor-list',
			title: __('XML Sitemap', 'vulopilot'),
		},
		{
			key: 'sitemap_enabled',
			type: 'checkbox',
			look: 'toggle',

			label: __('Enable sitemap', 'vulopilot'),
			settingDescription: __(
				'Available at yoursite.com/sitemap.xml once enabled. Search engines are notified automatically when new content is published.',
				'vulopilot'
			),
			options: [
				{ key: 'sitemap_enabled', label: '', value: 'sitemap_enabled' },
			],
		},
		{
			key: 'sitemap-notice',
			type: 'notice',
			noticeType: 'info',
			message: `${__('Active & up to date', 'vulopilot')} ${appLocalizer.site_url}/sitemap.xml`,
			dependent: { key: 'sitemap_enabled', value: 'sitemap_enabled', set: true },
		},
		{
			key: 'sitemap-section-post-types',
			type: 'section',
			icon: 'category',
			title: __('Post types & taxonomies in sitemap', 'vulopilot'),
			desc: __(
				'Which real post types/taxonomies are included — shared by both the XML sitemap and the [vulopilot_html_sitemap] shortcode below. "Products"/"Product categories"/"Product tags" only take effect when WooCommerce is active.',
				'vulopilot'
			),
		},
		{
			key: 'sitemap_xml_post_types',
			type: 'choice-toggle',

			label: __('Post types in sitemap', 'vulopilot'),
			options: [
				{ key: 'post', label: __('Posts', 'vulopilot'), value: 'post' },
				{ key: 'page', label: __('Pages', 'vulopilot'), value: 'page' },
				{ key: 'attachment', label: __('Media', 'vulopilot'), value: 'attachment' },
				{ key: 'product', label: __('Products', 'vulopilot'), value: 'product' },
			],
		},
		{
			key: 'sitemap_xml_taxonomies',
			type: 'choice-toggle',

			label: __('Taxonomies in sitemap', 'vulopilot'),
			options: [
				{ key: 'category', label: __('Categories', 'vulopilot'), value: 'category' },
				{ key: 'post_tag', label: __('Tags', 'vulopilot'), value: 'post_tag' },
				{ key: 'product_cat', label: __('Product Categories', 'vulopilot'), value: 'product_cat' },
				{ key: 'product_tag', label: __('Product Tags', 'vulopilot'), value: 'product_tag' },
			],
		},
		{
			key: 'advance-section',
			type: 'section',
			icon: 'editor-list',
			title: __('Advance Settings', 'vulopilot'),
		},
		{
			key: 'sitemap_links_per_page',
			type: 'number',
			size: 10,
			label: __('Links per sitemap', 'vulopilot'),
			settingDescription: __('Max number of links on each sitemap page.', 'vulopilot'),
		},
		{
			key: 'sitemap_exclude_posts',
			type: 'text',
			size: 10,
			label: __('Exclude posts', 'vulopilot'),
			settingDescription: __(
				'Post IDs to exclude from the sitemap, separated by commas. Applies across all included post types.',
				'vulopilot'
			),
		},
		{
			key: 'sitemap_exclude_terms',
			type: 'text',
			size: 10,
			label: __('Exclude terms', 'vulopilot'),
			settingDescription: __(
				'Term IDs to exclude, separated by commas. Applies across all included taxonomies.',
				'vulopilot'
			),
		},
		{
			key: 'sitemap_include_images',
			type: 'checkbox',
			look: 'toggle',

			label: __('Images in sitemaps', 'vulopilot'),
			settingDescription: __(
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
			settingDescription: __(
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
			key: 'sitemap-section-html',
			type: 'section',
			icon: 'web-page-website',
			title: __('HTML Sitemap', 'vulopilot'),
		},
		{
			key: 'html_sitemap_enabled',
			type: 'checkbox',
			look: 'toggle',

			label: __('Enable HTML sitemap', 'vulopilot'),
			settingDescription: __(
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
			size: 10,
			label: __('Display format', 'vulopilot'),
			settingDescription: __('How you want to display the HTML sitemap.', 'vulopilot'),
			options: [
				{ label: __('List', 'vulopilot'), value: 'list' },
				{ label: __('Grid', 'vulopilot'), value: 'grid' },
			],
			dependent: { key: 'html_sitemap_enabled', value: 'html_sitemap_enabled', set: true },
		},
		{
			key: 'html_sitemap_sort_by',
			type: 'select',
			size: 15,
			label: __('Sort by', 'vulopilot'),
			settingDescription: __('How to sort the items in the HTML sitemap.', 'vulopilot'),
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
			settingDescription: __('Show published dates for each post & page.', 'vulopilot'),
			options: [
				{ key: 'html_sitemap_show_dates', label: '', value: 'html_sitemap_show_dates' },
			],
			dependent: { key: 'html_sitemap_enabled', value: 'html_sitemap_enabled', set: true },
		},
		{
			key: 'html_sitemap_item_titles',
			type: 'select',
			size: 15,
			label: __('Item titles', 'vulopilot'),
			settingDescription: __(
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
