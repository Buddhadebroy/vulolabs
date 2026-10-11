<?php
/**
 * VuloBackup class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup;

defined( 'ABSPATH' ) || exit;

/**
 * VuloBackup Class.
 *
 * @class       VuloBackup class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class VuloBackup {

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
		$this->container['version']        = VULOBACKUP_PLUGIN_VERSION;
		$this->container['rest_namespace'] = 'vulobackup/v1';
		$this->container['plugin_slug']    = VULOBACKUP_PLUGIN_SLUG;

		register_activation_hook( $file, array( $this, 'activate' ) );
		register_deactivation_hook( $file, array( $this, 'deactivate' ) );
		// uninstall.php isn't in the shared release script's file list, so the uninstall routine is
		// registered as a hook instead.
		register_uninstall_hook( $file, array( Install::class, 'uninstall' ) );

		// Cron intervals must exist before WordPress reads the schedule on `init`.
		add_filter( 'cron_schedules', array( Schedule\Scheduler::class, 'intervals' ) ); // phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval, WordPress.WP.CronInterval.ChangeDetected -- five minutes, for the watchdog that resumes interrupted jobs.
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
	 * Runs on plugin deactivation. Backups and settings are kept; only the scheduled events go.
	 *
	 * @return void
	 */
	public function deactivate() {
		Schedule\Scheduler::clear();
	}

	/**
	 * Boots the plugin once every other active plugin has loaded.
	 *
	 * @return void
	 */
	public function init_plugin() {
		$needs_install = get_option( Utill::OTHER_SETTINGS['run_installer'] )
			|| get_option( Utill::OTHER_SETTINGS['plugin_db_version'] ) !== VULOBACKUP_PLUGIN_VERSION;

		if ( $needs_install ) {
			new Install();
			delete_option( Utill::OTHER_SETTINGS['run_installer'] );
		}

		add_action( 'init', array( $this, 'init_classes' ), 0 );
	}

	/**
	 * Instantiate the plugin's core classes.
	 *
	 * @return void
	 */
	public function init_classes() {
		$this->container['secrets']      = new Security\Secrets();
		$this->container['settings']     = new Settings\Settings();
		$this->container['vault']        = new Storage\Vault( $this->container['settings'] );
		$this->container['logger']       = new Logging\Logger( $this->container['vault'], $this->container['settings'] );
		$this->container['jobs']         = new Jobs\Store( $this->container['vault'] );
		$this->container['destinations'] = new Storage\Destinations( $this->container['secrets'] );
		$this->container['runner']       = new Jobs\Runner();
		$this->container['scheduler']    = new Schedule\Scheduler();
		$this->container['admin']        = new Admin();
		$this->container['rest']         = new Rest();

		/**
		 * Fires once VuloBackup has booted. Extensions should wait for this.
		 */
		do_action( 'vulobackup_loaded' );
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
	 * Magic setter for the container.
	 *
	 * @param string $class_name Container key to store under.
	 * @param mixed  $value      Value to store.
	 * @return void
	 */
	public function __set( $class_name, $value ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.classFound
		$this->container[ $class_name ] = $value;
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
