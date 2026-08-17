<?php
/**
 * Install class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot Install class.
 *
 * Creates VuloPilot's custom database tables on first install and runs
 * version-gated incremental migrations on upgrade, following the same
 * dbDelta()-based pattern as VuloLabs\Install. Schema design and the
 * rationale for every table/index below is documented in
 * vulolabs/plugins/vulopilot/DATABASE.md.
 *
 * @class       Install class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Install {

    /**
     * Class constructor — runs migration immediately.
     *
     * Unlike VuloLabs\Install (which defers to the 'init' hook because
     * it can be constructed as early as register_activation_hook), this is
     * only ever constructed from VuloPilot::init_classes() and
     * VuloPilot::activate(), both of which already run at/after 'init', so
     * running synchronously here is safe and avoids double-registering the
     * same callback on 'init'.
     */
    public function __construct() {
        $this->run_migration();
    }

    /**
     * Runs the database migration process.
     *
     * @return void
     */
    public function run_migration() {
        $previous_version = get_option( Utill::VULOPILOT_OTHER_SETTINGS['plugin_db_version'], false );

        if ( ! $previous_version ) {
            $this->create_database_tables();
        } else {
            $this->do_migration( $previous_version );
        }

        update_option( Utill::VULOPILOT_OTHER_SETTINGS['plugin_db_version'], VULOPILOT_PLUGIN_VERSION );
        do_action( 'vulopilot_after_installed' );
    }

    /**
     * Creates every VuloPilot custom table for a fresh install (schema
     * version 1.0.0). Additive-only from here on — later schema changes
     * belong in do_migration(), never here.
     *
     * @return void
     */
    private static function create_database_tables() {
        global $wpdb;

        $collate = $wpdb->get_charset_collate();

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $sql_scans = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['scan'] . "` (
            `id`            bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `scanner_id`    varchar(100) NOT NULL,
            `scanner_tier`  varchar(20) NOT NULL DEFAULT 'free',
            `status`        varchar(20) NOT NULL DEFAULT 'queued',
            `trigger_type`  varchar(20) NOT NULL DEFAULT 'manual',
            `triggered_by`  bigint(20) unsigned DEFAULT NULL,
            `started_at`    datetime DEFAULT NULL,
            `finished_at`   datetime DEFAULT NULL,
            `duration_ms`   int(10) unsigned DEFAULT NULL,
            `summary`       longtext DEFAULT NULL,
            `error_message` text DEFAULT NULL,
            `created_at`    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_scanner` (`scanner_id`),
            KEY `idx_status` (`status`),
            KEY `idx_created` (`created_at`)
        ) $collate;";

        $sql_scan_findings = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['scan_finding'] . "` (
            `id`          bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `scan_id`     bigint(20) unsigned NOT NULL,
            `scanner_id`  varchar(100) NOT NULL,
            `severity`    varchar(20) NOT NULL DEFAULT 'info',
            `category`    varchar(50) NOT NULL,
            `title`       varchar(255) NOT NULL,
            `description` longtext DEFAULT NULL,
            `object_type` varchar(50) DEFAULT NULL,
            `object_ref`  varchar(255) DEFAULT NULL,
            `status`      varchar(20) NOT NULL DEFAULT 'open',
            `resolved_at` datetime DEFAULT NULL,
            `meta`        longtext DEFAULT NULL,
            `created_at`  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_scan` (`scan_id`),
            KEY `idx_severity` (`severity`),
            KEY `idx_status` (`status`),
            KEY `idx_category` (`category`)
        ) $collate;";

        $sql_rules = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['rule'] . "` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `name`           varchar(191) NOT NULL,
            `description`    text DEFAULT NULL,
            `condition_tree` longtext NOT NULL,
            `is_active`      tinyint(1) NOT NULL DEFAULT 1,
            `created_by`     bigint(20) unsigned DEFAULT NULL,
            `created_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_active` (`is_active`)
        ) $collate;";

        $sql_automations = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['automation'] . "` (
            `id`                bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `name`              varchar(191) NOT NULL,
            `rule_id`           bigint(20) unsigned DEFAULT NULL,
            `category`          varchar(30) NOT NULL DEFAULT 'monitoring',
            `trigger_type`      varchar(50) NOT NULL,
            `trigger_config`    longtext DEFAULT NULL,
            `conditions`        longtext DEFAULT NULL,
            `actions`           longtext NOT NULL,
            `status`            varchar(20) NOT NULL DEFAULT 'enabled',
            `last_triggered_at` datetime DEFAULT NULL,
            `created_by`        bigint(20) unsigned DEFAULT NULL,
            `created_at`        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_rule` (`rule_id`),
            KEY `idx_status` (`status`),
            KEY `idx_trigger_type` (`trigger_type`),
            KEY `idx_category` (`category`)
        ) $collate;";

        $sql_automation_runs = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['automation_run'] . "` (
            `id`               bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `automation_id`    bigint(20) unsigned NOT NULL,
            `triggered_by`     varchar(50) NOT NULL,
            `trigger_ref_id`   bigint(20) unsigned DEFAULT NULL,
            `status`           varchar(20) NOT NULL DEFAULT 'running',
            `actions_executed` int(10) unsigned NOT NULL DEFAULT 0,
            `actions_failed`   int(10) unsigned NOT NULL DEFAULT 0,
            `changes_made`     int(10) unsigned NOT NULL DEFAULT 0,
            `result_log`       longtext DEFAULT NULL,
            `retry_count`      tinyint(3) unsigned NOT NULL DEFAULT 0,
            `started_at`       datetime NOT NULL,
            `finished_at`      datetime DEFAULT NULL,
            `created_at`       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_automation` (`automation_id`),
            KEY `idx_status` (`status`),
            KEY `idx_started` (`started_at`)
        ) $collate;";

        $sql_ai_jobs = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['ai_job'] . "` (
            `id`              bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `job_type`        varchar(50) NOT NULL,
            `provider`        varchar(50) NOT NULL,
            `model`           varchar(100) DEFAULT NULL,
            `status`          varchar(20) NOT NULL DEFAULT 'queued',
            `priority`        tinyint(3) unsigned NOT NULL DEFAULT 5,
            `object_type`     varchar(50) DEFAULT NULL,
            `object_id`       bigint(20) unsigned DEFAULT NULL,
            `request_payload` longtext NOT NULL,
            `attempts`        tinyint(3) unsigned NOT NULL DEFAULT 0,
            `requested_by`    bigint(20) unsigned DEFAULT NULL,
            `created_at`      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `started_at`      datetime DEFAULT NULL,
            `completed_at`    datetime DEFAULT NULL,
            `error_message`   text DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_status_priority` (`status`, `priority`),
            KEY `idx_object` (`object_type`, `object_id`)
        ) $collate;";

        $sql_ai_history = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['ai_history'] . "` (
            `id`                bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `job_id`            bigint(20) unsigned DEFAULT NULL,
            `provider`          varchar(50) NOT NULL,
            `model`             varchar(100) DEFAULT NULL,
            `object_type`       varchar(50) DEFAULT NULL,
            `object_id`         bigint(20) unsigned DEFAULT NULL,
            `surface`           varchar(30) DEFAULT NULL,
            `prompt_tokens`     int(10) unsigned DEFAULT NULL,
            `completion_tokens` int(10) unsigned DEFAULT NULL,
            `cost_estimate`     decimal(10,4) DEFAULT NULL,
            `status`            varchar(20) NOT NULL,
            `response_excerpt`  text DEFAULT NULL,
            `requested_by`      bigint(20) unsigned DEFAULT NULL,
            `created_at`        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_provider` (`provider`),
            KEY `idx_created` (`created_at`),
            KEY `idx_object` (`object_type`, `object_id`),
            KEY `idx_surface` (`surface`)
        ) $collate;";

        $sql_ai_provider_configs = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['ai_provider_config'] . "` (
            `id`              bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `provider`        varchar(50) NOT NULL,
            `label`           varchar(191) DEFAULT NULL,
            `credentials`     longtext NOT NULL,
            `default_model`   varchar(100) DEFAULT NULL,
            `is_active`       tinyint(1) NOT NULL DEFAULT 1,
            `quota_limit`     int(10) unsigned DEFAULT NULL,
            `quota_used`      int(10) unsigned NOT NULL DEFAULT 0,
            `quota_reset_at`  datetime DEFAULT NULL,
            `created_at`      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_provider` (`provider`),
            KEY `idx_active` (`is_active`)
        ) $collate;";

        $sql_reports = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['report'] . "` (
            `id`            bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `report_type`   varchar(50) NOT NULL,
            `format`        varchar(10) NOT NULL DEFAULT 'pdf',
            `period_start`  date DEFAULT NULL,
            `period_end`    date DEFAULT NULL,
            `status`        varchar(20) NOT NULL DEFAULT 'generating',
            `file_path`     varchar(255) DEFAULT NULL,
            `generated_by`  bigint(20) unsigned DEFAULT NULL,
            `meta`          longtext DEFAULT NULL,
            `created_at`    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_type` (`report_type`),
            KEY `idx_status` (`status`),
            KEY `idx_period` (`period_start`, `period_end`)
        ) $collate;";

        $sql_scheduled_jobs = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['scheduled_job'] . "` (
            `id`               bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `job_key`          varchar(100) NOT NULL,
            `job_type`         varchar(50) NOT NULL,
            `schedule`         varchar(50) NOT NULL,
            `config`           longtext DEFAULT NULL,
            `is_enabled`       tinyint(1) NOT NULL DEFAULT 1,
            `next_run_at`      datetime DEFAULT NULL,
            `last_run_at`      datetime DEFAULT NULL,
            `last_run_status`  varchar(20) DEFAULT NULL,
            `created_at`       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_job_key` (`job_key`),
            KEY `idx_enabled` (`is_enabled`),
            KEY `idx_next_run` (`next_run_at`)
        ) $collate;";

        $sql_activity_logs = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['activity_log'] . "` (
            `id`          bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `event_type`  varchar(100) NOT NULL,
            `object_type` varchar(50) DEFAULT NULL,
            `object_id`   bigint(20) unsigned DEFAULT NULL,
            `actor_type`  varchar(20) NOT NULL DEFAULT 'system',
            `actor_id`    bigint(20) unsigned DEFAULT NULL,
            `message`     text NOT NULL,
            `severity`    varchar(20) NOT NULL DEFAULT 'info',
            `meta`        longtext DEFAULT NULL,
            `created_at`  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_event` (`event_type`),
            KEY `idx_object` (`object_type`, `object_id`),
            KEY `idx_created` (`created_at`)
        ) $collate;";

        $sql_site_health_snapshots = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['site_health_snapshot'] . "` (
            `id`                bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `snapshot_date`     date NOT NULL,
            `overall_score`     tinyint(3) unsigned NOT NULL,
            `security_score`    tinyint(3) unsigned DEFAULT NULL,
            `performance_score` tinyint(3) unsigned DEFAULT NULL,
            `seo_score`         tinyint(3) unsigned DEFAULT NULL,
            `uptime_score`      tinyint(3) unsigned DEFAULT NULL,
            `critical_count`    int(10) unsigned NOT NULL DEFAULT 0,
            `high_count`        int(10) unsigned NOT NULL DEFAULT 0,
            `medium_count`      int(10) unsigned NOT NULL DEFAULT 0,
            `low_count`         int(10) unsigned NOT NULL DEFAULT 0,
            `created_at`        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_snapshot_date` (`snapshot_date`)
        ) $collate;";

        $sql_ai_action_runs = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['ai_action_run'] . "` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `action_id`      varchar(100) NOT NULL,
            `status`         varchar(20) NOT NULL DEFAULT 'pending_approval',
            `object_type`    varchar(50) DEFAULT NULL,
            `object_ref`     varchar(255) DEFAULT NULL,
            `input`          longtext DEFAULT NULL,
            `output`         longtext DEFAULT NULL,
            `preview`        longtext DEFAULT NULL,
            `snapshot`       longtext DEFAULT NULL,
            `error_message`  text DEFAULT NULL,
            `requested_by`   bigint(20) unsigned DEFAULT NULL,
            `approved_by`    bigint(20) unsigned DEFAULT NULL,
            `created_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `approved_at`    datetime DEFAULT NULL,
            `executed_at`    datetime DEFAULT NULL,
            `rolled_back_at` datetime DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_action` (`action_id`),
            KEY `idx_status` (`status`),
            KEY `idx_object` (`object_type`, `object_ref`)
        ) $collate;";

        dbDelta( $sql_scans );
        dbDelta( $sql_scan_findings );
        dbDelta( $sql_rules );
        dbDelta( $sql_automations );
        dbDelta( $sql_automation_runs );
        dbDelta( $sql_ai_jobs );
        dbDelta( $sql_ai_history );
        dbDelta( $sql_ai_provider_configs );
        dbDelta( $sql_reports );
        dbDelta( $sql_scheduled_jobs );
        dbDelta( $sql_activity_logs );
        dbDelta( $sql_site_health_snapshots );
        dbDelta( $sql_ai_action_runs );

        self::create_crawler_visits_table();
        self::create_redirect_tables();
        self::create_indexnow_log_table();
        self::create_geo_visibility_history_table();
        self::create_brand_score_history_table();
        self::create_entity_relationships_table();
        self::create_kg_health_history_table();
        self::create_file_baselines_table();
        self::create_accessibility_snapshots_table();
        self::create_store_trends_snapshots_table();
        self::create_performance_score_snapshots_table();
        self::create_performance_requests_table();
        self::create_core_web_vitals_table();
        self::create_page_speed_table();
        self::create_login_attempts_table();
        self::create_firewall_blocks_table();
        self::create_backups_table();
    }

    /**
     * Creates `vulopilot_redirects` and `vulopilot_not_found_logs` — same
     * "own method, self-sufficient, callable from both a fresh install and
     * do_migration()" shape as create_crawler_visits_table() below, for the
     * same reason: these were added after this class's original table set,
     * so sites upgrading in place need them created too, not just fresh
     * installs.
     *
     * `vulopilot_redirects.source_path` is UNIQUE — Services\RedirectManager
     * looks a request path up by exact match, and only one active target
     * makes sense per source path (a second row for the same path would be
     * ambiguous, not a legitimate A/B case this feature is for).
     * `vulopilot_not_found_logs.requested_path` is likewise UNIQUE —
     * Services\NotFoundLogger upserts (increment `hit_count`, bump
     * `last_seen_at`) rather than inserting one row per visit, so repeat
     * 404s to the same missing URL don't grow this table unboundedly the
     * way a per-visit log would.
     *
     * @return void
     */
    private static function create_redirect_tables() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_redirects = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['redirect'] . "` (
            `id`            bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `source_path`   varchar(255) NOT NULL,
            `target_url`    varchar(255) NOT NULL,
            `redirect_type` smallint(3) unsigned NOT NULL DEFAULT 301,
            `hit_count`     int(10) unsigned NOT NULL DEFAULT 0,
            `is_active`     tinyint(1) NOT NULL DEFAULT 1,
            `created_by`    bigint(20) unsigned DEFAULT NULL,
            `created_at`    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_source_path` (`source_path`),
            KEY `idx_active` (`is_active`)
        ) $collate;";

        $sql_not_found_logs = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['not_found_log'] . "` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `requested_path` varchar(255) NOT NULL,
            `referrer`       varchar(255) DEFAULT NULL,
            `hit_count`      int(10) unsigned NOT NULL DEFAULT 1,
            `last_seen_at`   datetime NOT NULL,
            `created_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_requested_path` (`requested_path`),
            KEY `idx_last_seen` (`last_seen_at`)
        ) $collate;";

        dbDelta( $sql_redirects );
        dbDelta( $sql_not_found_logs );
    }

    /**
     * Creates `vulopilot_performance_score_snapshots` — "Improve Speed"
     * Overview's Speed History card. Own dedicated table rather than a
     * reuse of `vulopilot_site_health_snapshots` (that table's other
     * columns are Pro's AdvancedReports module data — see
     * Services\PerformanceScoreSnapshotRecorder's own docblock for why
     * sharing one mutable daily row is the wrong move here). Same
     * "own method, self-sufficient, callable from both a fresh install and
     * do_migration()" shape as create_redirect_tables() above.
     *
     * @return void
     */
    private static function create_performance_score_snapshots_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['performance_score_snapshot'] . "` (
            `id`                bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `snapshot_date`     date NOT NULL,
            `performance_score` tinyint(3) unsigned NOT NULL DEFAULT 0,
            `created_at`        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_snapshot_date` (`snapshot_date`)
        ) $collate;";

        dbDelta( $sql );
    }

    /**
     * Creates `vulopilot_performance_requests` — "Improve Speed"
     * Overview's Real-time Monitoring card. Deliberately no visitor-
     * identifying column at all (see Services\PerformanceRequestLogger's
     * own docblock) — just a response time sample per real front-end
     * request. Same "own method, self-sufficient, callable from both a
     * fresh install and do_migration()" shape as create_redirect_tables()
     * above.
     *
     * @return void
     */
    private static function create_performance_requests_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['performance_request'] . "` (
            `id`                bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `response_time_ms`  smallint(5) unsigned NOT NULL,
            `created_at`        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_created` (`created_at`)
        ) $collate;";

        dbDelta( $sql );
    }

    /**
     * Creates `vulopilot_core_web_vitals` — "Improve Speed" Overview's real
     * Core Web Vitals RUM (Services\CoreWebVitalsBeacon's public front-end
     * beacon writes here). One row per real pageview that reported at
     * least one metric; a metric the browser couldn't measure (e.g. no
     * interaction yet for INP) is NULL, never a fabricated zero. `cls`
     * stored ×1000 as a smallint (`cls_thousandths`), matching this
     * codebase's own preference for integer ms/thousandths columns over
     * float columns. Same "own method, self-sufficient, callable from both
     * a fresh install and do_migration()" shape as create_redirect_tables()
     * above.
     *
     * @return void
     */
    private static function create_core_web_vitals_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['core_web_vital'] . "` (
            `id`               bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `lcp_ms`           smallint(5) unsigned DEFAULT NULL,
            `cls_thousandths`  smallint(5) unsigned DEFAULT NULL,
            `inp_ms`           smallint(5) unsigned DEFAULT NULL,
            `created_at`       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_created` (`created_at`)
        ) $collate;";

        dbDelta( $sql );
    }

    /**
     * Creates `vulopilot_page_speed` — "Improve Speed" › Slow Pages'
     * per-page speed table (Services\PageSpeedScanner writes here, one row
     * per real page it has checked, replaced on every rescan). `url`/
     * `title`/`page_type` describe a real WP page, post, or WooCommerce
     * page/product/category (never a fabricated entry). `load_time_ms` is
     * a real measured `wp_remote_get()` response time, same idiom as
     * SlowPageScanner's own homepage timing. `score` is derived from
     * `load_time_ms` via a documented formula (see PageSpeedScanner) — not
     * a Lighthouse score. `status` ('slow'/'needs_improvement'/'good') is
     * the same score banded into the real thresholds Slow Pages' own "What's
     * considered slow?" legend states, stored as its own column purely so
     * PageSpeedRepository can filter/count by it the same way every other
     * AbstractRepository-backed list does for its own status-count pill bar.
     * `mobile_score`/`desktop_score` stay NULL unless a
     * real Google PageSpeed Insights API key is configured and that page
     * has actually been checked against it, matching Part A's own
     * PSI-key-gated fallback posture — never a fabricated device split.
     * `main_issue` is either a real Google Lighthouse opportunity-audit
     * title (from a real PSI response) or a plain load-time-based label;
     * NULL when neither is available, never invented text.
     * `page_size_bytes`/`requests_count` are the real `total-byte-weight`/
     * `network-requests` Lighthouse audits from that same real PSI
     * response; `lcp_ms`/`inp_ms`/`cls_thousandths` + their `_rating`
     * ('FAST'/'AVERAGE'/'SLOW') are real Chrome UX Report field data from
     * PSI's own `loadingExperience` block — Google's real measured
     * visitor experience for that URL, not Lighthouse's simulated lab
     * run, and NULL whenever CrUX has no real field data for a
     * low-traffic page (a real "not enough data" case, not fabricated).
     * All eight stay NULL without a PSI key, same PSI-key-gated fallback
     * posture as `mobile_score`/`desktop_score`. Same "own method,
     * self-sufficient, callable from both a fresh install and
     * do_migration()" shape as create_core_web_vitals_table() above.
     *
     * @return void
     */
    private static function create_page_speed_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['page_speed'] . "` (
            `id`               bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `url`              varchar(500) NOT NULL,
            `title`            varchar(255) NOT NULL DEFAULT '',
            `page_type`        varchar(40) NOT NULL DEFAULT 'page',
            `load_time_ms`     int(10) unsigned DEFAULT NULL,
            `score`            tinyint(3) unsigned DEFAULT NULL,
            `status`           varchar(20) DEFAULT NULL,
            `mobile_score`     tinyint(3) unsigned DEFAULT NULL,
            `desktop_score`    tinyint(3) unsigned DEFAULT NULL,
            `main_issue`       varchar(255) DEFAULT NULL,
            `page_size_bytes`  int(10) unsigned DEFAULT NULL,
            `requests_count`   smallint(5) unsigned DEFAULT NULL,
            `lcp_ms`           int(10) unsigned DEFAULT NULL,
            `lcp_rating`       varchar(20) DEFAULT NULL,
            `inp_ms`           int(10) unsigned DEFAULT NULL,
            `inp_rating`       varchar(20) DEFAULT NULL,
            `cls_thousandths`  smallint(5) unsigned DEFAULT NULL,
            `cls_rating`       varchar(20) DEFAULT NULL,
            `scanned_at`       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_url` (`url`(191)),
            KEY `idx_page_type` (`page_type`),
            KEY `idx_score` (`score`),
            KEY `idx_status` (`status`)
        ) $collate;";

        dbDelta( $sql );
    }

    /**
     * Creates `vulopilot_login_attempts` — Protect My Site's "Login
     * Protection" tile (Services\LoginProtectionGuard). One row per real
     * login attempt (success or failure), `ip_address`+`attempted_at`
     * indexed together since the guard's only query is "how many failures
     * has this IP had in the last N minutes." No plaintext password/
     * username-guessing data is ever stored here — only which login *name*
     * was tried, same as WordPress core's own login-failure logging
     * convention.
     *
     * @return void
     */
    private static function create_login_attempts_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['login_attempt'] . "` (
            `id`                  bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `ip_address`          varchar(45) NOT NULL,
            `username_attempted`  varchar(60) NOT NULL DEFAULT '',
            `success`             tinyint(1) unsigned NOT NULL DEFAULT 0,
            `attempted_at`        datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_ip_time` (`ip_address`, `attempted_at`)
        ) $collate;";

        dbDelta( $sql );
    }

    /**
     * Creates `vulopilot_firewall_blocks` — Protect My Site's "Firewall"
     * tile (Services\FirewallGuard). One row per request that matched a
     * known attack-pattern rule; `action` records whether it was actually
     * blocked (`enable_firewall_blocking` on) or only logged (the default),
     * so the same table honestly represents both modes without a schema
     * change when a site owner later turns blocking on.
     *
     * @return void
     */
    private static function create_firewall_blocks_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['firewall_block'] . "` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `ip_address`     varchar(45) NOT NULL,
            `request_uri`    text NOT NULL,
            `rule_matched`   varchar(100) NOT NULL,
            `action`         varchar(10) NOT NULL DEFAULT 'logged',
            `created_at`     datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_ip` (`ip_address`),
            KEY `idx_created` (`created_at`)
        ) $collate;";

        dbDelta( $sql );
    }

    /**
     * Creates `vulopilot_backups` — Protect My Site's "Backups"/"Recovery"
     * tiles (Services\BackupManager/BackupScheduler). One row per backup
     * run (manual, scheduled, or the automatic pre-restore safety snapshot
     * a real Restore always takes first); `file_path` stores only the
     * archive's basename, never a full or web-reachable path, same
     * DATABASE.md convention Reports.php's own `vulopilot_reports.file_path`
     * already established — the real path is always re-derived server-side
     * from `wp_upload_dir()`, never trusted from the client.
     *
     * @return void
     */
    private static function create_backups_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['backup'] . "` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `status`         varchar(20) NOT NULL DEFAULT 'queued',
            `trigger_type`   varchar(20) NOT NULL DEFAULT 'manual',
            `file_path`      varchar(255) DEFAULT NULL,
            `file_size`      bigint(20) unsigned DEFAULT NULL,
            `started_at`     datetime DEFAULT NULL,
            `finished_at`    datetime DEFAULT NULL,
            `error_message`  text DEFAULT NULL,
            `created_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_status` (`status`),
            KEY `idx_created` (`created_at`)
        ) $collate;";

        dbDelta( $sql );
    }

    /**
     * Creates `vulopilot_crawler_visits` — its own method (not inlined into
     * create_database_tables() like the tables above) because, unlike
     * those, this one also needs to run for sites *upgrading* in place
     * (do_migration() calls this too) — added after those fresh-install-only
     * table definitions were already written, per this class's own
     * "additive only, ADD new things in do_migration(), never touch
     * create_database_tables() for an upgrade" convention. No IP address or
     * user column, ever — readme.txt's own FAQ promises AI Crawler Traffic
     * Monitoring "does not track human visitors, IP addresses, or personal
     * data," enforced by the schema itself, not just application code.
     *
     * @return void
     */
    private static function create_crawler_visits_table() {
        global $wpdb;

        // create_database_tables() already guarantees dbDelta() is loaded
        // before its own calls, but do_migration() calls this method
        // directly without going through that guard — confirmed fatal
        // ("Call to undefined function dbDelta()") the moment the
        // migration path actually ran on a real site, since
        // wp-admin/includes/upgrade.php is never autoloaded outside
        // wp-admin. Self-sufficient here so this method is safe to call
        // from either context.
        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_crawler_visits = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['crawler_visit'] . "` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `bot_name`       varchar(50) NOT NULL,
            `user_agent`     varchar(255) NOT NULL,
            `requested_url`  varchar(255) NOT NULL,
            `created_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_bot` (`bot_name`),
            KEY `idx_created` (`created_at`)
        ) $collate;";

        dbDelta( $sql_crawler_visits );
    }

    /**
     * Creates `vulopilot_indexnow_log` — its own method for the same reason
     * as create_crawler_visits_table()/create_redirect_tables() above: this
     * table was added after the original table set, so both a fresh install
     * and a site upgrading in place need it (do_migration() calls this too).
     * One row per real IndexNow API submission (manual or auto-submitted),
     * trimmed to the last 100 by Repositories\IndexNowLogRepository after
     * each insert (mockup's own "The last 100 IndexNow API requests" copy) —
     * not upserted/deduped like `vulopilot_not_found_logs`, since repeat
     * submissions of the same URL over time are each a distinct, meaningful
     * API call worth its own row.
     *
     * @return void
     */
    private static function create_indexnow_log_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_indexnow_log = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['indexnow_log'] . "` (
            `id`              bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `url`             varchar(255) NOT NULL,
            `response_code`   smallint(5) unsigned DEFAULT NULL,
            `response_status` varchar(20) NOT NULL DEFAULT 'unknown',
            `trigger_type`    varchar(20) NOT NULL DEFAULT 'manual',
            `created_at`      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_created` (`created_at`)
        ) $collate;";

        dbDelta( $sql_indexnow_log );
    }

    /**
     * Creates `vulopilot_geo_visibility_history` — same self-sufficient,
     * "own method, fresh install AND do_migration()" shape as
     * create_indexnow_log_table() above. One row per calendar day
     * (`snapshot_date` UNIQUE, upserted — never one row per run), the same
     * "daily snapshot, not a per-run log" shape `vulopilot_site_health_snapshots`
     * already uses, so a site that rebuilds its GEO visibility snapshot more
     * than once a day still only ever has one trend point for that day.
     * Written by vulopilot-pro's GeoInsights\VisibilitySnapshotBuilder
     * (Free owns the schema/Repository, Pro owns the population logic —
     * same split `vulopilot_site_health_snapshots`/AdvancedReports already
     * establishes) — this table exists and is queryable even without Pro
     * active, it just stays empty.
     *
     * @return void
     */
    private static function create_geo_visibility_history_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_geo_visibility_history = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['geo_visibility_history'] . "` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `snapshot_date`  date NOT NULL,
            `sample_size`    int(10) unsigned NOT NULL DEFAULT 0,
            `overall_score`  tinyint(3) unsigned DEFAULT NULL,
            `ai_scores`      longtext DEFAULT NULL,
            `sub_scores`     longtext DEFAULT NULL,
            `created_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_snapshot_date` (`snapshot_date`)
        ) $collate;";

        dbDelta( $sql_geo_visibility_history );
    }

    /**
     * `vulopilot_brand_score_history` — same one-row-per-day upsert shape
     * as `vulopilot_geo_visibility_history` above, but simpler: Brand Score
     * is a deterministic composite computed live from
     * `vulopilot_scan_findings` (Controllers\BrandIntelligence's own
     * docblock), never an AI-sampled average that can come back empty, so
     * there's no `sample_size`/nullable-score case to account for — every
     * one of its 4 score columns is always a real 0-100 int.
     *
     * @return void
     */
    private static function create_brand_score_history_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_brand_score_history = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['brand_score_history'] . "` (
            `id`               bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `snapshot_date`    date NOT NULL,
            `brand_score`      tinyint(3) unsigned NOT NULL,
            `trust_score`      tinyint(3) unsigned NOT NULL,
            `authority_score`  tinyint(3) unsigned NOT NULL,
            `entity_score`     tinyint(3) unsigned NOT NULL,
            `created_at`       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_snapshot_date` (`snapshot_date`)
        ) $collate;";

        dbDelta( $sql_brand_score_history );
    }

    /**
     * `vulopilot_entity_relationships` (KNOWLEDGE-GRAPH-MODULE.md) — one
     * row per real, deterministic edge vulopilot-pro's own
     * KnowledgeGraph\EntityRelationshipBuilder discovers between two of
     * Free's own extracted entities (Services\EntityExtractor). Entity ids
     * are the synthetic `{type}:{ref}` strings EntityExtractor itself
     * builds (e.g. `person:7`), not a foreign key into any single table —
     * no real FK constraints anywhere in this codebase's schema regardless
     * (DATABASE.md's own stated convention). `dedupe_hash` (an md5 of
     * from/to id + relationship_type) gets its own UNIQUE key instead of a
     * wide composite unique index across 3 varchar columns, since building
     * the graph is a repeatable rebuild-on-schedule operation, not a
     * one-time insert, and re-running it must not create duplicate edges.
     *
     * @return void
     */
    private static function create_entity_relationships_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_entity_relationships = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['entity_relationship'] . "` (
            `id`                bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `from_entity_id`    varchar(64) NOT NULL,
            `from_entity_type`  varchar(20) NOT NULL,
            `from_entity_name`  varchar(255) NOT NULL,
            `to_entity_id`      varchar(64) NOT NULL,
            `to_entity_type`    varchar(20) NOT NULL,
            `to_entity_name`    varchar(255) NOT NULL,
            `relationship_type` varchar(50) NOT NULL,
            `dedupe_hash`       char(32) NOT NULL,
            `created_at`        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_dedupe_hash` (`dedupe_hash`),
            KEY `idx_from_entity` (`from_entity_id`),
            KEY `idx_to_entity` (`to_entity_id`)
        ) $collate;";

        dbDelta( $sql_entity_relationships );
    }

    /**
     * `vulopilot_kg_health_history` (KNOWLEDGE-GRAPH-MODULE.md) — same
     * one-row-per-day upsert shape as `vulopilot_brand_score_history`
     * above; Knowledge Graph Health is likewise a deterministic composite
     * (entity/relationship completeness ratios, vulopilot-pro's own
     * KnowledgeGraphHealthMonitor), never an AI-sampled average, so every
     * column is always a real value.
     *
     * @return void
     */
    private static function create_kg_health_history_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_kg_health_history = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['kg_health_history'] . "` (
            `id`                  bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `snapshot_date`       date NOT NULL,
            `health_score`        tinyint(3) unsigned NOT NULL,
            `total_entities`      int(10) unsigned NOT NULL DEFAULT 0,
            `total_relationships` int(10) unsigned NOT NULL DEFAULT 0,
            `created_at`          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_snapshot_date` (`snapshot_date`)
        ) $collate;";

        dbDelta( $sql_kg_health_history );
    }

    /**
     * `vulopilot_file_baselines` (SECURITY-MODULE.md's "Integrity
     * Monitoring") — one row per plugin/theme file vulopilot-pro's own
     * IntegrityMonitoringScanner has seen, keyed by its own path so a
     * re-scan can `UPSERT`-by-path rather than accumulating a new row per
     * run the way `vulopilot_scan_findings` does. Free owns the
     * schema/Repository, Pro owns the population/diff logic — same split
     * `vulopilot_entity_relationships`/`vulopilot_geo_visibility_history`
     * already establish; this table exists and is queryable even without
     * Pro active, it just stays empty. `hash` is a sha256 (char(64)), not
     * core's own md5 (CoreFileIntegrityScanner's own choice) — core files
     * have an official published md5 baseline to diff against; these do
     * not, so there's no reason to match core's weaker algorithm here.
     * `path_hash` (an md5 of `path`) carries the UNIQUE key rather than
     * `path` itself — same "wide varchar can't cheaply carry a unique
     * index" reasoning `vulopilot_entity_relationships`' own `dedupe_hash`
     * column already documents.
     *
     * @return void
     */
    private static function create_file_baselines_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_file_baselines = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['file_baseline'] . "` (
            `id`           bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `path`         varchar(500) NOT NULL,
            `path_hash`    char(32) NOT NULL,
            `scope`        varchar(20) NOT NULL,
            `hash`         char(64) NOT NULL,
            `file_size`    bigint(20) unsigned NOT NULL DEFAULT 0,
            `last_seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `created_at`   timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_path_hash` (`path_hash`),
            KEY `idx_scope` (`scope`)
        ) $collate;";

        dbDelta( $sql_file_baselines );
    }

    /**
     * `vulopilot_accessibility_snapshots` (ACCESSIBILITY-MODULE.md's
     * "Historical Tracking") — same one-row-per-day upsert shape as
     * `vulopilot_site_health_snapshots`/`vulopilot_geo_visibility_history`
     * above, scoped to category 'accessibility' findings specifically
     * rather than the whole-site score those track. Free owns the
     * schema/Repository, vulopilot-pro's AccessibilityAudits module owns
     * the population logic (self-hooks `vulopilot_scan_completed`, same
     * split every other *_history/*_snapshots table in this file already
     * establishes) — this table exists and is queryable even without Pro
     * active, it just stays empty. Severity counts are a deterministic
     * rollup of `vulopilot_scan_findings` (FindingRepository's own
     * get_severity_breakdown_for_category()), never an AI-sampled average,
     * so — like `vulopilot_brand_score_history`/`vulopilot_kg_health_history`
     * — every column is always a real value, no nullable-score case.
     *
     * @return void
     */
    private static function create_accessibility_snapshots_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_accessibility_snapshots = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['accessibility_snapshot'] . "` (
            `id`             bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `snapshot_date`  date NOT NULL,
            `score`          tinyint(3) unsigned NOT NULL,
            `open_count`     int(10) unsigned NOT NULL DEFAULT 0,
            `critical_count` int(10) unsigned NOT NULL DEFAULT 0,
            `high_count`     int(10) unsigned NOT NULL DEFAULT 0,
            `medium_count`   int(10) unsigned NOT NULL DEFAULT 0,
            `low_count`      int(10) unsigned NOT NULL DEFAULT 0,
            `created_at`     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_snapshot_date` (`snapshot_date`)
        ) $collate;";

        dbDelta( $sql_accessibility_snapshots );
    }

    /**
     * `vulopilot_store_trends_snapshots` (WOOCOMMERCE-INTELLIGENCE-MODULE.md's
     * "Store Trends") — same one-row-per-day upsert shape as
     * `vulopilot_accessibility_snapshots` above, scoped to real WooCommerce
     * order data instead of scanner findings. Free owns the
     * schema/Repository, vulopilot-pro's WooCommerceIntelligence module
     * owns the population logic (its own daily wp-cron tick, not a scan
     * hook — a store's revenue isn't scanner-derived the way a finding
     * count is) — this table exists and is queryable even without Pro
     * active, it just stays empty. `revenue`/`avg_order_value` are
     * decimal(10,2), matching WooCommerce core's own `_order_total` meta
     * precision, not float (binary float rounding error is never
     * acceptable for a currency amount).
     *
     * @return void
     */
    private static function create_store_trends_snapshots_table() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_store_trends_snapshots = "CREATE TABLE IF NOT EXISTS `{$wpdb->prefix}" . Utill::TABLES['store_trends_snapshot'] . "` (
            `id`               bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `snapshot_date`    date NOT NULL,
            `revenue`          decimal(10,2) NOT NULL DEFAULT 0.00,
            `order_count`      int(10) unsigned NOT NULL DEFAULT 0,
            `avg_order_value`  decimal(10,2) NOT NULL DEFAULT 0.00,
            `created_at`       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_snapshot_date` (`snapshot_date`)
        ) $collate;";

        dbDelta( $sql_store_trends_snapshots );
    }

    /**
     * Runs incremental, version-gated schema changes for upgrades from an
     * already-installed copy of VuloPilot. Additive only, per
     * .claude/rules/backward-compatibility.md — ADD COLUMN / ADD INDEX,
     * never DROP.
     *
     * @param string $previous_version The version option value before this run.
     * @return void
     */
    public function do_migration( $previous_version ) {
        if ( version_compare( $previous_version, '1.1.0', '<' ) ) {
            $this->relax_automation_rule_id_to_nullable();
        }

        // llms.txt Generation & Management (readme.txt) added its own
        // rewrite rule this version — sites upgrading in place need a
        // flush to pick up '/llms.txt' without waiting for a deactivate/
        // reactivate cycle (VuloPilot::activate() already flushes, but
        // that only runs on a fresh activation). Deliberately OUTSIDE the
        // version_compare gate above, same reasoning as
        // create_crawler_visits_table() below: VULOPILOT_PLUGIN_VERSION
        // was already '1.1.0' before this rewrite rule existed, so a site
        // that had already recorded plugin_db_version=1.1.0 would never
        // satisfy `< 1.1.0` again and would silently never get this flush.
        //
        // Deferred to a late 'init' priority rather than called directly
        // here — confirmed via a real wp-env site that calling it
        // synchronously still 404s on /llms.txt, because both places
        // do_migration() ever runs from (init_plugin()'s plugins_loaded
        // path, and init_classes()'s own 'init' priority 0 path) execute
        // *before* GeoAnalysis\LlmsTxtGenerator's own 'init' (default
        // priority 10) callback has added the rewrite rule this flush is
        // supposed to pick up — flushing before the rule exists just
        // bakes in a rule set without it. Priority 20 guarantees this
        // runs after that priority-10 registration within the same 'init'
        // pass, however do_migration() itself got triggered.
        add_action( 'init', 'flush_rewrite_rules', 20 );

        // AI Crawler Traffic Monitoring (readme.txt) needs its own new
        // table for sites upgrading in place too — create_database_tables()
        // only ever runs for a brand-new install. Deliberately OUTSIDE the
        // version_compare gate above (unlike the two migrations inside it):
        // VULOPILOT_PLUGIN_VERSION was already '1.1.0' before this table's
        // migration code existed, so a site that had already recorded
        // plugin_db_version=1.1.0 (from activating an earlier build still
        // under this same version number) would never satisfy `< 1.1.0`
        // again and would silently never get this table — confirmed via a
        // real wp-env site hitting "Table ... doesn't exist" on every
        // /crawler-traffic request. dbDelta()'s CREATE TABLE IF NOT EXISTS
        // makes this safe to run unconditionally on every upgrade check,
        // the same self-healing shape create_database_tables() already
        // uses for a fresh install.
        self::create_crawler_visits_table();

        // Redirects & 404 logging (readme.txt's "Redirects & 404s") needs
        // its own two new tables for sites upgrading in place too — same
        // "outside the version_compare gate, self-healing via CREATE TABLE
        // IF NOT EXISTS" reasoning as create_crawler_visits_table() above.
        self::create_redirect_tables();

        // Instant Indexing (readme.txt's IndexNow support) needs its own new
        // table for sites upgrading in place too — same "outside the
        // version_compare gate, self-healing via CREATE TABLE IF NOT EXISTS"
        // reasoning as create_crawler_visits_table() above.
        self::create_indexnow_log_table();

        // GEO Historical Trends (AI-VISIBILITY-MODULE.md) needs its own new
        // table for sites upgrading in place too — same "outside the
        // version_compare gate, self-healing via CREATE TABLE IF NOT EXISTS"
        // reasoning as create_crawler_visits_table() above.
        self::create_geo_visibility_history_table();

        // Brand Authority Trends (BRAND-INTELLIGENCE-MODULE.md) needs its
        // own new table for sites upgrading in place too — same "outside
        // the version_compare gate, self-healing via CREATE TABLE IF NOT
        // EXISTS" reasoning as create_crawler_visits_table() above.
        self::create_brand_score_history_table();

        // Knowledge Graph (KNOWLEDGE-GRAPH-MODULE.md) needs both its new
        // tables for sites upgrading in place too — same "outside the
        // version_compare gate, self-healing via CREATE TABLE IF NOT
        // EXISTS" reasoning as create_crawler_visits_table() above.
        self::create_entity_relationships_table();
        self::create_kg_health_history_table();

        // Security (SECURITY-MODULE.md's "Integrity Monitoring") needs its
        // own new table for sites upgrading in place too — same "outside
        // the version_compare gate, self-healing via CREATE TABLE IF NOT
        // EXISTS" reasoning as create_crawler_visits_table() above.
        self::create_file_baselines_table();

        // Accessibility (ACCESSIBILITY-MODULE.md's "Historical Tracking")
        // needs its own new table for sites upgrading in place too — same
        // "outside the version_compare gate, self-healing via CREATE TABLE
        // IF NOT EXISTS" reasoning as create_crawler_visits_table() above.
        self::create_accessibility_snapshots_table();

        // WooCommerce Intelligence (WOOCOMMERCE-INTELLIGENCE-MODULE.md's
        // "Store Trends") needs its own new table for sites upgrading in
        // place too — same "outside the version_compare gate, self-healing
        // via CREATE TABLE IF NOT EXISTS" reasoning as
        // create_crawler_visits_table() above.
        self::create_store_trends_snapshots_table();

        // "Improve Speed" Overview (Speed History + Real-time Monitoring)
        // needs both its new tables for sites upgrading in place too — same
        // "outside the version_compare gate, self-healing via CREATE TABLE
        // IF NOT EXISTS" reasoning as create_crawler_visits_table() above.
        self::create_performance_score_snapshots_table();
        self::create_performance_requests_table();

        // "Improve Speed" Overview's real Core Web Vitals RUM needs its own
        // new table for sites upgrading in place too — same "outside the
        // version_compare gate, self-healing via CREATE TABLE IF NOT
        // EXISTS" reasoning as create_crawler_visits_table() above.
        self::create_core_web_vitals_table();

        // "Improve Speed" › Slow Pages needs its own new table for sites
        // upgrading in place too — same "outside the version_compare gate,
        // self-healing via CREATE TABLE IF NOT EXISTS" reasoning as
        // create_crawler_visits_table() above.
        self::create_page_speed_table();

        // Automation Engine — Conditions & Retries (AUTOMATION-ENGINE-MODULE.md)
        // need two new columns on tables that already existed before this
        // version — same "outside the version_compare gate, self-healing"
        // reasoning as the create_*_table() calls above, just column_exists()-
        // guarded instead of relying on dbDelta()'s own CREATE TABLE IF NOT
        // EXISTS idempotency (see each method's own docblock).
        self::add_automations_conditions_column();
        self::add_automation_runs_retry_count_column();

        // AI Copilot's History tab needs to tell a real chat turn
        // (Controllers\Copilot.php/ContentAssistant.php) apart from every
        // other feature that also shares vulopilot_ai_history via the same
        // UsageTrackingProvider decorator (GEO scoring, schema generation,
        // content intelligence, …) — same "outside the version_compare
        // gate, self-healing" reasoning as the two calls above.
        self::add_ai_history_surface_column();

        // "Automations" tab redesign (AUTOMATION-ENGINE-MODULE.md) needs
        // two more columns on these same already-existing tables — same
        // outside-the-version-gate, self-healing reasoning as the pair
        // immediately above.
        self::add_automations_category_column();
        self::add_automation_runs_changes_made_column();

        // "Slow Pages" redesign needs 8 more columns on an already-existing
        // table — same outside-the-version-gate, self-healing reasoning as
        // the pair immediately above.
        self::add_page_speed_psi_detail_columns();

        // The Geo module (modules/Geo/Module.php) didn't exist before this
        // version either — a site upgrading in place needs it added to
        // its active-module list the same way a fresh install gets it via
        // VuloPilot::activate()'s add_option(), or its "Auto-regenerate on
        // publish" setting would silently do nothing (the module governs
        // that hook; GEO scanning itself and the llms.txt route are core
        // and unaffected either way). Deliberately OUTSIDE the
        // version_compare gate, same reasoning as the two migrations
        // above; self-limiting after the first run since it only adds
        // 'geo' when it isn't already present.
        self::seed_module_active( 'geo' );

        // The Seo module (modules/Seo/Module.php) is a stricter case than
        // Geo above: it's what now registers all 17 SEO scanner classes via
        // `vulopilot_scanner_sources` (they were removed from
        // ScannerRegistry::get_default_scanner_classes()'s hardcoded list).
        // A site upgrading in place that doesn't get 'seo' added here would
        // silently stop producing any new SEO findings the moment this
        // version's code runs — not just lose a convenience automation like
        // Geo's case. Same "deliberately outside the version_compare gate,
        // self-limiting after the first run" reasoning.
        self::seed_module_active( 'seo' );

        // Content Intelligence (CONTENT-INTELLIGENCE-MODULE.md) didn't
        // exist before this version either — same "sites upgrading in
        // place need it added the same way a fresh install gets it via
        // VuloPilot::activate()" reasoning as 'geo'/'seo' above. No new
        // table needed (readability findings reuse vulopilot_scan_findings,
        // Content Score is computed live), so this is the only migration
        // step this module needs.
        self::seed_module_active( 'content-intelligence' );

        // Brand Intelligence (BRAND-INTELLIGENCE-MODULE.md) — same
        // reasoning as 'content-intelligence' immediately above. No new
        // Free table needed either (Brand Score is computed live from
        // vulopilot_scan_findings the same way; only vulopilot-pro's own
        // Authority Trends history table is new, and that's created by
        // Pro's own migration path, not this one).
        self::seed_module_active( 'brand-intelligence' );

        // Entity Extraction (KNOWLEDGE-GRAPH-MODULE.md) — same reasoning as
        // 'content-intelligence'/'brand-intelligence' above. No new Free
        // table needed — entities are read live (transient-cached) from
        // existing users/products/terms/settings, never persisted; only
        // vulopilot-pro's own entity-relationships/health-history tables
        // are new, and those are created by Pro's own migration path.
        self::seed_module_active( 'entity-extraction' );

        // AI Copilot (modules/AiCopilot/Module.php) didn't exist before this
        // version either — same "sites upgrading in place need it added the
        // same way a fresh install gets it via VuloPilot::activate()"
        // reasoning as 'geo'/'seo' above. This one matters more than most:
        // Copilot.php's /copilot/chat permission check now requires this id
        // to be active, so skipping this seed would silently take AI Chat
        // away from every existing site the moment this version's code
        // runs. No new table needed (chat has never persisted anything of
        // its own), so this is the only migration step this module needs.
        self::seed_module_active( 'ai-copilot' );

        // Protect My Site's Malware/Firewall/Login Protection/Backups/
        // Recovery tiles need all three new tables for sites upgrading in
        // place too — same "outside the version_compare gate, self-healing
        // via CREATE TABLE IF NOT EXISTS" reasoning as
        // create_crawler_visits_table() above.
        self::create_login_attempts_table();
        self::create_firewall_blocks_table();
        self::create_backups_table();
    }

    /**
     * Adds one module id to the stored active-module list if it isn't
     * already present — shared by every "this module didn't exist before
     * version X, sites upgrading in place need it added the same way a
     * fresh install gets it via VuloPilot::activate()" migration step.
     *
     * @param string $module_id Module id to seed active, e.g. 'geo'/'seo'.
     * @return void
     */
    private static function seed_module_active( string $module_id ): void {
        $active_modules = get_option( Utill::ACTIVE_MODULES_DB_KEY, array() );

        if ( in_array( $module_id, $active_modules, true ) ) {
            return;
        }

        $active_modules[] = $module_id;
        update_option( Utill::ACTIVE_MODULES_DB_KEY, $active_modules );
    }

    /**
     * 1.1.0 (AutomationEngine, ARCHITECTURE.md's Prompt 12): `rule_id` was
     * originally `NOT NULL`, a foreign key to the *separate*,
     * still-unbuilt user-authored-custom-rules table (`vulopilot_rules`,
     * see RULE-ENGINE.md's "What's not here yet") — but AutomationEngine
     * binds an automation to one of the 19 code-defined RuleInterface
     * rules by string id (`trigger_config.rule_key`), not a row in that
     * table. Loosening `NOT NULL` to nullable is additive/non-destructive:
     * this column has never actually been populated by any released
     * version (Automations couldn't be created via REST until this
     * version), so there is no existing data this could conflict with.
     *
     * @return void
     */
    private function relax_automation_rule_id_to_nullable() {
        global $wpdb;

        $table = $wpdb->prefix . Utill::TABLES['automation'];

        $wpdb->query( "ALTER TABLE `{$table}` MODIFY `rule_id` bigint(20) unsigned DEFAULT NULL" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
    }

    /**
     * AUTOMATION-ENGINE-MODULE.md's "Conditions" — an extra, composable
     * filter (Contracts\Automation\ConditionInterface, vulopilot-pro's
     * ConditionRegistry) an automation can layer on top of its bound rule.
     * Deliberately outside do_migration()'s version_compare gate and
     * guarded by column_exists() rather than a raw unconditional ALTER
     * (unlike relax_automation_rule_id_to_nullable() above, ADD COLUMN
     * isn't naturally idempotent the way MODIFY is — a second run without
     * this guard would fatal with "Duplicate column name") — same
     * self-healing-for-already-migrated-sites reasoning as
     * create_entity_relationships_table() etc., just for an ALTER instead
     * of a CREATE TABLE IF NOT EXISTS.
     *
     * @return void
     */
    private static function add_automations_conditions_column() {
        global $wpdb;

        $table = $wpdb->prefix . Utill::TABLES['automation'];

        if ( self::column_exists( $table, 'conditions' ) ) {
            return;
        }

        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `conditions` longtext DEFAULT NULL AFTER `trigger_config`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
    }

    /**
     * AUTOMATION-ENGINE-MODULE.md's "Retries" — how many times
     * vulopilot-pro's RetryScheduler has re-run this run's failed actions,
     * capped at the `automation_max_retries` setting. Same
     * outside-the-version-gate, column_exists()-guarded shape as
     * add_automations_conditions_column() above.
     *
     * @return void
     */
    private static function add_automation_runs_retry_count_column() {
        global $wpdb;

        $table = $wpdb->prefix . Utill::TABLES['automation_run'];

        if ( self::column_exists( $table, 'retry_count' ) ) {
            return;
        }

        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `retry_count` tinyint(3) unsigned NOT NULL DEFAULT 0 AFTER `result_log`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
    }

    /**
     * AI Copilot History's "Conversations" filter — every real AI call
     * (chat, GEO scoring, schema generation, content intelligence, …)
     * writes to `vulopilot_ai_history` through the same shared
     * `UsageTrackingProvider` decorator, so nothing previously
     * distinguished a real chat turn from any other feature's call.
     * `AIRequest::get_surface()`/`SafeRequestSender::send()`'s new
     * `$surface` param populate this column going forward
     * (`Controllers\Copilot.php`/`ContentAssistant.php` pass
     * `'copilot_chat'`/`'content_assistant_chat'`; other callers pass
     * their own real feature label). Same outside-the-version-gate,
     * `column_exists()`-guarded shape as
     * `add_automations_conditions_column()` above.
     *
     * @return void
     */
    private static function add_ai_history_surface_column() {
        global $wpdb;

        $table = $wpdb->prefix . Utill::TABLES['ai_history'];

        if ( self::column_exists( $table, 'surface' ) ) {
            return;
        }

        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `surface` varchar(30) DEFAULT NULL AFTER `object_id`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
    }

    /**
     * "Automations" tab (AUTOMATION-ENGINE-MODULE.md) — a real, user-chosen
     * grouping (`monitoring`/`security`/`content`/`commerce`/`reporting`/
     * `custom`, validated against the same fixed set
     * AutomationsRest::CATEGORY_OPTIONS enforces) for the table's own type
     * badge — distinct from `trigger_type` (schedule vs. event
     * mechanics) and from a Finding's `category` (what a *scanner* found,
     * not what an *automation* is for). Same outside-the-version-gate,
     * column_exists()-guarded shape as add_automations_conditions_column()
     * above. Defaults every pre-existing row to 'monitoring' (the DEFAULT
     * clause itself, applied retroactively by the ALTER) since every
     * automation this codebase could create before this column existed was
     * a scan-and-react workflow — a real, honest default, not a guess.
     *
     * @return void
     */
    private static function add_automations_category_column() {
        global $wpdb;

        $table = $wpdb->prefix . Utill::TABLES['automation'];

        if ( self::column_exists( $table, 'category' ) ) {
            return;
        }

        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `category` varchar(30) NOT NULL DEFAULT 'monitoring' AFTER `rule_id`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
        $wpdb->query( "ALTER TABLE `{$table}` ADD KEY `idx_category` (`category`)" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
    }

    /**
     * "Automations" tab's "Actions this month" stat tile — how many of a
     * run's already-counted `actions_executed` were actions that actually
     * changed something on the site (Contracts\Automation\ActionInterface::changes_site_state()),
     * as opposed to a notification-only action (send-email/
     * create-notification) that ran successfully but changed nothing.
     * `actions_executed` alone can't answer "did VuloPilot change my site
     * this month, or just notify me" — this column can. Same
     * outside-the-version-gate, column_exists()-guarded shape as
     * add_automation_runs_retry_count_column() above.
     *
     * @return void
     */
    private static function add_automation_runs_changes_made_column() {
        global $wpdb;

        $table = $wpdb->prefix . Utill::TABLES['automation_run'];

        if ( self::column_exists( $table, 'changes_made' ) ) {
            return;
        }

        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `changes_made` int(10) unsigned NOT NULL DEFAULT 0 AFTER `actions_failed`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
    }

    /**
     * "Slow Pages" redesign — real PSI-sourced page weight/request-count/
     * Core Web Vitals field-data columns on a table that already existed
     * before this version. Same outside-the-version-gate, column_exists()-
     * guarded shape as the pair above; see create_page_speed_table()'s own
     * docblock for what each column really holds and why every one of them
     * stays NULL without a configured PSI key.
     *
     * @return void
     */
    private static function add_page_speed_psi_detail_columns() {
        global $wpdb;

        $table = $wpdb->prefix . Utill::TABLES['page_speed'];

        if ( self::column_exists( $table, 'page_size_bytes' ) ) {
            return;
        }

        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `page_size_bytes` int(10) unsigned DEFAULT NULL AFTER `main_issue`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `requests_count` smallint(5) unsigned DEFAULT NULL AFTER `page_size_bytes`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `lcp_ms` int(10) unsigned DEFAULT NULL AFTER `requests_count`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `lcp_rating` varchar(20) DEFAULT NULL AFTER `lcp_ms`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `inp_ms` int(10) unsigned DEFAULT NULL AFTER `lcp_rating`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `inp_rating` varchar(20) DEFAULT NULL AFTER `inp_ms`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `cls_thousandths` smallint(5) unsigned DEFAULT NULL AFTER `inp_rating`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
        $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `cls_rating` varchar(20) DEFAULT NULL AFTER `cls_thousandths`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
    }

    /**
     * Shared by both column-adding migrations above — dbDelta() has no
     * "ADD COLUMN IF NOT EXISTS" equivalent for a plain ALTER, unlike its
     * own CREATE TABLE IF NOT EXISTS handling every create_*_table() method
     * here relies on.
     *
     * @param string $table  Fully-prefixed table name.
     * @param string $column Column name to check for.
     * @return bool
     */
    private static function column_exists( string $table, string $column ): bool {
        global $wpdb;

        return (bool) $wpdb->get_var(
            $wpdb->prepare(
                'SHOW COLUMNS FROM `' . $table . '` LIKE %s', // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- $table is our own prefixed constant, not request input.
                $column
            )
        );
    }
}
