<?php
/**
 * Every class in this file used to be its own file under classes/Services/
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

namespace VuloPilot\Services;

use VuloPilot\Automations\BuiltinAutomationSeeder;
use VuloPilot\Reports\ReportGenerator;
use VuloPilot\Repositories\AutomationsRepository;
use VuloPilot\Repositories\AutomationsRunRepository;
use VuloPilot\Repositories\CrawlerVisitRepository;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\FirewallBlockRepository;
use VuloPilot\Repositories\IndexNowLogRepository;
use VuloPilot\Repositories\LoginAttemptRepository;
use VuloPilot\Repositories\NotFoundLogRepository;
use VuloPilot\Repositories\RedirectRepository;
use VuloPilot\Repositories\ReportRepository;
use VuloPilot\Scanners\ScanRunner;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Real, independent cron tick for Free's two built-in automations (see
 * Automations\BuiltinAutomationSeeder) - same "own small scheduler, not
 * entangled with any other feature's cadence" posture Services\
 * BackupScheduler already documents, and the free-tier counterpart to
 * vulopilot-pro's Automations\Scheduler: this deliberately does NOT go
 * through vulopilot-pro's AutomationsEngine (Recommendation-driven; see
 * WebsiteHealthScanScheduler's own docblock for why a bare site-level
 * action can't run through that engine) - it invokes each row's one real
 * action directly.
 *
 * @class       AutomationScheduler class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AutomationScheduler {

    private const SCAN_HOOK   = 'vulopilot_automation_full_site_scan_run';
    private const REPORT_HOOK = 'vulopilot_automation_visibility_report_run';

    /**
     * @var ScanRunner
     */
    private ScanRunner $scan_runner;

    /**
     * @var ReportGenerator
     */
    private ReportGenerator $report_generator;

    /**
     * @var AutomationsRepository
     */
    private AutomationsRepository $automations;

    /**
     * @var AutomationsRunRepository
     */
    private AutomationsRunRepository $runs;

    /**
     * @param ScanRunner                    $scan_runner      Runs row 1's real action.
     * @param ReportGenerator                $report_generator Builds VisibilityReportMailer's own dependency.
     * @param AutomationsRepository|null     $automations      Defaults to a new instance - injectable for tests.
     * @param AutomationsRunRepository|null  $runs             Defaults to a new instance - injectable for tests.
     */
    public function __construct( ScanRunner $scan_runner, ReportGenerator $report_generator, ?AutomationsRepository $automations = null, ?AutomationsRunRepository $runs = null ) {
        $this->scan_runner      = $scan_runner;
        $this->report_generator = $report_generator;
        $this->automations      = $automations ?? new AutomationsRepository();
        $this->runs             = $runs ?? new AutomationsRunRepository();

        add_filter( 'cron_schedules', array( $this, 'register_custom_schedules' ) ); // phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval -- registering real, standard 7/30-day intervals, not shorter-than-recommended ones.
        add_action( 'init', array( $this, 'ensure_scheduled' ), 30 );
        add_action( self::SCAN_HOOK, array( $this, 'run_scheduled_scan' ) );
        add_action( self::REPORT_HOOK, array( $this, 'run_scheduled_report' ) );
    }

    /**
     * @param array<string, array{interval: int, display: string}> $schedules Real, currently-registered schedules.
     * @return array<string, array{interval: int, display: string}>
     */
    public function register_custom_schedules( array $schedules ): array {
        if ( ! isset( $schedules['weekly'] ) ) {
            $schedules['weekly'] = array(
                'interval' => WEEK_IN_SECONDS,
                'display'  => __( 'Once Weekly', 'vulopilot' ),
            );
        }

        if ( ! isset( $schedules['monthly'] ) ) {
            $schedules['monthly'] = array(
                'interval' => 30 * DAY_IN_SECONDS,
                'display'  => __( 'Once Monthly', 'vulopilot' ),
            );
        }

        return $schedules;
    }

    /**
     * Reconciles both real scheduled cron events against their own
     * automation row's current `status`/`trigger_config`.
     *
     * @return void
     */
    public function ensure_scheduled(): void {
        $scan_row = $this->automations->find_by_system_default_marker( BuiltinAutomationSeeder::MARKER_FULL_SITE_SCAN );

        if ( $scan_row ) {
            $this->reconcile_row( $scan_row, self::SCAN_HOOK, array( 'daily', 'weekly', 'monthly' ) );
        }

        $report_row = $this->automations->find_by_system_default_marker( BuiltinAutomationSeeder::MARKER_VISIBILITY_REPORT );

        if ( $report_row ) {
            $this->reconcile_row( $report_row, self::REPORT_HOOK, array( 'weekly', 'monthly' ) );
        }
    }

    /**
     * @param array<string, mixed> $row               Real automation row.
     * @param string                $hook              This row's own cron hook.
     * @param string[]              $valid_frequencies Frequencies this row's own UI actually offers (excludes 'manual').
     * @return void
     */
    private function reconcile_row( array $row, string $hook, array $valid_frequencies ): void {
        $trigger_config = json_decode( (string) ( $row['trigger_config'] ?? '' ), true );
        $trigger_config = is_array( $trigger_config ) ? $trigger_config : array();

        $frequency   = (string) ( $trigger_config['frequency'] ?? 'disabled' );
        $day_of_week = max( 1, min( 7, absint( $trigger_config['day_of_week'] ?? 1 ) ) );
        $enabled     = 'enabled' === ( $row['status'] ?? '' );

        $scheduled = wp_get_scheduled_event( $hook );

        if ( ! $enabled || ! in_array( $frequency, $valid_frequencies, true ) ) {
            if ( $scheduled ) {
                wp_clear_scheduled_hook( $hook );
            }

            return;
        }

        if ( $scheduled && $frequency === $scheduled->schedule ) {
            if ( 'weekly' !== $frequency || (int) gmdate( 'N', $scheduled->timestamp ) === $day_of_week ) {
                return;
            }
        }

        wp_clear_scheduled_hook( $hook );

        $start = 'weekly' === $frequency ? $this->next_weekday_timestamp( $day_of_week ) : time();

        wp_schedule_event( $start, $frequency, $hook );
    }

    /**
     * @param int $day_of_week ISO-8601 weekday, 1 (Monday) through 7 (Sunday).
     * @return int Unix timestamp for 03:00 UTC on the next occurrence of that weekday (today included).
     */
    private function next_weekday_timestamp( int $day_of_week ): int {
        $now         = time();
        $current_iso = (int) gmdate( 'N', $now );
        $days_until  = ( $day_of_week - $current_iso + 7 ) % 7;
        $target_date = gmdate( 'Y-m-d', $now + ( $days_until * DAY_IN_SECONDS ) );

        return (int) strtotime( $target_date . ' 03:00:00 UTC' );
    }

    /**
     * Row 1's real cron tick - runs every scanner and records a run row.
     *
     * @return void
     */
    public function run_scheduled_scan(): void {
        $row = $this->automations->find_by_system_default_marker( BuiltinAutomationSeeder::MARKER_FULL_SITE_SCAN );

        if ( ! $row ) {
            return;
        }

        $started_at = current_time( 'mysql', true );

        try {
            $this->scan_runner->run_all();
            $this->record_run( (int) $row['id'], 'completed', $started_at );
        } catch ( \Throwable $exception ) {
            $this->record_run( (int) $row['id'], 'failed', $started_at, $exception->getMessage() );
        }
    }

    /**
     * Row 2's real cron tick - generates and emails the visibility report.
     *
     * @return void
     */
    public function run_scheduled_report(): void {
        $row = $this->automations->find_by_system_default_marker( BuiltinAutomationSeeder::MARKER_VISIBILITY_REPORT );

        if ( ! $row ) {
            return;
        }

        $trigger_config = json_decode( (string) ( $row['trigger_config'] ?? '' ), true );
        $frequency      = is_array( $trigger_config ) ? (string) ( $trigger_config['frequency'] ?? 'weekly' ) : 'weekly';

        $started_at = current_time( 'mysql', true );
        $mailer     = new VisibilityReportMailer( $this->report_generator );

        try {
            $sent = $mailer->send( $frequency );
            $this->record_run( (int) $row['id'], $sent ? 'completed' : 'failed', $started_at, $sent ? '' : 'No recipient configured, or the report failed to generate.' );
        } catch ( \Throwable $exception ) {
            $this->record_run( (int) $row['id'], 'failed', $started_at, $exception->getMessage() );
        }
    }

    /**
     * @param int    $automation_id Real automation row id.
     * @param string $status        'completed'|'failed'.
     * @param string $started_at    Real MySQL datetime this run started at.
     * @param string $error         Real error message, empty when $status is 'completed'.
     * @return void
     */
    private function record_run( int $automation_id, string $status, string $started_at, string $error = '' ): void {
        $finished_at = current_time( 'mysql', true );

        $this->runs->insert(
            array(
                'automation_id'    => $automation_id,
                'triggered_by'     => 'scheduled',
                'trigger_ref_id'   => null,
                'status'           => $status,
                'actions_executed' => 'completed' === $status ? 1 : 0,
                'actions_failed'   => 'failed' === $status ? 1 : 0,
                'changes_made'     => 0,
                'result_log'       => $error ? wp_json_encode( array( 'error' => $error ) ) : null,
                'started_at'       => $started_at,
                'finished_at'      => $finished_at,
            )
        );

        $this->automations->update( $automation_id, array( 'last_triggered_at' => $finished_at ) );
    }
}

