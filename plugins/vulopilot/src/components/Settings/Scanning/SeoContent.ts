import { __ } from '@wordpress/i18n';

/**
 * Settings → Scanning → SEO & Content — first tab under Scanning (see
 * `priority: 0` below) per direct instruction, now that the sibling
 * "Content & Search" tab (id `content-search`, ContentSearch.ts) has been
 * removed entirely, also per direct instruction. That tab used to hold a
 * `content_search_scans` nested-setting panel (5 scan-category rows:
 * seo/images/links/schema/readability); over several direct instructions
 * every one of its real per-check settings (`flag_missing_meta_description`/
 * `flag_duplicate_titles`, `flag_missing_alt_text`/`flag_broken_images`,
 * `flag_broken_links`, `content_readability_min_score`) was moved out into
 * this tab as flat standalone keys, leaving only each row's own bare
 * `enable` master switch behind — with no settings left of its own to
 * show, that tab (and its "Restore Defaults" header,
 * ContentSearchScansHeader.tsx, also deleted) was removed outright rather
 * than kept around empty.
 *
 * `content_search_scans.{seo,images,links,schema,readability}.enable`
 * (Utill::VULOPILOT_SETTINGS_DEFAULTS) are themselves still real and still
 * read by their own PHP scanners — SeoScanner/HeadingStructureScanner,
 * LargeImagesScanner, RedirectAnalysisScanner/NotFoundScanner,
 * SchemaScanner/StructuredDataValidationScanner, ReadabilityScanner's own
 * on/off switch respectively — just with no admin UI left to toggle them
 * (they stay at their own `true` default). `broken_link_check_frequency`/
 * `broken_image_check_frequency` are the same story, flat settings with
 * no UI of their own, read directly by BrokenLinksScanner/
 * BrokenImagesScanner as a rate-limit, not an on/off switch.
 *
 * Granular, per-check toggles replacing the old whole-category
 * `enable_seo_scanning` switch — same "no blanket kill switch, only
 * granular ones" posture Scanning → GEO already uses. Each checkbox's
 * option key/value is the field's own settings key (not a shared
 * 'enabled' literal), matching every other settings tab in this plugin.
 *
 * Real backing per card:
 * - Titles & meta / Images: `flag_orphan_pages`/`thin_content_word_threshold`
 *   gate ThinContentScanner/OrphanPageScanner; `flag_missing_meta_description`
 *   gates MetaDescriptionScanner, `flag_duplicate_titles` gates
 *   DuplicateContentScanner; `flag_missing_alt_text` gates ImagesScanner,
 *   `flag_broken_images` gates BrokenImagesScanner; `flag_missing_featured_image`
 *   gates SeoImagesScanner.
 * - Links & schema: `flag_broken_links` gates BrokenLinksScanner.
 * - Readability: `content_readability_min_score` gates ReadabilityScanner's
 *   own threshold (that scanner's separate on/off switch,
 *   `content_search_scans.readability.enable`, has no admin UI of its own
 *   any more — see this file's own top docblock).
 * - Robots.txt: a real toggle over WordPress core's own virtual
 *   robots.txt (via Services\RobotsTxtManager) — not a from-scratch
 *   generator, plus `flag_ai_crawler_blocked_pages`
 *   (Scanners\Basic\AiCrawlerBlockedPagesScanner,
 *   AI-CRAWLER-ANALYTICS-MODULE.md).
 *
 * "XML Sitemap"/"Post types & taxonomies in sitemap"/"HTML Sitemap" (all
 * real `sitemap_*`/`html_sitemap_*` keys) moved out entirely, into their
 * own new sub-tab, Settings → Get Started → Sitemap (`GetStarted/Sitemap.ts`)
 * — same real backend, only where the UI for it lives moved.
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
 * "Tag Manager" (`tag_manager_enabled`/`tag_manager_container_id`, real
 * Services\TagManagerService `<script>`/`<noscript><iframe>` output — used
 * to be this tab's own last section) moved out to Settings → Connections
 * (TagManagerPanel.tsx), rendered above "Webmaster Tools" there, per direct
 * instruction — same real keys, nothing server-side changed.
 *
 * "Webmaster Tools"/"Custom Webmaster Tags" (all 6 `webmaster_*_verification`
 * codes + `webmaster_custom_tags`, all still real
 * Services\WebmasterToolsManager-backed `<meta>` output) moved out of this
 * tab entirely, merged into Settings → Connections → Site Verification
 * (SiteVerificationPanel.tsx) per direct instruction — that panel already
 * owned Google/Bing/Pinterest with a real "Verify" self-check; Baidu/
 * Yandex/Norton/Custom Tags now live there too as plain fields (no fake
 * Verify button — this plugin has no real self-check for those), so
 * there's one editor for all 6 instead of two.
 */
