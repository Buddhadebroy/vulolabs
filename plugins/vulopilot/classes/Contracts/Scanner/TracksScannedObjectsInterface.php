<?php
/**
 * TracksScannedObjectsInterface file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Contracts\Scanner;

defined( 'ABSPATH' ) || exit;

/**
 * Optional companion to ScannerInterface, implemented only by scanners that
 * iterate individual posts/pages (Scanners\Basic\ScannedPostsTrait). Lets
 * ScanRunner recover which posts a scan actually considered even when zero
 * findings resulted — Finding objects alone only ever exist for objects
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