/**
 * Discovers and registers every Gutenberg block VuloPilot ships -
 * `tools/webpack/create-config.js` builds each `src/blocks/{name}/` folder
 * into `assets/js/block/{name}/` (block.json + render.php, if present,
 * copied alongside the built JS via `CopyWebpackPlugin`), and this class
 * `glob()`s that BUILT directory at runtime rather than hardcoding a block
 * list, so a new block folder under `src/blocks/` is picked up
 * automatically after a build with no PHP change needed here - same
 * pattern as the sibling free plugin vulocart's own `VuloCart\Block` class,
 * ported here since vulopilot had no block infrastructure at all before
 * `vulopilot/table-of-contents` and `vulopilot/faq`.
 *
 * @class       BlockRegistrar class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BlockRegistrar {

    /**
     * Discovered blocks, cached for the lifetime of one request.
     *
     * @var array<int, array{name: string, path: string}>|null
     */
    private $blocks;

    /**
     * BlockRegistrar constructor.
     */
    public function __construct() {
        add_action( 'init', array( $this, 'register_blocks' ) );
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_frontend_styles' ) );
        add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_editor_styles' ) );
    }

    /**
     * Scans `assets/js/block/` for built block folders containing a `block.json`.
     *
     * @return array<int, array{name: string, path: string}>
     */
    private function get_blocks(): array {
        if ( null !== $this->blocks ) {
            return $this->blocks;
        }

        $this->blocks = array();

        $block_base_path = VuloPilot()->plugin_path . 'assets/js/block/';

        if ( ! is_dir( $block_base_path ) ) {
            return $this->blocks;
        }

        $folders = glob( $block_base_path . '*', GLOB_ONLYDIR );

        foreach ( $folders as $folder ) {
            if ( file_exists( $folder . '/block.json' ) ) {
                $this->blocks[] = array(
                    'name' => basename( $folder ),
                    'path' => $folder,
                );
            }
        }

        return $this->blocks;
    }

    /**
     * Registers every discovered block. Passing a directory path (rather
     * than a bare block name) lets `register_block_type()` read that
     * block's own `block.json` and auto-wire its `render` callback file if
     * one is declared - no custom render-dispatch glue needed here.
     *
     * @return void
     */
    public function register_blocks(): void {
        foreach ( $this->get_blocks() as $block ) {
            register_block_type( $block['path'] );
        }
    }

    /**
     * @return void
     */
    public function enqueue_frontend_styles(): void {
        if ( ! has_block( 'vulopilot/table-of-contents' ) && ! has_block( 'vulopilot/faq' ) ) {
            return;
        }

        $this->enqueue_blocks_stylesheet( 'vulopilot-blocks' );
    }

    /**
     * Unconditional in the editor - the block inserter needs the same
     * `.vulopilot-toc`/`.vulopilot-faq` rules to preview correctly
     * regardless of whether either block has been inserted into THIS
     * particular post yet.
     *
     * @return void
     */
    public function enqueue_editor_styles(): void {
        $this->enqueue_blocks_stylesheet( 'vulopilot-blocks-editor' );
    }

    /**
     * Same `public/*.scss` → `assets/styles/public/vulopilot-*.min.css`
     * pipeline (`tools/scripts/minify.mjs`, part of `build:project:bundle`)
     * already used for e.g. `admin-menu-groups.scss` - deliberately NOT a
     * webpack-bundled block.json `style`/`editorStyle` field, since that
     * mechanism's actual frontend wiring couldn't be confirmed anywhere in
     * this monorepo's existing block (vulocart's own `checkout.scss` has
     * no matching `wp_enqueue_style()`/`block.json` field found anywhere).
     *
     * @param string $handle Real registered handle for this enqueue call.
     * @return void
     */
    private function enqueue_blocks_stylesheet( string $handle ): void {
        $style_path = VuloPilot()->plugin_path . 'assets/styles/public/vulopilot-blocks.min.css';

        if ( ! file_exists( $style_path ) ) {
            return;
        }

        wp_enqueue_style(
            $handle,
            VuloPilot()->plugin_url . 'assets/styles/public/vulopilot-blocks.min.css',
            array(),
            VuloPilot()->version
        );
    }
}