export default {
	id: 'seo-content',
	// First tab under Scanning per direct instruction, now that Content &
	// Search (previously priority 0) was removed entirely and this tab
	// absorbed its real settings.
	priority: 0,
	headerTitle: __('SEO & Content', 'vulopilot'),
	settingTitle: __('Titles & meta', 'vulopilot'),
	headerDescription: __(
		'Controls what shows up in the SEO page\'s "Titles & Meta" and "Content Structure" findings.',
		'vulopilot'
	),
	hideSettingHeader: true,
	groupBySections: true,
	headerIcon: 'search',
	submitUrl: 'settings',
	modal: [
		{
			key: 'general_settings',
			type: 'section',
			icon: 'setting',
			title: __('Titles & meta', 'vulopilot'),
			desc:  __(
		'Controls what shows up in the SEO page\'s "Titles & Meta" and "Content Structure" findings.',
		'vulopilot'
	),
		},
		{
			key: 'flag_orphan_pages',
			type: 'checkbox',
			look: 'toggle',
			
			label: __('Flag orphan pages', 'vulopilot'),
			settingDescription: __('Pages with no internal links pointing to them.', 'vulopilot'),
			options: [
				{ key: 'flag_orphan_pages', label: '', value: 'flag_orphan_pages' },
			],
		},
		{
			key: 'thin_content_word_threshold',
			type: 'number',
			size: 15,
			label: __('Thin content threshold (words)', 'vulopilot'),
			settingDescription: __(
				'Pages below this word count are flagged as thin content.',
				'vulopilot'
			),
		},
		{
			key: 'flag_missing_meta_description',
			type: 'checkbox',
			look: 'toggle',

			label: __('Flag missing meta descriptions', 'vulopilot'),
			settingDescription: __('Pages and posts with no meta description set.', 'vulopilot'),
			options: [
				{ key: 'flag_missing_meta_description', label: '', value: 'flag_missing_meta_description' },
			],
		},
		{
			key: 'flag_duplicate_titles',
			type: 'checkbox',
			look: 'toggle',

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
			key: 'seo-section-images',
			type: 'section',
			icon: 'image',
			title: __('Images', 'vulopilot'),
			desc: __(
				'Controls the "Images" findings group on the SEO page.',
				'vulopilot'
			),
		},
		{
			key: 'flag_missing_alt_text',
			type: 'checkbox',
			look: 'toggle',

			label: __('Flag missing alt text', 'vulopilot'),
			settingDescription: __('Content images with no alt attribute.', 'vulopilot'),
			options: [
				{ key: 'flag_missing_alt_text', label: '', value: 'flag_missing_alt_text' },
			],
		},
		{
			key: 'flag_broken_images',
			type: 'checkbox',
			look: 'toggle',

			label: __('Flag broken images', 'vulopilot'),
			settingDescription: __(
				'Image tags pointing to a source URL that returns a broken (non-2xx/3xx) response.',
				'vulopilot'
			),
			options: [
				{ key: 'flag_broken_images', label: '', value: 'flag_broken_images' },
			],
		},
		{
			key: 'flag_missing_featured_image',
			type: 'checkbox',
			look: 'toggle',

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
			key: 'seo-section-links-schema',
			type: 'section',
			icon: 'link',
			title: __('Links & schema', 'vulopilot'),
			desc: __(
				'Controls the "Links & Indexability" findings group.',
				'vulopilot'
			),
		},
		{
			key: 'flag_broken_links',
			type: 'checkbox',
			look: 'toggle',

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
			key: 'canonical_url_enabled',
			type: 'checkbox',
			look: 'toggle',
			
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
			icon: 'search-discovery',
			title: __('Robots.txt', 'vulopilot'),
		},
		{
			key: 'robots_auto_generate',
			type: 'checkbox',
			look: 'toggle',
			
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
			icon: 'external',
			title: __('Redirects', 'vulopilot'),
		},
		{
			key: 'enable_redirect_manager',
			type: 'checkbox',
			look: 'toggle',
			
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
			
			label: __('Log 404s', 'vulopilot'),
			settingDescription: __(
				'Track visits to missing pages so you can turn them into redirect suggestions.',
				'vulopilot'
			),
			options: [{ key: 'log_404s', label: '', value: 'log_404s' }],
		},
		// {
		// 	key: 'content-section',
		// 	type: 'section',
		// 	title: __('Content Intelligence', 'vulopilot'),
		// },
		{
			key: 'seo-section-readability',
			type: 'section',
			icon: 'text',
			title: __('Readability', 'vulopilot'),
			desc: __(
				"Analyze content readability to ensure it's easy for your visitors to read and understand.",
				'vulopilot'
			),
		},
		{
			key: 'content_readability_min_score',
			type: 'number',
			size: 5,
			label: __('Minimum readability score', 'vulopilot'),
			settingDescription: __(
				'Posts scoring below this on the Flesch Reading Ease scale (0-100, higher is easier to read) are flagged. 50 is that scale\'s own "Fairly Difficult" boundary.',
				'vulopilot'
			),
		},
	],
};
