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

use VuloPilot\Automations\BuiltinAutomationSeeder;
use VuloPilot\Repositories\AutomationsRepository;
use VuloPilot\Repositories\AutomationsRunRepository;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\ScanRepository;
use VuloPilot\Scanners\ScannerRegistry;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * GET /automation-dashboard-stats backs src/pages/Automations/AutomationsPeriodStatsCard.tsx's
 * "This month" card and AutomationsStatsRow.tsx's own "last check" stat.
 * This route was missing entirely on a Free-only or unlicensed-Pro site -
 * vulopilot-pro's own AutomationsDashboardRest.php (`automation_dashboard`
 * key) already computes this exact same response entirely off Free's own
 * AutomationsRepository/AutomationsRunRepository - there was never any real
 * Pro-only aggregation here, just a missing Free-side registration, so both
 * cards silently rendered blank stat tiles on every site without a licensed
 * Pro Automations module, even though every number they need already comes
 * from Free's own 2 built-in automations' real run history.
 *
 * Registered under the same `automation_dashboard` key vulopilot-pro's own
 * Module.php uses, so Pro's own controller (registered later, when that
 * module is active) cleanly overrides this one at the same route rather
 * than colliding with it - identical relationship to `automations` above.
 *
 * @class       AutomationDashboardStats controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class AutomationDashboardStats extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'automation-dashboard-stats';

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
        $automations = new AutomationsRepository();
        $runs        = new AutomationsRunRepository();

        $period_param = (string) $request->get_param( 'period' );
        $period       = in_array( $period_param, array( 'week', 'month' ), true ) ? $period_param : 'today';
        $end          = current_time( 'Y-m-d' );

        $window_days = array(
            'today' => 1,
            'week'  => 7,
            'month' => 30,
        )[ $period ];

        $start          = gmdate( 'Y-m-d', strtotime( '-' . ( $window_days - 1 ) . ' days', strtotime( $end ) ) );
        $previous_end   = gmdate( 'Y-m-d', strtotime( '-1 day', strtotime( $start ) ) );
        $previous_start = gmdate( 'Y-m-d', strtotime( '-' . ( $window_days - 1 ) . ' days', strtotime( $previous_end ) ) );

        $stats                = $runs->get_stats_for_period( $start, $end );
        $action_totals        = $runs->get_action_totals_for_period( $start, $end );
        $action_type_totals   = $runs->get_action_type_totals_for_period( $start, $end );
        $previous_stats       = $runs->get_stats_for_period( $previous_start, $previous_end );
        $previous_totals      = $runs->get_action_totals_for_period( $previous_start, $previous_end );
        $previous_type_totals = $runs->get_action_type_totals_for_period( $previous_start, $previous_end );

        return rest_ensure_response(
            array(
                'period'                => $period,
                'period_start'          => $start,
                'period_end'            => $end,
                'previous_period_start' => $previous_start,
                'previous_period_end'   => $previous_end,
                'status_counts'         => $automations->get_status_counts(),
                'last_check_at'         => $runs->get_most_recent_finished_at(),
                'runs'                  => $stats['total'],
                'succeeded'             => $stats['by_status']['completed'] ?? 0,
                'failed'                => $stats['by_status']['failed'] ?? 0,
                'running'               => $stats['by_status']['running'] ?? 0,
                'actions_executed'      => $action_totals['executed'],
                'actions_failed'        => $action_totals['failed'],
                'changes_made'          => $action_totals['changes_made'],
                'action_type_totals'    => $action_type_totals,
                'previous'              => array(
                    'runs'               => $previous_stats['total'],
                    'succeeded'          => $previous_stats['by_status']['completed'] ?? 0,
                    'failed'             => $previous_stats['by_status']['failed'] ?? 0,
                    'actions_executed'   => $previous_totals['executed'],
                    'changes_made'       => $previous_totals['changes_made'],
                    'action_type_totals' => $previous_type_totals,
                ),
            )
        );
    }
}

