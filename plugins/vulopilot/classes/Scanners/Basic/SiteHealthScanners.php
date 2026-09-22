<?php
/**
 * Every class in this file used to be its own file under classes/Scanners/Basic/
 * (same names, docblocks, and behavior) - merged into one file to reduce
 * classes/'s file count, per direct instruction. Autoloading does not rely on
 * each class's own file matching its own name for this: composer.json's
 * autoload.classmap entry (alongside the existing psr-4 one) makes Composer
 * tokenize every file under classes/ and modules/ and map each class it finds
 * to its real file, however many classes share one file - run
 * `composer dump-autoload` (no `-o`/`--optimize-autoloader` needed) after any
 * further file merge/split here.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\Contracts\Scanner\ScannerInterface;
use VuloPilot\Repositories\BackupRepository;
use VuloPilot\Utill;
use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Base class for every free-tier scanner under Scanners/Basic/.
 *
 * Every scanner in this namespace is, by definition, free-tier - that's
 * what "Basic" means here (ARCHITECTURE.md) - so get_tier() is genuinely
 * shared behavior, not per-scanner boilerplate being prematurely
 * abstracted. get_id()/get_label()/get_category()/scan() stay abstract
 * since those are what actually differ between scanners.
 *
 * @class       AbstractBasicScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class AbstractBasicScanner implements ScannerInterface {

    /**
     * @inheritDoc
     */
    public function get_tier(): string {
        return 'free';
    }

    /**
     * @inheritDoc
     */
    abstract public function get_id(): string;

    /**
     * @inheritDoc
     */
    abstract public function get_label(): string;

    /**
     * @inheritDoc
     */
    abstract public function get_category(): string;

    /**
     * @inheritDoc
     */
    abstract public function scan(): array;
}

/**
 * Turns Services\BackupManager/BackupScheduler's own real backup-run log
 * (`vulopilot_backups`) into a real Finding when automatic backups are
 * enabled but something's actually wrong - the most recent run failed, or
 * nothing has completed in over 2x the configured `backup_frequency`
 * interval. Zero findings when healthy, or - deliberately - when automatic
 * backups simply aren't turned on at all (no nagging about an opt-in
 * feature nobody enabled; a manual-only backup user isn't "unhealthy").
 *
 * @class       BackupHealthScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BackupHealthScanner extends AbstractBasicScanner {

    /**
     * Real days-per-cadence, matching Services\BackupScheduler's own
     * `wp_schedule_event()` interval choices.
     *
     * @var array<string, int>
     */
    private const FREQUENCY_DAYS = array(
        'daily'  => 1,
        'weekly' => 7,
    );

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'backup-health';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Backup Health', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'security';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_automatic_backups'] ) ) {
            return $findings;
        }

        $repository = new BackupRepository();
        $latest     = $repository->get_latest();

        if ( $latest && 'failed' === $latest['status'] ) {
            $findings[] = new Finding(
                __( 'Your most recent automatic backup failed', 'vulopilot' ),
                Severity::MEDIUM,
                $this->get_category(),
                ! empty( $latest['error_message'] )
                    ? sprintf(
                        /* translators: %s is the real error message the failed backup recorded. */
                        __( 'Real error from the last backup run: %s', 'vulopilot' ),
                        $latest['error_message']
                    )
                    : __( 'The last automatic backup run did not complete successfully. Check the Backups tab and try running one manually.', 'vulopilot' ),
                'backup',
                (string) $latest['id']
            );

            return $findings;
        }

        $frequency      = (string) ( $settings['backup_frequency'] ?? 'disabled' );
        $frequency_days = self::FREQUENCY_DAYS[ $frequency ] ?? null;

        if ( null === $frequency_days ) {
            return $findings;
        }

        $latest_completed = $repository->get_latest_completed();
        $stale_threshold  = time() - ( $frequency_days * 2 * DAY_IN_SECONDS );

        if ( ! $latest_completed ) {
            $findings[] = new Finding(
                __( 'No automatic backup has completed yet', 'vulopilot' ),
                Severity::MEDIUM,
                $this->get_category(),
                __( 'Automatic backups are enabled, but none has finished successfully yet. If this persists, check the Backups tab for the real error.', 'vulopilot' )
            );

            return $findings;
        }

        $finished_timestamp = strtotime( (string) $latest_completed['finished_at'] );

        if ( $finished_timestamp && $finished_timestamp < $stale_threshold ) {
            $findings[] = new Finding(
                __( 'Your automatic backups are overdue', 'vulopilot' ),
                Severity::MEDIUM,
                $this->get_category(),
                sprintf(
                    /* translators: %s is the real date/time of the last successful backup. */
                    __( 'The last successful backup completed on %s - longer ago than your configured schedule allows for. Check the Backups tab.', 'vulopilot' ),
                    get_date_from_gmt( $latest_completed['finished_at'], get_option( 'date_format' ) . ' ' . get_option( 'time_format' ) )
                ),
                'backup',
                (string) $latest_completed['id']
            );
        }

        return $findings;
    }
}

