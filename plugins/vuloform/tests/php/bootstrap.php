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

if ( ! class_exists( 'GFAPI', false ) ) {
	/**
	 * Minimal stand-in for Gravity Forms' own GFAPI. `class_exists( 'GFAPI' )` is how
	 * GravityFormsMigrator detects the plugin, so this always "exists" for the test suite;
	 * individual tests control its forms through the public static $forms array.
	 */
	class GFAPI { // phpcs:ignore
		/**
		 * Form id => form array, set by a test before calling the migrator.
		 *
		 * @var array
		 */
		public static $forms = array();

		public static function get_forms( $active = true, $trash = false, $sort_column = 'id', $sort_dir = 'ASC' ) {
			return array_values( self::$forms );
		}

		public static function get_form( $id ) {
			return self::$forms[ $id ] ?? false;
		}
	}
}

if ( ! class_exists( 'VuloformTestNinjaForms', false ) ) {
	/**
	 * Minimal stand-in for Ninja Forms' own extension API. Deliberately shaped like the real
	 * thing's two different object types: the plain row `form()->get_forms()` returns has no
	 * `get_fields()` of its own (NinjaFormsMigrator::list_available() fatally called it there
	 * once - see this session's fix), only the full form object `form( $id )` returns does.
	 */
	class VuloformTestNinjaForms { // phpcs:ignore
		/**
		 * Form id => row (get_id()/get_setting() only), set by a test.
		 *
		 * @var array
		 */
		public $rows = array();

		/**
		 * Form id => full form object (get(), get_fields(), get_actions()), set by a test.
		 *
		 * @var array
		 */
		public $forms = array();

		public function form( $id = null ) {
			return null === $id ? $this : ( $this->forms[ $id ] ?? null );
		}

		public function get_forms() {
			return array_values( $this->rows );
		}
	}

	/**
	 * A Ninja Forms row: what `form()->get_forms()` returns, with no `get_fields()`.
	 */
	class VuloformTestNinjaFormsRow { // phpcs:ignore
		private $id;
		private $settings;

		public function __construct( $id, array $settings ) {
			$this->id       = $id;
			$this->settings = $settings;
		}

		public function get_id() {
			return $this->id;
		}

		public function get_setting( $key ) {
			return $this->settings[ $key ] ?? '';
		}
	}

	/**
	 * A Ninja Forms full form object: what `form( $id )` returns.
	 */
	class VuloformTestNinjaFormsForm { // phpcs:ignore
		private $row;
		private $fields;
		private $actions;

		public function __construct( VuloformTestNinjaFormsRow $row, array $fields = array(), array $actions = array() ) {
			$this->row     = $row;
			$this->fields  = $fields;
			$this->actions = $actions;
		}

		public function get() {
			return $this->row;
		}

		public function get_setting( $key ) {
			return $this->row->get_setting( $key );
		}

		public function get_fields() {
			return $this->fields;
		}

		public function get_actions() {
			return $this->actions;
		}
	}

	$GLOBALS['vuloform_test_ninja_forms'] = new VuloformTestNinjaForms();

	/**
	 * Stand-in for Ninja Forms' own global accessor.
	 *
	 * @return VuloformTestNinjaForms
	 */
	function Ninja_Forms() { // phpcs:ignore
		return $GLOBALS['vuloform_test_ninja_forms'];
	}
}

if ( ! class_exists( 'VuloformTestFluentCollection', false ) ) {
	/**
	 * Minimal stand-in for Fluent Forms' own query builder. `->get()` deliberately returns an
	 * object that is iterable but is not, and cannot be `(array)`-cast into, a plain array of
	 * rows - the same `FluentForm\Framework\Support\Collection` shape that made
	 * FluentFormsMigrator::list_available() silently iterate the wrong thing once (see this
	 * session's fix); a stub that just returned a plain array would not have caught it.
	 */
	class VuloformTestFluentCollection implements IteratorAggregate { // phpcs:ignore
		private $items;

		public function __construct( array $items ) {
			$this->items = $items;
		}

		#[\ReturnTypeWillChange]
		public function getIterator() {
			return new ArrayIterator( $this->items );
		}
	}

	/**
	 * One table's query builder.
	 */
	class VuloformTestFluentQuery { // phpcs:ignore
		private $rows;
		private $wheres = array();

		public function __construct( array $rows ) {
			$this->rows = $rows;
		}

		public function where( $key, $value ) {
			$this->wheres[ $key ] = $value;
			return $this;
		}

		public function get() {
			return new VuloformTestFluentCollection( array_map( static fn( $row ) => (object) $row, $this->rows ) );
		}

		public function find( $id ) {
			foreach ( $this->rows as $row ) {
				if ( (int) $row['id'] === (int) $id ) {
					return (object) $row;
				}
			}

			return null;
		}

		public function first() {
			foreach ( $this->rows as $row ) {
				foreach ( $this->wheres as $key => $value ) {
					if ( ( $row[ $key ] ?? null ) !== $value ) {
						continue 2;
					}
				}

				return (object) $row;
			}

			return null;
		}
	}

	/**
	 * Stand-in for Fluent Forms' own `wpFluent()` query builder entry point.
	 */
	class VuloformTestFluent { // phpcs:ignore
		/**
		 * Table name => rows (each a plain array), set by a test.
		 *
		 * @var array<string, array>
		 */
		public $tables = array();

		public function table( $name ) {
			return new VuloformTestFluentQuery( $this->tables[ $name ] ?? array() );
		}
	}

	$GLOBALS['vuloform_test_fluent'] = new VuloformTestFluent();

	/**
	 * Stand-in for Fluent Forms' own global accessor.
	 *
	 * @return VuloformTestFluent
	 */
	function wpFluent() { // phpcs:ignore
		return $GLOBALS['vuloform_test_fluent'];
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
