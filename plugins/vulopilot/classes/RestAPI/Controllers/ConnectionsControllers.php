<?php
/**
 * Every class in this file used to be its own file under classes/RestAPI/Controllers/
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

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\BackupRepository;
use VuloPilot\Repositories\CrawlerVisitRepository;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\IndexNowLogRepository;
use VuloPilot\Services\AiByokGatewayClient;
use VuloPilot\Services\AiCreditsConnection;
use VuloPilot\Services\GoogleAdSenseClient;
use VuloPilot\Services\GoogleAnalyticsClient;
use VuloPilot\Services\GoogleServicesConnection;
use VuloPilot\Services\IndexNowClient;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Backs the AI Credits indicator/claim CTA (VuloPilot brief §4/§21) - a
 * real `GET .../status` (composes AiCreditsConnection + the underlying
 * VuloCloudAccountConnection's own status, see that class's own
 * get_status() docblock) and a real `POST .../refresh-balance` (force a
 * live re-sync from VuloCloud's own authoritative wallet). Connecting
 * itself goes through `vulocloud-ai-connection/broker-authorize-url`'s
 * passwordless redirect (AiCreditsConnection::get_broker_authorize_url()'s
 * own docblock), not a route on this controller.
 *
 * Same "never let a raw secret reach the client" boundary
 * GoogleServices.php's own docblock documents - every method here only
 * ever returns AiCreditsConnection::get_status()'s shape.
 *
 * @class       AiCredits controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiCredits extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'ai-credits';

    /**
     * Registers this controller's routes.
     *
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/status',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_status' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/refresh-balance',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'refresh_balance' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/disconnect',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'disconnect' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * `GET .../status`.
     *
     * @return \WP_REST_Response
     */
    public function get_status() {
        return rest_ensure_response( ( new AiCreditsConnection() )->get_status() );
    }

    /**
     * `POST .../refresh-balance`.
     *
     * @return \WP_REST_Response|\WP_Error
     */
    public function refresh_balance() {
        $result = ( new AiCreditsConnection() )->refresh_balance();

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( $result );
    }

    /**
     * `POST .../disconnect`.
     *
     * @return \WP_REST_Response
     */
    public function disconnect() {
        $connection = new AiCreditsConnection();
        $connection->disconnect();

        return rest_ensure_response( $connection->get_status() );
    }
}