/**
 * Flags scheduled cron events that are overdue - a hook scheduled for the
 * past that still hasn't run means WP-Cron isn't actually firing (no
 * traffic hitting the site, DISABLE_WP_CRON without a real system cron
 * replacing it, a fatal error in another hook blocking the request). This
 * mirrors the check behind WordPress core's own Site Health "scheduled
 * event" test, using the same _get_cron_array() core already maintains.
 *
 * @class       CronScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CronScanner extends AbstractBasicScanner {

    /**
     * How late (in seconds) an event has to be before it's flagged.
     * One hour comfortably exceeds normal scheduling jitter.
     */
    private const OVERDUE_THRESHOLD_SECONDS = HOUR_IN_SECONDS;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'cron';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Cron', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'cron';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings   = array();
        $cron_array = _get_cron_array();

        if ( false === $cron_array ) {
            return $findings;
        }

        $now = time();

        foreach ( $cron_array as $timestamp => $hooks ) {
            if ( $timestamp >= $now - self::OVERDUE_THRESHOLD_SECONDS ) {
                continue;
            }

            foreach ( array_keys( $hooks ) as $hook_name ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the cron hook name. */
                        __( 'Overdue scheduled event: %s', 'vulopilot' ),
                        $hook_name
                    ),
                    Severity::MEDIUM,
                    $this->get_category(),
                    sprintf(
                        /* translators: %s is a human-readable time difference, e.g. "2 hours". */
                        __( 'This event was due %s ago and has not run - WP-Cron may not be firing.', 'vulopilot' ),
                        human_time_diff( $timestamp, $now )
                    ),
                    'cron_hook',
                    $hook_name
                );
            }
        }

        return $findings;
    }
}

/**
 * Flags database bloat relevant to the "Performance" page specifically:
 * expired transients (rows WordPress itself considers stale, safe to
 * delete) plus revisions beyond the most recent 5 per post. Distinct from
 * DatabaseScanner (category 'database', revisions-only, feeds the Health
 * category instead) - this one is scoped to category 'performance' and
 * combines both signals into a single "Database Cleanup" tile/finding, and
 * its threshold/counts are what PerformanceActions' `database-cleanup`
 * quick action actually deletes.
 *
 * @class       DatabaseCleanupScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class DatabaseCleanupScanner extends AbstractBasicScanner {

    /**
     * How many of the most recent revisions to keep per post before the
     * rest count as bloat.
     */
    const KEEP_REVISIONS_PER_POST = 5;

    /**
     * Combined (expired transients + excess revisions) count above which
     * this is worth flagging.
     */
    private const COMBINED_THRESHOLD = 50;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'database-cleanup';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Database Cleanup', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $expired_transients = self::count_expired_transients();
        $excess_revisions   = self::count_excess_revisions();
        $combined           = $expired_transients + $excess_revisions;

        if ( $combined <= self::COMBINED_THRESHOLD ) {
            return array();
        }

        return array(
            new Finding(
                sprintf(
                    /* translators: 1: number of expired transients, 2: number of excess post revisions. */
                    __( '%1$d expired transients and %2$d excess post revisions', 'vulopilot' ),
                    $expired_transients,
                    $excess_revisions
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'Expired transients and old post revisions accumulate in the database over time, slowing down queries. Use the "Database Cleanup" quick action to remove them.', 'vulopilot' ),
                'table',
                'options',
                array(
                    'expired_transients' => $expired_transients,
                    'excess_revisions'   => $excess_revisions,
                    'recommended_fix'    => array(
                        __( 'Delete expired transients with a database-cleanup plugin (e.g. WP-Optimize, Advanced Database Cleaner).', 'vulopilot' ),
                        __( 'Limit future post revisions by adding define(\'WP_POST_REVISIONS\', 5); to wp-config.php.', 'vulopilot' ),
                        __( 'Run a one-time cleanup to remove existing excess revisions.', 'vulopilot' ),
                        __( 'Schedule periodic database optimization to keep this from building up again.', 'vulopilot' ),
                    ),
                ),
                'db-cleanup'
            ),
        );
    }

    /**
     * @return int
     */
    public static function count_expired_transients(): int {
        global $wpdb;

        return (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE %s AND option_value < %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $wpdb->esc_like( '_transient_timeout_' ) . '%',
                time()
            )
        );
    }

    /**
     * Counts revisions beyond the most recent KEEP_REVISIONS_PER_POST for
     * each post that has any - a single aggregate query rather than
     * looping every post in PHP.
     *
     * @return int
     */
    public static function count_excess_revisions(): int {
        global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $per_post_counts = $wpdb->get_col(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'revision' GROUP BY post_parent"
        );

        $excess = 0;

        foreach ( $per_post_counts as $count ) {
            $excess += max( 0, (int) $count - self::KEEP_REVISIONS_PER_POST );
        }

        return $excess;
    }
}

