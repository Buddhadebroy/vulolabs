<?php
/**
 * Automations controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\AutomationRepository;
use VuloPilot\Repositories\AutomationRunRepository;

defined( 'ABSPATH' ) || exit;

/**
 * GET /automations backs src/pages/Automation/Automation.tsx's table.
 * POST /automations/{id} backs its Enable/Disable row action.
 * POST /automations/{id}/run backs its "Run now" row action — returns a
 * clear error rather than pretending to work: there is no trigger→action
 * execution engine anywhere in this codebase yet (only the DB schema, this
 * repository, and an unimplemented Contracts\Automation\TriggerInterface),
 * so there is nothing to actually run. This route exists so the button
 * gets an honest, specific failure message instead of a 404.
 *
 * This controller didn't exist at all before — the free plugin's own
 * Automation page called an endpoint with no backing route, so its table
 * could never load any data. Modeled directly on Findings.php's shape.
 *
 * @class       Automations controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Automations extends \WP_REST_Controller {

    /**
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
        $repository = new AutomationRepository();

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
        $result['data']          = self::with_last_run( $result['data'] );

        return rest_ensure_response( $result );
    }

    /**
     * @inheritDoc
     */
    public function update_item( $request ) {
        $id     = absint( $request->get_param( 'id' ) );
        $status = sanitize_key( (string) $request->get_param( 'status' ) );

        if ( ! in_array( $status, array( 'enabled', 'disabled' ), true ) ) {
            return new \WP_Error( 'vulopilot_invalid_status', __( 'Invalid automation status.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $repository = new AutomationRepository();

        if ( ! $repository->find( $id ) ) {
            return new \WP_Error( 'vulopilot_automation_not_found', __( 'Automation not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        if ( ! $repository->update( $id, array( 'status' => $status ) ) ) {
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
     * @inheritDoc
     */
    public function run_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new AutomationRepository();

        if ( ! $repository->find( $id ) ) {
            return new \WP_Error( 'vulopilot_automation_not_found', __( 'Automation not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        return new \WP_Error(
            'vulopilot_automation_not_implemented',
            __( 'Manually running an automation isn\'t supported yet — automations currently only fire from their own configured trigger.', 'vulopilot' ),
            array( 'status' => 501 )
        );
    }

    /**
     * Enriches each automation row with its own real most-recent run
     * (`last_run_status`/`last_run_actions_executed`/`last_run_actions_failed`/
     * `last_run_finished_at`) — what the "Automations" tab's table reads
     * for its "Last run" column's real outcome subtext (e.g. "3 actions
     * taken" / "No changes needed" / "Run failed"), one batch query via
     * AutomationRunRepository::get_latest_by_automation_ids() rather than
     * N+1 (performance.md). `null` fields mean this automation has never
     * run yet — the frontend renders that as "Never run" rather than a
     * fabricated outcome. Same small helper, independently duplicated in
     * vulopilot-pro's own AutomationsRest.php (that controller doesn't
     * extend this one — it's a separate registry override for when the
     * Automation module is active — same "duplicate small per-file logic"
     * convention automationLabels.ts's own docblock already establishes).
     *
     * @param array<int, array<string, mixed>> $rows Real automation rows, each with a real 'id'.
     * @return array<int, array<string, mixed>>
     */
    private static function with_last_run( array $rows ): array {
        $ids = array_map(
            static fn( array $row ): int => (int) ( $row['id'] ?? 0 ),
            $rows
        );

        $latest_by_id = ( new AutomationRunRepository() )->get_latest_by_automation_ids( $ids );

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
