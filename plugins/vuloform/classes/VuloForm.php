<?php
/**
 * VuloForm class file.
 *
 * @package VuloForm
 */

namespace VuloForm;

defined( 'ABSPATH' ) || exit;

/**
 * VuloForm Class - the plugin singleton and its service container.
 */
final class VuloForm {

	/**
	 * Holds the single instance of the class (singleton pattern).
	 *
	 * @var self|null
	 */
	private static $instance = null;

	/**
	 * Container for shared class instances and config values.
	 *
	 * @var array
	 */
	private $container = array();

	/**
	 * Class constructor.
	 *
	 * @param string $file Main plugin file path.
	 */
	public function __construct( $file ) {
		require_once trailingslashit( dirname( $file ) ) . 'config.php';

		$this->container['plugin_url']     = trailingslashit( plugins_url( '', $file ) );
		$this->container['plugin_path']    = trailingslashit( dirname( $file ) );
		$this->container['plugin_base']    = plugin_basename( $file );
		$this->container['version']        = VULOFORM_PLUGIN_VERSION;
		$this->container['rest_namespace'] = 'vuloform/v1';

		register_activation_hook( $file, array( $this, 'activate' ) );
		register_deactivation_hook( $file, array( $this, 'deactivate' ) );
		// uninstall.php isn't in the shared release script's file list, so the uninstall routine is
		// registered as a hook instead.
		register_uninstall_hook( $file, array( Install::class, 'uninstall' ) );

		add_action( 'plugins_loaded', array( $this, 'init_plugin' ) );
	}

	/**
	 * Runs on plugin activation.
	 *
	 * @return void
	 */
	public function activate() {
		add_option( Utill::OTHER_SETTINGS['run_installer'], true );
	}

	/**
	 * Runs on plugin deactivation. Nothing is deleted; background work is only paused.
	 *
	 * @return void
	 */
	public function deactivate() {
		wp_clear_scheduled_hook( Submissions\Retention::HOOK );
	}

	/**
	 * Boots the plugin once every other active plugin has loaded.
	 *
	 * @return void
	 */
	public function init_plugin() {
		$needs_install = get_option( Utill::OTHER_SETTINGS['run_installer'] )
			|| get_option( Utill::OTHER_SETTINGS['plugin_db_version'] ) !== VULOFORM_PLUGIN_VERSION;

		if ( $needs_install ) {
			new Install();
			delete_option( Utill::OTHER_SETTINGS['run_installer'] );
		}

		$this->container['forms']       = new Forms\FormRepository();
		$this->container['submissions'] = new Submissions\SubmissionRepository();
		$this->container['processor']   = new Submissions\Processor( $this->container['submissions'] );
		$this->container['notifier']    = new Notifications\Notifier( $this->container['submissions'] );
		$this->container['webhooks']    = new Notifications\Webhooks( $this->container['forms'], $this->container['submissions'] );
		$this->container['frontend']    = new Frontend\Frontend();
		$this->container['privacy']     = new Security\Privacy();
		$this->container['modules']     = new Modules();

		// Extension modules hook into everything above, so they load before the first request is handled.
		$this->container['modules']->load_active_modules();

		add_action( 'init', array( $this, 'init_classes' ), 0 );
	}

	/**
	 * @return void
	 */
	public function init_classes() {
		$this->container['admin']     = new Admin();
		$this->container['rest']      = new Rest();
		$this->container['retention'] = new Submissions\Retention( $this->container['submissions'] );

		/**
		 * Fires once VuloForm has booted.
		 */
		do_action( 'vuloform_loaded' );
	}

	/**
	 * Magic getter for the container.
	 *
	 * @param string $class_name Container key to retrieve.
	 * @return mixed
	 * @throws \Exception If the requested key does not exist in the container.
	 */
	public function __get( $class_name ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.classFound
		if ( array_key_exists( $class_name, $this->container ) ) {
			return $this->container[ $class_name ];
		}

		throw new \Exception( sprintf( 'Call to unknown class %s.', esc_html( $class_name ) ) );
	}

	/**
	 * Magic isset for the container.
	 *
	 * @param string $class_name Container key to check.
	 * @return bool
	 */
	public function __isset( $class_name ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.classFound
		return array_key_exists( $class_name, $this->container );
	}

	/**
	 * Returns the single instance of this class, creating it if necessary.
	 *
	 * @param string $file Main plugin file path.
	 * @return self
	 */
	public static function init( $file ) {
		if ( null === self::$instance ) {
			self::$instance = new self( $file );
		}

		return self::$instance;
	}
}