/**
 * AI Crawler Traffic Monitoring (readme.txt) - detects known AI-answer-
 * engine crawlers by User-Agent on every real front-end page load and
 * logs the visit (bot name + user agent + requested URL only - never an
 * IP address or any other visitor-identifying data, per readme.txt's own
 * FAQ promise). Self-registers its own hooks in the constructor
 * (php-wordpress.md) and is constructed unconditionally in
 * VuloPilot::init_classes(), the same shape GeoAnalysis\LlmsTxtGenerator
 * already uses for "detect something on every real front-end request" -
 * `template_redirect` fires only for genuine page-template requests, never
 * wp-admin, REST API, or admin-ajax.php, so no extra is_admin()/DOING_AJAX
 * guard is needed beyond what that hook already excludes.
 *
 * The plugin's readme.txt names "Google-Extended (Gemini)" as one of the
 * crawlers to monitor, but Google documents Google-Extended as a robots.txt-only
 * opt-out *token* with no distinguishing User-Agent of its own - content
 * used for Gemini/AI training is actually fetched under Google's
 * AI-training crawler UA, `Google-CloudVertexBot`. BOT_SIGNATURES maps
 * the readme's label to that real, detectable UA instead of matching a
 * literal "Google-Extended" string that would never appear in real
 * traffic and would silently show zero visits forever.
 *
 * One Pro extension point for "AI Crawler Traffic Analytics & Historical
 * Logs" (readme.txt's Pro line) is `vulopilot_crawler_log_retention_days`
 * - Free's daily cleanup cron deletes rows older than Settings → AI
 * Visibility's own "Log retention" value (default 30); vulopilot-pro's
 * AdvancedReports module overrides it further via this same filter.
 * No separate Pro table/REST controller is needed - see this feature's
 * plan doc for why a per-event log doesn't need the snapshot-rollup shape
 * Health Score's historical trend uses.
 *
 * A second extension point, `vulopilot_crawler_bot_signatures`, lets Pro (or
 * any third party) extend BOT_SIGNATURES without editing this class -
 * AI-CRAWLER-ANALYTICS-MODULE.md's "register a source, don't modify the
 * host" reasoning, the same posture every other *_sources filter in this
 * codebase already uses, applied to this one fixed array that previously
 * had no such seam.
 *
 * @class       CrawlerTrafficLogger class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CrawlerTrafficLogger {

    private const CLEANUP_HOOK = 'vulopilot_crawler_log_cleanup';

    /**
     * User-Agent substring => display name. Matched case-sensitively
     * against the raw header, same convention every real bot's
     * documented UA token already uses (these are all literal,
     * case-sensitive product tokens).
     *
     * @var array<string, string>
     */
    private const BOT_SIGNATURES = array(
        'GPTBot'                => 'GPTBot (OpenAI)',
        'ChatGPT-User'          => 'ChatGPT-User (OpenAI)',
        'ClaudeBot'             => 'ClaudeBot (Anthropic)',
        'anthropic-ai'          => 'anthropic-ai (Anthropic)',
        'PerplexityBot'         => 'PerplexityBot (Perplexity)',
        'Bytespider'            => 'Bytespider (ByteDance)',
        'CCBot'                 => 'CCBot (Common Crawl)',
        'Google-CloudVertexBot' => 'Google-CloudVertexBot (Google AI training)',
        'Amazonbot'             => 'Amazonbot (Amazon)',
    );

    /**
     * CrawlerTrafficLogger constructor.
     */
    public function __construct() {
        add_action( 'template_redirect', array( $this, 'maybe_log' ) );
        add_action( 'init', array( $this, 'ensure_cleanup_scheduled' ) );
        add_action( self::CLEANUP_HOOK, array( $this, 'run_cleanup' ) );
    }

    /**
     * @return void
     */
    public function maybe_log(): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_crawler_tracking'] ) ) {
            return;
        }

        $user_agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';

        if ( '' === $user_agent ) {
            return;
        }

        foreach ( self::get_bot_signatures() as $signature => $bot_name ) {
            if ( false === strpos( $user_agent, $signature ) ) {
                continue;
            }

            $requested_url = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';

            // is_404() is already reliable here - `template_redirect` fires
            // after WP has resolved the main query, so this is the request's
            // real outcome, not a guess. AI Crawler Alerts' "access limited"
            // check (CrawlerAlertMonitor::find_bots_with_high_404_rate())
            // reads this back per bot.
            ( new CrawlerVisitRepository() )->log( $bot_name, $user_agent, $requested_url, is_404() );
            return;
        }
    }

    /**
     * User-Agent substring => display name, extensible via
     * `vulopilot_crawler_bot_signatures` - the shared source of truth for
     * every place in this codebase that needs to know which AI bots are
     * detectable (Seo\Scanners\AiCrawlerBlockedPagesScanner, and
     * vulopilot-pro's crawler-analytics correlation/alert code).
     *
     * @return array<string, string>
     */
    public static function get_bot_signatures(): array {
        return apply_filters( 'vulopilot_crawler_bot_signatures', self::BOT_SIGNATURES );
    }

    /**
     * Schedules the daily cleanup cron once, the standard
     * wp_next_scheduled()-guarded wp_schedule_event() pattern - no
     * existing cron-scheduling helper to reuse in this plugin (Scheduler.php
     * for recurring scans is Pro business logic, a different concern).
     *
     * @return void
     */
    public function ensure_cleanup_scheduled(): void {
        if ( ! wp_next_scheduled( self::CLEANUP_HOOK ) ) {
            wp_schedule_event( time(), 'daily', self::CLEANUP_HOOK );
        }
    }

    /**
     * Deletes crawler-visit rows past the retention window - the one
     * mechanism behind readme.txt's Pro "Historical Logs" line, see this
     * class's own docblock.
     *
     * @return void
     */
    public function run_cleanup(): void {
        $settings       = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $saved_days     = (int) ( $settings['log_retention'] ?? 30 );
        $retention_days = (int) apply_filters( 'vulopilot_crawler_log_retention_days', $saved_days ?: 30 );

        if ( $retention_days <= 0 ) {
            return;
        }

        ( new CrawlerVisitRepository() )->delete_older_than( $retention_days );
    }
}

