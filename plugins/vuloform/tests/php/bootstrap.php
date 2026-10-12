<?php
/**
 * PHPUnit bootstrap file.
 *
 * Unit tests run without WordPress: Brain\Monkey stands in for the hook API and the functions each
 * test needs, and the few core classes the plugin touches are replaced by the doubles below.
 *
 * @package VuloForm
 */

// Every class file starts with `defined( 'ABSPATH' ) || exit;`.
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

define( 'WPINC', 'wp-includes' );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );
define( 'MB_IN_BYTES', 1048576 );
define( 'ARRAY_A', 'ARRAY_A' );
if ( ! class_exists( 'WP_REST_Controller', false ) ) {
	class WP_REST_Controller {} // phpcs:ignore
}
define( 'WP_PLUGIN_DIR', '/var/www/wp-content/plugins' );

require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';
require_once dirname( __DIR__, 2 ) . '/config.php';

if ( ! class_exists( 'WP_Error', false ) ) {
	/**
	 * Minimal stand-in for core's WP_Error.
	 */
	class WP_Error { // phpcs:ignore
		private $code;
		private $message;
		private $data;

		public function __construct( $code = '', $message = '', $data = '' ) {
			$this->code    = $code;
			$this->message = $message;
			$this->data    = $data;
		}

		public function get_error_code() {
			return $this->code;
		}

		public function get_error_message() {
			return $this->message;
		}

		public function get_error_data() {
			return $this->data;
		}
	}
}

/**
 * Test container standing in for the plugin singleton; tests assign the services they need.
 *
 * @return stdClass
 */
function VuloForm() { // phpcs:ignore
	if ( ! isset( $GLOBALS['vuloform_test_container'] ) ) {
		$GLOBALS['vuloform_test_container'] = new stdClass();
	}

	return $GLOBALS['vuloform_test_container'];
}

require_once dirname( __DIR__, 2 ) . '/classes/Integrations/functions.php';
require_once __DIR__ . '/src/dns.php';
require_once __DIR__ . '/src/TestCase.php';
