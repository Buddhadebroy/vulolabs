<?php
/**
 * ContentIntelligenceReport class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Reports\Types;

use VuloPilot\Reports\AbstractReportType;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\ValueObjects\ReportResult;

defined( 'ABSPATH' ) || exit;

/**
 * "Content Reports" (CONTENT-INTELLIGENCE-MODULE.md). Extends
 * AbstractReportType directly rather than AbstractCategoryReportType —
 * that base only scopes to one category string, but this report spans a
 * fixed scanner_id list across two categories (`content`'s own readability
 * scanner plus 4 reused `seo`-category scanners), the same scope
 * FindingRepository::get_severity_breakdown_for_scanner_ids()'s own
 * docblock explains. Its generate() body is otherwise identical to
 * AbstractCategoryReportType's — not a second, diverging implementation of
 * the same idea, just parameterized differently (there's exactly one
 * report needing this scanner_id-list shape today, so a new shared
 * abstract for it would be the "interface with one implementer" this
 * codebase's own conventions already argue against — same reasoning
 * GeoAnalysis\GeoAnalyzer's own docblock gives for staying a plain class).
 *
 * @class       ContentIntelligenceReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ContentIntelligenceReport extends AbstractReportType {

    /**
     * Same list ContentIntelligence\ContentAnalyzer::SCANNER_IDS and
     * Controllers\ContentIntelligence::SCANNER_IDS use, plus `orphan-pages`
     * (sitewide-shaped, excluded from the per-post analyzer but real here
     * — a report period naturally includes sitewide findings too, the same
     * way AbstractCategoryReportType's own category scope already would).
     *
     * @var string[]
     */
    private const SCANNER_IDS = array( 'readability', 'thin-content', 'duplicate-content', 'heading-structure', 'internal-linking', 'orphan-pages' );

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'content_intelligence';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Content Intelligence Report', 'vulopilot' );
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
