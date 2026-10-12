<?php
/**
 * Admin class file.
 *
 * @package VuloForm
 */

namespace VuloForm;

defined( 'ABSPATH' ) || exit;

/**
 * VuloForm Admin class - the menu and the admin app's assets.
 */
class Admin {

	/**
	 * Admin constructor.
	 */
	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_menus' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_script' ) );
		add_filter( 'plugin_action_links_' . VuloForm()->plugin_base, array( $this, 'add_action_links' ) );
	}

	/**
	 * Registers the VuloForm top-level menu and its submenu tabs.
	 *
	 * @return void
	 */
	public function add_menus() {
		add_menu_page( 'VuloForm', 'VuloForm', Utill::CAPABILITY, 'vuloform', array( $this, 'create_admin_page' ), 'dashicons-feedback', 58 );

		// Each entry is a hash tab of the one React screen (src/routes.ts).
		$submenus = apply_filters(
			'vuloform_submenus',
			array(
				'forms'       => __( 'Forms', 'vuloform' ),
				'submissions' => __( 'Submissions', 'vuloform' ),
				'settings'    => __( 'Settings', 'vuloform' ),
			)
		);

		foreach ( $submenus as $slug => $name ) {
			add_submenu_page( 'vuloform', $name, $name, Utill::CAPABILITY, 'vuloform#&tab=' . $slug, '__return_null' );
		}

		// add_menu_page() auto-registers a duplicate first submenu for the top-level item.
		remove_submenu_page( 'vuloform', 'vuloform' );
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
	 * Loads the admin app on VuloForm's own admin screen only.
	 *
	 * @return void
	 */
	public function enqueue_admin_script() {
		$screen = get_current_screen();

		if ( ! $screen || 'toplevel_page_vuloform' !== $screen->id ) {
			return;
		}

		FrontendScripts::admin_load_scripts();

		wp_enqueue_script( 'vuloform-vendor-script' );
		wp_enqueue_script( 'vuloform-admin-script' );
		wp_enqueue_style( 'vuloform-admin-style' );
		// The builder's preview shows the form exactly as the public site styles and runs it.
		wp_enqueue_style( 'vuloform-form', VuloForm()->plugin_url . 'assets/styles/public/vuloform-form.min.css', array(), VULOFORM_PLUGIN_VERSION );
		wp_enqueue_script( 'vuloform-form', VuloForm()->plugin_url . 'assets/js/public/vuloform-form.min.js', array(), VULOFORM_PLUGIN_VERSION, true );

		FrontendScripts::localize_scripts( 'vuloform-admin-script' );
	}

	/**
	 * Adds a "Forms" link on the Plugins screen.
	 *
	 * @param array $links Existing links.
	 * @return array
	 */
	public function add_action_links( $links ) {
		array_unshift( $links, sprintf( '<a href="%s">%s</a>', esc_url( admin_url( 'admin.php?page=vuloform' ) ), esc_html__( 'Forms', 'vuloform' ) ) );

		return $links;
	}
}
