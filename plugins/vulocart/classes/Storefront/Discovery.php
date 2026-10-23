<?php
/**
 * Discovery class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Storefront;

defined( 'ABSPATH' ) || exit;

/**
 * The shopper tools around a product: recently viewed, sharing and comparison. (Upsells and back-in-stock alerts are
 * vulocart-pro modules that build on `views_for()` and `cards_html()`.) Each is a block (registered here, drawn in PHP, enhanced by blocks/view.js) and the public routes the
 * script needs.
 *
 * @class       Discovery class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Discovery {

	/**
	 * Block folders under `blocks/` this class owns.
	 */
	const BLOCKS = array(
		'product-recently-viewed' => 'render_recently_viewed',
		'product-share'           => 'render_share',
		'product-compare'         => 'render_compare',
	);

	/**
	 * Registers the blocks, the routes and the compare buttons.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'register_blocks' ), 20 );
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
		add_filter( 'render_block_vulocart/product-purchase', array( $this, 'add_after_purchase' ), 12, 3 );
		add_filter( 'render_block_vulocart/product-add-to-cart', array( $this, 'add_compare_button' ), 10, 3 );
	}

	/**
	 * Registers every block of this class.
	 *
	 * @return void
	 */
	public function register_blocks(): void {
		$dir = dirname( __DIR__, 2 ) . '/blocks/';

		foreach ( self::BLOCKS as $name => $callback ) {
			register_block_type( $dir . $name, array( 'render_callback' => array( $this, $callback ) ) );
		}
	}

	/**
	 * The shop page URL products link to.
	 *
	 * @return string
	 */
	private function base_url(): string {
		$shop = \VuloCart()->storefront->shop_url();

		return $shop ? $shop : home_url( '/' );
	}

	/**
	 * The product a block sits in.
	 *
	 * @param \WP_Block $block Block instance.
	 * @return array<string, mixed>|null
	 */
	private function product_of( $block ) {
		return isset( $block->context['vulocart/product'] ) ? $block->context['vulocart/product'] : null;
	}

	/**
	 * Published, listed products for a list of ids, in the order given, as storefront views.
	 *
	 * @param int[] $ids Product ids.
	 * @return array<int, array<string, mixed>>
	 */
	public function views_for( array $ids ): array {
		$base  = $this->base_url();
		$views = array();

		foreach ( array_slice( array_unique( array_filter( array_map( 'absint', $ids ) ) ), 0, 24 ) as $id ) {
			$product = \VuloCart()->product_service->get_product( $id );
			$meta    = $product && is_array( $product->meta ) ? $product->meta : array();

			if ( ! $product || 'published' !== $product->status || in_array( isset( $meta['catalog_visibility'] ) ? $meta['catalog_visibility'] : '', array( 'hidden' ), true ) ) {
				continue;
			}

			$views[] = ProductView::make( $product, $base );
		}

		return $views;
	}

	/**
	 * The cards for a list of product views, drawn with the same blocks as the shop.
	 *
	 * @param array<int, array<string, mixed>> $views   Product views.
	 * @param int                              $columns Columns.
	 * @param \WP_Block|null                   $parent  Block whose context is passed on.
	 * @return string
	 */
	public function cards_html( array $views, int $columns, $parent = null ): string {
		if ( ! $views ) {
			return '';
		}

		$context = array_merge(
			$parent ? $parent->context : array(),
			array(
				'vulocart/query' => array(
					'products' => $views,
					'total'    => count( $views ),
					'page'     => 1,
					'pages'    => 1,
					'per_page' => count( $views ),
					'columns'  => $columns,
					'layout'   => 'grid',
					'sort'     => 'newest',
					'search'   => '',
					'category' => '',
					'base'     => $this->base_url(),
					'cart'     => true,
				),
			)
		);

		$card = '<!-- wp:vulocart/product-template --><!-- wp:vulocart/product-image /--><!-- wp:vulocart/product-title /--><!-- wp:vulocart/product-rating /--><!-- wp:vulocart/product-price /--><!-- wp:vulocart/product-add-to-cart /--><!-- /wp:vulocart/product-template -->';
		$html = '';

		foreach ( parse_blocks( $card ) as $parsed ) {
			if ( ! empty( $parsed['blockName'] ) ) {
				$html .= ( new \WP_Block( $parsed, $context ) )->render();
			}
		}

		return sprintf( '<div class="vulocart-collection is-layout-grid" style="--vc-columns:%d;">%s</div>', $columns, $html );
	}

	/**
	 * The columns a block asked for, or the site setting.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @return int
	 */
	private function columns( $attributes ): int {
		$settings = wp_parse_args( get_option( \VuloCart\Utill::SETTINGS_KEY, array() ), \VuloCart\Utill::SETTINGS_DEFAULTS );
		$columns  = (int) ( ! empty( $attributes['columns'] ) ? $attributes['columns'] : $settings['listing_columns'] );

		return max( 1, min( 6, $columns ? $columns : 4 ) );
	}

	/**
	 * Recently viewed: a shell the script fills with the products this browser looked at last (never the current one).
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_recently_viewed( $attributes, $content, $block ) {
		$product = $this->product_of( $block );
		$count   = max( 1, min( 12, (int) ( isset( $attributes['count'] ) ? $attributes['count'] : 4 ) ) );

		return sprintf(
			'<section %s data-vulocart-recent data-count="%d" data-columns="%d" data-exclude="%d" hidden><h2>%s</h2><div data-cards></div></section>',
			get_block_wrapper_attributes( array( 'class' => 'vulocart-recent vulocart-section' ) ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by core.
			$count,
			$this->columns( $attributes ),
			$product ? (int) $product['id'] : 0,
			esc_html( ! empty( $attributes['heading'] ) ? $attributes['heading'] : __( 'Recently viewed', 'vulocart' ) )
		);
	}

	/**
	 * Share: links to the common networks and email, a copy-link button and, where the browser has one, the device's
	 * own share sheet. No third-party scripts load.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_share( $attributes, $content, $block ) {
		$product = $this->product_of( $block );

		if ( ! $product ) {
			return '';
		}

		$url   = rawurlencode( $product['url'] );
		$text  = rawurlencode( $product['title'] );
		$links = array(
			'X'        => 'https://twitter.com/intent/tweet?url=' . $url . '&text=' . $text,
			'Facebook' => 'https://www.facebook.com/sharer/sharer.php?u=' . $url,
			'WhatsApp' => 'https://wa.me/?text=' . $text . '%20' . $url,
			'Email'    => 'mailto:?subject=' . $text . '&body=' . $url,
		);

		ob_start();
		?>
		<div <?php echo get_block_wrapper_attributes( array( 'class' => 'vulocart-share' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by core. ?> data-vulocart-share data-url="<?php echo esc_url( $product['url'] ); ?>" data-title="<?php echo esc_attr( $product['title'] ); ?>">
			<span class="vulocart-share__label"><?php esc_html_e( 'Share', 'vulocart' ); ?></span>
			<?php foreach ( $links as $label => $href ) : ?>
				<a href="<?php echo esc_url( $href ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $label ); ?></a>
			<?php endforeach; ?>
			<button type="button" data-copy data-done="<?php esc_attr_e( 'Link copied', 'vulocart' ); ?>"><?php esc_html_e( 'Copy link', 'vulocart' ); ?></button>
			<button type="button" data-native hidden><?php esc_html_e( 'More…', 'vulocart' ); ?></button>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * Compare page: an empty shell that blocks/view.js fills with the table of the products the shopper ticked.
	 *
	 * @return string
	 */
	public function render_compare() {
		return sprintf(
			'<div %s data-vulocart-compare-page><p class="vulocart-muted" data-empty hidden>%s</p><div data-table></div></div>',
			get_block_wrapper_attributes( array( 'class' => 'vulocart-compare' ) ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by core.
			esc_html__( 'Nothing to compare yet. Tick "Compare" on two or more products.', 'vulocart' )
		);
	}

	/**
	 * Under the buy button of a product page: the share links. A page that places the Share block itself keeps its own;
	 * the filter `vulocart_auto_product_share` turns the automatic one off.
	 *
	 * @param string    $content Rendered block.
	 * @param array     $parsed  Parsed block.
	 * @param \WP_Block $block   Block instance.
	 * @return string
	 */
	public function add_after_purchase( $content, $parsed, $block ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundInExtendedClassAfterLastUsed
		$product = $this->product_of( $block );

		if ( ! $product || has_block( 'vulocart/product-share' ) || ! apply_filters( 'vulocart_auto_product_share', true, $product ) ) {
			return $content;
		}

		return $content . $this->render_share( array(), '', $block );
	}

	/**
	 * A "Compare" tick under a card's add-to-cart button - only while a page with the Compare block exists.
	 *
	 * @param string    $content Rendered block.
	 * @param array     $parsed  Parsed block.
	 * @param \WP_Block $block   Block instance.
	 * @return string
	 */
	public function add_compare_button( $content, $parsed, $block ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundInExtendedClassAfterLastUsed
		$product = $this->product_of( $block );

		if ( ! $product || ! \VuloCart()->storefront->url_for_block( 'vulocart/product-compare' ) ) {
			return $content;
		}

		return $content . sprintf(
			'<label class="vulocart-compare-toggle"><input type="checkbox" data-vulocart-compare="%d" /> %s</label>',
			(int) $product['id'],
			esc_html__( 'Compare', 'vulocart' )
		);
	}

	/**
	 * Registers the public routes the blocks' script calls.
	 *
	 * @return void
	 */
	public function register_routes(): void {
		$namespace = \VuloCart()->rest_namespace;

		register_rest_route( $namespace, '/storefront/cards', array( 'methods' => \WP_REST_Server::READABLE, 'callback' => array( $this, 'get_cards' ), 'permission_callback' => '__return_true' ) );
		register_rest_route( $namespace, '/storefront/compare', array( 'methods' => \WP_REST_Server::READABLE, 'callback' => array( $this, 'get_compare' ), 'permission_callback' => '__return_true' ) );
	}

	/**
	 * Cards for a list of ids (the Recently viewed block).
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function get_cards( $request ) {
		$ids     = explode( ',', (string) $request->get_param( 'ids' ) );
		$columns = max( 1, min( 6, absint( $request->get_param( 'columns' ) ) ) );

		return rest_ensure_response( array( 'html' => $this->cards_html( $this->views_for( $ids ), $columns ) ) );
	}

	/**
	 * The comparison table for a list of ids.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function get_compare( $request ) {
		$views = $this->views_for( array_slice( explode( ',', (string) $request->get_param( 'ids' ) ), 0, 4 ) );

		if ( count( $views ) < 1 ) {
			return rest_ensure_response( array( 'html' => '' ) );
		}

		$rows = array(
			__( 'Price', 'vulocart' )        => static function ( $view ) {
				return $view['has_price'] ? ( ( $view['from'] ? __( 'From ', 'vulocart' ) : '' ) . $view['current'] ) : '—';
			},
			__( 'Availability', 'vulocart' ) => static function ( $view ) {
				return $view['sold_out'] ? __( 'Sold out', 'vulocart' ) : __( 'In stock', 'vulocart' );
			},
			__( 'Type', 'vulocart' )         => static function ( $view ) {
				return ucfirst( str_replace( '_', ' ', $view['type'] ) );
			},
			__( 'Summary', 'vulocart' )      => static function ( $view ) {
				return $view['summary'] ? wp_trim_words( $view['summary'], 30 ) : '—';
			},
		);

		ob_start();
		?>
		<table class="vulocart-compare__table">
			<thead>
				<tr>
					<td></td>
					<?php foreach ( $views as $view ) : ?>
						<th scope="col">
							<?php if ( $view['image_url'] ) : ?>
								<img src="<?php echo esc_url( $view['image_url'] ); ?>" alt="" loading="lazy" />
							<?php endif; ?>
							<a href="<?php echo esc_url( $view['url'] ); ?>"><?php echo esc_html( $view['title'] ); ?></a>
							<button type="button" class="vulocart-compare__remove" data-remove="<?php echo esc_attr( (string) $view['id'] ); ?>" aria-label="<?php esc_attr_e( 'Remove from comparison', 'vulocart' ); ?>">×</button>
						</th>
					<?php endforeach; ?>
				</tr>
			</thead>
			<tbody>
				<?php foreach ( $rows as $label => $value ) : ?>
					<tr>
						<th scope="row"><?php echo esc_html( $label ); ?></th>
						<?php foreach ( $views as $view ) : ?>
							<td><?php echo esc_html( $value( $view ) ); ?></td>
						<?php endforeach; ?>
					</tr>
				<?php endforeach; ?>
				<tr>
					<th scope="row"></th>
					<?php foreach ( $views as $view ) : ?>
						<td><a class="wp-element-button" href="<?php echo esc_url( $view['url'] ); ?>"><?php esc_html_e( 'View product', 'vulocart' ); ?></a></td>
					<?php endforeach; ?>
				</tr>
			</tbody>
		</table>
		<?php
		return rest_ensure_response( array( 'html' => (string) ob_get_clean() ) );
	}
}