/**
 * Real, always-on request-time pattern blocking - Protect My Site's
 * "Firewall" tile. Unconditionally constructed in VuloPilot::init_classes()
 * (not a Modules-page module), hooks `init` at priority 1 (as early as a
 * plugin can practically run).
 *
 * Checks only the request URI + raw query string - deliberately never
 * `$_POST`, since inspecting POST bodies for these same substrings would
 * false-positive on entirely legitimate content (e.g. an admin editing a
 * blog post that happens to discuss SQL injection, or pasting a `../`
 * relative path into a code sample). A small, well-known, low-false-
 * positive pattern set: SQL-injection markers, path traversal, a direct
 * PHP-execution attempt inside `wp-content/uploads/` (the same signal
 * Scanners\Basic\MalwareScanner's Check A uses, here checked at request
 * time instead of at rest), and null-byte injection.
 *
 * On a match, **always** logs a real row (`vulopilot_security_events` (type `firewall_block`)).
 * Only actually blocks (403 + terminate) when `enable_firewall_blocking`
 * is explicitly turned on - off by default, so a false positive can't lock
 * out a legitimate request the moment this ships. See
 * Scanners\Basic\FirewallScanner for the real summary Finding built from
 * this same log.
 *
 * @class       FirewallGuard class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FirewallGuard {

    /**
     * Pattern => human-readable rule name, checked against the decoded
     * request URI + raw query string. Kept small and well-known - same
     * "hardening check, not a comprehensive WAF" posture MalwareScanner's
     * own signature list uses.
     *
     * @var array<string, string>
     */
    private const RULES = array(
        '/union\s+select/i'          => 'sql-injection',
        '/information_schema/i'      => 'sql-injection',
        "/'\\s*or\\s*'?1'?\\s*=\\s*'?1/i" => 'sql-injection',
        '/\.\.\/\.\.\//'             => 'path-traversal',
        '/wp-content\/uploads\/.*\.(php|phtml)/i' => 'uploads-php-execution',
        '/%00/i'                     => 'null-byte-injection',
    );

    /**
     * FirewallGuard constructor.
     */
    public function __construct() {
        add_action( 'init', array( $this, 'inspect_request' ), 1 );
    }

    /**
     * Real client IP, `$_SERVER['REMOTE_ADDR']` only - same reasoning as
     * LoginProtectionGuard::get_client_ip().
     *
     * @return string
     */
    private function get_client_ip(): string {
        $raw = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.MissingUnslash

        $valid = filter_var( $raw, FILTER_VALIDATE_IP );

        return $valid ? $valid : '0.0.0.0';
    }

    /**
     * `init` callback (priority 1) - checked on every real front-end/admin
     * request.
     *
     * @return void
     */
    public function inspect_request(): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_firewall'] ) ) {
            return;
        }

        $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.MissingUnslash

        if ( '' === $request_uri ) {
            return;
        }

        $decoded_uri = rawurldecode( $request_uri );

        foreach ( self::RULES as $pattern => $rule_name ) {
            if ( ! preg_match( $pattern, $decoded_uri ) ) {
                continue;
            }

            $blocking_on = ! empty( $settings['enable_firewall_blocking'] );

            ( new FirewallBlockRepository() )->insert(
                array(
                    'ip_address'   => $this->get_client_ip(),
                    'request_uri'  => $request_uri,
                    'rule_matched' => $rule_name,
                    'action'       => $blocking_on ? 'blocked' : 'logged',
                    'created_at'   => current_time( 'mysql' ),
                )
            );

            if ( $blocking_on ) {
                nocache_headers();
                status_header( 403 );
                wp_die(
                    esc_html__( 'Request blocked.', 'vulopilot' ),
                    esc_html__( 'Forbidden', 'vulopilot' ),
                    array( 'response' => 403 )
                );
            }

            // One matched rule is enough to act on - no need to keep
            // checking the remaining rules against this same request.
            return;
        }
    }
}

/**
 * Scanning → Instant Indexing tab's "Auto-submit post types" setting - real
 * automatic IndexNow submission on publish/update (`save_post`) and on
 * trash (`wp_trash_post`, hooked before the post's slug/status actually
 * changes, so the real, still-live permalink is what gets submitted - a
 * removed/trashed URL is itself a legitimate, real IndexNow use case: it
 * prompts participating engines to re-crawl and discover the 404/410,
 * rather than continuing to serve a stale cached result).
 *
 * Every submission (success or failure) is logged to
 * the shared activity log (`indexnow.submitted`) via IndexNowLogRepository with
 * `trigger_type = 'auto'`, same table the manual "Submit URLs" button's
 * own submissions land in - the mockup's own History card is described as
 * "the last 100 IndexNow API requests," not "manual requests only."
 *
 * Self-registers its own hooks in the constructor (php-wordpress.md) and
 * is constructed unconditionally in VuloPilot::init_classes() - both hooks
 * read `indexnow_post_types`/`indexnow_api_key` before doing anything, same
 * "settings gate the callback's own behavior, not construction" shape
 * every other Services\* class in this plugin already uses.
 *
 * @class       IndexNowAutoSubmitter class
 * @version     1.0.0
 * @author      VuloLabs
 */
class IndexNowAutoSubmitter {

    /**
     * IndexNowAutoSubmitter constructor.
     */
    public function __construct() {
        add_action( 'save_post', array( $this, 'maybe_submit_on_save' ), 20, 2 );
        add_action( 'wp_trash_post', array( $this, 'maybe_submit_on_trash' ) );
    }

    /**
     * @param int      $post_id Post being saved.
     * @param \WP_Post $post    The post object.
     * @return void
     */
    public function maybe_submit_on_save( $post_id, $post ): void {
        if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
            return;
        }

        if ( 'publish' !== $post->post_status ) {
            return;
        }

        $this->maybe_submit( $post );
    }

    /**
     * @param int $post_id Post being trashed.
     * @return void
     */
    public function maybe_submit_on_trash( $post_id ): void {
        $post = get_post( $post_id );

        if ( $post ) {
            $this->maybe_submit( $post );
        }
    }

    /**
     * @param \WP_Post $post Post to submit, if its type is configured for auto-submit.
     * @return void
     */
    private function maybe_submit( \WP_Post $post ): void {
        $settings   = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $post_types = (array) ( $settings['indexnow_post_types'] ?? array() );
        $api_key    = (string) ( $settings['indexnow_api_key'] ?? '' );

        if ( '' === $api_key || ! in_array( $post->post_type, $post_types, true ) ) {
            return;
        }

        $permalink = get_permalink( $post );

        if ( ! $permalink ) {
            return;
        }

        $result = ( new IndexNowClient( $api_key ) )->submit( array( $permalink ) );

        ( new IndexNowLogRepository() )->log( $permalink, $result['status_code'], $result['status'], 'auto' );
    }
}

