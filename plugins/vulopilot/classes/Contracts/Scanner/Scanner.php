<?php
/**
 * Every class in this file used to be its own file under classes/Contracts/Scanner/
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

namespace VuloPilot\Contracts\Scanner;

use VuloPilot\ValueObjects\Finding;

defined( 'ABSPATH' ) || exit;

/**
 * Every scanner - free-tier (Scanners\Basic\AbstractBasicScanner) or a
 * premium Pro scanner registered via the `vulopilot_scanner_sources`
 * filter - implements this so ScannerRegistry/ScanRunner can run either
 * kind without knowing which side authored it.
 *
 * @class       ScannerInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface ScannerInterface {

    /**
     * @return string Unique, stable scanner id.
     */
    public function get_id(): string;

    /**
     * @return string Human-readable label.
     */
    public function get_label(): string;

    /**
     * @return string Category this scanner's findings belong to (e.g. 'seo', 'geo', 'security').
     */
    public function get_category(): string;

    /**
     * @return string 'free' or 'pro'.
     */
    public function get_tier(): string;

    /**
     * Runs the scan.
     *
     * @return Finding[]
     */
    public function scan(): array;
}

/**
 * Optional companion to ScannerInterface (same "optional, instanceof-checked
 * add-on" shape as TracksScannedObjectsInterface), implemented only by a
 * scanner that self-rate-limits its own real work independently of the
 * shared scan cadence (Seo\Scanners\BrokenLinksScanner/
 * BrokenImagesScanner's own `due_to_run()` - see that method's docblock).
 *
 * ScannerInterface::scan() deliberately takes no parameters, and isn't
 * widened here - every other scanner (free or Pro) implements the plain
 * zero-arg contract and would need no changes, so a real, user-initiated
 * "Run scan" click threading a force flag through only reaches the one or
 * two scanners that actually gate themselves, via ScanRunner::run()'s own
 * `instanceof` check, rather than every ScannerInterface implementation
 * across both plugins gaining a parameter it would never use.
 *
 * @class       SupportsForceRunInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface SupportsForceRunInterface {

    /**
     * Tells this scanner's next scan() call to bypass its own self-rate-limit
     * - a real, user-initiated "Run scan" click (or `wp vulopilot scan run
     * --force`) should always actually check again, even if this scanner's
     * own configured frequency (e.g. "daily") hasn't elapsed since its last
     * genuine run; a scheduled/cron-driven run should still respect it.
     *
     * @param bool $force True to bypass the self-rate-limit for the next scan() call.
     * @return void
     */
    public function set_force_run( bool $force ): void;
}

/**
 * Optional companion to ScannerInterface, implemented only by scanners that
 * iterate individual posts/pages (Scanners\Basic\ScannedPostsTrait). Lets
 * ScanRunner recover which posts a scan actually considered even when zero
 * findings resulted - Finding objects alone only ever exist for objects
 * that DID trip a check (ScannerInterface::scan()'s own docblock), so a
 * clean scan otherwise leaves no record of what it looked at.
 *
 * @class       TracksScannedObjectsInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface TracksScannedObjectsInterface {

    /**
     * @return int[] Post/page IDs actually considered during this scanner's
     *                most recent scan() call, whether or not each one
     *                produced a Finding.
     */
    public function get_scanned_post_ids(): array;
}
