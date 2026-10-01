<?php
/**
 * SupportsForceRunInterface file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Optional companion to ScannerInterface (same "optional, instanceof-checked add-on" shape
 * as TracksScannedObjectsInterface).
 *
 * @class       SupportsForceRunInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface SupportsForceRunInterface {

	/**
	 * Tells this scanner's next scan() call to bypass its own self-rate-limit.
	 *
	 * @param bool $force True to bypass the self-rate-limit for the next scan() call.
	 * @return void
	 */
	public function set_force_run( bool $force ): void;
}