/**
 * Real HTTP client for the IndexNow protocol (indexnow.org) - a single
 * submission to this one neutral aggregator endpoint is picked up by every
 * participating search engine (Bing, Yandex, Seznam.cz, Naver, and others),
 * so this never needs a per-engine endpoint list. Uses
 * `wp_remote_post()` + explicit status-code branching (real pass/fail
 * responses worth surfacing to an admin), not SitemapManager's fire-and-
 * forget ping - IndexNow's response codes are meaningful and documented
 * (mockup's own "Response code help" card lists exactly these).
 *
 * Stateless: takes the site's own current key as a constructor argument
 * rather than reading settings itself, so callers (the manual-submit REST
 * endpoint, IndexNowAutoSubmitter's publish/update hook) each own their own
 * one read of the current settings.
 *
 * @class       IndexNowClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class IndexNowClient {

    private const ENDPOINT = 'https://api.indexnow.org/indexnow';

    /**
     * @var string
     */
    private string $api_key;

    /**
     * @param string $api_key This site's current IndexNow API key.
     */
    public function __construct( string $api_key ) {
        $this->api_key = $api_key;
    }

    /**
     * Submits one or more URLs in a single IndexNow request. Every URL must
     * belong to this site's own host - IndexNow itself rejects (422)
     * cross-host submissions, so this is filtered client-side too rather
     * than relying solely on the API to reject them.
     *
     * @param string[] $urls Absolute URLs to submit.
     * @return array{success: bool, status_code: int|null, status: string, message: string}
     */
    public function submit( array $urls ): array {
        $host       = wp_parse_url( home_url(), PHP_URL_HOST );
        $valid_urls = array_values(
            array_filter(
                $urls,
                static fn( $url ) => is_string( $url ) && wp_parse_url( $url, PHP_URL_HOST ) === $host
            )
        );

        if ( ! $valid_urls ) {
            return array(
                'success'     => false,
                'status_code' => null,
                'status'      => 'invalid',
                'message'     => __( 'No valid URLs for this site were given.', 'vulopilot' ),
            );
        }

        $response = wp_remote_post(
            self::ENDPOINT,
            array(
                'timeout' => 15,
                'headers' => array( 'Content-Type' => 'application/json; charset=utf-8' ),
                'body'    => wp_json_encode(
                    array(
                        'host'        => $host,
                        'key'         => $this->api_key,
                        'keyLocation' => home_url( $this->api_key . '.txt' ),
                        'urlList'     => array_values( $valid_urls ),
                    )
                ),
            )
        );

        if ( is_wp_error( $response ) ) {
            return array(
                'success'     => false,
                'status_code' => null,
                'status'      => 'error',
                'message'     => $response->get_error_message(),
            );
        }

        $status_code = (int) wp_remote_retrieve_response_code( $response );

        return array(
            'success'     => in_array( $status_code, array( 200, 202 ), true ),
            'status_code' => $status_code,
            'status'      => $this->describe_status_code( $status_code ),
            'message'     => $this->status_code_message( $status_code ),
        );
    }

    /**
     * @param int $status_code Real HTTP status code IndexNow returned.
     * @return string Short machine-readable status, backs IndexNowLogRepository's `response_status` column.
     */
    private function describe_status_code( int $status_code ): string {
        if ( in_array( $status_code, array( 200, 202 ), true ) ) {
            return 'success';
        }

        if ( in_array( $status_code, array( 400, 403, 422, 429 ), true ) ) {
            return 'failed';
        }

        return 'unknown';
    }

    /**
     * Real, documented IndexNow response codes (mockup's own "Response code
     * help" card - this is that same list, not paraphrased).
     *
     * @param int $status_code Real HTTP status code IndexNow returned.
     * @return string
     */
    private function status_code_message( int $status_code ): string {
        switch ( $status_code ) {
            case 200:
                return __( 'URL received.', 'vulopilot' );
            case 202:
                return __( 'URL received; key not yet validated.', 'vulopilot' );
            case 400:
                return __( 'Invalid format.', 'vulopilot' );
            case 403:
                return __( "Key not found or doesn't match.", 'vulopilot' );
            case 422:
                return __( "URL doesn't belong to this site.", 'vulopilot' );
            case 429:
                return __( 'Rate limited, try again later.', 'vulopilot' );
            default:
                return sprintf(
                    /* translators: %d: HTTP status code. */
                    __( 'Unexpected response (%d).', 'vulopilot' ),
                    $status_code
                );
        }
    }
}

