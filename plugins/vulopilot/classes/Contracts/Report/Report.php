<?php
/**
 * Every class in this file used to be its own file under classes/Contracts/Report/
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

namespace VuloPilot\Contracts\Report;

use VuloPilot\ValueObjects\ReportResult;

defined( 'ABSPATH' ) || exit;

/**
 * Renders a generated ReportResult to a file in one specific format.
 * Free ships csv/json/pdf (Reports\Exporters\*); a premium/third-party
 * exporter (e.g. xlsx) registers via the `vulopilot_report_exporter_sources`
 * filter, same extension shape as every other *Interface in this package.
 *
 * @class       ReportExporterInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface ReportExporterInterface {

    /**
     * @return string Format id this exporter handles (matches `vulopilot_reports.format`), e.g. 'csv', 'json', 'pdf'.
     */
    public function get_format(): string;

    /**
     * Renders $result and writes it to $file_path. The caller (Reports\ReportGenerator)
     * owns deciding the destination path and its permission-checked download -
     * this only ever writes to the exact path it's given.
     *
     * @param ReportResult $result    The generated report data.
     * @param string       $file_path Absolute filesystem path to write to.
     * @return void
     */
    public function export( ReportResult $result, string $file_path ): void;
}

/**
 * Every report type - Free's own (scan summary, SEO, WooCommerce, security,
 * accessibility, health, automation, AI usage, custom/report-builder) or a
 * premium/third-party one registered via the `vulopilot_report_type_sources`
 * filter - implements this so Reports\ReportTypeRegistry/ReportGenerator can
 * generate either kind without knowing which side authored it. Mirrors
 * Contracts\Scanner\ScannerInterface's extension shape (module-architecture.md's
 * "discovery-by-filter" pattern, applied here instead of a folder-scan).
 *
 * @class       ReportTypeInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface ReportTypeInterface {

    /**
     * @return string Unique, stable report type id (matches `vulopilot_reports.report_type`).
     */
    public function get_id(): string;

    /**
     * @return string Human-readable label.
     */
    public function get_label(): string;

    /**
     * Collects and aggregates this report's data for one period. Reads
     * whatever repositories/tables the concrete report type needs - the
     * contract itself stays storage-agnostic, same posture as
     * ScannerInterface::scan() returning Finding value objects rather than
     * exposing $wpdb.
     *
     * @param string $period_start Y-m-d, inclusive.
     * @param string $period_end   Y-m-d, inclusive.
     * @return ReportResult
     */
    public function generate( string $period_start, string $period_end ): ReportResult;
}
