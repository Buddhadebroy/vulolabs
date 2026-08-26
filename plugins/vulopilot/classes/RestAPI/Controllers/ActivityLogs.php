<?php
/**
 * ActivityLogs controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\ActivityLogRepository;

defined( 'ABSPATH' ) || exit;

/**
 * GET /activity-logs backs src/pages/Activity/Activity.tsx's table.
 *
 * @class       ActivityLogs controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class ActivityLogs extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'activity-logs';

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
        $repository = new ActivityLogRepository();

        $result                      = $repository->find_all(
            array(
                'page'       => absint( $request->get_param( 'page' ) ) ?: 1,
                'per_page'   => absint( $request->get_param( 'per_page' ) ) ?: 20,
                'actor_type' => sanitize_key( (string) $request->get_param( 'actor_type' ) ),
                'event_type' => $this->parse_comma_separated_event_types( $request->get_param( 'event_type' ) ) ?? '',
                'search'     => sanitize_text_field( (string) $request->get_param( 'search' ) ),
                'orderby'    => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                'order'      => sanitize_key( (string) $request->get_param( 'order' ) ),
            )
        );
        $result['actor_type_counts'] = $repository->get_actor_type_counts();

        return rest_ensure_response( $result );
    }

    /**
     * Same shape as Findings.php's/Scans.php's own `parse_comma_separated_list()`
     * (a caller like RecentActivityCard.tsx can pass several real event
     * types at once, e.g. `scan.completed.security,security.alert`), but
     * `sanitize_text_field()` per item rather than `sanitize_key()` —
     * this table's real `event_type` values contain dots
     * (`scan.completed`, `security.alert`, `ai_action.executed`, …) that
     * `sanitize_key()` silently strips, which would corrupt every
     * multi-segment event type down to something that can never match a
     * real stored row (confirmed live: the single-value `sanitize_key()`
     * this replaced had this exact bug for as long as this route existed).
     *
     * @param mixed $raw_param Raw comma-separated request param.
     * @return string[]|null Sanitized values, or null when the param was empty/absent.
     */
    private function parse_comma_separated_event_types( $raw_param ): ?array {
        if ( empty( $raw_param ) ) {
            return null;
        }

        $event_types = array_filter( array_map( 'sanitize_text_field', explode( ',', (string) $raw_param ) ) );

        return $event_types ? array_values( $event_types ) : null;
    }
}
