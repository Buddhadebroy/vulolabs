import { __ } from '@wordpress/i18n';

/**
 * Granular, per-check toggles replacing the old whole-category
 * `enable_seo_scanning` switch — same "no blanket kill switch, only
 * granular ones" posture Scanning → GEO already uses. Each checkbox's
 * option key/value is the field's own settings key (not a shared
 * 'enabled' literal), matching every other settings tab in this plugin.
 *
 * Real backing per card:
 * - Titles & meta / Images / Links & schema: each toggle gates the one
 *   scanner it names directly (Scanners\Basic\MetaDescriptionScanner,
 *   DuplicateContentScanner, OrphanPageScanner, ThinContentScanner,
 *   SeoImagesScanner, ImagesScanner, BrokenLinksScanner, SchemaScanner +
 *   StructuredDataValidationScanner).
 * - Robots.txt: a real toggle over WordPress core's own virtual
 *   robots.txt (via Services\RobotsTxtManager) — not a from-scratch
 *   generator, plus `flag_ai_crawler_blocked_pages`
 *   (Scanners\Basic\AiCrawlerBlockedPagesScanner,
 *   AI-CRAWLER-ANALYTICS-MODULE.md). XML Sitemap settings moved to their own dedicated
 *   Scanning → Sitemap tab (Scanning/Sitemap.ts), matching the mockup's
 *   own tab boundary — they're no longer here.
 * - "Add canonical URL tags" / "Add Open Graph & Twitter Card tags"
 *   (Links & schema): real, independent tag output via
 *   Services\CanonicalUrlManager/SocialMetaTagsManager — the mechanical
 *   (non-AI) fixes vulopilot-pro's OneClickFix "Fix" action flips on for
 *   CanonicalUrlScanner/OpenGraphScanner/TwitterCardScanner's findings.
 *   Both default off; WordPress core (or another plugin) already covers
 *   most sites.
 * - Redirects & 404s: persisted settings only — a real 301 redirect
 *   manager and a real 404-visit log (distinct from
 *   Scanners\Basic\NotFoundScanner, which only checks this site's OWN
 *   published permalinks for 404s, not visitor traffic) don't exist in
 *   this codebase yet. That's a separate, larger feature; these three
 *   toggles round-trip through Settings correctly but nothing reads them
 *   yet (Utill.php's own defaults list this same caveat).
 */
