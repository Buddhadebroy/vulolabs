<?php
/**
 * ScanRunner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners;

use VuloPilot\Contracts\Scanner\SupportsForceRunInterface;
use VuloPilot\Contracts\Scanner\TracksScannedObjectsInterface;
use VuloPilot\ValueObjects\ScanResult;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot ScanRunner class.
 *
 * Orchestrates running one, several, or all registered scanners and wraps
 * each outcome in a ScanResult — timing and failure handling live here,
 * not in individual scanners (see ScannerInterface::scan()'s docblock),
 * so a scanner author never has to write their own try/catch/timer
 * boilerplate.
 *
 * Deliberately does not persist results itself. Writing a ScanResult into
 * vulopilot_scans/vulopilot_scan_findings is the Repositories/Services
 * layer's job (a separate, not-yet-built pass — see ARCHITECTURE.md) —
 * ScanRunner only fires `vulopilot_scan_completed` with the ScanResult,
 * so that layer (or an automation action, or anything else) can react
 * without ScanRunner needing to know it exists.
 *
 * @class       ScanRunner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ScanRunner {

    /**
     * @var ScannerRegistry
     */
    private ScannerRegistry $registry;

    /**
     * @param ScannerRegistry $registry Registry to pull scanners from.
     */
    public function __construct( ScannerRegistry $registry ) {
        $this->registry = $registry;
    }

    /**
     * Runs a single scanner by id.
     *
     * @param string $scanner_id A scanner's get_id().
     * @param bool   $force      True for a real, user-initiated "Run scan" — passed on to
     *                           the scanner via SupportsForceRunInterface::set_force_run()
     *                           when it implements that optional interface (see that
     *                           interface's own docblock), so a scanner that self-rate-limits
     *                           independently of the shared scan cadence (BrokenLinksScanner/
     *                           BrokenImagesScanner) always actually checks again rather than
     *                           silently no-op'ing because it already ran earlier today. A
     *                           scanner that doesn't implement it (the vast majority — they
     *                           run their real check every time scan() is called regardless)
     *                           is unaffected either way.
     * @return ScanResult|null Null if no scanner is registered under that id.
     */
    public function run( string $scanner_id, bool $force = false ): ?ScanResult {
        $scanner = $this->registry->get_scanner( $scanner_id );

        if ( ! $scanner ) {
            return null;
        }

        if ( $force && $scanner instanceof SupportsForceRunInterface ) {
            $scanner->set_force_run( true );
        }

        $started_at = microtime( true );

        try {
            $findings = $scanner->scan();
            $result   = new ScanResult(
                $scanner_id,
                ScanResult::STATUS_COMPLETED,
                $findings,
                ( microtime( true ) - $started_at ) * 1000,
                null,
                $scanner instanceof TracksScannedObjectsInterface ? $scanner->get_scanned_post_ids() : array()
            );
        } catch ( \Throwable $exception ) {
            $result = new ScanResult(
                $scanner_id,
                ScanResult::STATUS_FAILED,
                array(),
                ( microtime( true ) - $started_at ) * 1000,
                $exception->getMessage()
            );
        }

        do_action( 'vulopilot_scan_completed', $result );

        return $result;
    }

    /**
     * Runs every registered scanner.
     *
     * @param bool $force See run()'s own docblock.
     * @return array<string, ScanResult> Keyed by scanner id.
     */
    public function run_all( bool $force = false ): array {
        $results = array();

        foreach ( array_keys( $this->registry->get_all_scanners() ) as $scanner_id ) {
            $results[ $scanner_id ] = $this->run( $scanner_id, $force );
        }

        return $results;
    }

    /**
     * Runs every registered scanner except those in the given categories
     * — see ScannerRegistry::get_all_scanners_except()'s own docblock for
     * why a caller would want this instead of run_all().
     *
     * @param string[] $excluded_categories Category strings to leave out.
     * @param bool     $force                See run()'s own docblock.
     * @return array<string, ScanResult> Keyed by scanner id.
     */
    public function run_all_except( array $excluded_categories, bool $force = false ): array {
        $results = array();

        foreach ( array_keys( $this->registry->get_all_scanners_except( $excluded_categories ) ) as $scanner_id ) {
            $results[ $scanner_id ] = $this->run( $scanner_id, $force );
        }

        return $results;
    }

    /**
     * Runs every scanner registered under a given category.
     *
     * @param string $category e.g. 'seo', 'security'.
     * @param bool   $force    See run()'s own docblock.
     * @return array<string, ScanResult> Keyed by scanner id.
     */
    public function run_category( string $category, bool $force = false ): array {
        $results = array();

        foreach ( array_keys( $this->registry->get_scanners_by_category( $category ) ) as $scanner_id ) {
            $results[ $scanner_id ] = $this->run( $scanner_id, $force );
        }

        return $results;
    }
}
