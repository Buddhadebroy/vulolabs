<?php
/**
 * TracksScannedObjectsInterface file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Optional companion to ScannerInterface, implemented only by scanners that iterate
 * individual posts/pages (ScannedPostsTrait).
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
