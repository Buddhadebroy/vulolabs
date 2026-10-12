<?php
/**
 * Install class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup;

defined( 'ABSPATH' ) || exit;

/**
 * VuloBackup Install class.
 *
 * VuloBackup creates no database tables: its records live beside the backups (see Jobs\Store), so
 * there is no schema to migrate. Installing only records the version.
 *
 * @class       Install class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Install {

	/**
	 * Class constructor - runs the install immediately.
	 */
	public function __construct() {
		$this->install();
	}

	/**
	 * Runs the install process.
	 *
	 * @return void
	 */
	public function install() {
		update_option( Utill::OTHER_SETTINGS['plugin_db_version'], VULOBACKUP_PLUGIN_VERSION );
		do_action( 'vulobackup_after_installed' );
	}

	/**
	 * Uninstall routine (register_uninstall_hook).
	 *
	 * Backups are never deleted by removing the plugin: someone who deletes a plugin while tidying
	 * up should not lose the only copies of their site. The settings are removed only when
	 * Settings → Data says so; the backup folder is always left, and its location is reported by
	 * the plugin while it is installed.
	 *
	 * @return void
	 */
	public static function uninstall() {
		Schedule\Scheduler::clear();

		$settings = get_option( Utill::SETTINGS_KEY, array() );

		if ( ! is_array( $settings ) || ( $settings['keep_data_uninstall'] ?? 'keep_data' ) !== 'delete_everything' ) {
			return;
		}

		delete_option( Utill::SETTINGS_KEY );
		delete_option( Utill::DESTINATIONS_KEY );
		delete_option( Utill::ENCRYPTION_KEY );
		delete_option( Security\Secrets::KEY_OPTION );
		delete_transient( 'vulobackup_daily_tidy' );

		foreach ( Utill::OTHER_SETTINGS as $option ) {
			delete_option( $option );
		}
	}
}