/**
 * Flags excessive post-revision buildup - a classic, well-understood
 * WordPress database bloat source (every edit of every post/page keeps a
 * full revision row by default) that slows down post-list queries and
 * backups as it grows unbounded.
 *
 * @class       DatabaseScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class DatabaseScanner extends AbstractBasicScanner {

    /**
     * Revision count above which this is worth flagging.
     */
    private const REVISION_COUNT_THRESHOLD = 500;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'database';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Database', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'database';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        global $wpdb;

        $findings = array();

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $revision_count = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'revision'"
        );

        if ( $revision_count > self::REVISION_COUNT_THRESHOLD ) {
            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the number of post revisions, formatted with thousands separators. */
                    __( '%s post revisions stored in the database', 'vulopilot' ),
                    number_format_i18n( $revision_count )
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'A large number of stored revisions increases database size and can slow down post-list and search queries.', 'vulopilot' ),
                'table',
                $wpdb->posts,
                array( 'revision_count' => $revision_count ),
                'post-revisions-count'
            );
        }

        return $findings;
    }
}

/**
 * Flags a high total active-plugin count - a simple, defensible, O(1)
 * heuristic (get_option('active_plugins') is already loaded on every
 * request) rather than measuring each active plugin's on-disk size or
 * asset count, which would mean walking every plugin's directory on
 * every scan and would violate the bounded-work discipline every other
 * scanner here follows (performance.md).
 *
 * @class       HeavyPluginsScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class HeavyPluginsScanner extends AbstractBasicScanner {

    /**
     * Active plugin count above which this is worth flagging.
     */
    private const ACTIVE_PLUGIN_THRESHOLD = 40;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'heavy-plugins';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Heavy Plugins', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $active_plugins = (array) get_option( 'active_plugins', array() );
        $plugin_count   = count( $active_plugins );

        if ( $plugin_count <= self::ACTIVE_PLUGIN_THRESHOLD ) {
            return array();
        }

        return array(
            new Finding(
                sprintf(
                    /* translators: %d is the number of active plugins. */
                    __( '%d active plugins', 'vulopilot' ),
                    $plugin_count
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'A large number of active plugins increases the odds of conflicts and can slow down every admin and frontend request.', 'vulopilot' ),
                'table',
                'active_plugins',
                array(
                    'plugin_count'    => $plugin_count,
                    'recommended_fix' => array(
                        __( 'Audit your active plugins and deactivate any that are unused or redundant.', 'vulopilot' ),
                        __( 'Look for plugins that duplicate functionality (e.g. two SEO plugins) and keep only one.', 'vulopilot' ),
                        __( 'Check each plugin\'s own performance impact with Query Monitor before deciding to keep it.', 'vulopilot' ),
                        __( 'Consider a multi-feature plugin instead of several single-purpose ones where it makes sense.', 'vulopilot' ),
                    ),
                ),
                'active-plugin-count'
            ),
        );
    }
}

