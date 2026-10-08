<?php
namespace VuloPilot\Content;

defined( 'ABSPATH' ) || exit;

/**
 * Discovers and registers every Gutenberg block VuloPilot ships.
 *
 * @class       BlockRegistrar class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BlockRegistrar {

	/**
	 * Discovered blocks, cached for the lifetime of one request.
	 *
	 * @var array<int, array{name: string, path: string}>|null
	 */
	private $blocks;

	/**
	 * BlockRegistrar constructor.
	 */
	public function __construct() {
		// Priority 0 - must run (and so must have the `vulopilot-blocks` handle already
		// registered) before `register_blocks()`'s own default-priority `register_block_type()`
		// calls, since both `faq`/`table-of-contents` block.json files reference that handle by
		// name in their own `style`/`editorStyle` fields rather than a `file:` path (the compiled
		// stylesheet lives in `assets/styles/public/`, shared by both blocks, not inside either
		// block's own folder). Registering it this way - not the plain `wp_enqueue_style()` on
		// `wp_enqueue_scripts`/`enqueue_block_editor_assets` this used to do - lets WordPress core
		// itself decide when to print it: on the frontend only when a page's content actually has
		// one of these blocks (same as the old `has_block()` check), and inside the block editor's
		// own iframe automatically, which a plain `enqueue_block_editor_assets` enqueue is not
		// guaranteed to reach.
		add_action( 'init', array( $this, 'register_stylesheet' ), 0 );
		add_action( 'init', array( $this, 'register_blocks' ) );
		add_filter( 'block_categories_all', array( $this, 'register_block_category' ) );
	}

	/**
	 * Registers (does not enqueue) the blocks' shared compiled stylesheet under the
	 * `vulopilot-blocks` handle `register_blocks()`'s own `block.json` files reference by name,
	 * so core's own block-asset loader enqueues it, on both the frontend and the block editor's
	 * iframe, instead of this class trying to do that by hand.
	 *
	 * @return void
	 */
	public function register_stylesheet(): void {
		$style_path = VuloPilot()->plugin_path . 'assets/styles/public/vulopilot-blocks.min.css';

		if ( ! file_exists( $style_path ) ) {
			return;
		}

		wp_register_style(
			'vulopilot-blocks',
			VuloPilot()->plugin_url . 'assets/styles/public/vulopilot-blocks.min.css',
			array(),
			VuloPilot()->version
		);
	}

	/**
	 * Adds a real "VuloPilot" category to the block inserter so this
	 * plugin's own blocks (`faq`/`table-of-contents`, both `"category":
	 * "vulopilot"` in their own block.json) group under their own plugin
	 * name instead of the generic core "Widgets"/"Theme" bucket every
	 * other `category: widgets` block (core's own Tag Cloud, etc.) also
	 * falls into.
	 *
	 * @param array<int, array{slug: string, title: string, icon: ?string}> $categories Core's own already-registered categories.
	 * @return array<int, array{slug: string, title: string, icon: ?string}>
	 */
	public function register_block_category( array $categories ): array {
		return array_merge(
			array(
				array(
					'slug'  => 'vulopilot',
					'title' => __( 'VuloPilot', 'vulopilot' ),
					'icon'  => null,
				),
			),
			$categories
		);
	}

	/**
	 * Scans `assets/js/block/` for built block folders containing a `block.json`.
	 *
	 * @return array<int, array{name: string, path: string}>
	 */
	private function get_blocks(): array {
		if ( null !== $this->blocks ) {
			return $this->blocks;
		}

		$this->blocks = array();

		$block_base_path = VuloPilot()->plugin_path . 'assets/js/block/';

		if ( ! is_dir( $block_base_path ) ) {
			return $this->blocks;
		}

		$folders = glob( $block_base_path . '*', GLOB_ONLYDIR );

		foreach ( $folders as $folder ) {
			if ( file_exists( $folder . '/block.json' ) ) {
				$this->blocks[] = array(
					'name' => basename( $folder ),
					'path' => $folder,
				);
			}
		}

		return $this->blocks;
	}

	/**
	 * Registers every discovered block.
	 *
	 * @return void
	 */
	public function register_blocks(): void {
		foreach ( $this->get_blocks() as $block ) {
			register_block_type( $block['path'] );
		}
	}
}
