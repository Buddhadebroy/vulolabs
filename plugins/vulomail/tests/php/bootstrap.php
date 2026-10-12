<?php
/**
 * PHPUnit bootstrap file.
 *
 * Unit tests run without WordPress: Brain\Monkey stands in for the hook API and the functions each
 * test needs, and the few core classes the plugin touches are replaced by the doubles below.
 *
 * @package VuloMail
 */

// Every class file starts with `defined( 'ABSPATH' ) || exit;`.
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

define( 'WPINC', 'wp-includes' );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );
define( 'ARRAY_A', 'ARRAY_A' );
define( 'WP_PLUGIN_DIR', '/var/www/wp-content/plugins' );

require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';
require_once dirname( __DIR__, 2 ) . '/config.php';

if ( ! class_exists( 'WP_Error', false ) ) {
	/**
	 * Minimal stand-in for core's WP_Error.
	 */
	class WP_Error { // phpcs:ignore
		/**
		 * Error code.
		 *
		 * @var string
		 */
		private $code;

		/**
		 * Error message.
		 *
		 * @var string
		 */
		private $message;

		/**
		 * Error data.
		 *
		 * @var mixed
		 */
		private $data;

		/**
		 * Constructor.
		 *
		 * @param string $code    Error code.
		 * @param string $message Error message.
		 * @param mixed  $data    Error data.
		 */
		public function __construct( $code = '', $message = '', $data = '' ) {
			$this->code    = $code;
			$this->message = $message;
			$this->data    = $data;
		}

		/**
		 * Get the error code.
		 *
		 * @return string
		 */
		public function get_error_code() {
			return $this->code;
		}

		/**
		 * Get the error message.
		 *
		 * @return string
		 */
		public function get_error_message() {
			return $this->message;
		}

		/**
		 * Get the error data.
		 *
		 * @return mixed
		 */
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
function VuloMail() { // phpcs:ignore
	if ( ! isset( $GLOBALS['vulomail_test_container'] ) ) {
		$GLOBALS['vulomail_test_container'] = new stdClass();
	}

	return $GLOBALS['vulomail_test_container'];
}

require_once dirname( __DIR__, 2 ) . '/classes/Integrations/functions.php';

// TestCase and the VuloMail\Tests doubles autoload via the classmap in composer.json's autoload-dev.