/**
 * Tails WordPress's own debug.log (when WP_DEBUG_LOG is enabled) for
 * recent PHP warnings/notices/deprecated/fatal messages, deduped by
 * message text. This scanner has no way to detect what isn't being
 * logged - if WP_DEBUG_LOG is off, it returns no findings rather than
 * guessing; that's a correct, honest "nothing to report" result, not a
 * failure. Bounded to the last MAX_BYTES_READ of the file (never reads
 * the whole log) and the last MAX_LINES_CHECKED lines within that, same
 * bounded-work discipline every other scanner here follows.
 *
 * @class       PhpWarningScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PhpWarningScanner extends AbstractBasicScanner {

    private const MAX_BYTES_READ    = 204800; // 200KB from the end of the file.
    private const MAX_LINES_CHECKED = 500;
    private const MAX_FINDINGS      = 20;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'php-warnings';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'PHP Warning Detection', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'php-warnings';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $log_path = $this->get_debug_log_path();

        if ( null === $log_path || ! is_readable( $log_path ) ) {
            return array();
        }

        $lines    = $this->tail_log( $log_path );
        $messages = array();

        foreach ( $lines as $line ) {
            $parsed = $this->parse_log_line( $line );

            if ( null === $parsed ) {
                continue;
            }

            // Dedupe by message text - the same warning firing on every
            // page load would otherwise flood findings with near-identical
            // rows.
            $messages[ $parsed['message'] ] = $parsed;
        }

        $findings = array();

        foreach ( array_slice( $messages, 0, self::MAX_FINDINGS ) as $entry ) {
            $findings[] = new Finding(
                sprintf(
                    /* translators: 1: PHP error level (Warning, Notice, etc.), 2: the error message. */
                    __( 'PHP %1$s: %2$s', 'vulopilot' ),
                    $entry['level'],
                    $entry['message']
                ),
                $this->severity_for_level( $entry['level'] ),
                $this->get_category(),
                __( 'Found in this site\'s own debug.log. Recurring warnings can indicate a plugin/theme compatibility issue.', 'vulopilot' ),
                null,
                null,
                array( 'level' => $entry['level'] )
            );
        }

        return $findings;
    }

    /**
     * Resolves WP_DEBUG_LOG's effective log file path - it's either a
     * boolean (defaulting to WP_CONTENT_DIR . '/debug.log') or a custom
     * path string.
     *
     * @return string|null
     */
    private function get_debug_log_path(): ?string {
        if ( ! defined( 'WP_DEBUG_LOG' ) || ! WP_DEBUG_LOG ) {
            return null;
        }

        if ( is_string( WP_DEBUG_LOG ) ) {
            return WP_DEBUG_LOG;
        }

        return WP_CONTENT_DIR . '/debug.log';
    }

    /**
     * Reads the last MAX_BYTES_READ bytes of the log file and returns up
     * to MAX_LINES_CHECKED of its most recent lines.
     *
     * @param string $log_path Absolute path to the debug log.
     * @return string[]
     */
    private function tail_log( string $log_path ): array {
        $file_size   = filesize( $log_path );
        $read_length = min( $file_size, self::MAX_BYTES_READ );

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
        $handle = fopen( $log_path, 'r' );

        if ( false === $handle ) {
            return array();
        }

        fseek( $handle, -$read_length, SEEK_END );
        $contents = fread( $handle, $read_length ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
        fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

        if ( false === $contents ) {
            return array();
        }

        $lines = explode( "\n", $contents );

        return array_slice( $lines, -self::MAX_LINES_CHECKED );
    }

    /**
     * Parses one debug.log line into a level/message pair. WordPress's
     * own format is "[date] PHP Warning:  message in file on line N".
     *
     * @param string $line Raw log line.
     * @return array{level: string, message: string}|null
     */
    private function parse_log_line( string $line ): ?array {
        if ( ! preg_match( '/PHP (Warning|Notice|Deprecated|Fatal error|Parse error):\s*(.+?)\s+in\s+\S+\s+on line \d+/', $line, $matches ) ) {
            return null;
        }

        return array(
            'level'   => $matches[1],
            'message' => $matches[2],
        );
    }

    /**
     * @param string $level PHP error level as it appears in debug.log.
     * @return string One of Severity's constants.
     */
    private function severity_for_level( string $level ): string {
        switch ( $level ) {
            case 'Fatal error':
            case 'Parse error':
                return Severity::CRITICAL;
            case 'Warning':
                return Severity::MEDIUM;
            default:
                return Severity::LOW;
        }
    }
}

/**
 * Flags plugins that are installed but not active. A dormant plugin still
 * carries its full code (and any known vulnerabilities in it) on disk and
 * is easy to lose track of - it just isn't loaded on every request, which
 * is a smaller, different concern from an active-but-outdated plugin
 * (that's UpdatesScanner's job).
 *
 * @class       PluginsScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PluginsScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'plugins';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Plugins', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'plugins';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $findings       = array();
        $all_plugins    = get_plugins();
        $active_plugins = (array) get_option( 'active_plugins', array() );

        foreach ( $all_plugins as $plugin_file => $plugin_data ) {
            if ( in_array( $plugin_file, $active_plugins, true ) ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the plugin name. */
                    __( 'Inactive plugin installed: %s', 'vulopilot' ),
                    $plugin_data['Name']
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'Inactive plugins still occupy disk space and can carry known vulnerabilities. Remove plugins you no longer use.', 'vulopilot' ),
                'plugin',
                $plugin_file
            );
        }

        return $findings;
    }
}

/**
 * Gives a per-post scanner a one-line way to record every post it actually
 * considered during scan() - call mark_post_scanned() inside the loop,
 * before any `continue`, so a post that turned out clean is recorded the
 * same as one that produced a Finding. Pairs with
 * Contracts\Scanner\TracksScannedObjectsInterface, which a scanner using
 * this trait should also `implements`.
 *
 * @class       ScannedPostsTrait trait
 * @version     1.0.0
 * @author      VuloLabs
 */
trait ScannedPostsTrait {

    /**
     * @var int[]
     */
    private array $scanned_post_ids = array();

    /**
     * @param int $post_id Post/page ID this scan run considered.
     * @return void
     */
    protected function mark_post_scanned( int $post_id ): void {
        $this->scanned_post_ids[] = $post_id;
    }

    /**
     * @inheritDoc
     */
    public function get_scanned_post_ids(): array {
        return $this->scanned_post_ids;
    }
}

