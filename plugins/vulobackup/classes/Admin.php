<?php
/**
 * Admin class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup;

defined( 'ABSPATH' ) || exit;

/**
 * VuloBackup Admin class.
 *
 * @class       Admin class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Admin {

	/**
	 * Admin constructor.
	 */
	public function __construct() {
		add_action( is_multisite() ? 'network_admin_menu' : 'admin_menu', array( $this, 'add_menus' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_script' ) );
		add_filter( 'plugin_action_links_' . VuloBackup()->plugin_base, array( $this, 'add_action_links' ) );
	}

	/**
	 * Registers the VuloBackup top-level menu and its submenu tabs.
	 *
	 * @return void
	 */
	public function add_menus() {
		$capability = is_multisite() ? 'manage_network' : Utill::CAPABILITY;

		add_menu_page(
			'VuloBackup',
			'VuloBackup',
			$capability,
			'vulobackup',
			array( $this, 'create_admin_page' ),
			'dashicons-backup',
			58
		);

		// Each entry is a hash tab of the one React screen (src/routes.ts).
		$submenus = apply_filters(
			'vulobackup_submenus',
			array(
				'overview'    => array(
					'name'     => __( 'Overview', 'vulobackup' ),
					'priority' => 10,
				),
				'backups'     => array(
					'name'     => __( 'Backups', 'vulobackup' ),
					'priority' => 20,
				),
				'restore'     => array(
					'name'     => __( 'Restore', 'vulobackup' ),
					'priority' => 30,
				),
				'diagnostics' => array(
					'name'     => __( 'Diagnostics', 'vulobackup' ),
					'priority' => 40,
				),
				'settings'    => array(
					'name'     => __( 'Settings', 'vulobackup' ),
					'priority' => 50,
				),
			)
		);

		uasort(
			$submenus,
			function ( $a, $b ) {
				return ( $a['priority'] ?? 0 ) <=> ( $b['priority'] ?? 0 );
			}
		);

		foreach ( $submenus as $slug => $submenu ) {
			add_submenu_page(
				'vulobackup',
				$submenu['name'],
				$submenu['name'],
				$capability,
				'vulobackup#&tab=' . $slug,
				'__return_null'
			);
		}

		// add_menu_page() auto-registers a duplicate first submenu for the top-level item.
		remove_submenu_page( 'vulobackup', 'vulobackup' );
	}

	/**
	 * Renders the empty mount point the React app renders into.
	 *
	 * @return void
	 */
	public function create_admin_page() {
		echo '<div id="admin-main-wrapper" class="admin-main-wrapper"></div>';
	}

	/**
	 * Loads the admin app on VuloBackup's own admin screen only.
	 *
	 * @return void
	 */
	public function enqueue_admin_script() {
		$screen = get_current_screen();

		if ( ! $screen || ! in_array( $screen->id, array( 'toplevel_page_vulobackup', 'toplevel_page_vulobackup-network' ), true ) ) {
			return;
		}

		FrontendScripts::admin_load_scripts();
		FrontendScripts::enqueue_script( 'vulobackup-vendor-script' );
		FrontendScripts::enqueue_script( 'vulobackup-admin-script' );
		FrontendScripts::enqueue_style( 'vulobackup-admin-style' );
		FrontendScripts::localize_scripts( 'vulobackup-admin-script' );
	}

	/**
	 * Adds a "Backups" link on the Plugins screen.
	 *
	 * @param array $links Existing links.
	 * @return array
	 */
	public function add_action_links( $links ) {
		array_unshift(
			$links,
			sprintf( '<a href="%s">%s</a>', esc_url( self::url( 'backups' ) ), esc_html__( 'Backups', 'vulobackup' ) )
		);

		return $links;
	}

	/**
	 * The address of a tab of the admin screen.
	 *
	 * @param string $tab Tab.
	 * @return string
	 */
	public static function url( $tab = '' ) {
		$base = is_multisite() ? network_admin_url( 'admin.php?page=vulobackup' ) : admin_url( 'admin.php?page=vulobackup' );

		return '' === $tab ? $base : $base . '#&tab=' . $tab;
	}
}
