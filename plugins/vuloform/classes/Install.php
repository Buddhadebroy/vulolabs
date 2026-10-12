<?php
/**
 * Install class file.
 *
 * @package VuloForm
 */

namespace VuloForm;

defined( 'ABSPATH' ) || exit;

/**
 * Creates and upgrades VuloForm's tables, and removes its data on uninstall when asked to.
 */
class Install {

	/**
	 * Class constructor - runs the install immediately.
	 */
	public function __construct() {
		self::create_database_tables();

		update_option( Utill::OTHER_SETTINGS['plugin_db_version'], VULOFORM_PLUGIN_VERSION );
		do_action( 'vuloform_after_installed' );
	}

	/**
	 * Creates or updates the tables. dbDelta only adds what is missing, so running this on an
	 * existing site never drops a column or a row.
	 *
	 * @return void
	 */
	private static function create_database_tables() {
		global $wpdb;

		$collate = $wpdb->get_charset_collate();

		if ( ! function_exists( 'dbDelta' ) ) {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		}

		// No "IF NOT EXISTS": dbDelta would read "IF" as the table name and never diff the real table.
		dbDelta(
			"CREATE TABLE {$wpdb->prefix}" . Utill::TABLES['form'] . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			title varchar(200) NOT NULL DEFAULT '',
			status varchar(20) NOT NULL DEFAULT 'draft',
			form_schema longtext NOT NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY idx_status (status)
		) $collate;"
		);

		dbDelta(
			"CREATE TABLE {$wpdb->prefix}" . Utill::TABLES['submission'] . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			form_id bigint(20) unsigned NOT NULL,
			status varchar(20) NOT NULL DEFAULT 'unread',
			user_id bigint(20) unsigned NOT NULL DEFAULT 0,
			data longtext NOT NULL,
			meta longtext DEFAULT NULL,
			search_text text DEFAULT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY idx_form_status (form_id, status),
			KEY idx_created (created_at),
			KEY idx_user (user_id)
		) $collate;"
		);
	}

	/**
	 * Uninstall routine (register_uninstall_hook). Keeps everything unless Settings says
	 * "Delete everything", so an accidental delete never destroys forms or submissions.
	 *
	 * @return void
	 */
	public static function uninstall() {
		$settings = get_option( Utill::SETTINGS_KEY, array() );

		if ( ! is_array( $settings ) || ( $settings['keep_data_uninstall'] ?? 'keep_data' ) !== 'delete_everything' ) {
			return;
		}

		global $wpdb;

		Submissions\Uploads::delete_all();

		foreach ( Utill::TABLES as $table ) {
			// Table identifiers can't be prepared placeholders; the name is a constant from this codebase.
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->query( "DROP TABLE IF EXISTS `{$wpdb->prefix}{$table}`" );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '\_transient\_vuloform\_%' OR option_name LIKE '\_transient\_timeout\_vuloform\_%'" );

		delete_option( Utill::SETTINGS_KEY );
		delete_option( Modules::ACTIVE_KEY );

		foreach ( Utill::OTHER_SETTINGS as $option ) {
			delete_option( $option );
		}

		wp_clear_scheduled_hook( Submissions\Retention::HOOK );
	}
}
