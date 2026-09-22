<?php
/**
 * Every class in this file used to be its own file under classes/Reports/Types/
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

namespace VuloPilot\Reports\Types;

use VuloPilot\Reports\AbstractReportType;
use VuloPilot\Repositories\AiHistoryRepository;
use VuloPilot\Repositories\AutomationsRunRepository;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\ScanRepository;
use VuloPilot\ValueObjects\ReportResult;

defined( 'ABSPATH' ) || exit;

/**
 * Base for every report type that's just "one scanner category's findings,
 * for one period" - SeoReport/WooCommerceReport/SecurityReport/
 * AccessibilityReport are identical in shape and differ only in which
 * category string they read (SCANNERS.md's category list), so the actual
 * generate() logic belongs here once rather than copy-pasted four times.
 *
 * @class       AbstractCategoryReportType class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class AbstractCategoryReportType extends AbstractReportType {

    /**
     * @return string One of the scanner category strings (SCANNERS.md).
     */
    abstract protected function get_category(): string;

    /**
     * @inheritDoc
     */
    public function generate( string $period_start, string $period_end ): ReportResult {
        $findings = new FindingRepository();
        $category = $this->get_category();

        [ $previous_start, $previous_end ] = $this->get_previous_period( $period_start, $period_end );

        $stats          = $findings->get_stats_for_period( $period_start, $period_end, $category );
        $previous_stats = $findings->get_stats_for_period( $previous_start, $previous_end, $category );
        $top_findings   = $findings->get_top_findings_for_period( $period_start, $period_end, $category, 15 );

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

/**
 * Category `accessibility` findings for one period (SCANNERS.md).
 *
 * @class       AccessibilityReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AccessibilityReport extends AbstractCategoryReportType {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'accessibility';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Accessibility Report', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    protected function get_category(): string {
        return 'accessibility';
    }
}

/**
 * AI call volume, token usage, and estimated cost for one period -
 * reads the permanent `vulopilot_ai_history` ledger (DATABASE.md), not the
 * `vulopilot_ai_jobs` work queue, since a report is about completed calls.
 *
 * @class       AiUsageReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiUsageReport extends AbstractReportType {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'ai_usage';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'AI Usage Report', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function generate( string $period_start, string $period_end ): ReportResult {
        $history                           = new AiHistoryRepository();
        [ $previous_start, $previous_end ] = $this->get_previous_period( $period_start, $period_end );

        $stats          = $history->get_stats_for_period( $period_start, $period_end );
        $previous_stats = $history->get_stats_for_period( $previous_start, $previous_end );
        $by_provider    = $history->get_breakdown_by_provider_for_period( $period_start, $period_end );

        return new ReportResult(
            $this->get_id(),
            $this->get_label(),
            $period_start,
            $period_end,
            array(
                'total_calls'      => $stats['total_calls'],
                'successful_calls' => $stats['successful_calls'],
                'failed_calls'     => $stats['failed_calls'],
                'total_tokens'     => $stats['prompt_tokens'] + $stats['completion_tokens'],
                'total_cost'       => $stats['total_cost'],
            ),
            array(
                'by_provider' => $by_provider,
            ),
            $this->build_trend(
                array(
					'total_calls' => $stats['total_calls'],
					'total_cost'  => $stats['total_cost'],
                ),
                array(
					'total_calls' => $previous_stats['total_calls'],
					'total_cost'  => $previous_stats['total_cost'],
                )
            )
        );
    }
}

/**
 * Readme.txt's "Reports" → "AI Visibility (AEO/GEO)" pillar. Category
 * `geo` findings for one period - the same 9-scanner GEO category
 * SCANNERS.md/GEO-MODULE.md document, and the same category the GEO
 * dashboard page's FindingsTable filters on. Deliberately reads the
 * deterministic, already-persisted `vulopilot_scan_findings` rows (same
 * shape every other AbstractCategoryReportType subclass reports on)
 * rather than GeoAnalysis\GeoAnalyzer's per-post AI-judged score -
 * Reports\ReportGenerator's own docblock is explicit that report
 * generation runs synchronously over bounded, already-aggregated SQL,
 * never an AI call, so aggregating GeoAnalyzer's postmeta-stored scores
 * across a whole period isn't a fit here.
 *
 * @class       AiVisibilityReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiVisibilityReport extends AbstractCategoryReportType {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'ai_visibility';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'AI Visibility Report', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    protected function get_category(): string {
        return 'geo';
    }
}

/**
 * Automation run/success/failure counts for one period, per-automation
 * breakdown included - what an admin reads to see whether their
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

/**
 * Brand Intelligence's own report (BRAND-INTELLIGENCE-MODULE.md). Extends
 * AbstractReportType directly rather than AbstractCategoryReportType -
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
     * Entity sub-scores read, combined - a report period naturally covers
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

/**
 * "Content Reports" (CONTENT-INTELLIGENCE-MODULE.md). Extends
 * AbstractReportType directly rather than AbstractCategoryReportType -
 * that base only scopes to one category string, but this report spans a
 * fixed scanner_id list across two categories (`content`'s own readability
 * scanner plus 4 reused `seo`-category scanners), the same scope
 * FindingRepository::get_severity_breakdown_for_scanner_ids()'s own
 * docblock explains. Its generate() body is otherwise identical to
 * AbstractCategoryReportType's - not a second, diverging implementation of
 * the same idea, just parameterized differently (there's exactly one
 * report needing this scanner_id-list shape today, so a new shared
 * abstract for it would be the "interface with one implementer" this
 * codebase's own conventions already argue against - same reasoning
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
     * - a report period naturally includes sitewide findings too, the same
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

/**
 * Readme.txt's "Reports" → "Performance" pillar. Category `performance`
 * findings for one period - the same category Scanners\Basic\PerformanceScanner
 * raises into (e.g. an oversized autoloaded `wp_options` table).
 *
 * @class       PerformanceReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceReport extends AbstractCategoryReportType {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Performance Report', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    protected function get_category(): string {
        return 'performance';
    }
}

/**
 * Every scanner run plus every finding raised in the period, across every
 * category - the "everything" report, same all-categories posture as the
 * Health dashboard page (SCANNERS.md).
 *
 * @class       ScanSummaryReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ScanSummaryReport extends AbstractReportType {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'scan_summary';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Scan Summary', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function generate( string $period_start, string $period_end ): ReportResult {
        $scans                             = new ScanRepository();
        $findings                          = new FindingRepository();
        [ $previous_start, $previous_end ] = $this->get_previous_period( $period_start, $period_end );

        $scan_stats     = $scans->get_stats_for_period( $period_start, $period_end );
        $finding_stats  = $findings->get_stats_for_period( $period_start, $period_end );
        $previous_stats = $findings->get_stats_for_period( $previous_start, $previous_end );
        $top_findings   = $findings->get_top_findings_for_period( $period_start, $period_end, null, 15 );

        return new ReportResult(
            $this->get_id(),
            $this->get_label(),
            $period_start,
            $period_end,
            array(
                'scans_run'         => $scan_stats['total'],
                'total_findings'    => $finding_stats['total'],
                'open_findings'     => $finding_stats['by_status']['open'] ?? 0,
                'resolved_findings' => $finding_stats['by_status']['resolved'] ?? 0,
                'critical_findings' => $finding_stats['by_severity']['critical'] ?? 0,
            ),
            array(
                'scans_by_status'      => $scan_stats['by_status'],
                'findings_by_severity' => $finding_stats['by_severity'],
                'findings_by_category' => $finding_stats['by_category'],
                'top_findings'         => $top_findings,
            ),
            $this->build_trend(
                array(
					'total_findings'    => $finding_stats['total'],
					'critical_findings' => $finding_stats['by_severity']['critical'] ?? 0,
                ),
                array(
					'total_findings'    => $previous_stats['total'],
					'critical_findings' => $previous_stats['by_severity']['critical'] ?? 0,
                )
            )
        );
    }
}

/**
 * Category `security` findings for one period (SCANNERS.md).
 *
 * @class       SecurityReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SecurityReport extends AbstractCategoryReportType {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'security';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Security Report', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    protected function get_category(): string {
        return 'security';
    }
}

/**
 * Category `seo` findings for one period - same category scope as the
 * SEO dashboard page's FindingsTable filter (SCANNERS.md).
 *
 * @class       SeoReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SeoReport extends AbstractCategoryReportType {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'seo';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'SEO Report', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    protected function get_category(): string {
        return 'seo';
    }
}

/**
 * Readme.txt's "Reports" → "Updates" pillar. Category `updates` findings
 * for one period - the same category Scanners\Basic\UpdatesScanner raises
 * into for pending WordPress core/plugin/theme updates (via
 * get_core_updates()/get_plugin_updates()/get_theme_updates()).
 *
 * @class       UpdatesReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class UpdatesReport extends AbstractCategoryReportType {

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
        return __( 'Updates Report', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    protected function get_category(): string {
        return 'updates';
    }
}

/**
 * Category `woocommerce` findings for one period - covers both the
 * original WooCommerceScanner (checkout page) and the 11 Product*
 * scanners from the WooCommerce AI pass (ARCHITECTURE.md's Prompt 11),
 * since both share the `woocommerce` category string.
 *
 * @class       WooCommerceReport class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceReport extends AbstractCategoryReportType {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'WooCommerce Report', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    protected function get_category(): string {
        return 'woocommerce';
    }
}
