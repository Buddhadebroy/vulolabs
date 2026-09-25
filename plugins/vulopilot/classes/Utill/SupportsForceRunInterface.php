<?php
/**
 * SupportsForceRunInterface file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Optional companion to ScannerInterface (same "optional, instanceof-checked
 * add-on" shape as TracksScannedObjectsInterface), implemented only by a
 * scanner that self-rate-limits its own real work independently of the
 * shared scan cadence (Seo\Scanners\BrokenLinksScanner/
 * BrokenImagesScanner's own `due_to_run()` - see that method's docblock).
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