/**
 * Same `WP_Site_Health`-wrapping approach WordPressHealthScanner uses,
 * scoped to the 2 tests that are actually about the hosting environment
 * rather than WordPress itself - PHP version and the SQL server version -
 * so "Server" and "WordPress" stay two genuinely distinct categories
 * rather than one grab-bag. See WordPressHealthScanner's own docblock for
 * the full "wrap core, don't reinvent" / status-mapping reasoning, shared
 * here rather than abstracted into a common base class - two ~15-line
 * private methods duplicated once is simpler than a new shared class for
 * two callers, same restraint every other scanner pair in this codebase
 * already shows.
 *
 * @class       ServerHealthScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ServerHealthScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'server-health';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Server', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'server';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $this->load_dependencies();

        $health   = \WP_Site_Health::get_instance();
        $findings = array();

        foreach ( array( 'get_test_php_version', 'get_test_sql_server' ) as $test_method ) {
            if ( ! method_exists( $health, $test_method ) ) {
                continue;
            }

            $finding = $this->finding_from_test_result( $health->$test_method() );

            if ( $finding ) {
                $findings[] = $finding;
            }
        }

        return $findings;
    }

    /**
     * `WP_Site_Health` itself is only autoloaded in wp-admin - but
     * `get_test_php_version()` also calls `wp_check_php_version()`, which
     * lives in wp-admin/includes/misc.php, not autoloaded outside
     * wp-admin either. A gap that only shows up when this scanner runs
     * from a REST request (this plugin's real runtime context), not
     * wp-admin or WP-CLI (both happen to already have misc.php loaded,
     * masking the gap in manual testing).
     *
     * @return void
     */
    private function load_dependencies(): void {
        if ( ! class_exists( '\WP_Site_Health' ) ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-site-health.php';
        }

        if ( ! function_exists( 'wp_check_php_version' ) ) {
            require_once ABSPATH . 'wp-admin/includes/misc.php';
        }
    }

    /**
     * @param array $result A `WP_Site_Health::get_test_*()` return value.
     * @return Finding|null Null when the test's own status is 'good'.
     */
    private function finding_from_test_result( array $result ): ?Finding {
        $status = $result['status'] ?? 'good';

        if ( 'good' === $status ) {
            return null;
        }

        $description = (string) ( $result['description'] ?? '' );
        $paragraphs  = $this->split_into_paragraphs( $description );

        return new Finding(
            wp_strip_all_tags( (string) ( $result['label'] ?? __( 'Server health check', 'vulopilot' ) ) ),
            'critical' === $status ? Severity::HIGH : Severity::MEDIUM,
            $this->get_category(),
            wp_strip_all_tags( $description ),
            'site_health_test',
            (string) ( $result['test'] ?? '' ),
            count( $paragraphs ) >= 2
                ? array(
                    'why_it_matters' => $paragraphs[0],
                    'what_happened'  => implode( ' ', array_slice( $paragraphs, 1 ) ),
                )
                : array()
        );
    }

    /**
     * Same real paragraph-recovery (and same `<br>`-within-a-paragraph
     * handling) `WordPressHealthScanner`'s own `split_into_paragraphs()`
     * documents - duplicated here rather than shared, same restraint this
     * class's own top docblock already explains for
     * `finding_from_test_result()` itself.
     *
     * @param string $html_description Raw HTML `description` from a `WP_Site_Health` test result.
     * @return array<int, string> Plain-text paragraphs, in order, empty ones dropped.
     */
    private function split_into_paragraphs( string $html_description ): array {
        $chunks = preg_split( '/<\/p>\s*/i', $html_description ) ?: array();

        return array_values(
            array_filter(
                array_map(
                    static fn( string $chunk ): string => trim(
                        wp_strip_all_tags( preg_replace( '/<br\s*\/?>/i', ' - ', $chunk ) ?? $chunk )
                    ),
                    $chunks
                ),
                static fn( string $paragraph ): bool => '' !== $paragraph
            )
        );
    }
}

