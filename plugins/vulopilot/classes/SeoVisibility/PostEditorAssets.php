<?php
namespace VuloPilot\SeoVisibility;

defined( 'ABSPATH' ) || exit;

/**
 * Enqueues the post-editor SEO metabox - src/post-editor/index.tsx, a `@wordpress/plugins`
 * PluginSidebar registered into the Block Editor.
 *
 * @class       PostEditorAssets class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PostEditorAssets {

	/**
	 * PostEditorAssets constructor.
	 */
	public function __construct() {
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_assets' ) );
	}

	/**
	 * Enqueues the post-editor sidebar assets on post/page/product edit
	 * screens.
	 *
	 * @return void
	 */
	public function enqueue_assets(): void {
		$screen = get_current_screen();

		if ( ! $screen || ! in_array( $screen->post_type, PostSeoMetaFields::POST_TYPES, true ) ) {
			return;
		}

		$asset_file = VuloPilot()->plugin_path . 'assets/js/post-editor.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			return;
		}

		$asset = include $asset_file;

		wp_enqueue_script(
			'vulopilot-post-editor',
			VuloPilot()->plugin_url . 'assets/js/post-editor.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		$style_path = VuloPilot()->plugin_path . 'assets/styles/post-editor.css';
		if ( file_exists( $style_path ) ) {
			wp_enqueue_style( 'vulopilot-post-editor', VuloPilot()->plugin_url . 'assets/styles/post-editor.css', array(), $asset['version'] );
		}

		wp_localize_script(
			'vulopilot-post-editor',
			'vulopilotPostSeo',
			array(
				'apiUrl'   => esc_url_raw( rest_url( VuloPilot()->rest_namespace ) ),
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'isPro'    => VuloPilot()->util->is_khali_dabba(),
				'shopUrl'  => defined( 'VULOPILOT_PRO_SHOP_URL' ) ? VULOPILOT_PRO_SHOP_URL : '',
				'metaKeys' => array_merge(
					PostSeoMetaFields::META_KEYS,
					array( 'schema_json' => '_vulopilot_schema_json' )
				),
			)
		);
	}
}
