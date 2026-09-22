<?php
/**
 * AutomationDashboardStats controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\AutomationsRepository;
use VuloPilot\Repositories\AutomationsRunRepository;

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
