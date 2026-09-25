<?php
/**
 * VersionGuard class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Sdk;

defined( 'ABSPATH' ) || exit;

/**
 * @class       VersionGuard class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VersionGuard {

	/**
	 * @param string $current  The version actually installed/running.
	 * @param string $required The lowest version that's acceptable.
	 * @return bool True when $current satisfies $required (>=).
	 */
	public static function meets_minimum( string $current, string $required ): bool {
		return version_compare( $current, $required, '>=' );
	}

	/**
	 * @param string $required The lowest PHP version an extension needs.
	 * @return bool
	 */
	public static function is_php_compatible( string $required ): bool {
		return self::meets_minimum( PHP_VERSION, $required );
	}

	/**
	 * @param string $required The lowest WordPress version an extension needs.
	 * @return bool
	 */
	public static function is_wp_compatible( string $required ): bool {
		return self::meets_minimum( $GLOBALS['wp_version'], $required );
	}

	/**
	 * @param string|null $required The lowest store-platform version an extension needs, or null to only check the store platform is active at all.
	 * @return bool
	 */
	public static function is_woocommerce_compatible( ?string $required = null ): bool {
		if ( ! defined( 'WC_VERSION' ) ) {
			return false;
		}

		return null === $required || self::meets_minimum( WC_VERSION, $required );
	}
}