/**
 * Serves this site's IndexNow key file at `/{key}.txt` - the IndexNow
 * protocol's own ownership-proof mechanism (a plain-text file at the site
 * root containing exactly the key, matching `keyLocation` in every
 * IndexNowClient submission). Same virtual-route + physical-file dual
 * approach GeoAnalysis\LlmsTxtGenerator already uses for `/llms.txt`, and
 * for the identical reason documented there: the rewrite rule only takes
 * effect once WordPress's cached rewrite_rules option is flushed, so a
 * real on-disk file makes "Check key" (and any IndexNow crawler actually
 * fetching it) work even before that flush has happened.
 *
 * The rewrite pattern matches a fixed 32-lowercase-hex-character filename
 * shape (`generate_new_key()`'s own output format) rather than embedding
 * the current key's literal value in the pattern - so the rewrite rule
 * itself never needs to change (and re-flush) when an admin rotates the
 * key via the Instant Indexing tab's "Change key" button; only the
 * comparison inside maybe_serve() needs the current value.
 *
 * @class       IndexNowKeyFileServer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class IndexNowKeyFileServer {

    private const QUERY_VAR = 'vulopilot_indexnow_key_file';

    /**
     * IndexNowKeyFileServer constructor.
     */
    public function __construct() {
        add_action( 'init', array( $this, 'register_rewrite_rule' ) );
        add_filter( 'query_vars', array( $this, 'add_query_var' ) );
        // Priority 1 - must run before WordPress core's own
        // redirect_canonical() (hooked on this same action at its default
        // priority 10): core's canonical-redirect logic otherwise 301s an
        // unmatched key-file guess (treating it as a page missing a
        // trailing slash) before this callback ever gets a chance to set a
        // real 404 for it.
        add_action( 'template_redirect', array( $this, 'maybe_serve' ), 1 );
    }

    /**
     * @return void
     */
    public function register_rewrite_rule(): void {
        add_rewrite_rule( '^([a-f0-9]{32})\.txt$', 'index.php?' . self::QUERY_VAR . '=$matches[1]', 'top' );
    }

    /**
     * @param string[] $vars Existing public query vars.
     * @return string[]
     */
    public function add_query_var( array $vars ): array {
        $vars[] = self::QUERY_VAR;
        return $vars;
    }

    /**
     * @return void
     */
    public function maybe_serve(): void {
        $requested_key = get_query_var( self::QUERY_VAR );

        if ( ! $requested_key ) {
            return;
        }

        $settings   = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $stored_key = (string) ( $settings['indexnow_api_key'] ?? '' );

        // No stored key yet, or it doesn't match what was requested - force
        // a real 404 rather than a bare `return`. A bare return here left
        // WordPress's main query in its default "matched a rewrite rule but
        // found no content" state, which redirect_canonical() then treated
        // as a page missing a trailing slash and 301-redirected to (landing
        // on the homepage, 200) instead of ever showing a 404 - confirmed
        // via a real request to a 32-hex-char URL that isn't this site's
        // key. Explicitly setting 404 here is what a guessed/stale key file
        // URL should actually do, not confirm the existence of a key that
        // isn't this one.
        if ( '' === $stored_key || ! hash_equals( $stored_key, $requested_key ) ) {
            global $wp_query;
            $wp_query->set_404();
            status_header( 404 );
            return;
        }

        header( 'Content-Type: text/plain; charset=utf-8' );
        echo esc_html( $stored_key );
        exit;
    }

    /**
     * Writes the key straight to a real `/{key}.txt` at the site root -
     * same best-effort semantics as LlmsTxtGenerator::write_file(): a
     * locked-down host where ABSPATH isn't writable still has the setting
     * saved and the virtual route above still serves it correctly, it just
     * doesn't also get a static file.
     *
     * @param string $key The key to write a file for.
     * @return bool True if the file was written.
     */
    public function write_key_file( string $key ): bool {
        if ( '' === $key || ! wp_is_writable( ABSPATH ) ) {
            return false;
        }

        $file_path = trailingslashit( ABSPATH ) . $key . '.txt';

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- a plain-text key file at the site root, same precedent/reasoning as LlmsTxtGenerator::write_file()'s own ignore comment.
        return false !== file_put_contents( $file_path, $key );
    }

    /**
     * Generates a fresh 32-character lowercase hex key - real
     * cryptographically-suitable randomness (`random_bytes()`), not a
     * client-trusted value; used both by the Instant Indexing tab's
     * `random-input-key-generator` field's own client-side regeneration
     * (which just needs *a* random string, any source) and, more
     * importantly, by Controllers\Settings/the IndexNow REST controller to
     * lazily seed `indexnow_api_key` the first time it's read, the same
     * "empty means not generated yet" precedent `indexnow_api_key`'s own
     * Utill.php comment documents.
     *
     * @return string
     */
    public static function generate_new_key(): string {
        return bin2hex( random_bytes( 16 ) );
    }
}

/**
 * Real, always-on brute-force login protection - Protect My Site's "Login
 * Protection" tile. Unconditionally constructed in VuloPilot::init_classes()
 * (not a Modules-page module), self-registers its own hooks:
 *
 * - `authenticate` (priority 30, after core's own username/email password
 *   checks at priority 20) - before letting this attempt proceed, counts
 *   real recent failures for the requesting IP
 *   (LoginAttemptRepository::count_recent_failures()) within
 *   `login_lockout_minutes`; at/over `login_max_attempts`, returns a
 *   WP_Error - core's own documented short-circuit contract for this
 *   filter, the same mechanism every login-limiter plugin relies on. The
 *   lockout check doesn't depend on whether the guessed password was
 *   correct - that's the point: it blocks the *attempt*, not just a
 *   specific wrong password.
 * - `wp_login_failed` - records one real `success=0` row.
 * - `wp_login` - records one real `success=1` row.
 *
 * IP is read from `$_SERVER['REMOTE_ADDR']` only - never a client-supplied
 * `X-Forwarded-For`-style header, which is trivially spoofable and would
 * let an attacker blame (or exempt) an arbitrary IP.
 *
 * @class       LoginProtectionGuard class
 * @version     1.0.0
 * @author      VuloLabs
 */
class LoginProtectionGuard {

    /**
     * LoginProtectionGuard constructor.
     */
    public function __construct() {
        add_filter( 'authenticate', array( $this, 'block_if_locked_out' ), 30, 3 );
        add_action( 'wp_login_failed', array( $this, 'record_failure' ), 10, 2 );
        add_action( 'wp_login', array( $this, 'record_success' ), 10, 2 );
    }

    /**
     * Real client IP, `$_SERVER['REMOTE_ADDR']` only - see class docblock
     * for why a forwarded-for header is never trusted here.
     *
     * @return string Real IP, or '0.0.0.0' if genuinely unavailable (e.g. CLI context).
     */
    private function get_client_ip(): string {
        $raw = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.MissingUnslash

        $valid = filter_var( $raw, FILTER_VALIDATE_IP );

        return $valid ? $valid : '0.0.0.0';
    }

    /**
     * Real settings, parsed with defaults - same `wp_parse_args()` shape
     * every scanner in this codebase already reads settings with.
     *
     * @return array<string, mixed>
     */
    private function get_settings(): array {
        return wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
    }

    /**
     * The `authenticate` filter callback - see class docblock.
     *
     * @param \WP_User|\WP_Error|null $user     Current authentication result.
     * @param string                  $username Real username/email being attempted.
     * @param string                  $password Real password being attempted (never stored).
     * @return \WP_User|\WP_Error|null
     */
    public function block_if_locked_out( $user, string $username, string $password ) {
        // No credentials submitted yet (e.g. the login form's first load) -
        // nothing to check.
        if ( '' === $username && '' === $password ) {
            return $user;
        }

        $settings = $this->get_settings();

        if ( empty( $settings['enable_login_protection'] ) ) {
            return $user;
        }

        $max_attempts    = max( 1, absint( $settings['login_max_attempts'] ) ?: 5 );
        $lockout_minutes = max( 1, absint( $settings['login_lockout_minutes'] ) ?: 15 );

        $repository = new LoginAttemptRepository();
        $ip_address = $this->get_client_ip();

        if ( $repository->count_recent_failures( $ip_address, $lockout_minutes ) < $max_attempts ) {
            return $user;
        }

        return new \WP_Error(
            'vulopilot_locked_out',
            sprintf(
                /* translators: %d is how many minutes until this IP can try again. */
                __( '<strong>Error:</strong> Too many failed login attempts. Please try again in %d minutes.', 'vulopilot' ),
                $lockout_minutes
            )
        );
    }