/**
 * `GET /backups` lists real backup runs; `POST /backups` starts a real
 * manual backup (never runs synchronously - `VuloPilot()->backup_manager`
 * processes it via WP-Cron in small batches, same "GET lists, POST
 * triggers, persistence happens elsewhere" shape `Scans.php`/`PageSpeed.php`
 * already use); `GET /backups/{id}/download` streams the real archive
 * through this permission-checked handler rather than ever exposing
 * `file_path` to the client, same posture `Reports.php::download_item()`
 * already established; `DELETE /backups/{id}` removes the real row + real
 * file; `POST /backups/{id}/restore` is Recovery's real, destructive
 * restore - always preceded here by a real, synchronously-completed
 * pre-restore safety snapshot before `BackupManager::restore()` is ever
 * called (Recovery's first of three safety nets; the second - a typed
 * confirmation gate - lives in the frontend; the third is
 * `BackupManager::restore()`'s own real activity-log audit entry).
 *
 * @class       Backups controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Backups extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'backups';

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::DELETABLE,
                    'callback'            => array( $this, 'delete_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/download',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'download_item' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/restore',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'restore_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );
    }

    /**
     * @inheritDoc
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function create_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function get_items( $request ) {
        $repository = new BackupRepository();

        $result = $repository->find_all(
            array(
                'page'         => absint( $request->get_param( 'page' ) ) ?: 1,
                'per_page'     => absint( $request->get_param( 'per_page' ) ) ?: 20,
                'status'       => sanitize_key( (string) $request->get_param( 'status' ) ),
                'trigger_type' => sanitize_key( (string) $request->get_param( 'trigger_type' ) ),
                'orderby'      => sanitize_key( (string) $request->get_param( 'orderby' ) ) ?: 'id',
                'order'        => sanitize_key( (string) $request->get_param( 'order' ) ) ?: 'desc',
            )
        );

        // file_path is deliberately never exposed to the client - same
        // DATABASE.md posture Reports.php::get_items() already established.
        $result['data'] = array_map(
            static function ( array $row ): array {
                $row['has_file'] = ! empty( $row['file_path'] );
                unset( $row['file_path'] );
                return $row;
            },
            $result['data']
        );

        return rest_ensure_response( $result );
    }

    /**
     * Starts a real manual backup - never runs synchronously.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function create_item( $request ) {
        $backup_id = VuloPilot()->backup_manager->start_backup( 'manual' );

        return rest_ensure_response(
            array(
                'success' => true,
                'id'      => $backup_id,
            )
        );
    }

    /**
     * Deletes a real backup row and its real file.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function delete_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new BackupRepository();
        $backup     = $repository->find( $id );

        if ( ! $backup ) {
            return new \WP_Error( 'vulopilot_backup_not_found', __( 'Backup not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        if ( ! empty( $backup['file_path'] ) ) {
            $file_path = VuloPilot()->backup_manager->resolve_file_path( (string) $backup['file_path'] );

            if ( file_exists( $file_path ) ) {
                // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- deleting VuloPilot's own controlled backup file, not arbitrary user input.
                unlink( $file_path );
            }
        }

        // Real remote-copy cleanup (S3/Google Drive) - a no-op for a
        // 'local'-only backup or one whose upload never finished. See
        // Services\BackupStorageManager::delete_remote_copy()'s own
        // docblock.
        VuloPilot()->backup_storage_manager->delete_remote_copy( $backup );

        $repository->delete( $id );

        return rest_ensure_response( array( 'success' => true ) );
    }

    /**
     * Streams a real backup archive rather than ever returning its
     * filesystem path to the client - same posture
     * `Reports.php::download_item()` already established.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|void
     */
    public function download_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new BackupRepository();
        $backup     = $repository->find( $id );

        if ( ! $backup ) {
            return new \WP_Error( 'vulopilot_backup_not_found', __( 'Backup not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        if ( 'completed' !== $backup['status'] || empty( $backup['file_path'] ) ) {
            return new \WP_Error( 'vulopilot_backup_not_ready', __( 'This backup is not ready to download yet.', 'vulopilot' ), array( 'status' => 409 ) );
        }

        $file_path = VuloPilot()->backup_manager->resolve_file_path( (string) $backup['file_path'] );

        if ( ! file_exists( $file_path ) ) {
            return new \WP_Error( 'vulopilot_backup_file_missing', __( 'This backup\'s file could not be found on disk.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        nocache_headers();
        header( 'Content-Type: application/zip' );
        header( 'Content-Disposition: attachment; filename="' . basename( $file_path ) . '"' );
        header( 'Content-Length: ' . filesize( $file_path ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_filesize -- reading the size of VuloPilot's own controlled backup file, not an arbitrary path.

        readfile( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile -- streaming VuloPilot's own controlled backup file to an already permission-checked request; not arbitrary user input.
        exit;
    }

    /**
     * Real, destructive Recovery restore. Always takes a real,
     * synchronously-completed pre-restore safety snapshot first - see this
     * class's own docblock for the full 3-safety-net posture.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function restore_item( $request ) {
        $id = absint( $request->get_param( 'id' ) );

        $safety_backup_id = VuloPilot()->backup_manager->start_backup( 'pre_restore_safety' );
        VuloPilot()->backup_manager->run_queue_synchronously();

        $result = VuloPilot()->backup_manager->restore( $id );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response(
            array(
                'success'           => true,
                'safety_backup_id'  => $safety_backup_id,
            )
        );
    }
}

/**
 * Backs src/pages/CrawlerTraffic/CrawlerTraffic.tsx (AI Crawler Traffic
 * Monitoring, readme.txt). `GET /crawler-traffic` is the paginated raw
 * visit log + filter-pill bar, same shape as ActivityLogs.php.
 * `GET /crawler-traffic/summary` is a separate, lightweight route for the
 * page's aggregate section (last-seen per bot, most-crawled pages, daily
 * volume) rather than bloating the paginated list response.
 *
 * @class       CrawlerTraffic controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class CrawlerTraffic extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'crawler-traffic';

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/summary',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_summary' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        // GET-only, real current-vs-previous-period comparison - backs the
        // restyled Crawler Traffic tab's stat row + Top Crawlers/Most
        // Crawled Pages tables (CrawlerVisitRepository::get_period_comparison()'s
        // own docblock). Composed here rather than in the repository
        // because it needs FindingRepository's own real blocked-pages count
        // too - a repository shouldn't reach into a sibling table.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/analytics',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_analytics' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );
    }

    /**
     * @inheritDoc
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function get_items( $request ) {
        $repository = new CrawlerVisitRepository();

        $result                    = $repository->find_all(
            array(
                'page'     => absint( $request->get_param( 'page' ) ) ?: 1,
                'per_page' => absint( $request->get_param( 'per_page' ) ) ?: 20,
                'bot_name' => sanitize_text_field( (string) $request->get_param( 'bot_name' ) ),
                'search'   => sanitize_text_field( (string) $request->get_param( 'search' ) ),
                'orderby'  => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                'order'    => sanitize_key( (string) $request->get_param( 'order' ) ),
            )
        );
        $result['bot_name_counts'] = $repository->get_bot_counts();

        return rest_ensure_response( $result );
    }

    /**
     * `GET /crawler-traffic/analytics` - real current-vs-previous-period
     * comparison (CrawlerVisitRepository::get_period_comparison()) plus a
     * real "by AI lab" breakdown and the real open blocked-pages count.
     * There's deliberately no "search engines vs AI engines" split here the
     * way the reference mockup's own "Crawler Types" donut shows - this
     * plugin's own BOT_SIGNATURES list (CrawlerTrafficLogger's own
     * docblock) only ever detects AI/answer-engine crawlers, never classic
     * search engines, so every real row would land in one bucket and the
     * other two would always read zero. Grouped by AI lab instead (the
     * vendor name each bot's own display string already carries in
     * parentheses, e.g. "GPTBot (OpenAI)" → "OpenAI") - a real, meaningful
     * split of the traffic this plugin actually tracks.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_analytics( $request ) {
        $days       = absint( $request->get_param( 'days' ) ) ?: 30;
        $repository = new CrawlerVisitRepository();
        $comparison = $repository->get_period_comparison( $days );

        $by_vendor = array();
        foreach ( $comparison['top_crawlers'] as $crawler ) {
            $vendor = $crawler['bot_name'];
            if ( preg_match( '/\(([^)]+)\)\s*$/', $crawler['bot_name'], $matches ) ) {
                $vendor = $matches[1];
            }
            $by_vendor[ $vendor ] = ( $by_vendor[ $vendor ] ?? 0 ) + $crawler['total'];
        }
        arsort( $by_vendor );

        $findings             = new FindingRepository();
        $blocked_pages_total  = $findings->find_all(
            array(
                'scanner_id' => 'ai-crawler-blocked-pages',
                'status'     => 'open',
                'per_page'   => 1,
            )
        )['total'];

        // Same real weighted-severity formula Controllers\Seo::calculate_score()/
        // Controllers\Geo::calculate_score() already use, scoped to the exact
        // same 4 real scanner ids CrawlerAnalyticsSection.tsx's own
        // CHECKLIST_ITEMS already groups its "Crawl Health Checklist" into
        // (robots.txt reachable, sitemap reachable, no critical AI-bot
        // blocks) - one real number standing in for what that checklist
        // already shows as 3 separate pass/fail rows, for the mockup's own
        // "Overall Crawl Health" ring. Frontend only renders this ring while
        // the SEO module is active (same `isSeoModuleActive()` gate the
        // checklist itself already requires) - these scanners simply never
        // run otherwise, so 0 open findings there would be a false "100",
        // not a real one.
        $crawl_scanner_ids   = array( 'robots-txt', 'sitemap', 'sitemap-validation', 'ai-crawler-blocked-pages' );
        $crawl_health_score  = $this->calculate_score( $findings->get_severity_breakdown_for_scanner_ids( $crawl_scanner_ids ) );

        return rest_ensure_response(
            array_merge(
                $comparison,
                array(
                    'by_vendor'            => $by_vendor,
                    'blocked_pages_total'  => (int) $blocked_pages_total,
                    'daily_volume'         => $repository->get_daily_volume( $days ),
                    'crawl_health_score'   => $crawl_health_score,
                )
            )
        );
    }

    /**
     * Same weighting `Controllers\Seo::calculate_score()`/
     * `Controllers\Geo::calculate_score()` already use - kept as its own
     * private copy here rather than a shared trait, same "each controller
     * keeps its own copy" convention those two (plus BrandIntelligence)
     * already established.
     *
     * @param array{critical: int, high: int, medium: int, low: int} $breakdown Severity breakdown to score.
     * @return int 0-100.
     */
    private function calculate_score( array $breakdown ): int {
        $score = 100
            - ( $breakdown['critical'] * 15 )
            - ( $breakdown['high'] * 8 )
            - ( $breakdown['medium'] * 3 )
            - ( $breakdown['low'] * 1 );

        return max( 0, min( 100, $score ) );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_summary( $request ) {
        $repository = new CrawlerVisitRepository();
        $days       = absint( $request->get_param( 'days' ) ) ?: 30;

        return rest_ensure_response(
            array(
                'bot_last_seen'      => $repository->get_bot_last_seen(),
                'most_crawled_pages' => $repository->get_most_crawled_pages(),
                'daily_volume'       => $repository->get_daily_volume( $days ),
            )
        );
    }
}

/**
 * Backs Settings → Connections → Google Services' real "Connect Google
 * Services" flow (GoogleServicesPanel.tsx) and the Keywords tab's own
 * real connection-status read (KeywordsTab.tsx). Replaces the earlier,
 * narrower Controllers\SearchConsole - one connection now covers Search
 * Console, Analytics (GA4), and AdSense, matching the reference flow's
 * own single-button/multi-service consent screen.
 *
 * Every route here delegates to GoogleServicesConnection (real OAuth) or
 * GoogleAnalyticsClient/GoogleAdSenseClient (real per-service API calls)
 * - see those classes' own docblocks. `get_status()` never returns a
 * client secret, access token, or refresh token - same
 * "repositories/REST controllers never see a raw secret" boundary
 * Controllers\VuloCloudAiConnection::prepare_config_for_response() already
 * documents for AI service credentials.
 *
 * @class       GoogleServices controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleServices extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'google-services';

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/status',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_status' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/authorize-url',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_authorize_url' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/disconnect',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'disconnect' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/test-connections',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'test_connections' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        // Search Console.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/search-console-sites',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_search_console_sites' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/select-search-console-site',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'select_search_console_site' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        // Analytics (GA4).
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/analytics-accounts',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_analytics_accounts' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/analytics-data-streams',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_analytics_data_streams' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/select-analytics-property',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'select_analytics_property' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        // AdSense.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/adsense-accounts',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_adsense_accounts' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/select-adsense-account',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'select_adsense_account' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @return \WP_REST_Response
     */
    public function get_status() {
        return rest_ensure_response( ( new GoogleServicesConnection() )->get_status() );
    }

    /**
     * `return_to` is validated again inside
     * GoogleServicesConnection::get_authorization_url() itself (an
     * unrecognized value there silently falls back to 'settings') - this
     * `sanitize_text_field()` is just normal REST param hygiene, not the
     * real allow-list check.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_authorize_url( $request ) {
        $return_to = sanitize_text_field( (string) $request->get_param( 'return_to' ) );
        $url       = ( new GoogleServicesConnection() )->get_authorization_url( $return_to ?: 'settings' );

        if ( ! $url ) {
            return new \WP_Error( 'vulopilot_gsc_no_credentials', __( 'Google Connect isn’t configured for this build yet.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        return rest_ensure_response( array( 'url' => $url ) );
    }

    /**
     * @return \WP_REST_Response
     */
    public function disconnect() {
        $connection = new GoogleServicesConnection();
        $connection->disconnect();

        return rest_ensure_response( $connection->get_status() );
    }

    /**
     * Real per-service pings - a stored refresh token that's been revoked
     * in Google's own account settings would still read `connected: true`
     * from `get_status()` (nothing has told VuloPilot otherwise yet), so
     * this is the "Test Connections" button's own real check, one real
     * call per service rather than trusting the stored flag.
     *
     * @return \WP_REST_Response
     */
    public function test_connections() {
        $connection = new GoogleServicesConnection();

        $search_console = $connection->list_search_console_sites();
        $analytics      = ( new GoogleAnalyticsClient( $connection ) )->list_account_summaries();
        $adsense        = ( new GoogleAdSenseClient( $connection ) )->list_accounts();

        return rest_ensure_response(
            array(
                'search_console' => ! is_wp_error( $search_console ),
                'analytics'       => ! is_wp_error( $analytics ),
                'adsense'         => ! is_wp_error( $adsense ),
            )
        );
    }

    /**
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_search_console_sites() {
        $sites = ( new GoogleServicesConnection() )->list_search_console_sites();

        if ( is_wp_error( $sites ) ) {
            return $sites;
        }

        return rest_ensure_response( $sites );
    }

    /**
     * `sanitize_text_field()`, not `esc_url_raw()` - a real Search
     * Console property is either a URL-prefix property
     * (`https://example.com/`) or a domain property
     * (`sc-domain:example.com`, no recognized URL scheme), and
     * `esc_url_raw()` would silently strip that second, completely valid
     * form since `sc-domain:` isn't in `wp_allowed_protocols()`. Checked
     * against this site's own real `list_search_console_sites()` result
     * rather than trusted as-is, so this can't be used to point the
     * connection at an arbitrary property this account doesn't actually
     * have verified access to.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function select_search_console_site( $request ) {
        $site_url = sanitize_text_field( (string) $request->get_param( 'site_url' ) );

        if ( '' === $site_url ) {
            return new \WP_Error( 'vulopilot_gsc_missing_site', __( 'No site selected.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $connection = new GoogleServicesConnection();
        $sites      = $connection->list_search_console_sites();

        if ( is_wp_error( $sites ) ) {
            return $sites;
        }

        if ( ! in_array( $site_url, array_column( $sites, 'site_url' ), true ) ) {
            return new \WP_Error( 'vulopilot_gsc_unknown_site', __( 'That property isn’t in your Search Console account.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $connection->select_search_console_site( $site_url );

        return rest_ensure_response( $connection->get_status() );
    }

    /**
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_analytics_accounts() {
        $accounts = ( new GoogleAnalyticsClient() )->list_account_summaries();

        if ( is_wp_error( $accounts ) ) {
            return $accounts;
        }

        return rest_ensure_response( $accounts );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_analytics_data_streams( $request ) {
        $property_id = sanitize_text_field( (string) $request->get_param( 'property_id' ) );

        if ( '' === $property_id ) {
            return new \WP_Error( 'vulopilot_ga4_missing_property', __( 'No property given.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $streams = ( new GoogleAnalyticsClient() )->list_data_streams( $property_id );

        if ( is_wp_error( $streams ) ) {
            return $streams;
        }

        return rest_ensure_response( $streams );
    }

    /**
     * Validated against a fresh real `list_account_summaries()`/
     * `list_data_streams()` pair rather than trusting the posted
     * account/property names as-is - same "never let the client dictate
     * what gets stored without a real server-side check" posture
     * `select_search_console_site()` above already takes.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function select_analytics_property( $request ) {
        $account_id     = sanitize_text_field( (string) $request->get_param( 'account_id' ) );
        $property_id    = sanitize_text_field( (string) $request->get_param( 'property_id' ) );
        $data_stream_id = sanitize_text_field( (string) $request->get_param( 'data_stream_id' ) );

        if ( '' === $account_id || '' === $property_id || '' === $data_stream_id ) {
            return new \WP_Error( 'vulopilot_ga4_missing_selection', __( 'Account, property, and data stream are all required.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $analytics_client = new GoogleAnalyticsClient();
        $accounts          = $analytics_client->list_account_summaries();

        if ( is_wp_error( $accounts ) ) {
            return $accounts;
        }

        $account = current( array_filter( $accounts, static fn( $a ) => $a['account_id'] === $account_id ) );

        if ( ! $account ) {
            return new \WP_Error( 'vulopilot_ga4_unknown_account', __( 'That Analytics account isn’t available.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $property = current( array_filter( $account['properties'], static fn( $p ) => $p['property_id'] === $property_id ) );

        if ( ! $property ) {
            return new \WP_Error( 'vulopilot_ga4_unknown_property', __( 'That Analytics property isn’t available.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $streams = $analytics_client->list_data_streams( $property_id );

        if ( is_wp_error( $streams ) ) {
            return $streams;
        }

        $stream = current( array_filter( $streams, static fn( $s ) => $s['data_stream_id'] === $data_stream_id ) );

        if ( ! $stream ) {
            return new \WP_Error( 'vulopilot_ga4_unknown_stream', __( 'That data stream isn’t available.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $connection = new GoogleServicesConnection();
        $connection->select_ga4_property(
            array(
                'account_id'     => $account['account_id'],
                'account_name'   => $account['account_name'],
                'property_id'    => $property['property_id'],
                'property_name'  => $property['property_name'],
                'measurement_id' => $stream['measurement_id'],
            )
        );

        return rest_ensure_response( $connection->get_status() );
    }

    /**
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_adsense_accounts() {
        $accounts = ( new GoogleAdSenseClient() )->list_accounts();

        if ( is_wp_error( $accounts ) ) {
            return $accounts;
        }

        return rest_ensure_response( $accounts );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function select_adsense_account( $request ) {
        $account_id = sanitize_text_field( (string) $request->get_param( 'account_id' ) );

        if ( '' === $account_id ) {
            return new \WP_Error( 'vulopilot_adsense_missing_account', __( 'No AdSense account selected.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $accounts = ( new GoogleAdSenseClient() )->list_accounts();

        if ( is_wp_error( $accounts ) ) {
            return $accounts;
        }

        $account = current( array_filter( $accounts, static fn( $a ) => $a['account_id'] === $account_id ) );

        if ( ! $account ) {
            return new \WP_Error( 'vulopilot_adsense_unknown_account', __( 'That AdSense account isn’t available.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $connection = new GoogleServicesConnection();
        $connection->select_adsense_account( $account['account_id'], $account['display_name'] );

        return rest_ensure_response( $connection->get_status() );
    }
}

/**
 * Backs the Instant Indexing tab's two action-driven cards that don't fit
 * Controllers\Settings' per-field auto-save model (Settings.tsx's own
 * "special component" escape hatch - see that class's docblock): the
 * "Submit URLs" textarea/button (`POST /indexnow/submit`) and the
 * "History" table (`GET /indexnow/history`). The "auto-submit post types"/
 * "API key" fields still round-trip through the normal `/settings` GET/POST
 * endpoint like every other setting - only the parts of this tab that are
 * genuinely actions (not persisted fields) live here.
 *
 * @class       IndexNow controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class IndexNow extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'indexnow';

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/submit',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'submit_urls' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/history',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_history' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );
    }

    /**
     * Shared permission check for both routes in this controller - same
     * `manage_options` gate every other VuloPilot settings-adjacent
     * controller uses.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return bool
     */
    public function permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * Manually submits one or more URLs - the mockup's own "Submit URLs"
     * textarea/button. Each URL is logged and reported individually so the
     * UI can render per-URL results the same instant, without a second
     * `/history` fetch.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response|\WP_Error
     */
    public function submit_urls( $request ) {
        $raw_urls = $request->get_param( 'urls' );
        $urls     = is_array( $raw_urls ) ? $raw_urls : preg_split( '/[\r\n]+/', (string) $raw_urls );
        $urls     = array_values( array_filter( array_map( 'trim', (array) $urls ) ) );

        if ( ! $urls ) {
            return new \WP_Error( 'vulopilot_no_urls', __( 'No URLs were given.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $api_key  = (string) ( $settings['indexnow_api_key'] ?? '' );

        if ( '' === $api_key ) {
            return new \WP_Error( 'vulopilot_no_key', __( 'No IndexNow API key yet - reload the Instant Indexing tab once to generate one.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $client     = new IndexNowClient( $api_key );
        $repository = new IndexNowLogRepository();
        $results    = array();

        // IndexNow's own protocol accepts a batch in one request, but this
        // codebase logs per-URL rows (History is a per-URL list, matching
        // the mockup's own per-row table) - one client call per URL keeps
        // each row's own real, individual response code, rather than one
        // batch response applied identically to every URL regardless of
        // which of them actually succeeded.
        foreach ( $urls as $url ) {
            $result = $client->submit( array( $url ) );

            $repository->log( $url, $result['status_code'], $result['status'], 'manual' );

            $results[] = array_merge( array( 'url' => $url ), $result );
        }

        return rest_ensure_response( array( 'results' => $results ) );
    }

    /**
     * @return \WP_REST_Response
     */
    public function get_history() {
        return rest_ensure_response( ( new IndexNowLogRepository() )->get_recent() );
    }
}

/**
 * GET /plugin-overlap - backs "Protect My Site" → Files & Plugins' own
 * "VuloPilot already covers this" card.
 *
 * Deliberately NOT tied to any vulnerability finding: AdvancedVulnerabilitiesScanner's
 * own feed (LocalSeedVulnerabilityFeed) is illustrative-only sample data
 * matching two fictional plugin slugs - this repo's own documented policy
 * is to never name a real, currently-maintained third-party plugin in
 * relation to a vulnerability claim (see that class's own docblock). This
 * controller makes no such claim either way; it only checks whether a
 * real, currently-*active* plugin's category (SEO, security, accessibility,
 * caching, automation) overlaps with a real VuloPilot feature, the same
 * "known caching plugin" detection `EfficiencyChecks::has_known_caching_plugin()`
 * already does for its own unrelated check, generalized here across a
 * curated list of well-known plugin slugs.
 *
 * @class       PluginOverlap controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class PluginOverlap extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'plugin-overlap';

    /**
     * Curated, well-known WordPress.org plugin main-file paths (the same
     * `folder/file.php` shape `get_option('active_plugins')` stores and
     * `is_plugin_active()` checks against) mapped to the real VuloPilot
     * feature that covers the same ground. `module_id` is a real id from
     * src/components/Modules/index.ts's own catalog when the overlap is a
     * togglable Pro module; `null` for the caching/performance category,
     * which isn't gated behind a module toggle - its destination is the
     * "Improve My Speed" tab instead (`link_tab`).
     *
     * @var array<string, array{plugin_name: string, category: string, vulopilot_feature: string, module_id: string|null, link_tab: string}>
     */
    private const KNOWN_OVERLAPS = array(
        'wordpress-seo/wp-seo.php'                                     => array(
            'plugin_name'       => 'Yoast SEO',
            'category'          => 'seo',
            'vulopilot_feature' => 'SEO Copilot',
            'module_id'         => 'advanced-seo',
            'link_tab'          => 'modules',
        ),
        'seo-by-rank-math/rank-math.php'                               => array(
            'plugin_name'       => 'Rank Math SEO',
            'category'          => 'seo',
            'vulopilot_feature' => 'SEO Copilot',
            'module_id'         => 'advanced-seo',
            'link_tab'          => 'modules',
        ),
        'all-in-one-seo-pack/all_in_one_seo_pack.php'                  => array(
            'plugin_name'       => 'All in One SEO',
            'category'          => 'seo',
            'vulopilot_feature' => 'SEO Copilot',
            'module_id'         => 'advanced-seo',
            'link_tab'          => 'modules',
        ),
        'wordfence/wordfence.php'                                      => array(
            'plugin_name'       => 'Wordfence Security',
            'category'          => 'security',
            'vulopilot_feature' => 'Security Watchtower',
            'module_id'         => 'security-monitoring',
            'link_tab'          => 'modules',
        ),
        'sucuri-scanner/sucuri.php'                                    => array(
            'plugin_name'       => 'Sucuri Security',
            'category'          => 'security',
            'vulopilot_feature' => 'Security Watchtower',
            'module_id'         => 'security-monitoring',
            'link_tab'          => 'modules',
        ),
        'better-wp-security/better-wp-security.php'                    => array(
            'plugin_name'       => 'Solid Security (iThemes Security)',
            'category'          => 'security',
            'vulopilot_feature' => 'Security Watchtower',
            'module_id'         => 'security-monitoring',
            'link_tab'          => 'modules',
        ),
        'all-in-one-wp-security-and-firewall/wp-security.php'          => array(
            'plugin_name'       => 'All In One WP Security & Firewall',
            'category'          => 'security',
            'vulopilot_feature' => 'Security Watchtower',
            'module_id'         => 'security-monitoring',
            'link_tab'          => 'modules',
        ),
        'wp-accessibility/wp-accessibility.php'                        => array(
            'plugin_name'       => 'WP Accessibility',
            'category'          => 'accessibility',
            'vulopilot_feature' => 'Accessibility Guard',
            'module_id'         => 'accessibility-audits',
            'link_tab'          => 'modules',
        ),
        'uncanny-automator/uncanny-automator.php'                      => array(
            'plugin_name'       => 'Uncanny Automator',
            'category'          => 'automation',
            'vulopilot_feature' => 'Workflow Autopilot',
            'module_id'         => 'automations',
            'link_tab'          => 'modules',
        ),
        'wp-rocket/wp-rocket.php'                                      => array(
            'plugin_name'       => 'WP Rocket',
            'category'          => 'caching',
            'vulopilot_feature' => 'Efficiency checks & speed monitoring',
            'module_id'         => null,
            'link_tab'          => 'performance',
        ),
        'w3-total-cache/w3-total-cache.php'                            => array(
            'plugin_name'       => 'W3 Total Cache',
            'category'          => 'caching',
            'vulopilot_feature' => 'Efficiency checks & speed monitoring',
            'module_id'         => null,
            'link_tab'          => 'performance',
        ),
        'wp-super-cache/wp-cache.php'                                  => array(
            'plugin_name'       => 'WP Super Cache',
            'category'          => 'caching',
            'vulopilot_feature' => 'Efficiency checks & speed monitoring',
            'module_id'         => null,
            'link_tab'          => 'performance',
        ),
        'litespeed-cache/litespeed-cache.php'                          => array(
            'plugin_name'       => 'LiteSpeed Cache',
            'category'          => 'caching',
            'vulopilot_feature' => 'Efficiency checks & speed monitoring',
            'module_id'         => null,
            'link_tab'          => 'performance',
        ),
    );

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );
    }

    /**
     * @inheritDoc
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function get_items( $request ) {
        if ( ! function_exists( 'is_plugin_active' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $matches = array();

        foreach ( self::KNOWN_OVERLAPS as $plugin_file => $overlap ) {
            if ( is_plugin_active( $plugin_file ) ) {
                $matches[] = array_merge( array( 'plugin_file' => $plugin_file ), $overlap );
            }
        }

        // `data`/`total`, not a bespoke `matches` key - same response
        // shape every other real list endpoint in this codebase uses
        // (useApiList.ts's own `ListResponse<T>` contract), so the
        // frontend can read this the same way as any other list.
        return rest_ensure_response(
            array(
                'data'  => $matches,
                'total' => count( $matches ),
            )
        );
    }
}

/**
 * GET /vulocloud-ai-connection, GET /vulocloud-ai-connection/broker-authorize-url -
 * backs src/components/Settings/VuloCloudAiConnectionPanel.tsx
 * (Settings → Connections → VuloCloud AI): the "Connect to VuloCloud" /
 * "Disconnect" section. VuloCloud is the only place this site gets AI from -
 * it holds every key - so this only reports whether the site is connected and
 * whether VuloCloud has an AI key that resolves for it, and hands back the URL
 * the connect button sends the browser to.
 *
 * @class       VuloCloudAiConnection controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloCloudAiConnection extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'vulocloud-ai-connection';

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/broker-authorize-url',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_broker_authorize_url' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );
    }

    /**
     * @inheritDoc
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * `connected` is "this site has a VuloCloud site secret"; `configured` is
     * "an Organization's own (or an allowed Customer backup) AI key actually
     * resolves for this site right now".
     *
     * @inheritDoc
     */
    public function get_items( $request ) {
        // A cheap connection-status check (AiByokGatewayClient::status(),
        // never a key/prompt) - the real, current answer to "does AI work
        // for this site".
        $vulocloud_status = ( new AiByokGatewayClient() )->status();

        return rest_ensure_response(
            array(
                'vulocloud_status' => is_wp_error( $vulocloud_status )
                    ? array( 'connected' => false, 'configured' => false )
                    : $vulocloud_status,
            )
        );
    }

    /**
     * The URL the "Connect to VuloCloud" button itself 302s the browser
     * to - AiCreditsConnection::get_broker_authorize_url()'s own docblock
     * for the full passwordless sequence this kicks off.
     *
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_broker_authorize_url() {
        $url = ( new AiCreditsConnection() )->get_broker_authorize_url();

        if ( ! $url ) {
            return new \WP_Error( 'vulopilot_connect_broker_not_configured', __( 'VuloCloud isn’t configured for this build yet.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        return rest_ensure_response( array( 'url' => $url ) );
    }
}
