<?php
/**
 * WooCommerceCompatibilityScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * "Compatibility" — one real finding per theme-overridden WooCommerce
 * template file that's older than the version WooCommerce core itself
 * now ships. Not a heuristic: this is the exact same
 * `WC_Admin_Status::scan_template_files()` + `get_file_version()` +
 * `version_compare()` comparison WooCommerce's own System Status page
 * (Tools > Status) already runs to populate its "Templates" section — a
 * theme's own copy of a WC template can silently miss bug fixes/new
 * hooks that shipped in a newer core template, causing subtle checkout/
 * cart/product-page bugs that are hard to trace back to "the theme's
 * template override is stale."
 *
 * @class       WooCommerceCompatibilityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceCompatibilityScanner extends AbstractBasicScanner {

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'woocommerce-compatibility';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Compatibility', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'woocommerce';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'WC' ) || ! defined( 'WC_ABSPATH' ) ) {
			return array();
		}

		if ( ! class_exists( '\WC_Admin_Status' ) ) {
			require_once WC_ABSPATH . 'includes/admin/class-wc-admin-status.php';
		}

		if ( ! class_exists( '\WC_Admin_Status' ) || ! function_exists( 'wc_locate_template' ) ) {
			return array();
		}

		$wc_templates_dir = trailingslashit( WC()->plugin_path() ) . 'templates/';
		$scan_files        = \WC_Admin_Status::scan_template_files( $wc_templates_dir );
		$findings          = array();

		foreach ( $scan_files as $file ) {
			$located = wc_locate_template( $file, WC()->template_path(), $wc_templates_dir );

			// Not overridden by the active theme — nothing to compare.
			if ( 0 === strpos( $located, $wc_templates_dir ) || ! file_exists( $located ) ) {
				continue;
			}

			$core_version     = \WC_Admin_Status::get_file_version( $wc_templates_dir . $file );
			$override_version = \WC_Admin_Status::get_file_version( $located );

			if ( ! $core_version || '' === $override_version || ! version_compare( $override_version, $core_version, '<' ) ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: %s is the template file's relative path, e.g. "cart/cart.php". */
					__( 'Outdated theme template override: %s', 'vulopilot' ),
					$file
				),
				Severity::LOW,
				$this->get_category(),
				sprintf(
					/* translators: 1: the theme's own template version, 2: WooCommerce core's current template version. */
					__( 'The active theme\'s copy of this template is version %1$s, but WooCommerce core is now on %2$s — the theme\'s override may be missing fixes or hooks from newer versions.', 'vulopilot' ),
					$override_version,
					$core_version
				),
				'setting',
				str_replace( ABSPATH, '', $located )
			);
		}

		return $findings;
	}
}