/**
 * GET /automations backs src/pages/Automations/Automations.tsx's table.
 * POST /automations/{id} backs its Enable/Disable row action.
 * POST /automations/{id}/run backs its "Run now" row action - returns a
 * clear error rather than pretending to work: there is no trigger→action
 * execution engine anywhere in this codebase yet (only the DB schema, this
 * repository, and an unimplemented Contracts\Automations\TriggerInterface),
 * so there is nothing to actually run. This route exists so the button
 * gets an honest, specific failure message instead of a 404.
 *
 * This controller didn't exist at all before - the free plugin's own
 * Automations page called an endpoint with no backing route, so its table
 * could never load any data. Modeled directly on Findings.php's shape.
 *
 * @class       Automations controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Automations extends \WP_REST_Controller {

    /**
     * `workflow-automation` (this feature's own Settings → Modules id -
     * `components/Modules/index.ts`, `ShowProPopup moduleName`) is NOT this
     * route's own path segment - every real frontend consumer
     * (BuiltinAutomationCards.tsx, AutomationsAttentionCard.tsx,
     * AutomationStatusWidget.tsx) calls `getApiLink(appLocalizer,
     * 'automations')`, and this controller is itself registered under the
     * `'automations'` key in Rest.php's own controllers array - `$rest_base`
     * being `workflow-automation` instead of `automations` was a real,
     * silent typo/mix-up with that unrelated module id, resulting in every
     * one of those real GET calls 404ing (`/vulopilot/v1/automations` had
     * no route at all) rather than any of them actually reaching this
     * class's own `get_items()`. Confirmed live: before this fix,
     * `/vulopilot/v1/automations` 404s while `/vulopilot/v1/workflow-automation`
     * (this route, unreachable from the real app) 401s.
     *
     * @var string
     */
    protected $rest_base = 'automations';

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
            '/' . $this->rest_base . '/(?P<id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_item' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/run',
            array(
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'run_item' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
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
    public function update_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function get_items( $request ) {
        $repository = new AutomationsRepository();

        $status = sanitize_key( (string) $request->get_param( 'status' ) );
        $search = sanitize_text_field( (string) $request->get_param( 'search' ) );

        $result                  = $repository->find_all(
            array(
                'page'     => absint( $request->get_param( 'page' ) ) ?: 1,
                'per_page' => absint( $request->get_param( 'per_page' ) ) ?: 20,
                'status'   => $status,
                'search'   => $search,
                'orderby'  => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                'order'    => sanitize_key( (string) $request->get_param( 'order' ) ),
            )
        );
        $result['status_counts'] = $repository->get_status_counts();
        $result['data']          = self::with_next_run( self::with_last_run( $result['data'] ) );

        return rest_ensure_response( $result );
    }

    /**
     * @see \VuloPilotPro\Automations\AutomationsRest::with_next_run() - identical shape (that controller's own docblock explains the real cron-hook-per-trigger-type reasoning). Doesn't need `VuloPilotPro()->scheduler` - `wp_next_scheduled()` is a plain WP core read, not something only the Pro scheduler wrapper can do.
     *
     * @param array<int, array<string, mixed>> $rows Real automation rows, each with a real 'trigger_type'.
     * @return array<int, array<string, mixed>>
     */
    private static function with_next_run( array $rows ): array {
        $cron_trigger_types = array( 'hourly', 'daily', 'weekly', 'monthly' );
        $next_run_by_type   = array();

        foreach ( $cron_trigger_types as $trigger_type ) {
            $timestamp                        = wp_next_scheduled( 'vulopilot_automations_tick_' . $trigger_type );
            $next_run_by_type[ $trigger_type ] = $timestamp ? gmdate( 'Y-m-d H:i:s', $timestamp ) : null;
        }

        return array_map(
            static function ( array $row ) use ( $next_run_by_type ): array {
                $row['next_run_at'] = $next_run_by_type[ $row['trigger_type'] ?? '' ] ?? null;

                return $row;
            },
            $rows
        );
    }

    /**
     * @inheritDoc
     */
    public function update_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new AutomationsRepository();
        $row        = $repository->find( $id );

        if ( ! $row ) {
            return new \WP_Error( 'vulopilot_automations_not_found', __( 'Automation not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        $data = array();

        if ( null !== $request->get_param( 'status' ) ) {
            $status = sanitize_key( (string) $request->get_param( 'status' ) );

            if ( ! in_array( $status, array( 'enabled', 'disabled', 'draft' ), true ) ) {
                return new \WP_Error( 'vulopilot_invalid_status', __( 'Invalid automation status.', 'vulopilot' ), array( 'status' => 400 ) );
            }

            $data['status'] = $status;
        }

        if ( null !== $request->get_param( 'trigger_config' ) ) {
            $trigger_config = $this->validate_builtin_trigger_config( (string) $row['trigger_type'], (array) $request->get_param( 'trigger_config' ) );

            if ( is_wp_error( $trigger_config ) ) {
                return $trigger_config;
            }

            $data['trigger_config'] = wp_json_encode( $trigger_config );
        }

        if ( ! $data ) {
            return new \WP_Error( 'vulopilot_nothing_to_update', __( 'Nothing to update.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        if ( ! $repository->update( $id, $data ) ) {
            return new \WP_Error( 'vulopilot_update_failed', __( 'Could not update this automation.', 'vulopilot' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response(
            array(
                'success' => true,
                'id'      => $id,
            )
        );
    }

    /**
     * Free's own two built-in automations (Automations\
     * BuiltinAutomationSeeder) are the only rows this route allows a
     * `trigger_config` patch for - every other row's trigger configuration
     * is Pro's own AutomationsRest::update_item() territory (a full wizard
     * re-save, not a partial patch). Preserves the row's own
     * `system_default` marker unconditionally (never client-writable - it's
     * how BuiltinAutomationSeeder/AutomationScheduler keep recognizing this
     * row across renames).
     *
     * @param string               $trigger_type   The row's own, already-known trigger_type.
     * @param array<string, mixed> $incoming       Raw `trigger_config` from the request body.
     * @return array<string, mixed>|\WP_Error
     */
    private function validate_builtin_trigger_config( string $trigger_type, array $incoming ) {
        $allowed_frequencies = array(
            BuiltinAutomationSeeder::TRIGGER_FULL_SITE_SCAN   => array( 'manual', 'daily', 'weekly', 'monthly' ),
            BuiltinAutomationSeeder::TRIGGER_VISIBILITY_REPORT => array( 'weekly', 'monthly' ),
        );

        if ( ! isset( $allowed_frequencies[ $trigger_type ] ) ) {
            return new \WP_Error( 'vulopilot_trigger_config_not_editable', __( 'This automation\'s schedule can\'t be edited here.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $frequency = sanitize_key( (string) ( $incoming['frequency'] ?? '' ) );

        if ( ! in_array( $frequency, $allowed_frequencies[ $trigger_type ], true ) ) {
            return new \WP_Error( 'vulopilot_invalid_frequency', __( 'Invalid schedule frequency.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $config = array(
            'frequency'      => $frequency,
            'system_default' => BuiltinAutomationSeeder::TRIGGER_FULL_SITE_SCAN === $trigger_type
                ? BuiltinAutomationSeeder::MARKER_FULL_SITE_SCAN
                : BuiltinAutomationSeeder::MARKER_VISIBILITY_REPORT,
        );

        if ( 'weekly' === $frequency ) {
            $config['day_of_week'] = max( 1, min( 7, absint( $incoming['day_of_week'] ?? 1 ) ) );
        }

        return $config;
    }

    /**
     * @inheritDoc
     */
    public function run_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new AutomationsRepository();
        $row        = $repository->find( $id );

        if ( ! $row ) {
            return new \WP_Error( 'vulopilot_automations_not_found', __( 'Automation not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        // Free's own two built-in automations run synchronously here - same
        // real action Services\AutomationScheduler's own cron tick calls,
        // just triggered on demand instead of waiting for the schedule.
        if ( BuiltinAutomationSeeder::TRIGGER_FULL_SITE_SCAN === $row['trigger_type'] ) {
            VuloPilot()->automation_scheduler->run_scheduled_scan();

            return rest_ensure_response( array( 'success' => true ) );
        }

        if ( BuiltinAutomationSeeder::TRIGGER_VISIBILITY_REPORT === $row['trigger_type'] ) {
            VuloPilot()->automation_scheduler->run_scheduled_report();

            return rest_ensure_response( array( 'success' => true ) );
        }

        return new \WP_Error(
            'vulopilot_automations_not_implemented',
            __( 'Manually running an automation isn\'t supported yet - automations currently only fire from their own configured trigger.', 'vulopilot' ),
            array( 'status' => 501 )
        );
    }

    /**
     * Enriches each automation row with its own real most-recent run
     * (`last_run_status`/`last_run_actions_executed`/`last_run_actions_failed`/
     * `last_run_finished_at`) - what the "Automations" tab's table reads
     * for its "Last run" column's real outcome subtext (e.g. "3 actions
     * taken" / "No changes needed" / "Run failed"), one batch query via
     * AutomationsRunRepository::get_latest_by_automation_ids() rather than
     * N+1 (performance.md). `null` fields mean this automation has never
     * run yet - the frontend renders that as "Never run" rather than a
     * fabricated outcome. Same small helper, independently duplicated in
     * vulopilot-pro's own AutomationsRest.php (that controller doesn't
     * extend this one - it's a separate registry override for when the
     * Automations module is active - same "duplicate small per-file logic"
     * convention automationsLabels.ts's own docblock already establishes).
     *
     * @param array<int, array<string, mixed>> $rows Real automation rows, each with a real 'id'.
     * @return array<int, array<string, mixed>>
     */
    private static function with_last_run( array $rows ): array {
        $ids = array_map(
            static fn( array $row ): int => (int) ( $row['id'] ?? 0 ),
            $rows
        );

        $latest_by_id = ( new AutomationsRunRepository() )->get_latest_by_automation_ids( $ids );

        return array_map(
            static function ( array $row ) use ( $latest_by_id ): array {
                $latest = $latest_by_id[ (int) ( $row['id'] ?? 0 ) ] ?? null;

                $row['last_run_status']           = $latest['status'] ?? null;
                $row['last_run_actions_executed']  = $latest['actions_executed'] ?? null;
                $row['last_run_actions_failed']    = $latest['actions_failed'] ?? null;
                $row['last_run_changes_made']      = $latest['changes_made'] ?? null;
                $row['last_run_finished_at']       = $latest['finished_at'] ?? null;

                return $row;
            },
            $rows
        );
    }
}

/**
 * GET /findings backs the shared FindingsTable component (Health/SEO/GEO/
 * WooCommerce/Dashboard pages - src/components/FindingsTable.tsx).
 * POST /findings/{id} backs its "Mark resolved" row action.
 *
 * Zyra's sendApiResponse() (src/services/useApiList.ts and
 * FindingsTable.tsx's handleResolve) always issues a plain POST
 * regardless of semantic intent, so the sub-route accepts
 * WP_REST_Server::EDITABLE (POST/PUT/PATCH) rather than a stricter
 * single-verb registration - matching the client, not an idealized REST
 * verb choice it doesn't actually use.
 *
 * @class       Findings controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Findings extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'findings';

    /**
     * GET /findings/groups' own `priority` param (one of the Issues table's
     * High/Medium/Low stat tiles) mapped to FindingRepository::get_finding_groups()'s
     * severity->rank scale - same 3-tier collapse get_priority_counts()
     * already applies for those tiles' own counts (critical folds into
     * "high", info folds into "low"), kept here rather than in the
     * repository since it's a request-param translation, not persistence.
     *
     * @var array<string, int[]>
     */
    private const PRIORITY_SEVERITY_RANKS = array(
        'high'   => array( 0, 1 ),
        'medium' => array( 2 ),
        'low'    => array( 3, 4 ),
    );

    /**
     * GET /findings' own `priority` param (the "Schema & Knowledge" tab's
     * Issues section - its Critical/Important/Minor pill bar) mapped to a
     * real `severity` IN(...) filter - same 3-tier collapse
     * PRIORITY_SEVERITY_RANKS above already applies for `get_finding_groups()`,
     * expressed here as real severity values (not ranks) since get_items()
     * filters through FindingRepository::find_all()'s own `severity`
     * filterable column, which AbstractRepository::build_column_where_clause()
     * already turns into a real `IN (...)` clause when given an array.
     *
     * @var array<string, string[]>
     */
    private const PRIORITY_SEVERITY_LABELS = array(
        'high'   => array( 'critical', 'high' ),
        'medium' => array( 'medium' ),
        'low'    => array( 'low', 'info' ),
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

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_item' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/bulk',
            array(
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'bulk_update_items' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // AI Copilot's "Needs your attention" card (NeedsAttentionCard.tsx)
        // - a dedicated summary shape (priority-bucketed counts + top
        // issue-type groups) rather than overloading this controller's own
        // GET /findings row-list contract, which FindingsTable/every
        // category page already depends on unchanged.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/attention-summary',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_attention_summary' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        // AI Copilot's Issues table (IssuesList.tsx) - every
        // open finding grouped by issue type (scanner_id), paginated,
        // instead of GET /findings' own one-row-per-individual-finding
        // shape. Its own route, not a `group_by` param on GET /findings
        // itself, since the response shape is fundamentally different
        // (grouped counts + a representative sample, not a row list) and
        // every existing GET /findings consumer (FindingsTable.tsx et al.)
        // depends on the row-list shape unchanged.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/groups',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_finding_groups' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        // "Manual Actions Only" (readme.txt) - runs one registered
        // Automations\ActionRegistry action against this specific finding,
        // right now, via Automations\ManualActionRunner. No trigger, rule,
        // or `vulopilot_automations` row involved - see that class's own
        // docblock for how this differs from vulopilot-pro's Automations
        // module.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/actions/(?P<action_id>[a-z0-9-]+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'run_manual_action' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
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
    public function update_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function get_items( $request ) {
        $repository = new FindingRepository();

        $category    = sanitize_key( (string) $request->get_param( 'category' ) );
        $severity    = sanitize_key( (string) $request->get_param( 'severity' ) );
        $status      = sanitize_key( (string) $request->get_param( 'status' ) );
        $search      = sanitize_text_field( (string) $request->get_param( 'search' ) );
        $scanner_ids = $this->parse_comma_separated_list( $request->get_param( 'scanner_id' ) );
        $priority    = sanitize_key( (string) $request->get_param( 'priority' ) );

        if ( '' !== $severity && ! Severity::is_valid( $severity ) ) {
            return new \WP_Error( 'vulopilot_invalid_severity', __( 'Invalid severity filter.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        // `priority` (the "Schema & Knowledge" tab's Issues section -
        // Critical/Important/Minor pills) is a display-only relabeling of
        // the same real severity values - never both at once in practice,
        // but `severity` wins if a caller somehow sends both, same
        // "explicit single value beats a derived one" precedence every
        // other param on this endpoint already has.
        $severity_filter = $severity;
        if ( '' === $severity_filter && '' !== $priority && isset( self::PRIORITY_SEVERITY_LABELS[ $priority ] ) ) {
            $severity_filter = self::PRIORITY_SEVERITY_LABELS[ $priority ];
        }

        $result                  = $repository->find_all(
            array(
                'page'       => absint( $request->get_param( 'page' ) ) ?: 1,
                'per_page'   => absint( $request->get_param( 'per_page' ) ) ?: 20,
                'category'   => $category,
                'severity'   => $severity_filter,
                'status'     => $status,
                'search'     => $search,
                'scanner_id' => $scanner_ids ?? '',
                'orderby'    => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                'order'      => sanitize_key( (string) $request->get_param( 'order' ) ),
            )
        );
        $result['status_counts'] = $repository->get_status_counts( '' !== $category ? $category : null, $scanner_ids );
        $result['data']          = array_map( array( $this, 'add_page_field' ), $result['data'] );

        // Real Critical/Important/Minor pill counts, scoped to this
        // request's own scanner_id set - reuses
        // get_severity_breakdown_for_scanner_ids(), the same method
        // SchemaCoverageAnalyzer already calls for its own "open problems"
        // total. Only populated when scanner_id was given: this method's
        // sitewide `priority_counts` already exists via `get_priority_counts()`
        // elsewhere, so a scanner-agnostic caller has no use for a second,
        // differently-scoped copy of the same shape.
        if ( $scanner_ids ) {
            $breakdown                 = $repository->get_severity_breakdown_for_scanner_ids( $scanner_ids );
            $result['priority_counts'] = array(
                'high'   => ( $breakdown['critical'] ?? 0 ) + ( $breakdown['high'] ?? 0 ),
                'medium' => $breakdown['medium'] ?? 0,
                'low'    => $breakdown['low'] ?? 0,
            );
        }

        return rest_ensure_response(
            // Lets a Pro module (vulopilot-pro's OneClickFix) annotate each
            // row with a `fix_action_id` without Free knowing anything
            // about AI-action-to-scanner mapping - same "register a
            // source, don't modify the host" pattern as
            // vulopilot_reports_advanced_panel/vulopilot_pro_dashboard_component.
            apply_filters( 'vulopilot_finding_list_response', $result )
        );
    }

    /**
     * Bucket id => the real `category` values it draws its top finding-type
     * group from - AI Copilot's "Recommended by VuloPilot" card (one card
     * per bucket, most-urgent finding in that bucket). Matches the same
     * category groupings issuesTypes.ts's own CATEGORY_TABS uses for
     * "Security"/"Performance"/"AI Visibility", so a card's own "View
     * issues" click lands on the same tab a site owner would expect.
     *
     * @var array<string, string[]>
     */
    private const RECOMMENDATION_BUCKETS = array(
        'security'      => array( 'security', 'ssl', 'rest-api' ),
        'performance'   => array( 'performance' ),
        'ai-visibility' => array( 'geo', 'brand' ),
    );

    /**
     * GET /findings/attention-summary - real open-findings counts bucketed
     * into 3 priority tiers, the top 3 issue types sitewide (grouped by
     * scanner_id, most severe first), and one top issue per
     * RECOMMENDATION_BUCKETS bucket - every group/recommendation annotated
     * with its scanner's human `get_label()` so the client never has to
     * hardcode a scanner_id => label map. See
     * FindingRepository::get_priority_counts()/get_top_finding_groups()/
     * get_top_finding_group_for_categories() for how each part is computed.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function get_attention_summary( $request ) {
        $repository      = new FindingRepository();
        $priority_counts = $repository->get_priority_counts();
        $groups          = $repository->get_top_finding_groups( 3 );

        $label_scanner = static function ( array $group ): array {
            $scanner        = VuloPilot()->scanner_registry->get_scanner( $group['scanner_id'] );
            $group['label'] = $scanner ? $scanner->get_label() : $group['scanner_id'];

            return $group;
        };

        $groups = array_map( $label_scanner, $groups );

        $recommendations = array();

        foreach ( self::RECOMMENDATION_BUCKETS as $bucket => $categories ) {
            $group = $repository->get_top_finding_group_for_categories( $categories );

            if ( null === $group ) {
                continue;
            }

            $recommendations[] = array_merge( array( 'bucket' => $bucket ), $label_scanner( $group ) );
        }

        return rest_ensure_response(
            array(
                'total'           => array_sum( $priority_counts ),
                'priority_counts' => $priority_counts,
                'groups'          => $groups,
                'recommendations' => $recommendations,
            )
        );
    }

    /**
     * GET /findings/groups - AI Copilot's Issues table (IssuesList.tsx):
     * every open finding grouped by issue type, paginated and optionally
     * scoped to one category and/or one priority tier, each group
     * annotated with its scanner's real `get_label()` and one real
     * representative finding (`sample`) so the client's row/detail-panel
     * copy is never fabricated - see FindingRepository::get_finding_groups()
     * for how the grouping itself is computed.
     *
     * Also backs the "Schema & Knowledge" tab's own grouped Issues section
     * (IssuesSection.tsx) via this same route's `scanner_id` param (comma-
     * separated, same `parse_comma_separated_list()` GET /findings' own
     * `scanner_id` already uses) - when given, `priority_counts` is scoped
     * to exactly that scanner_id set too
     * (get_priority_counts_for_scanner_ids()) rather than the sitewide
     * figure every category-tab caller wants, since a scanner_id-scoped
     * caller has no category tabs of its own to fall back on for context.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function get_finding_groups( $request ) {
        $repository  = new FindingRepository();
        $categories  = $this->parse_comma_separated_list( $request->get_param( 'category' ) );
        $scanner_ids = $this->parse_comma_separated_list( $request->get_param( 'scanner_id' ) );
        $priority    = sanitize_key( (string) $request->get_param( 'priority' ) );

        // Real group-level status filter - 'open' (default, unchanged
        // behavior for every existing caller that never passes this) or
        // 'all' (SectionedIssuesTable.tsx's own real "Show ignored"
        // toggle: every real status together, not a second, separate
        // "ignored only" view) - never an arbitrary caller-supplied
        // string, so this can't become a SQL-injection vector via
        // FindingRepository::get_finding_groups()'s own `WHERE status = %s`.
        $requested_status = sanitize_key( (string) $request->get_param( 'status' ) );
        $status            = in_array( $requested_status, array( 'open', 'all' ), true ) ? $requested_status : 'open';

        $page     = absint( $request->get_param( 'page' ) );
        $per_page = absint( $request->get_param( 'per_page' ) );

        $result = $repository->get_finding_groups(
            array(
                'status'         => $status,
                'category'       => $categories ?? '',
                'scanner_ids'    => $scanner_ids ?? array(),
                'priority_ranks' => self::PRIORITY_SEVERITY_RANKS[ $priority ] ?? array(),
                'page'           => $page > 0 ? $page : 1,
                'per_page'       => $per_page > 0 ? $per_page : 20,
            )
        );

        $result['data'] = array_map(
            function ( array $group ) use ( $repository ): array {
                $scanner        = VuloPilot()->scanner_registry->get_scanner( $group['scanner_id'] );
                $group['label'] = $scanner ? $scanner->get_label() : $group['scanner_id'];

                $sample = $repository->find_all(
                    array(
                        'scanner_id' => $group['scanner_id'],
                        'status'     => 'open',
                        'per_page'   => 1,
                        'orderby'    => 'id',
                        'order'      => 'desc',
                    )
                );

                $group['sample'] = $sample['data'][0] ?? null;

                if ( $group['sample'] ) {
                    $group['sample'] = $this->add_page_field( $group['sample'] );
                }

                return $group;
            },
            $result['data']
        );

        $result['priority_counts'] = $scanner_ids
            ? $repository->get_priority_counts_for_scanner_ids( $scanner_ids )
            : $repository->get_priority_counts();
        $result['category_counts'] = $repository->get_category_group_counts();

        return rest_ensure_response( $result );
    }

    /**
     * Resolves each row's raw `object_type`/`object_ref` DB columns into a
     * human-readable `page` field the client can display directly (GEO.tsx's
     * compact FindingsTable layout - "$page · Detected $date", the same
     * meta line the dashboard mockup's own FindingRow shows) rather than a
     * bare post ID or the `home_url('/')` placeholder ref sitewide scanners
     * write (see GeoAnalysis\GeoAnalyzer::calculate_deterministic_score()'s
     * own docblock on that placeholder).
     *
     * @param array<string, mixed> $row One row from FindingRepository::find_all()'s `data`.
     * @return array<string, mixed> Same row, with a `page` key added.
     */
    private function add_page_field( array $row ): array {
        $object_type = $row['object_type'] ?? null;
        $object_ref  = $row['object_ref'] ?? null;

        if ( 'post' === $object_type && is_numeric( $object_ref ) ) {
            $post_id     = (int) $object_ref;
            $permalink   = get_permalink( $post_id );
            $row['page'] = $permalink ? wp_make_link_relative( $permalink ) : __( 'Site-wide', 'vulopilot' );
            // Real post title (`get_the_title()`), for callers that show a
            // human-readable page name instead of/alongside the real path
            // above (e.g. BrokenLinksSection.tsx's own "Source page"
            // column) - null when there's no real post behind this row to
            // name (falls back to `page` itself either way, never a
            // fabricated title).
            $row['page_title'] = $permalink ? ( get_the_title( $post_id ) ?: null ) : null;

            return $row;
        }

        if ( is_string( $object_ref ) && untrailingslashit( $object_ref ) === untrailingslashit( home_url( '/' ) ) ) {
            $row['page']       = __( 'Site-wide', 'vulopilot' );
            $row['page_title'] = null;

            return $row;
        }

        if ( is_string( $object_ref ) && filter_var( $object_ref, FILTER_VALIDATE_URL ) ) {
            $row['page']       = wp_make_link_relative( $object_ref );
            $row['page_title'] = null;

            return $row;
        }

        $row['page']       = __( 'Site-wide', 'vulopilot' );
        $row['page_title'] = null;

        return $row;
    }

    /**
     * SEO.tsx's per-section tables (e.g. "Titles & meta") pass a
     * comma-separated `scanner_id` param covering every scanner id that
     * section groups together, since FindingRepository::find_all()'s
     * filterable_columns only exact-matches a single scalar per column
     * value unless given an array (AbstractRepository::build_column_where_clause()).
     * A single value (no comma) still round-trips correctly as a
     * one-element array. Also backs `get_finding_groups()`'s own `category`
     * param - the Issues table's "SEO & Visibility" tab, for example, folds
     * 4 real category values into one tab (see IssuesFilterTabs in the
     * frontend's issuesTypes.ts) - same shape, same reasoning.
     *
     * @param mixed $raw_param Raw comma-separated request param.
     * @return string[]|null Sanitized values, or null when the param was empty/absent.
     */
    private function parse_comma_separated_list( $raw_param ): ?array {
        if ( empty( $raw_param ) ) {
            return null;
        }

        $scanner_ids = array_filter( array_map( 'sanitize_key', explode( ',', (string) $raw_param ) ) );

        return $scanner_ids ? array_values( $scanner_ids ) : null;
    }

    /**
     * @inheritDoc
     */
    public function update_item( $request ) {
        $id     = absint( $request->get_param( 'id' ) );
        $status = sanitize_key( (string) $request->get_param( 'status' ) );

        $allowed_statuses = array( 'open', 'resolved', 'ignored', 'snoozed' );

        if ( ! in_array( $status, $allowed_statuses, true ) ) {
            return new \WP_Error( 'vulopilot_invalid_status', __( 'Invalid finding status.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $repository = new FindingRepository();

        if ( ! $repository->find( $id ) ) {
            return new \WP_Error( 'vulopilot_finding_not_found', __( 'Finding not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        $updated = $repository->update(
            $id,
            array(
                'status'      => $status,
                'resolved_at' => 'resolved' === $status ? current_time( 'mysql', true ) : null,
            )
        );

        if ( ! $updated ) {
            return new \WP_Error( 'vulopilot_update_failed', __( 'Could not update this finding.', 'vulopilot' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response(
            array(
				'success' => true,
				'id'      => $id,
            )
        );
    }

    /**
     * Backs FindingsTable.tsx's bulk Resolve/Ignore action - applies the
     * same status update update_item() does, to every id in one request,
     * via AbstractRepository::bulk_update()'s single-row-update loop.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function bulk_update_items( $request ) {
        $ids    = array_map( 'absint', (array) $request->get_param( 'ids' ) );
        $status = sanitize_key( (string) $request->get_param( 'status' ) );

        if ( ! in_array( $status, array( 'resolved', 'ignored' ), true ) ) {
            return new \WP_Error( 'vulopilot_invalid_status', __( 'Invalid bulk finding status.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        if ( empty( $ids ) ) {
            return new \WP_Error( 'vulopilot_no_ids', __( 'No findings selected.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $repository    = new FindingRepository();
        $updated_count = $repository->bulk_update(
            $ids,
            array(
                'status'      => $status,
                'resolved_at' => 'resolved' === $status ? current_time( 'mysql', true ) : null,
            )
        );

        return rest_ensure_response(
            array(
                'success' => true,
                'updated' => $updated_count,
            )
        );
    }

    /**
     * Backs FindingsTable.tsx's "Snooze" row action (and any other
     * registered manual action) via Automations\ManualActionRunner.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function run_manual_action( $request ) {
        $finding_id = absint( $request->get_param( 'id' ) );
        $action_id  = sanitize_key( (string) $request->get_param( 'action_id' ) );

        try {
            $result = VuloPilot()->manual_action_runner->run( $finding_id, $action_id );
        } catch ( \InvalidArgumentException $exception ) {
            return new \WP_Error( 'vulopilot_manual_action_invalid', $exception->getMessage(), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $result->to_array() );
    }
}

/**
 * GET /scans lists past scan runs; POST /scans triggers one synchronously
 * via VuloPilot()->scan_runner (Scanners\ScanRunner - already wired in
 * VuloPilot::init_classes()). Persistence of the result happens via
 * Services\ScanPersistenceListener's `vulopilot_scan_completed` hook, not
 * anything in this controller - it only asks the runner to run.
 *
 * @class       Scans controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Scans extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'scans';

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
     *
     * `scanner_id` (comma-separated, e.g. `ssl-monitoring` or
     * `core-file-integrity,integrity-monitoring`) plus `orderby`/`order` -
     * same `parse_comma_separated_list()` shape `create_item()` already uses
     * for `category` below, added so a tile that only cares about one
     * scanner group's own most recent run (e.g. "last scan time" on a
     * summary card) can ask for `?scanner_id=...&status=completed&
     * per_page=1&orderby=finished_at&order=desc` instead of paging through
     * every scan run to find it client-side.
     *
     * `category` (comma-separated, e.g. `security,accessibility`) - the
     * same real category → scanner-ids mapping `create_item()`'s own
     * `ScanRunner::run_category()` already resolves via
     * `ScannerRegistry::get_scanners_by_category()`, resolved here instead
     * so a category page's own header "Last scan: …" text
     * (useRunScan.ts/useLastScanTime.ts) can ask by the same real category
     * it scans by, rather than every caller having to know and hardcode
     * that category's own raw scanner ids. Merges with any explicit
     * `scanner_id` also given, rather than one replacing the other.
     */
    public function get_items( $request ) {
        $repository  = new ScanRepository();
        $scanner_ids = $this->parse_comma_separated_list( $request->get_param( 'scanner_id' ) ) ?? array();
        $categories  = $this->parse_comma_separated_list( $request->get_param( 'category' ) );

        if ( $categories ) {
            $registry = new ScannerRegistry();

            foreach ( $categories as $category ) {
                $scanner_ids = array_merge( $scanner_ids, array_keys( $registry->get_scanners_by_category( $category ) ) );
            }
        }

        $scanner_ids = array_values( array_unique( $scanner_ids ) );

        return rest_ensure_response(
            $repository->find_all(
                array(
                    'page'       => absint( $request->get_param( 'page' ) ) ?: 1,
                    'per_page'   => absint( $request->get_param( 'per_page' ) ) ?: 20,
                    'status'     => sanitize_key( (string) $request->get_param( 'status' ) ),
                    'scanner_id' => $scanner_ids ? $scanner_ids : '',
                    'orderby'    => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                    'order'      => sanitize_key( (string) $request->get_param( 'order' ) ),
                )
            )
        );
    }

    /**
     * @inheritDoc
     *
     * `category` (comma-separated, e.g. `security,accessibility`) scopes
     * the run to just those categories via ScanRunner::run_category() -
     * a category page's own header "Run scan" button passes its own
     * category set here instead of always running every registered
     * scanner, same `parse_comma_separated_list` shape
     * Findings::get_items()'s own `category`/`scanner_id` params already
     * use. Takes precedence over `scanner_id` when both are present;
     * omitting `category` keeps every existing caller (Dashboard's Run
     * Audit widget, Health.tsx's own "Run scan") working exactly as
     * before.
     *
     * Every call into this endpoint is treated as a real, user-initiated
     * "Run scan" click (`$force = true` passed to the runner) unless the
     * caller explicitly marks itself `trigger_type=scheduled` - this repo
     * has no cron path in Free that calls this REST route at all today
     * (see ScanRunner's own docblock), so the default matches every
     * existing caller (useRunScan.ts always sends `trigger_type: 'manual'`)
     * without a param even being required. Without this, a scanner that
     * self-rate-limits independently of the shared scan cadence
     * (BrokenLinksScanner/BrokenImagesScanner's own `due_to_run()`) would
     * silently no-op on a manual click that happened to land inside its
     * own configured "daily"/"weekly" window - exactly the "scan starts
     * but doesn't detect anything new" bug this fixes.
     */
    public function create_item( $request ) {
        $force      = 'scheduled' !== sanitize_key( (string) $request->get_param( 'trigger_type' ) );
        $categories = $this->parse_comma_separated_list( $request->get_param( 'category' ) );

        if ( $categories ) {
            $results = array();

            foreach ( $categories as $category ) {
                $results += VuloPilot()->scan_runner->run_category( $category, $force );
            }
        } else {
            $scanner_id = sanitize_key( (string) $request->get_param( 'scanner_id' ) );

            if ( '' === $scanner_id || 'all' === $scanner_id ) {
                $results = VuloPilot()->scan_runner->run_all( $force );
            } else {
                $results = array( $scanner_id => VuloPilot()->scan_runner->run( $scanner_id, $force ) );
            }
        }

        $failed = array_filter(
            $results,
            static fn( $result ) => null === $result || \VuloPilot\ValueObjects\ScanResult::STATUS_FAILED === $result->get_status()
        );

        if ( count( $failed ) === count( $results ) && count( $results ) > 0 ) {
            return new \WP_Error(
                'vulopilot_scan_failed',
                __( 'The scan could not be completed.', 'vulopilot' ),
                array( 'status' => 500 )
            );
        }

        return rest_ensure_response(
            array(
                'success'     => true,
                'scanner_ids' => array_keys( $results ),
            )
        );
    }

    /**
     * Same shape as Findings::parse_comma_separated_list() - a single
     * value (no comma) still round-trips correctly as a one-element array.
     *
     * @param mixed $raw_param Raw comma-separated request param.
     * @return string[]|null Sanitized values, or null when the param was empty/absent.
     */
    private function parse_comma_separated_list( $raw_param ): ?array {
        if ( empty( $raw_param ) ) {
            return null;
        }

        $values = array_filter( array_map( 'sanitize_key', explode( ',', (string) $raw_param ) ) );

        return $values ? array_values( $values ) : null;
    }
}

/**
 * GET /store-readiness - "Commerce"'s live store-status checklist
 * (`StoreReadinessCard.tsx`) and the informational (not "problem")
 * numbers its category-card grid needs. Deliberately separate from the
 * Findings/scanner system: these are live facts about the store's
 * *current* configuration (a page either exists and is published right
 * now, or it doesn't), not persistent issues with an open/resolve/ignore
 * lifecycle - recomputed fresh on every request rather than only as-of
 * the last scan run. Real order/checkout *problems* (failed orders,
 * stale orders, gateway test-mode, outdated templates) are genuine
 * scanner findings instead (WooCommerceFailedOrdersScanner and its
 * siblings in classes/Scanners/Basic/) so they get the real
 * open/resolve/ignore workflow and show up in the same findings table
 * everything else does.
 *
 * @class       StoreReadiness controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class StoreReadiness extends \WP_REST_Controller {

	/**
	 * @var string
	 */
	protected $rest_base = 'store-readiness';

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
		$automation_runs = new AutomationsRunRepository();

		return rest_ensure_response(
			array(
				'has_woocommerce'         => class_exists( 'WooCommerce' ) && function_exists( 'wc_get_page_id' ),
				'readiness'               => $this->build_readiness(),
				'payment_methods_active'  => $this->count_active_payment_methods(),
				'secure_checkout'         => is_ssl(),
				'automation_failed_count' => $automation_runs->get_failed_count_since(
					gmdate( 'Y-m-d H:i:s', strtotime( '-30 days' ) )
				),
			)
		);
	}

	/**
	 * @return array<string, bool>
	 */
	private function build_readiness(): array {
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_page_id' ) ) {
			return array(
				'shop'       => false,
				'cart'       => false,
				'checkout'   => false,
				'my_account' => false,
			);
		}

		return array(
			'shop'       => $this->is_page_ready( 'shop' ),
			'cart'       => $this->is_page_ready( 'cart' ),
			'checkout'   => $this->is_page_ready( 'checkout' ),
			'my_account' => $this->is_page_ready( 'myaccount' ),
		);
	}

	/**
	 * @param string $page_id_key WooCommerce's own `wc_get_page_id()` key.
	 * @return bool
	 */
	private function is_page_ready( string $page_id_key ): bool {
		$page_id = wc_get_page_id( $page_id_key );

		return $page_id > 0 && 'publish' === get_post_status( $page_id );
	}

	/**
	 * @return int
	 */
	private function count_active_payment_methods(): int {
		if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
			return 0;
		}

		return count( WC()->payment_gateways()->get_available_payment_gateways() );
	}
}