/**
 * Checks whether the site's own front end is actually reachable - a real
 * `wp_remote_get( home_url() )` from the server's own perspective, not a
 * third-party/external uptime probe (this plugin runs ON the site being
 * checked, so it can only ever observe "can THIS server reach its own
 * front door right now," the same self-check shape RobotsTxtScanner/
 * SitemapScanner already use for their own HTTP requests - see
 * SslMonitoringScanner's docblock for the same category of caveat about
 * what a WordPress-plugin-run scanner can and can't observe).
 *
 * No existing scanner covers "is the homepage reachable at all" -
 * NotFoundScanner tracks individual 404s, SslMonitoringScanner checks
 * certificate validity, neither checks whether a request to the site
 * itself completes and returns successfully. Genuinely new ground,
 * closing that specific gap. Deliberately has no self-throttle
 * (SupportsForceRunInterface) - unlike BrokenLinksScanner's own bounded
 * multi-URL crawl, this is a single lightweight request, cheap enough to
 * run every time scan() is called, same as the vast majority of scanners
 * in this namespace.
 *
 * @class       SiteAvailabilityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SiteAvailabilityScanner extends AbstractBasicScanner {

    /**
     * How long to wait for the homepage to respond before treating it as
     * unreachable - long enough to tolerate a normal slow page load, short
     * enough that this scanner's own run doesn't hang indefinitely on a
     * genuinely down server.
     */
    private const REQUEST_TIMEOUT_SECONDS = 15;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'site-availability';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Website Availability', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'availability';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $url = home_url( '/' );

        $response = wp_remote_get(
            $url,
            array(
                'timeout'     => self::REQUEST_TIMEOUT_SECONDS,
                'redirection' => 5,
                'sslverify'   => false, // A cert problem is SslMonitoringScanner's own finding, not "site unreachable" - don't fail this check on that basis.
            )
        );

        if ( is_wp_error( $response ) ) {
            return array(
                new Finding(
                    __( 'Website is unreachable', 'vulopilot' ),
                    Severity::CRITICAL,
                    $this->get_category(),
                    sprintf(
                        /* translators: %s is the underlying connection error message. */
                        __( 'A request to the homepage failed: %s', 'vulopilot' ),
                        $response->get_error_message()
                    ),
                    'url',
                    $url,
                    array( 'reason' => 'unreachable' )
                ),
            );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );

        if ( $status_code >= 500 ) {
            return array(
                new Finding(
                    sprintf(
                        /* translators: %d is the HTTP status code the homepage returned. */
                        __( 'Website is returning server errors (HTTP %d)', 'vulopilot' ),
                        $status_code
                    ),
                    Severity::CRITICAL,
                    $this->get_category(),
                    __( 'The homepage responded with a server error instead of loading successfully - visitors are likely seeing this too.', 'vulopilot' ),
                    'url',
                    $url,
                    array(
                        'reason'      => 'server-error',
                        'status_code' => $status_code,
                    )
                ),
            );
        }

        if ( $status_code < 200 || $status_code >= 400 ) {
            return array(
                new Finding(
                    sprintf(
                        /* translators: %d is the HTTP status code the homepage returned. */
                        __( 'Website homepage returned an unexpected status (HTTP %d)', 'vulopilot' ),
                        $status_code
                    ),
                    Severity::HIGH,
                    $this->get_category(),
                    __( 'The homepage did not return a normal success response - worth checking manually.', 'vulopilot' ),
                    'url',
                    $url,
                    array(
                        'reason'      => 'unexpected-status',
                        'status_code' => $status_code,
                    )
                ),
            );
        }

        return array();
    }
}

/**
 * Flags installed-but-inactive themes - the same dormant-code concern
 * PluginsScanner checks for plugins, applied to themes. The active theme
 * and, when present, its parent theme are excluded.
 *
 * @class       ThemesScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ThemesScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'themes';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Themes', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'themes';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings     = array();
        $active_theme = wp_get_theme();

        $in_use = array( $active_theme->get_stylesheet() );
        if ( $active_theme->parent() ) {
            $in_use[] = $active_theme->parent()->get_stylesheet();
        }

        foreach ( wp_get_themes() as $stylesheet => $theme ) {
            if ( in_array( $stylesheet, $in_use, true ) ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the theme name. */
                    __( 'Inactive theme installed: %s', 'vulopilot' ),
                    $theme->get( 'Name' )
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'Inactive themes still occupy disk space and can carry known vulnerabilities. Remove themes you no longer use.', 'vulopilot' ),
                'theme',
                $stylesheet
            );
        }

        return $findings;
    }
}

/**
 * Flags any pending WordPress core, plugin, or theme update, using core's
 * own update-check APIs rather than re-implementing version comparison -
 * `get_core_updates()`, `get_plugin_updates()`, and `get_theme_updates()`
 * already do exactly this and are what the native Updates admin screen
 * itself calls.
 *
 * @class       UpdatesScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class UpdatesScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'updates';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Updates', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'updates';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        if ( ! function_exists( 'get_core_updates' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }

        $findings = array();

        $core_updates = get_core_updates();
        if ( is_array( $core_updates ) && isset( $core_updates[0]->response ) && 'upgrade' === $core_updates[0]->response ) {
            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the available WordPress core version. */
                    __( 'WordPress core update available (%s)', 'vulopilot' ),
                    $core_updates[0]->version
                ),
                Severity::HIGH,
                $this->get_category(),
                __( 'Running an outdated core version increases security risk and can cause plugin/theme compatibility issues.', 'vulopilot' ),
                'core',
                $core_updates[0]->version
            );
        }

        $plugin_updates = get_plugin_updates();
        foreach ( $plugin_updates as $plugin_file => $plugin_data ) {
            // `$description` was `null` here - Finding::__construct()'s
            // own `$description` parameter is a non-nullable `string`, so
            // this threw a real `TypeError` the moment there was ever a
            // real plugin update pending, crashing this whole scanner
            // (confirmed live: 0 findings, status 'failed', every other
            // real update - including a genuinely stale, no-longer-true
            // "core update available" finding - silently stuck open
            // forever because the scan never got far enough to say
            // otherwise).
            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the plugin name. */
                    __( 'Plugin update available: %s', 'vulopilot' ),
                    $plugin_data->Name // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- get_plugin_updates()'s own property name, not ours to rename.
                ),
                Severity::MEDIUM,
                $this->get_category(),
                sprintf(
                    /* translators: %s is the plugin name. */
                    __( 'A newer version of %s is available. Keeping plugins up to date closes known security holes and fixes bugs.', 'vulopilot' ),
                    $plugin_data->Name // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- get_plugin_updates()'s own property name, not ours to rename.
                ),
                'plugin',
                $plugin_file
            );
        }

        $theme_updates = get_theme_updates();
        foreach ( $theme_updates as $stylesheet => $theme ) {
            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the theme name. */
                    __( 'Theme update available: %s', 'vulopilot' ),
                    $theme->get( 'Name' )
                ),
                Severity::MEDIUM,
                $this->get_category(),
                sprintf(
                    /* translators: %s is the theme name. */
                    __( 'A newer version of %s is available. Keeping themes up to date closes known security holes and fixes bugs.', 'vulopilot' ),
                    $theme->get( 'Name' )
                ),
                'theme',
                $stylesheet
            );
        }

        return $findings;
    }
}

