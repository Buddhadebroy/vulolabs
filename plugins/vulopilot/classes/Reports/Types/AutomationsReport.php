<?php
/**
 * AutomationsReport class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Reports\Types;

use VuloPilot\Reports\AbstractReportType;
use VuloPilot\Repositories\AutomationsRunRepository;
use VuloPilot\ValueObjects\ReportResult;

defined( 'ABSPATH' ) || exit;

/**
 * Automation run/success/failure counts for one period, per-automation
 * breakdown included — what an admin reads to see whether their
 * automations are actually doing anything, and whether they're failing.
 *
 * @class       AutomationsReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AutomationsReport extends AbstractReportType {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'automations';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Automations Report', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function generate( string $period_start, string $period_end ): ReportResult {
        $runs                              = new AutomationsRunRepository();
        [ $previous_start, $previous_end ] = $this->get_previous_period( $period_start, $period_end );

        $stats          = $runs->get_stats_for_period( $period_start, $period_end );
        $previous_stats = $runs->get_stats_for_period( $previous_start, $previous_end );
        $by_automation  = $runs->get_breakdown_by_automation_for_period( $period_start, $period_end );

        return new ReportResult(
            $this->get_id(),
            $this->get_label(),
            $period_start,
            $period_end,
            array(
                'total_runs'    => $stats['total'],
                'succeeded'     => $stats['by_status']['completed'] ?? 0,
                'failed'        => $stats['by_status']['failed'] ?? 0,
                'still_running' => $stats['by_status']['running'] ?? 0,
            ),
            array(
                'by_automation' => $by_automation,
            ),
            $this->build_trend(
                array(
					'total_runs' => $stats['total'],
					'failed'     => $stats['by_status']['failed'] ?? 0,
                ),
                array(
					'total_runs' => $previous_stats['total'],
					'failed'     => $previous_stats['by_status']['failed'] ?? 0,
                )
            )
        );
    }
}