    /**
     * `wp_login_failed` callback - records one real failed attempt.
     *
     * @param string          $username Real username/email that was attempted.
     * @param \WP_Error|mixed $error    Core's own real authentication error (unused - only the fact of failure matters here).
     * @return void
     */
    public function record_failure( string $username, $error = null ): void {
        $settings = $this->get_settings();

        if ( empty( $settings['enable_login_protection'] ) ) {
            return;
        }

        ( new LoginAttemptRepository() )->insert(
            array(
                'ip_address'         => $this->get_client_ip(),
                'username_attempted' => sanitize_user( $username ),
                'success'            => 0,
                'created_at'         => current_time( 'mysql' ),
            )
        );
    }

    /**
     * `wp_login` callback - records one real successful attempt. Failures
     * still age out of the rolling lockout window naturally (no need to
     * clear them here) - see LoginAttemptRepository::count_recent_failures().
     *
     * @param string           $user_login Real username that logged in.
     * @param \WP_User|mixed   $user       Core's own real WP_User (unused).
     * @return void
     */
    public function record_success( string $user_login, $user = null ): void {
        $settings = $this->get_settings();

        if ( empty( $settings['enable_login_protection'] ) ) {
            return;
        }

        ( new LoginAttemptRepository() )->insert(
            array(
                'ip_address'         => $this->get_client_ip(),
                'username_attempted' => sanitize_user( $user_login ),
                'success'            => 1,
                'created_at'         => current_time( 'mysql' ),
            )
        );
    }
}

/**
 * Readme.txt's "Redirects & 404s" - the `log_404s` setting's own
 * implementation, distinct from Scanners\Basic\NotFoundScanner (which only
 * checks this site's OWN published permalinks for internal links pointing
 * at a 404, a content-integrity check with no visitor traffic involved).
 * This logs real visitor requests that actually 404, so a site owner can
 * see which missing URLs are still being hit and turn the worthwhile ones
 * into a redirect from the Redirects page - readme.txt's own description:
 * "Track visits to missing pages so you can turn them into redirect
 * suggestions."
 *
 * Self-registers on `template_redirect` at priority 20 - after
 * Services\RedirectManager's own priority-1 hook has had a chance to
 * redirect the request away first, so a path that already HAS a configured
 * redirect is never also logged as a 404 (by the time this runs, a
 * matched redirect has already `exit`ed the request).
 *
 * No IP address or other visitor-identifying data, ever - same posture
 * CrawlerTrafficLogger's own docblock documents for the same reason (this
 * plugin's general privacy stance on visit logging, not a promise specific
 * to crawler traffic).
 *
 * @class       NotFoundLogger class
 * @version     1.0.0
 * @author      VuloLabs
 */
class NotFoundLogger {

    /**
     * Path prefixes that mark a 404 as "system" rather than a missing
     * CONTENT page - core/theme/plugin asset directories and browser/
     * tooling auto-probe paths (Chrome DevTools' own
     * `/.well-known/appspecific/com.chrome.devtools.json`, Apple's
     * `/.well-known/apple-app-site-association`, etc.). On a site where
     * every unmatched request routes through `index.php` (any normal
     * pretty-permalink rewrite setup), a stale/renamed theme or plugin
     * asset URL - or a browser silently probing a well-known path - is a
     * genuine WordPress 404 exactly like a real missing content page is,
     * but nobody ever wants to "create a redirect" for
     * `/wp-content/themes/x/assets/old.css`. These are still logged (real
     * 404s, real data) - `is_system_path()` below is what lets
     * `log_or_increment()` route them to `is_system = 1` instead of
     * dropping them, so RedirectsTab.tsx's main missing-page list can stay
     * scoped to `is_system = 0` while its own "System 404s" link still
     * shows the rest.
     *
     * @var string[]
     */
    private const SYSTEM_PATH_PREFIXES = array( '/wp-content/', '/wp-includes/', '/wp-admin/', '/.well-known/' );

    /**
     * File extensions treated the same way as SYSTEM_PATH_PREFIXES above -
     * a static asset request that 404s (an old cached bundle hash, a
     * favicon, a source map) is the same kind of "system, not content" 404
     * even when it isn't under one of those directories (a root-level
     * `/favicon.ico`, an upload under `/wp-content/uploads/` already
     * caught by the prefix check above but listed again here for anything
     * similar outside it).
     *
     * @var string[]
     */
    private const SYSTEM_EXTENSIONS = array(
        'css',
        'js',
        'mjs',
        'map',
        'json',
        'xml',
        'png',
        'jpg',
        'jpeg',
        'gif',
        'svg',
        'webp',
        'avif',
        'ico',
        'woff',
        'woff2',
        'ttf',
        'eot',
        'otf',
        'zip',
        'txt',
        'pdf',
        'mp4',
        'webm',
        'mp3',
        'csv',
    );

    /**
     * NotFoundLogger constructor.
     */
    public function __construct() {
        add_action( 'template_redirect', array( $this, 'maybe_log' ), 20 );
    }

    /**
     * Logs the current request as a 404 visit, if it is one - classified
     * as `is_system` (see is_system_path()) or a real content-page miss.
     *
     * @return void
     */
    public function maybe_log(): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['log_404s'] ) || ! is_404() ) {
            return;
        }

        $requested_uri  = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
        $path           = wp_parse_url( $requested_uri, PHP_URL_PATH ) ?? '/';
        $requested_path = RedirectRepository::normalize_path( $path );
        $referrer       = wp_get_referer();

        ( new NotFoundLogRepository() )->log_or_increment(
            $requested_path,
            $referrer ? esc_url_raw( $referrer ) : null,
            self::is_system_path( $requested_path )
        );
    }

    /**
     * Checks a path against SYSTEM_PATH_PREFIXES/SYSTEM_EXTENSIONS.
     *
     * @param string $path Already-normalized request path (RedirectRepository::normalize_path()).
     * @return bool True if this path is a static asset/tooling-probe request, not a real missing content page.
     */
    private static function is_system_path( string $path ): bool {
        foreach ( self::SYSTEM_PATH_PREFIXES as $prefix ) {
            if ( 0 === strpos( $path, $prefix ) ) {
                return true;
            }
        }

        $extension = strtolower( (string) pathinfo( $path, PATHINFO_EXTENSION ) );

        return '' !== $extension && in_array( $extension, self::SYSTEM_EXTENSIONS, true );
    }
}

