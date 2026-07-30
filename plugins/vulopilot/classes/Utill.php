<?php
/**
 * Utill class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot Utill class.
 *
 * Central registry of custom table names and installation-tracking option
 * keys, mirroring VuloLabs\Utill's role for the vulolabs family.
 *
 * @class       Utill class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Utill {

    /**
     * Custom $wpdb table names, keyed by short entity id.
     *
     * @var array
     */
    const TABLES = array(
        'scan'                   => 'vulopilot_scans',
        'scan_finding'           => 'vulopilot_scan_findings',
        'rule'                   => 'vulopilot_rules',
        'automation'             => 'vulopilot_automations',
        'automation_run'         => 'vulopilot_automation_runs',
        'ai_job'                 => 'vulopilot_ai_jobs',
        'ai_history'             => 'vulopilot_ai_history',
        'ai_provider_config'     => 'vulopilot_ai_provider_configs',
        'report'                 => 'vulopilot_reports',
        'scheduled_job'          => 'vulopilot_scheduled_jobs',
        'activity_log'           => 'vulopilot_activity_logs',
        'site_health_snapshot'   => 'vulopilot_site_health_snapshots',
        'ai_action_run'          => 'vulopilot_ai_action_runs',
        'crawler_visit'          => 'vulopilot_crawler_visits',
        'redirect'               => 'vulopilot_redirects',
        'not_found_log'          => 'vulopilot_not_found_logs',
        'indexnow_log'           => 'vulopilot_indexnow_log',
        'geo_visibility_history' => 'vulopilot_geo_visibility_history',
        'brand_score_history'    => 'vulopilot_brand_score_history',
        'entity_relationship'    => 'vulopilot_entity_relationships',
        'kg_health_history'      => 'vulopilot_kg_health_history',
        'file_baseline'          => 'vulopilot_file_baselines',
        'accessibility_snapshot' => 'vulopilot_accessibility_snapshots',
        'store_trends_snapshot'  => 'vulopilot_store_trends_snapshots',
    );

    /**
     * Option keys used by the bootstrap/Install flow.
     *
     * @var array
     */
    const VULOPILOT_OTHER_SETTINGS = array(
        'run_installer'     => 'vulopilot_run_installer',
        'plugin_db_version' => 'vulopilot_version',
    );

    /**
     * Option name for VuloPilot's plain settings — deliberately a single
     * wp_options row (an array), not a custom table, per
     * backward-compatibility.md: "New settings should be added through
     * the existing ... registered-settings-keys mechanism ... rather than
     * a new bespoke get_option() call." VULOPILOT_SETTINGS_DEFAULTS is
     * that registry: every known setting key and its default, so a
     * missing/never-saved key still has a sane value instead of null.
     *
     * @var string
     */
    const VULOPILOT_SETTINGS_KEY = 'vulopilot_settings';

    /**
     * @var array
     */
    const VULOPILOT_SETTINGS_DEFAULTS = array(
        // General.
        'scan_frequency'                        => 'daily',
        // Notifications.
        'notification_email'                    => '',
        'notify_on_critical_findings'           => array(),
        // Read by GeoAnalysis\GeoAnalyzer::analyze() — compares the fresh
        // overall_score against the previously-stored one and emails when
        // it falls by at least Scanning → GEO's `geo_drop_threshold`.
        'email_on_geo_score_drop'               => array(),
        // Read by vulopilot-pro's BrandIntelligence\BrandMonitor — same
        // shape as 'email_on_geo_score_drop' above, scoped to Brand Score
        // instead.
        'email_on_brand_score_drop'             => array(),
        // Read by vulopilot-pro's AiCrawlerAnalytics\CrawlerAlertMonitor —
        // same shape as 'email_on_geo_score_drop' above, scoped to AI
        // crawler volume drops/still-blocked-page hits instead.
        'email_on_crawler_alerts'               => array(),
        'email_from_name'                       => '',
        'email_from_address'                    => '',
        // Automation — replaces AutomationEngine's previously-hardcoded
        // COOLDOWN_MINUTES constant (ARCHITECTURE.md's Prompt 12 pass
        // shipped a fixed 60-minute rate limit as a pragmatic v1; this
        // makes it a real, per-site setting instead).
        'automation_cooldown_minutes'           => 60,
        // Read by vulopilot-pro's Automation\AutomationEngine — 0 (the
        // default) means retries are off; an automation run with at least
        // one failed action simply stays 'failed', same as before this
        // setting existed.
        'automation_max_retries'                => 0,
        'automation_retry_delay_minutes'        => 5,
        // SECURITY-MODULE.md's "Scheduled Security Monitoring"/"Alerts"/
        // "Integrity Monitoring" — same "setting lives here, only
        // meaningfully acted on by vulopilot-pro's SecurityMonitoring
        // module" split as scan_frequency/automation_* above.
        'security_scan_frequency'               => 'daily',
        'security_alerts_enabled'               => array(),
        'security_alert_email'                  => '',
        'security_alert_min_severity'           => 'high',
        'enable_integrity_monitoring'           => array( 'enable_integrity_monitoring' ),
        'integrity_monitoring_max_files'        => 2000,
        // ACCESSIBILITY-MODULE.md's "WCAG Scanner" — same granular
        // per-scanner toggle shape as the SECURITY-MODULE.md scanners
        // above, default on (a WCAG link-text check makes no outbound
        // request, so there's no WAF-flagging reason to ship it off).
        'enable_wcag_scanner'                   => array( 'enable_wcag_scanner' ),
        // ACCESSIBILITY-MODULE.md's "Scheduled Audits" — same "setting
        // lives here, only meaningfully acted on by vulopilot-pro's
        // AccessibilityAudits module" split as security_scan_frequency above.
        'accessibility_audit_frequency'         => 'daily',
        // WOOCOMMERCE-INTELLIGENCE-MODULE.md's "Inventory Intelligence" —
        // same "setting lives here, only meaningfully acted on by
        // vulopilot-pro's WooCommerceIntelligence module" split as
        // integrity_monitoring_max_files above. Read by
        // InventoryIntelligenceScanner as the "projected to run out within
        // this many days" threshold.
        'inventory_stockout_threshold_days'     => 7,
        // MCP-SERVER-MODULE.md's MCP Server — same "setting lives here,
        // only meaningfully acted on by vulopilot-pro's McpServer module"
        // split as the settings above. Off by default: this gates an
        // endpoint external AI clients can reach with a valid WordPress
        // Application Password, so it's an explicit opt-in rather than
        // silently available the moment Pro's module is toggled on.
        'enable_mcp_server'                     => array(),
        // Reports.
        'default_report_format'                 => 'pdf',
        'default_report_period_days'            => 30,
        // Security. Checkbox-type defaults are zyra's own wire shape (an
        // array containing the field's own key when on, or an empty array
        // when off — matches every checkbox option's own `key`/`value` in
        // the *.ts settings configs) rather than a PHP boolean — every PHP
        // consumer already reads these with empty()/!empty(), which is
        // true for a non-empty array and false for an empty one, so this
        // shape works everywhere a boolean did.
        'enable_rest_api_scanner'               => array( 'enable_rest_api_scanner' ),
        'enable_xmlrpc_scanner'                 => array( 'enable_xmlrpc_scanner' ),
        'enable_security_headers_scanner'       => array( 'enable_security_headers_scanner' ),
        'enable_exposed_files_scanner'          => array( 'enable_exposed_files_scanner' ),
        // SECURITY-MODULE.md's Free scanners — same granular per-scanner
        // toggle shape as the four above, default on (unlike those four,
        // none of these three make an anonymous request a WAF is likely to
        // flag, so there's no reason to ship them off-by-default).
        'enable_weak_password_scanner'          => array( 'enable_weak_password_scanner' ),
        'enable_basic_vulnerabilities_scanner'  => array( 'enable_basic_vulnerabilities_scanner' ),
        'enable_core_file_integrity_scanner'    => array( 'enable_core_file_integrity_scanner' ),
        // Scanner-category kill switches — each gates every scanner
        // registered under that category string (SCANNERS.md), not just
        // one check, since that's what these settings-page groupings
        // actually correspond to (e.g. disabling "WooCommerce" turns off
        // both the original WooCommerceScanner and the 11 Product*
        // scanners from the WooCommerce AI pass — all category `woocommerce`).
        // SEO no longer has one of these — see the granular
        // flag_*/Scanning/Seo.ts entries below, same "no whole-category
        // switch, only granular ones" posture GEO already uses.
        'enable_accessibility_scanning'         => array( 'enable_accessibility_scanning' ),
        'enable_woocommerce_scanning'           => array( 'enable_woocommerce_scanning' ),
        // Scanning > SEO — granular, per-check toggles (readme's SEO
        // Optimization pillar), replacing the old whole-category
        // enable_seo_scanning switch. Each is read directly by the one
        // scanner it corresponds to; there's no "seo" category kill
        // switch to fall back on above, same posture GEO's scanners
        // already use.
        'flag_missing_meta_description'         => array( 'flag_missing_meta_description' ),
        'flag_duplicate_titles'                 => array( 'flag_duplicate_titles' ),
        'flag_orphan_pages'                     => array( 'flag_orphan_pages' ),
        // Read by Scanners\Basic\ThinContentScanner as its minimum word
        // count instead of a hardcoded constant.
        'thin_content_word_threshold'           => 300,
        'flag_missing_featured_image'           => array( 'flag_missing_featured_image' ),
        'flag_missing_alt_text'                 => array( 'flag_missing_alt_text' ),
        'flag_broken_links'                     => array( 'flag_broken_links' ),
        // Read by Scanners\Basic\BrokenLinksScanner to self-rate-limit —
        // 'daily'/'weekly', since this codebase's scan scheduling is one
        // global cadence (`scan_frequency` above), not a per-scanner cron;
        // this setting doesn't change *when* the shared scan runs, only
        // whether this specific scanner's own check actually re-runs that
        // time or skips (based on when it last genuinely ran).
        'broken_link_check_frequency'           => 'daily',
        // Covers both SchemaScanner (presence) and
        // StructuredDataValidationScanner (validity) — the mockup this
        // was built from has one "Flag missing structured data" toggle
        // for both, not two.
        'flag_missing_schema'                   => array( 'flag_missing_schema' ),
        // Scanning > Sitemap — moved out of the SEO tab into its own
        // dedicated Settings sub-tab (Scanning/Sitemap.ts), matching the
        // mockup's own tab boundary. Read by Services\SitemapManager — real
        // toggles/filters over WordPress core's own native `/wp-sitemap.xml`
        // (`wp_sitemaps_enabled`, `wp_sitemaps_max_urls`,
        // `wp_sitemaps_post_types`, `wp_sitemaps_taxonomies`,
        // `wp_sitemaps_posts_query_args`, `wp_sitemaps_taxonomies_query_args`),
        // not a from-scratch sitemap generator; see that class's own docblock.
        'sitemap_enabled'                       => array( 'sitemap_enabled' ),
        'sitemap_ping_search_engines'           => array( 'sitemap_ping_search_engines' ),
        // Max URLs per sitemap page — core's own default is 2000; this
        // overrides `wp_sitemaps_max_urls` when set.
        'sitemap_links_per_page'                => 200,
        // Neither of these has a real backing implementation — WordPress
        // core's native XML sitemaps (unlike Yoast/RankMath's own
        // from-scratch generators) have no `<image:image>` sitemap
        // extension support at all, and SitemapManager.php's own docblock
        // deliberately rejects building a second, competing sitemap
        // implementation just to add one. Persisted only, same honest
        // "round-trips through Settings but nothing reads it yet" posture
        // Seo.ts's own Redirects & 404s section documents for the same
        // reason (a real from-scratch generator is a separate, larger
        // feature this codebase hasn't taken on).
        'sitemap_include_images'                => array(),
        'sitemap_include_featured_images'       => array(),
        // Comma-separated post/term IDs — read by Services\SitemapManager
        // and applied via `wp_sitemaps_posts_query_args`/
        // `wp_sitemaps_taxonomies_query_args` (`post__not_in`/`exclude`).
        'sitemap_exclude_posts'                 => '',
        'sitemap_exclude_terms'                 => '',
        // Which real post types/taxonomies are included in the XML sitemap
        // (`wp_sitemaps_post_types`/`wp_sitemaps_taxonomies`) vs the HTML
        // sitemap (Services\HtmlSitemapRenderer's `[vulopilot_html_sitemap]`
        // shortcode). Real WP post_type/taxonomy slugs, not the mockup's
        // fictional "knowledgebase"/"megamenu" entries (this codebase
        // registers no custom post types of its own — confirmed via grep).
        // `product`/`product_cat`/`product_tag` are only ever effective
        // when WooCommerce is active (`post_type_exists( 'product' )`),
        // same conditional-effectiveness pattern
        // GeoAnalysis\LlmsTxtGenerator::generate() already uses for its own
        // `products` entry — harmless to list here unconditionally since
        // the PHP consumer is what actually gates on WooCommerce, not this
        // default.
        'sitemap_xml_post_types'                => array( 'post', 'page', 'attachment', 'product' ),
        'sitemap_html_post_types'               => array( 'post', 'page', 'product' ),
        'sitemap_xml_taxonomies'                => array( 'category', 'post_tag', 'product_cat', 'product_tag' ),
        'sitemap_html_taxonomies'               => array( 'category', 'product_cat' ),
        // Read by Services\HtmlSitemapRenderer — a real, human-readable
        // `[vulopilot_html_sitemap]` shortcode (mockup's own "Shortcode"
        // settings row), not a dedicated page/template.
        'html_sitemap_enabled'                  => array( 'html_sitemap_enabled' ),
        'html_sitemap_display_format'           => 'list',
        'html_sitemap_sort_by'                  => 'published_date',
        'html_sitemap_show_dates'               => array( 'html_sitemap_show_dates' ),
        // 'post_title' or 'seo_title' — the latter reads
        // Services\PostSeoMetaFields::META_KEYS['social_title'] per post/term
        // when set (the closest real "SEO title" field this codebase has;
        // there is no separate meta box "SEO title" distinct from the
        // social/OG title), falling back to the normal title when empty.
        'html_sitemap_item_titles'              => 'post_title',
        // Scanning > Webmaster Tools. Read by Services\WebmasterToolsManager —
        // outputs each configured verification `<meta>` tag on `wp_head`,
        // same self-registers-own-hook/setting-gates-output shape as
        // CanonicalUrlManager/SocialMetaTagsManager. Empty string = that
        // provider's tag isn't output at all.
        'webmaster_google_verification'         => '',
        'webmaster_bing_verification'           => '',
        'webmaster_baidu_verification'          => '',
        'webmaster_yandex_verification'         => '',
        'webmaster_pinterest_verification'      => '',
        'webmaster_norton_verification'         => '',
        // Free-form custom `<meta>` tags — WebmasterToolsManager sanitizes
        // this with an allowlist limited to `<meta ...>` tags only (mockup's
        // own "Only <meta> tags are allowed" copy) before echoing it.
        'webmaster_custom_tags'                 => '',
        // Scanning > Instant Indexing (IndexNow). Read by
        // Services\IndexNowClient/IndexNowAutoSubmitter/IndexNowKeyFileServer.
        // Empty `indexnow_post_types` means auto-submit-on-publish is off;
        // manual submission from the Instant Indexing tab's textarea always
        // works regardless of this setting.
        'indexnow_post_types'                   => array( 'post', 'page', 'product' ),
        // Generated lazily (Controllers\Settings::get_stored_settings(),
        // same "can't call a method inside a class const array" reasoning
        // llms_txt_content's own comment gives) rather than defaulted here —
        // an empty string means it hasn't been generated yet.
        'indexnow_api_key'                      => '',
        // Read by Services\RobotsTxtManager — appends a `Sitemap:` line to
        // WordPress core's own virtual robots.txt via the `robots_txt`
        // filter; see that class's own docblock for why this isn't a
        // from-scratch robots.txt file generator.
        'robots_auto_generate'                  => array( 'robots_auto_generate' ),
        // Read by Scanners\Basic\AiCrawlerBlockedPagesScanner
        // (AI-CRAWLER-ANALYTICS-MODULE.md) — flags real published pages
        // robots.txt disallows for one specific known AI bot.
        'flag_ai_crawler_blocked_pages'         => array( 'flag_ai_crawler_blocked_pages' ),
        // Read by Services\CanonicalUrlManager — WordPress core already
        // outputs a canonical tag by default (rel_canonical() on wp_head),
        // so this defaults OFF; it exists as a safety net a site owner (or
        // vulopilot-pro's OneClickFix "Fix" action) can turn on when a
        // theme/caching plugin is found to be stripping it, per
        // Scanners\Basic\CanonicalUrlScanner's own finding.
        'canonical_url_enabled'                 => array(),
        // Read by Services\SocialMetaTagsManager — outputs Open Graph +
        // Twitter Card meta tags. Defaults OFF since many sites already
        // have another plugin/theme outputting these; exists so
        // vulopilot-pro's OneClickFix "Fix" action has something real to
        // turn on for Scanners\Basic\OpenGraphScanner/TwitterCardScanner's
        // findings.
        'social_meta_tags_enabled'              => array(),
        // Read by Services\RedirectManager (the first two) and
        // Services\NotFoundLogger (the third) — a real 301 redirect
        // manager (a user-managed old-path -> new-path table, applied at
        // request time via `vulopilot_redirects`) and a real 404-visit log
        // (distinct from Scanners\Basic\NotFoundScanner, which only checks
        // this site's OWN published permalinks for 404s, not visitor
        // traffic to missing URLs), backed by `vulopilot_not_found_logs`.
        'enable_redirect_manager'               => array( 'enable_redirect_manager' ),
        'auto_redirect_on_slug_change'          => array( 'auto_redirect_on_slug_change' ),
        'log_404s'                              => array( 'log_404s' ),
        // AI Visibility / GEO.
        'enable_llms_txt'                       => array( 'enable_llms_txt' ),
        // Empty means "not customized yet" — Controllers\Settings::get_stored_settings()
        // fills this with GeoAnalysis\LlmsTxtGenerator::generate()'s live
        // output for display until an admin edits and saves their own.
        'llms_txt_content'                      => '',
        // Read by modules/Geo/Module.php's save_post hook — regenerates
        // and re-writes llms.txt automatically on publish/update, only
        // while the Geo module (Modules page) is active.
        'llms_auto_regen'                       => array( 'llms_auto_regen' ),
        // Read by GeoAnalysis\LlmsTxtGenerator::generate() to decide which
        // sections to build at all.
        'llms_include_types'                    => array( 'pages', 'posts' ),
        // Read by Scanners\Basic\GeoSummaryBlockScanner — GEO scanning has
        // no whole-category kill switch (unlike SEO/Accessibility/
        // WooCommerce above), so this is that scanner's only on/off switch.
        'flag_missing_ai_summary'               => array( 'flag_missing_ai_summary' ),
        // Read by Scanners\Basic\GeoSummaryBlockScanner — how many words
        // from the top of a page/post its summary marker must appear
        // within.
        'answer_first_words'                    => 200,
        // Read by GeoAnalysis\GeoAnalyzer::calculate_evidence_density() —
        // stats/citations per 500 words a page needs to score well on
        // "Data Point & Evidence Density".
        'min_data_points'                       => 3,
        // Read by GeoAnalysis\GeoAnalyzer::calculate_content_freshness() —
        // the "flag as stale" boundary its tiering scales against.
        'stale_content_months'                  => 12,
        // Read by GeoAnalysis\GeoAnalyzer::analyze() — the minimum-points
        // drop in overall_score, since the last analysis, that triggers
        // Notifications' `email_on_geo_score_drop`.
        'geo_drop_threshold'                    => 5,
        // Read by vulopilot-pro's GeoInsights\CompetitorVisibilityAnalyzer —
        // newline-separated competitor URLs to fetch and compare structural
        // GEO-readiness signals against (schema/author/heading structure),
        // real HTTP requests with no AI cost. Persisted here (Free owns the
        // setting/interface) even though only Pro ever reads it — same
        // "setting round-trips through Settings regardless of which tier
        // reads it" posture every other Pro-gated setting in this file
        // already takes.
        'geo_competitor_urls'                   => '',
        // Scanning > Content Intelligence. Read by
        // Scanners\Basic\ReadabilityScanner — a post scoring below this on
        // the standard Flesch Reading Ease scale (0-100, higher = easier
        // to read) is flagged. 50 is the formula's own published "Fairly
        // Difficult" boundary, not an arbitrary VuloPilot-specific number.
        'content_readability_min_score'         => 50,
        // Scanning > Brand Intelligence. Read by
        // Scanners\Basic\AboutPageAnalysisScanner — the minimum real word
        // count an existing About-shaped page needs before it counts as
        // substantive rather than a placeholder, not a claim about ideal
        // About-page length.
        'brand_about_page_min_words'            => 80,
        // Read by vulopilot-pro's BrandIntelligence\BrandMonitor — the
        // minimum-points drop in Brand Score, since the last snapshot, that
        // triggers `email_on_brand_score_drop`. Same "setting round-trips
        // through Settings regardless of which tier reads it" posture as
        // 'geo_competitor_urls' above.
        'brand_drop_threshold'                  => 5,
        // AI Crawler Traffic Monitoring.
        'enable_crawler_tracking'               => array( 'enable_crawler_tracking' ),
        // Scanning > Crawler Analytics. Read by vulopilot-pro's
        // AiCrawlerAnalytics\CrawlerAlertMonitor — the minimum percentage
        // drop in daily AI crawler visit volume (vs. the trailing 7-day
        // average) that triggers `email_on_crawler_alerts`. Same
        // "setting round-trips through Settings regardless of which tier
        // reads it" posture as 'geo_competitor_urls' above.
        'crawler_volume_drop_threshold_percent' => 50,
        // Scanning > Entity Extraction (KNOWLEDGE-GRAPH-MODULE.md). Read by
        // Services\EntityExtractor. Newline-separated page URLs/ids — this
        // codebase has no existing Service concept to derive these from
        // automatically, so the site owner explicitly curates which real
        // published pages are "services."
        'entity_service_pages'                  => '',
        // Newline-separated `Name | Address` lines — same reasoning as
        // 'entity_service_pages' above, for Location entities (no
        // LocalBusiness address field is ever written anywhere in this
        // codebase to derive this from automatically).
        'entity_business_locations'             => '',
        // Read by vulopilot-pro's KnowledgeGraph\KnowledgeGraphHealthMonitor
        // — same "setting round-trips through Settings regardless of which
        // tier reads it" posture as 'geo_competitor_urls' above.
        'kg_health_drop_threshold'              => 5,
        'email_on_kg_health_drop'               => array(),
        // Advanced / Debug.
        'enable_debug_logging'                  => array(),
    );

    /**
     * Canonical widget ids for the Dashboard's drag-and-drop layout
     * (src/dashboard-widgets/registry.ts's DEFAULT_DASHBOARD_WIDGETS,
     * kept in sync with this list by convention — same id-matching
     * convention AI-ACTIONS.md already uses between Rule ids and Action
     * ids). `Controllers\DashboardLayout` validates against this list so
     * a saved layout can never contain an id the client made up; new
     * widgets (Free or, via `vulopilot_dashboard_widgets`, Pro) get added
     * here so an existing user's saved layout doesn't silently drop them.
     *
     * @var string[]
     */
    const DASHBOARD_WIDGET_IDS = array(
        'overall-health',
        'seo',
        'performance',
        'security',
        'woocommerce',
        'accessibility',
        'ai-usage',
        'geo',
        'recent-activity',
        'quick-fixes',
        'health-timeline',
        'latest-reports',
        'pending-approval',
        'automation-status',
        'crawler-traffic',
        'health-pillars',
        'recent-issues',
        'content',
        'brand',
        // Registered by vulopilot-pro's AiCrawlerAnalytics module via
        // `vulopilot_dashboard_widgets` (AI-CRAWLER-ANALYTICS-MODULE.md).
        'ai-monitoring',
        'knowledge-graph',
        // Registered by vulopilot-pro's KnowledgeGraph module via
        // `vulopilot_dashboard_widgets` (KNOWLEDGE-GRAPH-MODULE.md).
        'knowledge-graph-health',
        // Registered by vulopilot-pro's McpServer module via
        // `vulopilot_dashboard_widgets` (MCP-SERVER-MODULE.md).
        'mcp-server-status',
    );

    /**
     * User meta key the Dashboard's widget layout (order + enabled flags)
     * is stored under — per-user, like WordPress core's own
     * `meta-box-order_{screen}` dashboard widget layout, since a widget
     * arrangement is a personal UI preference, not site-wide config (so
     * it belongs in user meta, not VULOPILOT_SETTINGS_KEY's shared
     * wp_options row).
     *
     * @var string
     */
    const DASHBOARD_LAYOUT_META_KEY = 'vulopilot_dashboard_widget_layout';

    /**
     * Option name the active-modules list is stored under — mirrors
     * VuloLabs\Utill::ACTIVE_MODULES_DB_KEY's role for this product
     * line's own `modules/` addon system (module-architecture.md's
     * discovery/loading mechanism, added here for VuloPilot via
     * `Modules::load_active_modules()`).
     *
     * @var string
     */
    const ACTIVE_MODULES_DB_KEY = 'vulopilot_all_active_module_list';

    /**
     * Records an unexpected exception — Modules::load_active_modules()'s
     * catch-and-skip path calls this so one broken module's constructor
     * (Free's own, vulopilot-pro's, or a third party's) doesn't take the
     * whole site down. Writes to PHP's own error log only when the
     * Advanced tab's debug-logging setting is on — the same opt-in gate
     * Reports\ReportGenerator::maybe_log_debug() already uses, kept
     * consistent rather than introducing a second logging convention.
     *
     * @param \Throwable $exception The exception to record.
     * @return void
     */
    public function log( \Throwable $exception ): void {
        $settings = wp_parse_args( get_option( self::VULOPILOT_SETTINGS_KEY, array() ), self::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_debug_logging'] ) ) {
            return;
        }

        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- gated behind an explicit, opt-in admin setting (Advanced tab), matching Reports\ReportGenerator::maybe_log_debug()'s existing pattern.
        error_log( sprintf( '[VuloPilot] %s', $exception->getMessage() ) );
    }

    /**
     * Whether VuloPilot Pro is installed, active, and license-active —
     * mirrors VuloLabs\Utill::is_khali_dabba()'s role for this product
     * line. VuloPilotPro::check_pro_active() is the only thing that ever
     * hooks `kothay_dabba_vulopilot` (default false when Pro isn't
     * present), same filter-based "ask Pro, don't check for it directly"
     * pattern the vulolabs family uses.
     *
     * @return bool
     */
    public function is_khali_dabba(): bool {
        return (bool) apply_filters( 'kothay_dabba_vulopilot', false );
    }
}
