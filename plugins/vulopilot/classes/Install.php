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
 * Creates every VuloPilot custom table, dbDelta()-based like
 * VuloLabs\Install. VuloPilot resets its baseline to 1.0.0 here — this
 * plugin has never actually shipped to a real site under any earlier
 * version, so there is no live "upgrade from an older release" case to
 * support. The incremental, version-gated do_migration() this class used
 * to carry (real ADD COLUMN/CREATE TABLE steps layered on top of an
 * already-installed 1.0.0/1.1.0 site) has been removed for that reason —
 * every table and column it used to add on top now ships directly in
 * create_database_tables() below instead, and every module it used to
 * seed active on top now ships directly in VuloPilot::activate()'s own
 * add_option() call. A future schema change on top of a real 1.0.0
 * release will need its own do_migration()-shaped mechanism again; this
 * is a reset, not a permanent removal of the concept. Schema design and
 * the rationale for every table/index below is documented in
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
     * Runs the database install process. No more branching on a stored
     * previous version — see this class's own docblock for why: every
     * table create_database_tables() creates is guarded by dbDelta()'s
     * own `CREATE TABLE IF NOT EXISTS`, so calling it unconditionally is
     * exactly as safe on a site that already has every table as it is on
     * a genuinely fresh one, and simpler than tracking a version to
     * decide which path to take.
     *
     * @return void
     */
    public function run_migration() {
        $this->create_database_tables();

        update_option( Utill::VULOPILOT_OTHER_SETTINGS['plugin_db_version'], VULOPILOT_PLUGIN_VERSION );
        do_action( 'vulopilot_after_installed' );
    }

    /**
     * Creates every VuloPilot custom table (schema version 1.0.0).
     *
     * @return void
     */
    private static function create_database_tables() {
        global $wpdb;

        $collate = $wpdb->get_charset_collate();

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        // No "IF NOT EXISTS" here (unlike the table below) — dbDelta()
        // misparses the table name off of "IF" when that clause is present
        // on an already-existing table, silently skipping the ALTER path
        // that would otherwise add `scanned_objects` for existing installs.
        // Same bug, same fix as ai_history's own CREATE (Install.php's own
        // history there).
        $sql_scans = "CREATE TABLE `{$wpdb->prefix}" . Utill::TABLES['scan'] . "` (
            `id`               bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `scanner_id`       varchar(100) NOT NULL,
            `scanner_tier`     varchar(20) NOT NULL DEFAULT 'free',
            `status`           varchar(20) NOT NULL DEFAULT 'queued',
            `trigger_type`     varchar(20) NOT NULL DEFAULT 'manual',
            `triggered_by`     bigint(20) unsigned DEFAULT NULL,
            `started_at`       datetime DEFAULT NULL,
            `finished_at`      datetime DEFAULT NULL,
            `duration_ms`      int(10) unsigned DEFAULT NULL,
            `summary`          longtext DEFAULT NULL,
            `scanned_objects`  longtext DEFAULT NULL,
            `error_message`    text DEFAULT NULL,
            `created_at`       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

        // No "IF NOT EXISTS" here (unlike every other CREATE TABLE in this
        // file) — dbDelta() itself already only ever issues a CREATE for a
        // table that doesn't exist yet, and its own column-diff/ALTER path
        // for a table that DOES already exist misparses the table name
        // when "IF NOT EXISTS" is present, silently failing to detect (and
        // add) new columns like `prompt_excerpt` below on any site that
        // already has this table — confirmed via a direct dbDelta() call:
        // with "IF NOT EXISTS" it reports "Created table IF" (parsed "IF"
        // as the table name) and adds nothing; without it, it correctly
        // reports "Added column ...prompt_excerpt". This is a real,
        // wider-reaching dbDelta limitation (WordPress core's own docs warn
        // against combining dbDelta with "IF NOT EXISTS") that likely
        // affects every other table below too — out of scope to fix
        // wholesale here, but this table needed it for this change to
        // actually apply on an upgrade, not just a fresh install.
        $sql_ai_history = "CREATE TABLE `{$wpdb->prefix}" . Utill::TABLES['ai_history'] . "` (
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
            `prompt_excerpt`    text DEFAULT NULL,
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

        // No "IF NOT EXISTS" here — same dbDelta()/"IF NOT EXISTS" ALTER-path
        // bug documented above ai_history's own CREATE — needed so
        // `approval_method` actually gets added on an upgrade, not just a
        // fresh install.
        $sql_ai_action_runs = "CREATE TABLE `{$wpdb->prefix}" . Utill::TABLES['ai_action_run'] . "` (
            `id`              bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `action_id`       varchar(100) NOT NULL,
            `status`          varchar(20) NOT NULL DEFAULT 'pending_approval',
            `object_type`     varchar(50) DEFAULT NULL,
            `object_ref`      varchar(255) DEFAULT NULL,
            `input`           longtext DEFAULT NULL,
            `output`          longtext DEFAULT NULL,
            `preview`         longtext DEFAULT NULL,
            `snapshot`        longtext DEFAULT NULL,
            `error_message`   text DEFAULT NULL,
            `requested_by`    bigint(20) unsigned DEFAULT NULL,
            `approved_by`     bigint(20) unsigned DEFAULT NULL,
            `approval_method` varchar(20) NOT NULL DEFAULT 'manual',
            `created_at`      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `approved_at`     datetime DEFAULT NULL,
            `executed_at`     datetime DEFAULT NULL,
            `rolled_back_at`  datetime DEFAULT NULL,
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
     * Creates `vulopilot_redirects` and `vulopilot_not_found_logs` — own
     * method, same shape as create_crawler_visits_table() below.
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
     * `vulopilot_redirects.last_accessed_at` is deliberately its own
     * column, not a reuse of `updated_at` — `updated_at` bumps on ANY row
     * change (editing the target URL, toggling active/inactive from
     * RedirectsTab.tsx), which would make "Last accessed" lie about a row
     * a visitor never actually hit. Only
     * RedirectRepository::increment_hit_count() — called from
     * Services\RedirectManager::maybe_apply_redirect(), the one place a
     * real visitor request actually matched this row — ever writes it, so
     * it stays null until a real hit happens instead of defaulting to the
     * row's creation time.
     *
     * $sql_redirects deliberately does NOT use `CREATE TABLE IF NOT
     * EXISTS` (every other statement in this class still does, unchanged
     * here) — dbDelta() finds the table name via `preg_match( '|CREATE
     * TABLE ([^ ]*)|', ... )`, so with "IF NOT EXISTS" present it captures
     * the literal word "IF" as the table name instead. On a fresh install
     * that's harmless (dbDelta just runs the CREATE verbatim, and MySQL's
     * own IF NOT EXISTS makes it a no-op if something with that name
     * already raced it into existence), but on any site that already has
     * this table, dbDelta's real job — diffing the live column set against
     * this SQL and emitting `ALTER TABLE ADD COLUMN` for whatever's
     * missing — never runs, because it's diffing against nonexistent
     * table "IF" instead of the real one. `last_accessed_at` above would
     * silently never reach an already-installed site's table without this
     * fix. Confirmed live: with "IF NOT EXISTS" still in place, dbDelta()
     * reported `array( 'IF' => 'Created table IF' )` on this exact SQL
     * against a database that already had the real table.
     *
     * @return void
     */
    private static function create_redirect_tables() {
        global $wpdb;

        if ( ! function_exists( 'dbDelta' ) ) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        }

        $collate = $wpdb->get_charset_collate();

        $sql_redirects = "CREATE TABLE `{$wpdb->prefix}" . Utill::TABLES['redirect'] . "` (
            `id`            bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `source_path`   varchar(255) NOT NULL,
            `target_url`    varchar(255) NOT NULL,
            `redirect_type` smallint(3) unsigned NOT NULL DEFAULT 301,
            `hit_count`     int(10) unsigned NOT NULL DEFAULT 0,
            `is_active`     tinyint(1) NOT NULL DEFAULT 1,
            `created_by`    bigint(20) unsigned DEFAULT NULL,
            `created_at`    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at`    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `last_accessed_at` datetime DEFAULT NULL,
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
     * sharing one mutable daily row is the wrong move here). Own method,
     * same shape as create_redirect_tables() above.
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
     * request. Own method, same shape as create_redirect_tables() above.
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
     * float columns. Own method, same shape as create_redirect_tables()
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
     * posture as `mobile_score`/`desktop_score`. Own method, same shape as
     * create_core_web_vitals_table() above.
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
     * Creates `vulopilot_crawler_visits` — its own method, same shape as
     * every other create_*_table() method below create_database_tables().
     * No IP address or user column, ever — readme.txt's own FAQ promises
     * AI Crawler Traffic Monitoring "does not track human visitors, IP
     * addresses, or personal data," enforced by the schema itself, not
     * just application code.
     *
     * @return void
     */
    private static function create_crawler_visits_table() {
        global $wpdb;

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
     * Creates `vulopilot_indexnow_log` — its own method, same shape as
     * create_crawler_visits_table()/create_redirect_tables() above. One
     * row per real IndexNow API submission (manual or auto-submitted),
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
     * Creates `vulopilot_geo_visibility_history` — own method, same shape
     * as create_indexnow_log_table() above. One row per calendar day
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
}
