<?php
/**
 * FrontendScripts class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup;

defined( 'ABSPATH' ) || exit;

/**
 * VuloBackup FrontendScripts class.
 *
 * @class       FrontendScripts class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FrontendScripts {

	/**
	 * Returns the URL to the built assets directory.
	 *
	 * @return string
	 */
	public static function get_asset_url() {
		return VuloBackup()->plugin_url . 'assets/';
	}

	/**
	 * Registers the admin assets.
	 *
	 * @return void
	 */
	public static function admin_load_scripts() {
		$index_asset_path  = VuloBackup()->plugin_path . 'assets/js/index.asset.php';
		$vendor_asset_path = VuloBackup()->plugin_path . 'assets/js/vendors.asset.php';

		$index_asset = file_exists( $index_asset_path )
			? include $index_asset_path
			: array(
				'dependencies' => array( 'wp-element', 'wp-i18n', 'wp-hooks', 'wp-components' ),
				'version'      => VULOBACKUP_PLUGIN_VERSION,
			);

		$vendor_asset = file_exists( $vendor_asset_path )
			? include $vendor_asset_path
			: array(
				'dependencies' => array(),
				'version'      => VULOBACKUP_PLUGIN_VERSION,
			);

		wp_register_script(
			'vulobackup-vendor-script',
			self::get_asset_url() . 'js/vendors.js',
			$vendor_asset['dependencies'],
			$vendor_asset['version'],
			true
		);

		wp_register_script(
			'vulobackup-admin-script',
			self::get_asset_url() . 'js/index.js',
			array_merge( $index_asset['dependencies'], array( 'vulobackup-vendor-script' ) ),
			$index_asset['version'],
			true
		);
		wp_set_script_translations( 'vulobackup-admin-script', 'vulobackup' );

		wp_register_style(
			'vulobackup-admin-style',
			self::get_asset_url() . 'styles/index.css',
			array( 'wp-components' ),
			VULOBACKUP_PLUGIN_VERSION
		);
	}

	/**
	 * Enqueues a previously registered handle.
	 *
	 * @param string $handle Registered handle.
	 * @return void
	 */
	public static function enqueue_script( $handle ) {
		wp_enqueue_script( $handle );
	}

	/**
	 * Enqueues a previously registered CSS handle.
	 *
	 * @param string $handle Registered handle.
	 * @return void
	 */
	public static function enqueue_style( $handle ) {
		wp_enqueue_style( $handle );
	}

	/**
	 * Passes the React app what it needs to boot and call the REST API. No credential, password or
	 * server path is ever included here.
	 *
	 * @param string $handle Handle to attach the data to.
	 * @return void
	 */
	public static function localize_scripts( $handle ) {
		$roots = Utill::area_roots();

		wp_localize_script(
			$handle,
			'vulobackupAppLocalizer',
			array(
				'apiUrl'         => untrailingslashit( get_rest_url() ),
				'restUrl'        => VuloBackup()->rest_namespace,
				'nonce'          => wp_create_nonce( 'wp_rest' ),
				'plugin_url'     => VuloBackup()->plugin_url,
				'admin_url'      => Admin::url(),
				'site_url'       => home_url(),
				'version'        => VuloBackup()->version,
				'plugin_slug'    => VuloBackup()->plugin_slug,
				'text_domain'    => VULOBACKUP_PLUGIN_TEXTDOMAIN,
				// The parts of the site that exist here and can be backed up.
				'areas'          => array_values( array_intersect( Utill::AREAS, array_keys( $roots ) ) ),
				// Largest piece of an imported backup the server accepts in one request, with room for the form fields.
				'chunk_bytes'    => (int) max( 262144, min( 8 * 1024 * 1024, wp_max_upload_size() - 65536 ) ),
				// zyra's settings form locks a field whose `dependentPlugin` isn't in this list.
				'active_plugins' => array(),
				// zyra's HeaderComponent reads these two keys on every VuloLabs admin screen.
				'khali_dabba'    => false,
				'active_modules' => array(),
			)
		);
	}
}