export default {
	id: 'seo-content',
	priority: 2,
	headerTitle: __('SEO & Content', 'vulopilot'),
	headerDescription: __(
		'Scanning behavior for SEO, sitemaps, and webmaster tools.',
		'vulopilot'
	),
	headerIcon: 'search',
	submitUrl: 'settings',
	modal: [
		{
			key: 'seo-section',
			type: 'section',
			title: __('SEO', 'vulopilot'),
		},
		{
			key: 'seo-section-titles-meta',
			type: 'section',
			title: __('Titles & meta', 'vulopilot'),
			desc: __(
				'Controls what shows up in the SEO page\'s "Titles & Meta" and "Content Structure" findings.',
				'vulopilot'
			),
		},
		{
			key: 'flag_missing_meta_description',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between',
			label: __('Flag missing meta descriptions', 'vulopilot'),
			settingDescription: __('Pages and posts with no meta description set.', 'vulopilot'),
			options: [
				{
					key: 'flag_missing_meta_description',
					label: '',
					value: 'flag_missing_meta_description',
				},
			],
		},
		{
			key: 'flag_duplicate_titles',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between border-top',
			label: __('Flag duplicate title tags', 'vulopilot'),
			settingDescription: __(
				'Two or more published pages sharing the exact same title.',
				'vulopilot'
			),
			options: [
				{ key: 'flag_duplicate_titles', label: '', value: 'flag_duplicate_titles' },
			],
		},
		{
			key: 'flag_orphan_pages',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between border-top',
			label: __('Flag orphan pages', 'vulopilot'),
			settingDescription: __('Pages with no internal links pointing to them.', 'vulopilot'),
			options: [
				{ key: 'flag_orphan_pages', label: '', value: 'flag_orphan_pages' },
			],
		},
		{
			key: 'thin_content_word_threshold',
			type: 'number',
			classes: 'space-between border-top',
			label: __('Thin content threshold (words)', 'vulopilot'),
			settingDescription: __(
				'Pages below this word count are flagged as thin content.',
				'vulopilot'
			),
		},
		{
			key: 'seo-section-images',
			type: 'section',
			title: __('Images', 'vulopilot'),
			desc: __(
				'Controls the "Images" findings group on the SEO page.',
				'vulopilot'
			),
		},
		{
			key: 'flag_missing_featured_image',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between',
			label: __('Flag missing featured images', 'vulopilot'),
			settingDescription: __(
				'Published pages, posts, or products with no featured image set.',
				'vulopilot'
			),
			options: [
				{
					key: 'flag_missing_featured_image',
					label: '',
					value: 'flag_missing_featured_image',
				},
			],
		},
		{
			key: 'flag_missing_alt_text',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between border-top',
			label: __('Flag missing alt text', 'vulopilot'),
			settingDescription: __('Content images with no alt attribute.', 'vulopilot'),
			options: [
				{ key: 'flag_missing_alt_text', label: '', value: 'flag_missing_alt_text' },
			],
		},
		{
			key: 'seo-section-links-schema',
			type: 'section',
			title: __('Links & schema', 'vulopilot'),
			desc: __(
				'Controls the "Links & Indexability" and "Schema" findings groups.',
				'vulopilot'
			),
		},
		{
			key: 'flag_broken_links',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between',
			label: __('Flag broken internal links', 'vulopilot'),
			settingDescription: __(
				'Internal links pointing to a 404 or removed page.',
				'vulopilot'
			),
			options: [
				{ key: 'flag_broken_links', label: '', value: 'flag_broken_links' },
			],
		},
		{
			key: 'broken_link_check_frequency',
			type: 'select',
			classes: 'space-between border-top',
			label: __('Broken link check frequency', 'vulopilot'),
			settingDescription: __(
				'How often this specific check re-runs, independent of the overall scan frequency in the General tab.',
				'vulopilot'
			),
			options: [
				{ label: __('Daily', 'vulopilot'), value: 'daily' },
				{ label: __('Weekly', 'vulopilot'), value: 'weekly' },
			],
			dependent: { key: 'flag_broken_links', value: 'flag_broken_links', set: true },
		},
		{
			key: 'flag_missing_schema',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between border-top',
			label: __('Flag missing structured data', 'vulopilot'),
			settingDescription: __(
				'Content types (FAQ, Review, HowTo, etc.) without valid schema markup.',
				'vulopilot'
			),
			options: [
				{ key: 'flag_missing_schema', label: '', value: 'flag_missing_schema' },
			],
		},
		{
			key: 'canonical_url_enabled',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between border-top',
			label: __('Add canonical URL tags', 'vulopilot'),
			settingDescription: __(
				'WordPress already adds these by default — only turn this on if the "Canonical URLs" finding shows them missing (usually a theme or caching plugin stripping them).',
				'vulopilot'
			),
			options: [
				{
					key: 'canonical_url_enabled',
					label: '',
					value: 'canonical_url_enabled',
				},
			],
		},
		{
			key: 'social_meta_tags_enabled',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between border-top',
			label: __('Add Open Graph & Twitter Card tags', 'vulopilot'),
			settingDescription: __(
				'Adds preview tags (title, description, image) for Facebook, LinkedIn, and X/Twitter. Turn on only if the "Open Graph"/"Twitter Cards" findings show them missing.',
				'vulopilot'
			),
			options: [
				{
					key: 'social_meta_tags_enabled',
					label: '',
					value: 'social_meta_tags_enabled',
				},
			],
		},
		{
			key: 'seo-section-robots',
			type: 'section',
			title: __('Robots.txt', 'vulopilot'),
		},
		{
			key: 'robots_auto_generate',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between',
			label: __('Auto-generate robots.txt', 'vulopilot'),
			settingDescription: __(
				'Adds a sitemap reference to your robots.txt. Turn off if you maintain a custom robots.txt file yourself.',
				'vulopilot'
			),
			options: [
				{ key: 'robots_auto_generate', label: '', value: 'robots_auto_generate' },
			],
		},
		{
			key: 'flag_ai_crawler_blocked_pages',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between border-top',
			label: __('Flag pages blocked for specific AI crawlers', 'vulopilot'),
			settingDescription: __(
				'Published pages/posts that robots.txt disallows for one named AI bot (GPTBot, ClaudeBot, etc.), separate from the sitewide check above.',
				'vulopilot'
			),
			options: [
				{
					key: 'flag_ai_crawler_blocked_pages',
					label: '',
					value: 'flag_ai_crawler_blocked_pages',
				},
			],
			moduleEnabled: 'ai-crawler-analytics',
		},
		{
			key: 'seo-section-redirects',
			type: 'section',
			title: __('Redirects & 404s', 'vulopilot'),
		},
		{
			key: 'enable_redirect_manager',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between',
			label: __('Enable redirect manager', 'vulopilot'),
			settingDescription: __(
				'Create and manage 301 redirects from the Redirects page.',
				'vulopilot'
			),
			options: [
				{
					key: 'enable_redirect_manager',
					label: '',
					value: 'enable_redirect_manager',
				},
			],
		},
		{
			key: 'auto_redirect_on_slug_change',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between border-top',
			label: __('Auto-create redirect on slug change', 'vulopilot'),
			settingDescription: __(
				'When a published page or post URL changes, redirect the old URL automatically.',
				'vulopilot'
			),
			options: [
				{
					key: 'auto_redirect_on_slug_change',
					label: '',
					value: 'auto_redirect_on_slug_change',
				},
			],
			dependent: {
				key: 'enable_redirect_manager',
				value: 'enable_redirect_manager',
				set: true,
			},
		},
		{
			key: 'log_404s',
			type: 'checkbox',
			look: 'toggle',
			classes: 'space-between border-top',
			label: __('Log 404s', 'vulopilot'),
			settingDescription: __(
				'Track visits to missing pages so you can turn them into redirect suggestions.',
				'vulopilot'
			),
			options: [{ key: 'log_404s', label: '', value: 'log_404s' }],
		},
		{
			key: 'content-section',
			type: 'section',
			title: __('Content Intelligence', 'vulopilot'),
		},
		{
			key: 'content-section-readability',
			type: 'section',
			title: __('Readability', 'vulopilot'),
			desc: __(
				'Controls the Content and AI Content pages\' readability findings — a standard Flesch Reading Ease score (0-100, higher is easier to read).',
				'vulopilot'
			),
		},
		{
			key: 'content_readability_min_score',
			type: 'number',
			classes: 'space-between',
			label: __('Minimum readability score', 'vulopilot'),
			settingDescription: __(
				'Posts scoring below this on the Flesch Reading Ease scale are flagged. 50 is that scale\'s own "Fairly Difficult" boundary.',
				'vulopilot'
			),
		},
		{
			key: 'sitemap-section',
			type: 'section',
			title: __('Sitemap', 'vulopilot'),
		},
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
			classes: 'space-between border-top',
			label: __('Generate XML sitemap', 'vulopilot'),
			settingDescription: __(
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
			classes: 'space-between border-top',
			label: __('Ping search engines on update', 'vulopilot'),
			settingDescription: __(
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
			classes: 'space-between border-top',
			label: __('Links per sitemap', 'vulopilot'),
			settingDescription: __('Max number of links on each sitemap page.', 'vulopilot'),
			dependent: { key: 'sitemap_enabled', value: 'sitemap_enabled', set: true },
		},
		{
			key: 'sitemap_exclude_posts',
			type: 'text',
			classes: 'space-between border-top',
			label: __('Exclude posts', 'vulopilot'),
			settingDescription: __(
				'Post IDs to exclude from the sitemap, separated by commas. Applies across all included post types.',
				'vulopilot'
			),
			dependent: { key: 'sitemap_enabled', value: 'sitemap_enabled', set: true },
		},
		{
			key: 'sitemap_exclude_terms',
			type: 'text',
			classes: 'space-between border-top',
			label: __('Exclude terms', 'vulopilot'),
			settingDescription: __(
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
			classes: 'space-between',
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
			classes: 'space-between border-top',
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
			type: 'choice-toggle',
			classes: 'space-between',
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
			type: 'choice-toggle',
			classes: 'space-between border-top',
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
			type: 'choice-toggle',
			classes: 'space-between border-top',
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
			type: 'choice-toggle',
			classes: 'space-between border-top',
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
			classes: 'space-between',
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
			classes: 'border-top',
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
			classes: 'space-between border-top',
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
			classes: 'space-between border-top',
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
			classes: 'space-between border-top',
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
			classes: 'space-between border-top',
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
		{
			key: 'webmaster-section',
			type: 'section',
			title: __('Webmaster Tools', 'vulopilot'),
		},
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
			classes: 'space-between',
			label: __('Google Search Console', 'vulopilot'),
			settingDescription: __(
				'Enter your Google Search Console verification ID. Rendered as <meta name="google-site-verification" content="...">.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster_bing_verification',
			type: 'text',
			classes: 'space-between border-top',
			label: __('Bing Webmaster Tools', 'vulopilot'),
			settingDescription: __(
				'Enter your Bing Webmaster Tools verification ID. Rendered as <meta name="msvalidate.01" content="...">.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster_baidu_verification',
			type: 'text',
			classes: 'space-between border-top',
			label: __('Baidu Webmaster Tools', 'vulopilot'),
			settingDescription: __(
				'Enter your Baidu Webmaster Tools verification ID. Rendered as <meta name="baidu-site-verification" content="...">.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster_yandex_verification',
			type: 'text',
			classes: 'space-between border-top',
			label: __('Yandex Verification ID', 'vulopilot'),
			settingDescription: __(
				'Enter your Yandex.Webmaster verification ID. Rendered as <meta name="yandex-verification" content="...">.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster_pinterest_verification',
			type: 'text',
			classes: 'space-between border-top',
			label: __('Pinterest Verification ID', 'vulopilot'),
			settingDescription: __(
				'Enter your Pinterest account verification ID. Rendered as <meta property="p:domain_verify" content="...">.',
				'vulopilot'
			),
		},
		{
			key: 'webmaster_norton_verification',
			type: 'text',
			classes: 'space-between border-top',
			label: __('Norton Safe Web Verification ID', 'vulopilot'),
			settingDescription: __(
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
			settingDescription: __(
				'Enter your own custom webmaster tags. Only <meta> tags are allowed — anything else is stripped out before being added to the page.',
				'vulopilot'
			),
		},
	],
};