/**
 * Free's "Send Visibility Report" automation's real action - generates a
 * `scan_summary` report (Reports\Types\ScanSummaryReport already has
 * exactly the headline numbers/trend the spec's own bullet list wants: open/
 * resolved/critical finding counts, week-over-week trend) and emails a
 * plain-language summary of it. No new report type needed.
 *
 * Deliberately its own small class rather than reusing
 * vulopilot-pro's AdvancedReports\ScheduledReportRunner - that class is Pro
 * business logic keyed to `vulopilot_scheduled_jobs`/multi-format/multi-
 * recipient job configs; this is Free's own fixed, single-recipient,
 * single-report-type case, following the same "own small class per
 * concern" precedent Services\BackupScheduler/BackupManager already set
 * rather than being forced through a heavier Pro-oriented job system.
 *
 * @class       VisibilityReportMailer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VisibilityReportMailer {

    private const REPORT_TYPE = 'scan_summary';

    /**
     * @var ReportGenerator
     */
    private ReportGenerator $generator;

    /**
     * @var ReportRepository
     */
    private ReportRepository $reports;

    /**
     * @var FindingRepository
     */
    private FindingRepository $findings;

    /**
     * @param ReportGenerator         $generator Generates the underlying scan_summary report.
     * @param ReportRepository|null   $reports   Defaults to a new instance - injectable for tests.
     * @param FindingRepository|null  $findings  Defaults to a new instance - injectable for tests.
     */
    public function __construct( ReportGenerator $generator, ?ReportRepository $reports = null, ?FindingRepository $findings = null ) {
        $this->generator = $generator;
        $this->reports    = $reports ?? new ReportRepository();
        $this->findings   = $findings ?? new FindingRepository();
    }

    /**
     * @param string $frequency 'weekly'|'monthly' - the automation row's own `trigger_config.frequency`.
     * @return bool True if a report was generated and an email was sent (or there was nothing to email to).
     */
    public function send( string $frequency ): bool {
        [ $period_start, $period_end ] = $this->period_for_frequency( $frequency );

        $report_id = $this->generator->generate( self::REPORT_TYPE, 'json', $period_start, $period_end, array(), 0 );

        $report = $this->reports->find( $report_id );

        if ( ! $report || 'ready' !== $report['status'] ) {
            return false;
        }

        $meta = json_decode( (string) $report['meta'], true );
        $meta = is_array( $meta ) ? $meta : array();

        $recipient = $this->resolve_recipient();

        if ( ! $recipient ) {
            return false;
        }

        $top_findings = $this->findings->get_top_findings_for_period( $period_start, $period_end, null, 5 );

        return $this->mail(
            $recipient,
            (array) ( $meta['summary'] ?? array() ),
            (array) ( $meta['trend'] ?? array() ),
            $top_findings,
            $period_start,
            $period_end
        );
    }

    /**
     * @param string $frequency 'weekly'|'monthly'.
     * @return array{0: string, 1: string} [period_start, period_end], both Y-m-d.
     */
    private function period_for_frequency( string $frequency ): array {
        $end = current_time( 'Y-m-d' );

        $start = 'monthly' === $frequency
            ? gmdate( 'Y-m-d', strtotime( '-29 days', strtotime( $end ) ) )
            : gmdate( 'Y-m-d', strtotime( '-6 days', strtotime( $end ) ) );

        return array( $start, $end );
    }

    /**
     * @return string Empty string when there's genuinely nowhere to send this.
     */
    private function resolve_recipient(): string {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        $recipient = (string) ( $settings['notification_email'] ?? '' );

        if ( $recipient && is_email( $recipient ) ) {
            return $recipient;
        }

        return (string) get_option( 'admin_email' );
    }

    /**
     * @param string                $recipient    Real, already-validated email address.
     * @param array<string, mixed>  $summary      ReportResult::get_summary() from the just-generated report.
     * @param array<string, mixed>  $trend        ReportResult::get_trend() from the just-generated report.
     * @param array<int, array>     $top_findings Up to 5 real open findings, most severe first.
     * @param string                $period_start Y-m-d.
     * @param string                $period_end   Y-m-d.
     * @return bool wp_mail()'s own return value.
     */
    private function mail( string $recipient, array $summary, array $trend, array $top_findings, string $period_start, string $period_end ): bool {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $headers  = array( 'Content-Type: text/html; charset=UTF-8' );

        if ( ! empty( $settings['email_from_address'] ) && is_email( $settings['email_from_address'] ) ) {
            $from_name = $settings['email_from_name'] ?: get_bloginfo( 'name' );
            $headers[] = sprintf( 'From: %s <%s>', $from_name, $settings['email_from_address'] );
        }

        $subject = sprintf(
            /* translators: %s: site name. */
            __( '[%s] Your VuloPilot Visibility Report', 'vulopilot' ),
            get_bloginfo( 'name' )
        );

        ob_start();
        ?>
        <p><?php echo esc_html( sprintf( /* translators: 1: period start, 2: period end. */ __( 'Here\'s your visibility summary for %1$s – %2$s.', 'vulopilot' ), $period_start, $period_end ) ); ?></p>
        <ul>
            <li><?php echo esc_html( sprintf( /* translators: %d: number. */ __( '%d open issues', 'vulopilot' ), (int) ( $summary['open_findings'] ?? 0 ) ) ); ?></li>
            <li><?php echo esc_html( sprintf( /* translators: %d: number. */ __( '%d resolved this period', 'vulopilot' ), (int) ( $summary['resolved_findings'] ?? 0 ) ) ); ?></li>
            <li><?php echo esc_html( sprintf( /* translators: %d: number. */ __( '%d critical issues', 'vulopilot' ), (int) ( $summary['critical_findings'] ?? 0 ) ) ); ?></li>
        </ul>
        <?php if ( isset( $trend['total_findings'] ) && null !== $trend['total_findings']['change_percent'] ) : ?>
            <p><?php echo esc_html( sprintf( /* translators: %s: signed percent change, e.g. "+12%" or "-8%". */ __( 'Total findings changed %s vs. the previous period.', 'vulopilot' ), ( $trend['total_findings']['change_percent'] >= 0 ? '+' : '' ) . round( $trend['total_findings']['change_percent'], 1 ) . '%' ) ); ?></p>
        <?php endif; ?>
        <?php if ( $top_findings ) : ?>
            <p><strong><?php esc_html_e( 'Pages needing attention:', 'vulopilot' ); ?></strong></p>
            <ul>
                <?php foreach ( $top_findings as $finding ) : ?>
                    <li><?php echo esc_html( (string) $finding['title'] ); ?> (<?php echo esc_html( ucfirst( (string) $finding['severity'] ) ); ?>)</li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
        <p><?php esc_html_e( 'Sign in to your dashboard to see the full picture and recommended next steps.', 'vulopilot' ); ?></p>
        <?php
        $body = (string) ob_get_clean();

        return wp_mail( $recipient, $subject, $body, $headers );
    }
}