/**
 * Wraps 3 of WordPress core's own `WP_Site_Health` tests - the same class
 * and same cached results Tools → Site Health already computes - rather
 * than re-implementing core-version/HTTPS/REST-API checks from scratch,
 * same "wrap core, don't reinvent" posture SitemapManager/RobotsTxtManager
 * already establish for their own core-wrapping services. `WP_Site_Health`
 * isn't autoloaded outside wp-admin, hence the explicit `require_once`.
 * Every wrapped test's own `status` (good/recommended/critical) maps onto
 * Severity 1:1 (recommended → medium, critical → high); a `status` of
 * `good` produces no Finding at all, same "only report actual problems"
 * shape every other scanner here already follows. HTML tags are stripped
 * from each test's own `description` - Finding's own field is plain text,
 * not HTML, everywhere else in this codebase.
 *
 * @class       WordPressHealthScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WordPressHealthScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'wordpress-health';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'WordPress', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'wordpress';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $this->load_dependencies();

        $health   = \WP_Site_Health::get_instance();
        $findings = array();

        foreach ( array( 'get_test_wordpress_version', 'get_test_https_status', 'get_test_rest_availability' ) as $test_method ) {
            if ( ! method_exists( $health, $test_method ) ) {
                continue;
            }

            $finding = $this->finding_from_test_result( $health->$test_method() );

            if ( $finding ) {
                $findings[] = $finding;
            }
        }

        $inactive_plugins_finding = $this->check_inactive_plugins();

        if ( $inactive_plugins_finding ) {
            $findings[] = $inactive_plugins_finding;
        }

        return $findings;
    }

    /**
     * Real, own check (not a `WP_Site_Health` wrapper like the 3 above -
     * core's own Site Health only ever *lists* inactive plugins on its
     * Info tab, it never flags them as a pass/fail test) - installed but
     * deactivated plugins are still real files sitting on disk, still a
     * real attack surface if one of them has a known vulnerability, and
     * still something WordPress keeps auto-updating by default even while
     * inactive, so "not currently running" doesn't mean "no risk," just
     * lower risk than an active one. Standard WordPress hardening
     * guidance (and every mainstream security plugin's own housekeeping
     * check) is the same: review and remove what you're not using, rather
     * than letting deactivated plugins accumulate indefinitely.
     *
     * `LOW` severity (recommendation, not a real problem the way a
     * pending core update or a failing REST API is) - every plugin name
     * is real, read straight from `get_plugins()`, the same core function
     * the Plugins admin screen itself uses.
     *
     * @return Finding|null Null when there are no inactive plugins.
     */
    private function check_inactive_plugins(): ?Finding {
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $all_plugins    = get_plugins();
        $active_plugins = (array) get_option( 'active_plugins', array() );
        $inactive_names = array();
        // Real basenames (e.g. `hello-dolly/hello.php`) alongside the
        // display names above - `delete_plugins()`/`deactivate_plugins()`
        // both need this exact identifier, not the human-readable Name;
        // stored in `meta` below so vulopilot-pro's own OneClickFix
        // MechanicalFixRunner (Pro-owned; Free never runs the actual
        // delete itself - see DATABASE.md's Free/Pro schema-vs-logic
        // split this codebase already follows elsewhere) can act on
        // exactly the plugins this scan actually found, not guess.
        $inactive_files = array();

        foreach ( $all_plugins as $plugin_file => $plugin_data ) {
            if ( in_array( $plugin_file, $active_plugins, true ) ) {
                continue;
            }

            $inactive_names[] = $plugin_data['Name']; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- get_plugins()'s own array key, not ours to rename.
            $inactive_files[] = $plugin_file;
        }

        if ( empty( $inactive_names ) ) {
            return null;
        }

        $count = count( $inactive_names );

        return new Finding(
            sprintf(
                /* translators: %d is how many installed plugins are currently deactivated. */
                _n(
                    '%d inactive plugin installed',
                    '%d inactive plugins installed',
                    $count,
                    'vulopilot'
                ),
                $count
            ),
            Severity::LOW,
            $this->get_category(),
            sprintf(
                /* translators: %s is a comma-separated list of inactive plugin names. */
                __( 'Deactivated plugins are still real files on disk and still a real attack surface if one has a known vulnerability, even while not running. Review and remove what you no longer use: %s.', 'vulopilot' ),
                implode( ', ', $inactive_names )
            ),
            'wordpress_inactive_plugins',
            null,
            array(
                'inactive_plugins' => $inactive_names,
                'inactive_plugin_files' => $inactive_files,
            ),
            // The title's own count legitimately fluctuates scan to scan
            // (a plugin gets deactivated/deleted) - a stable dedupe_key
            // keeps this one finding refreshed in place across rescans
            // instead of find_open_duplicate()'s title-match fallback
            // treating "3 inactive plugins" and "4 inactive plugins" as
            // two different findings. Same reasoning Finding's own
            // constructor docblock gives for every other fluctuating-title
            // scanner.
            'wordpress_inactive_plugins'
        );
    }

    /**
     * `WP_Site_Health` itself is only autoloaded in wp-admin - but
     * `get_test_wordpress_version()` also calls `get_core_updates()`,
     * from update.php, which it doesn't require for you. Same gap
     * ServerHealthScanner's own `load_dependencies()` documents - only
     * shows up from a REST request (this plugin's real runtime context),
     * not wp-admin or WP-CLI, which is why manual testing there wouldn't
     * catch it.
     *
     * @return void
     */
    private function load_dependencies(): void {
        if ( ! class_exists( '\WP_Site_Health' ) ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-site-health.php';
        }

        if ( ! function_exists( 'get_core_updates' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }
    }

    /**
     * @param array $result A `WP_Site_Health::get_test_*()` return value.
     * @return Finding|null Null when the test's own status is 'good'.
     */
    private function finding_from_test_result( array $result ): ?Finding {
        $status = $result['status'] ?? 'good';

        if ( 'good' === $status ) {
            return null;
        }

        $description = (string) ( $result['description'] ?? '' );
        $paragraphs  = $this->split_into_paragraphs( $description );

        return new Finding(
            wp_strip_all_tags( (string) ( $result['label'] ?? __( 'WordPress health check', 'vulopilot' ) ) ),
            'critical' === $status ? Severity::HIGH : Severity::MEDIUM,
            $this->get_category(),
            wp_strip_all_tags( $description ),
            'site_health_test',
            (string) ( $result['test'] ?? '' ),
            count( $paragraphs ) >= 2
                ? array(
                    'why_it_matters' => $paragraphs[0],
                    'what_happened'  => implode( ' ', array_slice( $paragraphs, 1 ) ),
                )
                : array()
        );
    }

    /**
     * `WP_Site_Health`'s own test descriptions are built from separate real
     * HTML `<p>` blocks (confirmed by reading `WP_Site_Health`'s own core
     * source) - a first paragraph explaining why the check matters, then
     * one or more further paragraphs describing what this specific test
     * actually found - flattened into one plain-text blob by the time
     * `finding_from_test_result()` above stores it as `Finding`'s own
     * `description`. Splitting on `</p>` recovers that real, already-
     * existing structure (never fabricated) so the frontend can show a
     * genuine "Why it matters"/"What happened" split; a description with
     * only one real paragraph returns a single-element array, and the
     * caller above then omits `meta` entirely rather than splitting
     * nothing into two boxes.
     *
     * Some tests (e.g. `get_test_rest_availability()`) join two distinct
     * lines within the SAME paragraph with a real `<br>` rather than a new
     * `<p>` (e.g. "REST API Endpoint: …" and "REST API Response: …") - a
     * bare `wp_strip_all_tags()` would silently drop that tag and glue the
     * two lines together with no separator at all (confirmed live:
     * "…context=editREST API Response: …"). Replacing `<br>` with a real
     * separator first keeps both lines readable without fabricating new
     * wording - still core's own two lines, just not run together.
     *
     * @param string $html_description Raw HTML `description` from a `WP_Site_Health` test result.
     * @return array<int, string> Plain-text paragraphs, in order, empty ones dropped.
     */
    private function split_into_paragraphs( string $html_description ): array {
        $chunks = preg_split( '/<\/p>\s*/i', $html_description ) ?: array();

        return array_values(
            array_filter(
                array_map(
                    static fn( string $chunk ): string => trim(
                        wp_strip_all_tags( preg_replace( '/<br\s*\/?>/i', ' - ', $chunk ) ?? $chunk )
                    ),
                    $chunks
                ),
                static fn( string $paragraph ): bool => '' !== $paragraph
            )
        );
    }
}
