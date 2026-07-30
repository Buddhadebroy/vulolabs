<?php
/**
 * BrandIntelligenceReport class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Reports\Types;

use VuloPilot\Reports\AbstractReportType;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\ValueObjects\ReportResult;

defined( 'ABSPATH' ) || exit;

/**
 * Brand Intelligence's own report (BRAND-INTELLIGENCE-MODULE.md). Extends
 * AbstractReportType directly rather than AbstractCategoryReportType —
 * same "spans a fixed scanner_id list across categories, not one category
 * string" reasoning Reports\Types\ContentIntelligenceReport's own docblock
 * gives, applied to Brand's own 7-scanner list (3 new `brand`-category
 * scanners plus 4 reused `geo`-category ones,
 * Controllers\BrandIntelligence's own docblock explains the grouping).
 *
 * @class       BrandIntelligenceReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BrandIntelligenceReport extends AbstractReportType {

    /**
     * Every scanner_id Controllers\BrandIntelligence's Trust/Authority/
     * Entity sub-scores read, combined — a report period naturally covers
     * every one of them, the same way AbstractCategoryReportType's own
     * category scope would.
     *
     * @var string[]
     */
    private const SCANNER_IDS = array(
        'geo-trust-signals',
        'about-page-analysis',
        'geo-eeat-signals',
        'geo-author-info',
        'author-schema',
        'geo-entity-naming-consistency',
        'organization-schema',
    );

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'brand_intelligence';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Brand Intelligence Report', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function generate( string $period_start, string $period_end ): ReportResult {
        $findings = new FindingRepository();

        [ $previous_start, $previous_end ] = $this->get_previous_period( $period_start, $period_end );

        $stats          = $findings->get_stats_for_period( $period_start, $period_end, null, self::SCANNER_IDS );
        $previous_stats = $findings->get_stats_for_period( $previous_start, $previous_end, null, self::SCANNER_IDS );
        $top_findings   = $findings->get_top_findings_for_period( $period_start, $period_end, null, 15, self::SCANNER_IDS );

        return new ReportResult(
            $this->get_id(),
            $this->get_label(),
            $period_start,
            $period_end,
            array(
                'total_findings'    => $stats['total'],
                'open_findings'     => $stats['by_status']['open'] ?? 0,
                'resolved_findings' => $stats['by_status']['resolved'] ?? 0,
                'critical_findings' => $stats['by_severity']['critical'] ?? 0,
                'high_findings'     => $stats['by_severity']['high'] ?? 0,
            ),
            array(
                'findings_by_severity' => $stats['by_severity'],
                'top_findings'         => $top_findings,
            ),
            $this->build_trend(
                array(
                    'total_findings'    => $stats['total'],
                    'critical_findings' => $stats['by_severity']['critical'] ?? 0,
                ),
                array(
                    'total_findings'    => $previous_stats['total'],
                    'critical_findings' => $previous_stats['by_severity']['critical'] ?? 0,
                )
            )
        );
    }
}
