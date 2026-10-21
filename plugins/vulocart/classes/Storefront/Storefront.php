<?php
/**
 * Storefront block layer.
 *
 * @package VuloCart
 */

namespace VuloCart\Storefront;

use VuloCart\Domain\Term\Taxonomy;

defined( 'ABSPATH' ) || exit;

/**
 * The block-based shop: a Product Collection that queries the catalog and a set of small blocks (filters, template,
 * image, title, price, summary, add to cart, pagination, no results) that a site editor can rearrange, restyle or
 * replace - the same composition model WooCommerce's Product Collection uses, over VuloCart's own product tables.
 *
 * Everything is server-rendered and themed from the active theme's design tokens (see blocks/storefront.css), so it
 * works in any block theme and, through the "Shop" pattern/page content, in classic themes too. The URL carries the
 * shopper's choices (`vc_q`, `vc_cat`, `vc_sort`, `vc_page`), so every state is linkable and needs no JavaScript;
 * blocks/view.js only adds auto-submitting filters and the add-to-cart button.
 *
 * @class Storefront
 */
class Storefront {

	/**
	 * Block folders under `blocks/`, each with a block.json.
	 */
	const BLOCKS = array(
		'product-collection',
		'product-filters',
		'product-template',
		'product-image',
		'product-title',
		'product-price',
		'product-summary',
		'product-add-to-cart',
		'product-pagination',
		'product-no-results',
		'product-details',
		'product-breadcrumbs',
		'product-gallery',
		'product-purchase',
		'product-stock',
		'product-trust',
		'product-facts',
		'product-content',
		'product-specs',
		'product-faqs',
		'product-extras',
		'product-description',
		'cart',
		'cart-link',
	);

	/**
	 * Sort choices shown to shoppers: key => label.
	 *
	 * @return array<string, string>
	 */
	public static function sort_options() {
		return array(
			'newest'     => __( 'Newest', 'vulocart' ),
			'price_asc'  => __( 'Price: low to high', 'vulocart' ),
			'price_desc' => __( 'Price: high to low', 'vulocart' ),
			'title'      => __( 'Name: A to Z', 'vulocart' ),
		);
	}

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'register' ) );
	}

	/**
	 * Absolute path of this plugin's root.
	 *
	 * @return string
	 */
	private function root() {
		return dirname( __DIR__, 2 );
	}

	/**
	 * URL of a file under `blocks/`.
	 *
	 * @param string $file Relative file.
	 * @return string
	 */
	private function url( $file ) {
		return plugins_url( 'blocks/' . $file, $this->root() . '/vulocart.php' );
	}

	/**
	 * Registers assets, blocks, the pattern and the page template.
	 *
	 * @return void
	 */
	public function register() {
		$dir = $this->root() . '/blocks/';

		wp_register_style( 'vulocart-storefront', $this->url( 'storefront.css' ), array(), (string) filemtime( $dir . 'storefront.css' ) );
		wp_register_script(
			'vulocart-storefront-launch',
			$this->url( 'launch.js' ),
			array(),
			(string) filemtime( $dir . 'launch.js' ),
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);
		wp_register_script(
			'vulocart-storefront-view',
			$this->url( 'view.js' ),
			array( 'vulocart-storefront-launch' ),
			(string) filemtime( $dir . 'view.js' ),
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);
		wp_register_script(
			'vulocart-storefront-cart',
			$this->url( 'cart.js' ),
			array( 'wp-i18n', 'vulocart-storefront-launch' ),
			(string) filemtime( $dir . 'cart.js' ),
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);
		wp_set_script_translations( 'vulocart-storefront-cart', 'vulocart' );
		wp_register_script(
			'vulocart-storefront-editor',
			$this->url( 'editor.js' ),
			array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ),
			(string) filemtime( $dir . 'editor.js' ),
			array( 'in_footer' => true )
		);
		wp_set_script_translations( 'vulocart-storefront-editor', 'vulocart' );

		$callbacks = array(
			'product-collection'  => 'render_collection',
			'product-filters'     => 'render_filters',
			'product-template'    => 'render_template',
			'product-image'       => 'render_image',
			'product-title'       => 'render_title',
			'product-price'       => 'render_price',
			'product-summary'     => 'render_summary',
			'product-add-to-cart' => 'render_add_to_cart',
			'product-pagination'  => 'render_pagination',
			'product-no-results'  => 'render_no_results',
			'product-details'     => 'render_details',
			'product-breadcrumbs' => 'render_breadcrumbs',
			'product-gallery'     => 'render_gallery',
			'product-purchase'    => 'render_purchase',
			'product-stock'       => 'render_stock',
			'product-trust'       => 'render_trust',
			'product-facts'       => 'render_facts',
			'product-content'     => 'render_content',
			'product-specs'       => 'render_specs',
			'product-faqs'        => 'render_faqs',
			'product-extras'      => 'render_extras',
			'product-description' => 'render_description',
			'cart'                => 'render_cart',
			'cart-link'           => 'render_cart_link',
		);

		foreach ( self::BLOCKS as $name ) {
			register_block_type( $dir . $name, array( 'render_callback' => array( $this, $callbacks[ $name ] ) ) );
		}

		add_filter( 'render_block_core/post-title', array( $this, 'hide_title_on_product' ), 10, 1 );
		$this->register_patterns();
		$this->register_template();
	}

	/**
	 * A product page prints the product's own title, so the shop page's heading steps aside (otherwise the page has
	 * two h1 elements).
	 *
	 * @param string $html The rendered Post Title block.
	 * @return string
	 */
	public function hide_title_on_product( $html ) {
		return is_singular() && '' !== $this->param( 'product' ) && $this->page_has_details() ? '' : $html;
	}

	/**
	 * Whether the current page holds the product details block.
	 *
	 * @return bool
	 */
	private function page_has_details() {
		$post = get_post();

		return $post && has_block( 'vulocart/product-details', $post );
	}

	/**
	 * The page URL the shop lives on (product links and filter forms point at it): the current page, without the
	 * shopper's own query choices.
	 *
	 * @return string
	 */
	private function base_url() {
		$id  = get_queried_object_id();
		$url = $id ? get_permalink( $id ) : '';

		return $url ? $url : home_url( '/' );
	}

	/**
	 * Reads one shopper query value.
	 *
	 * @param string $key Query var.
	 * @return string
	 */
	private function param( $key ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- public, read-only catalog filters; nothing is changed.
		return isset( $_GET[ $key ] ) && is_scalar( $_GET[ $key ] ) ? sanitize_text_field( wp_unslash( (string) $_GET[ $key ] ) ) : '';
	}

	/**
	 * Collection: runs the query, hands the result to its inner blocks as context, and prints the wrapper.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused; inner blocks are rendered with the query in context.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_collection( $attributes, $content, $block ) {
		// A product page (`?product=`) is the detail block's; the shop steps aside.
		if ( '' !== $this->param( 'product' ) ) {
			return '';
		}

		$settings = wp_parse_args( get_option( \VuloCart\Utill::SETTINGS_KEY, array() ), \VuloCart\Utill::SETTINGS_DEFAULTS );
		$per_page = max( 1, min( 48, (int) ( isset( $attributes['perPage'] ) ? $attributes['perPage'] : 12 ) ) );
		$columns  = (int) ( ! empty( $attributes['columns'] ) ? $attributes['columns'] : $settings['listing_columns'] );
		$columns  = max( 1, min( 6, $columns ? $columns : 4 ) );
		$layout   = ! empty( $attributes['layout'] ) ? $attributes['layout'] : ( 'list' === $settings['listing_template'] ? 'list' : 'grid' );
		$sorts    = self::sort_options();
		$sort     = $this->param( 'vc_sort' );
		$sort     = isset( $sorts[ $sort ] ) ? $sort : ( isset( $attributes['orderBy'], $sorts[ $attributes['orderBy'] ] ) ? $attributes['orderBy'] : 'newest' );
		$category = sanitize_key( $this->param( 'vc_cat' ) );
		$category = $category ? $category : ( ! empty( $attributes['category'] ) ? sanitize_key( $attributes['category'] ) : '' );
		$search   = $this->param( 'vc_q' );
		$page     = max( 1, (int) $this->param( 'vc_page' ) );

		$result = \VuloCart()->product_service->list_products(
			array(
				'page'     => $page,
				'per_page' => $per_page,
				'status'   => 'published',
				'listing'  => true,
				'search'   => $search,
				'category' => $category,
				'orderby'  => $sort,
			)
		);

		$base     = $this->base_url();
		$products = array_map(
			static function ( $product ) use ( $base ) {
				return ProductView::make( $product, $base );
			},
			$result['data']
		);
		$total    = (int) $result['total'];

		$query = array(
			'products' => $products,
			'total'    => $total,
			'page'     => $page,
			'pages'    => (int) max( 1, ceil( $total / $per_page ) ),
			'per_page' => $per_page,
			'columns'  => $columns,
			'layout'   => $layout,
			'sort'     => $sort,
			'search'   => $search,
			'category' => $category,
			'base'     => $base,
			'cart'     => true,
		);

		$context = array_merge( $block->context, array( 'vulocart/query' => $query ) );
		$inner   = '';

		foreach ( $block->parsed_block['innerBlocks'] as $inner_block ) {
			$inner .= ( new \WP_Block( $inner_block, $context ) )->render();
		}

		$wrapper = get_block_wrapper_attributes(
			array(
				'class' => 'vulocart-collection is-layout-' . $layout . ( $total ? '' : ' is-empty' ),
				'style' => '--vc-columns:' . $columns . ';',
			)
		);

		return sprintf( '<div %s>%s</div>', $wrapper, $inner );
	}

	/**
	 * The query a block sits in.
	 *
	 * @param \WP_Block $block Block instance.
	 * @return array<string, mixed>|null
	 */
	private function query_of( $block ) {
		return isset( $block->context['vulocart/query'] ) ? $block->context['vulocart/query'] : null;
	}

	/**
	 * Filters: result count, search, category and sort - a plain GET form, enhanced by view.js.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_filters( $attributes, $content, $block ) {
		$query = $this->query_of( $block );

		if ( ! $query ) {
			return '';
		}

		$show_search = ! isset( $attributes['showSearch'] ) || $attributes['showSearch'];
		$show_sort   = ! isset( $attributes['showSort'] ) || $attributes['showSort'];
		$show_cats   = ! isset( $attributes['showCategories'] ) || $attributes['showCategories'];

		$categories = array();
		if ( $show_cats ) {
			foreach ( \VuloCart()->term_service->list_terms( Taxonomy::CATEGORY ) as $term ) {
				$categories[ $term->slug ] = $term->name;
			}
		}

		$active = '' !== $query['search'] || '' !== $query['category'];
		$first  = ( $query['page'] - 1 ) * $query['per_page'] + 1;
		$last   = min( $query['total'], $query['page'] * $query['per_page'] );
		if ( 0 === $query['total'] ) {
			$summary = __( 'No products found', 'vulocart' );
		} elseif ( 1 === $query['total'] ) {
			$summary = __( 'Showing 1 product', 'vulocart' );
		} else {
			$summary = sprintf(
				/* translators: 1: first product number, 2: last, 3: total. */
				__( 'Showing %1$d–%2$d of %3$d products', 'vulocart' ),
				$first,
				$last,
				$query['total']
			);
		}

		ob_start();
		?>
		<form <?php echo get_block_wrapper_attributes( array( 'class' => 'vulocart-filters' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by core. ?> method="get" action="<?php echo esc_url( $query['base'] ); ?>" role="search" aria-label="<?php esc_attr_e( 'Filter products', 'vulocart' ); ?>">
			<?php if ( $show_search ) : ?>
				<label class="vulocart-filters__search">
					<span class="screen-reader-text"><?php esc_html_e( 'Search products', 'vulocart' ); ?></span>
					<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
					<input type="search" name="vc_q" value="<?php echo esc_attr( $query['search'] ); ?>" placeholder="<?php esc_attr_e( 'Search products…', 'vulocart' ); ?>" />
				</label>
			<?php endif; ?>

			<?php if ( $categories ) : ?>
				<label class="vulocart-filters__field">
					<span class="screen-reader-text"><?php esc_html_e( 'Category', 'vulocart' ); ?></span>
					<select name="vc_cat" data-vulocart-autosubmit>
						<option value=""><?php esc_html_e( 'All categories', 'vulocart' ); ?></option>
						<?php foreach ( $categories as $slug => $name ) : ?>
							<option value="<?php echo esc_attr( $slug ); ?>" <?php selected( $query['category'], $slug ); ?>><?php echo esc_html( $name ); ?></option>
						<?php endforeach; ?>
					</select>
				</label>
			<?php endif; ?>

			<?php if ( $show_sort ) : ?>
				<label class="vulocart-filters__field">
					<span class="screen-reader-text"><?php esc_html_e( 'Sort by', 'vulocart' ); ?></span>
					<select name="vc_sort" data-vulocart-autosubmit>
						<?php foreach ( self::sort_options() as $key => $label ) : ?>
							<option value="<?php echo esc_attr( $key ); ?>" <?php selected( $query['sort'], $key ); ?>><?php echo esc_html( $label ); ?></option>
						<?php endforeach; ?>
					</select>
				</label>
			<?php endif; ?>

			<button type="submit" class="vulocart-filters__submit wp-element-button"><?php esc_html_e( 'Apply', 'vulocart' ); ?></button>

			<p class="vulocart-filters__count" role="status">
				<?php echo esc_html( $summary ); ?>
				<?php if ( $active ) : ?>
					<a href="<?php echo esc_url( $query['base'] ); ?>"><?php esc_html_e( 'Clear filters', 'vulocart' ); ?></a>
				<?php endif; ?>
			</p>
		</form>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * Template: repeats its inner blocks once per product, in a grid or a list.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_template( $attributes, $content, $block ) {
		$query = $this->query_of( $block );

		if ( ! $query || ! $query['products'] ) {
			return '';
		}

		$items = '';

		foreach ( $query['products'] as $product ) {
			$context = array_merge( $block->context, array( 'vulocart/product' => $product ) );
			$inner   = '';

			foreach ( $block->parsed_block['innerBlocks'] as $inner_block ) {
				$inner .= ( new \WP_Block( $inner_block, $context ) )->render();
			}

			$items .= sprintf(
				'<li class="vulocart-product%s%s" data-product-id="%d">%s</li>',
				$product['sold_out'] ? ' is-sold-out' : '',
				$product['on_sale'] ? ' is-on-sale' : '',
				(int) $product['id'],
				$inner
			);
		}

		return sprintf( '<ul %s>%s</ul>', get_block_wrapper_attributes( array( 'class' => 'vulocart-product-template' ) ), $items );
	}

	/**
	 * The product a block is rendering.
	 *
	 * @param \WP_Block $block Block instance.
	 * @return array<string, mixed>|null
	 */
	private function product_of( $block ) {
		return isset( $block->context['vulocart/product'] ) ? $block->context['vulocart/product'] : null;
	}

	/**
	 * Image: the featured image (or a neutral placeholder) linking to the product, with sale / sold-out badges.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_image( $attributes, $content, $block ) {
		$product = $this->product_of( $block );

		if ( ! $product ) {
			return '';
		}

		$ratio = ! empty( $attributes['aspectRatio'] ) ? preg_replace( '/[^0-9\/. ]/', '', (string) $attributes['aspectRatio'] ) : '1 / 1';
		$fit   = ! empty( $attributes['scale'] ) && 'contain' === $attributes['scale'] ? 'contain' : 'cover';
		$badge = ! isset( $attributes['showBadge'] ) || $attributes['showBadge'];

		// A photo whose file is gone (deleted from the media library or the disk) shows the placeholder, not a broken icon.
		$image_file = $product['image_id'] ? get_attached_file( $product['image_id'] ) : '';

		if ( $product['image_id'] && $image_file && file_exists( $image_file ) ) {
			$image = wp_get_attachment_image(
				$product['image_id'],
				'large',
				false,
				array(
					'alt'      => $product['title'],
					'loading'  => 'lazy',
					'decoding' => 'async',
				)
			);
		} else {
			$image = '';
		}

		if ( ! $image && $product['image_url'] && ! $product['image_id'] ) {
			$image = sprintf( '<img src="%s" alt="%s" loading="lazy" decoding="async" />', esc_url( $product['image_url'] ), esc_attr( $product['title'] ) );
		}

		if ( ! $image ) {
			$image = '<span class="vulocart-product-image__placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L8 19"/></svg></span>';
		}

		$badges = '';
		if ( $badge ) {
			if ( $product['sold_out'] ) {
				$badges .= '<span class="vulocart-badge is-sold-out">' . esc_html__( 'Sold out', 'vulocart' ) . '</span>';
			} elseif ( $product['on_sale'] && $product['discount'] > 0 ) {
				/* translators: %d: discount percentage. */
				$badges .= '<span class="vulocart-badge is-sale">' . esc_html( sprintf( __( '-%d%%', 'vulocart' ), $product['discount'] ) ) . '</span>';
			} elseif ( $product['featured'] ) {
				$badges .= '<span class="vulocart-badge is-featured">' . esc_html__( 'Featured', 'vulocart' ) . '</span>';
			}
		}

		return sprintf(
			'<div %s><a href="%s" aria-label="%s" tabindex="-1">%s</a>%s</div>',
			get_block_wrapper_attributes(
				array(
					'class' => 'vulocart-product-image',
					'style' => '--vc-ratio:' . $ratio . ';--vc-fit:' . $fit . ';',
				)
			),
			esc_url( $product['url'] ),
			esc_attr( $product['title'] ),
			$image, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built from escaped parts / core image markup above.
			$badges // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
		);
	}

	/**
	 * Title: a heading linking to the product.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_title( $attributes, $content, $block ) {
		$product = $this->product_of( $block );

		if ( ! $product ) {
			return '';
		}

		$level = isset( $attributes['level'] ) ? max( 1, min( 6, (int) $attributes['level'] ) ) : 3;
		$text  = esc_html( $product['title'] );
		$link  = ! isset( $attributes['isLink'] ) || $attributes['isLink'];

		return sprintf(
			'<h%1$d %2$s>%3$s</h%1$d>',
			$level,
			get_block_wrapper_attributes(),
			$link ? '<a href="' . esc_url( $product['url'] ) . '">' . $text . '</a>' : $text
		);
	}

	/**
	 * Price: current price, struck-through regular price when on sale, "From" for several prices, "/ month" for recurring.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_price( $attributes, $content, $block ) {
		$product = $this->product_of( $block );

		if ( ! $product ) {
			return '';
		}

		if ( ! $product['has_price'] ) {
			return '<p ' . get_block_wrapper_attributes( array( 'class' => 'vulocart-price is-unset' ) ) . '>' . esc_html__( 'Price not set', 'vulocart' ) . '</p>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}

		$html = '';

		if ( $product['from'] ) {
			$html .= '<span class="vulocart-price__from">' . esc_html__( 'From', 'vulocart' ) . '</span> ';
		}

		if ( $product['on_sale'] ) {
			$html .= '<del class="vulocart-price__regular"><span class="screen-reader-text">' . esc_html__( 'Original price:', 'vulocart' ) . '</span>' . esc_html( $product['regular'] ) . '</del> ';
		}

		$html .= '<ins class="vulocart-price__current">' . esc_html( $product['current'] ) . '</ins>';

		if ( $product['per'] ) {
			/* translators: %s: billing interval, e.g. month. */
			$html .= ' <span class="vulocart-price__per">' . esc_html( sprintf( __( '/ %s', 'vulocart' ), $product['per'] ) ) . '</span>';
		}

		return '<p ' . get_block_wrapper_attributes( array( 'class' => 'vulocart-price' ) ) . '>' . $html . '</p>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
	}

	/**
	 * Summary: the short description, trimmed.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_summary( $attributes, $content, $block ) {
		$product = $this->product_of( $block );

		if ( ! $product || '' === $product['summary'] ) {
			return '';
		}

		$words = isset( $attributes['words'] ) ? max( 5, min( 80, (int) $attributes['words'] ) ) : 18;

		return '<p ' . get_block_wrapper_attributes( array( 'class' => 'vulocart-summary' ) ) . '>' . esc_html( wp_trim_words( $product['summary'], $words ) ) . '</p>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Add to cart: adds in place when the product can be bought without a choice, otherwise links to its page.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_add_to_cart( $attributes, $content, $block ) {
		$product = $this->product_of( $block );
		$query   = $this->query_of( $block );

		if ( ! $product ) {
			return '';
		}

		$wrapper = get_block_wrapper_attributes( array( 'class' => 'vulocart-add' . ( ! empty( $attributes['fullWidth'] ) || ! isset( $attributes['fullWidth'] ) ? ' is-full' : '' ) ) );

		if ( $product['sold_out'] ) {
			return sprintf( '<div %s><span class="wp-element-button vulocart-add__button is-disabled" aria-disabled="true">%s</span></div>', $wrapper, esc_html__( 'Sold out', 'vulocart' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}

		if ( $product['quick_add'] && ( ! $query || $query['cart'] ) ) {
			return sprintf(
				'<div %1$s><button type="button" class="wp-element-button vulocart-add__button" data-vulocart-add data-product-id="%2$d" data-price-id="%3$s" data-added-label="%4$s">%5$s</button></div>',
				$wrapper, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				(int) $product['id'],
				esc_attr( $product['price_id'] ),
				esc_attr__( 'Added', 'vulocart' ),
				esc_html( $product['cta'] )
			);
		}

		$label = in_array( $product['type'], array( 'physical', 'digital' ), true ) ? __( 'Select options', 'vulocart' ) : $product['cta'];

		return sprintf( '<div %s><a class="wp-element-button vulocart-add__button" href="%s">%s</a></div>', $wrapper, esc_url( $product['url'] ), esc_html( $label ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Pagination: previous, numbers, next - ordinary links, so pages are crawlable and shareable.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_pagination( $attributes, $content, $block ) {
		$query = $this->query_of( $block );

		if ( ! $query || $query['pages'] < 2 ) {
			return '';
		}

		$args = array();
		foreach ( array(
			'vc_q'   => 'search',
			'vc_cat' => 'category',
		) as $key => $field ) {
			if ( '' !== $query[ $field ] ) {
				$args[ $key ] = $query[ $field ];
			}
		}
		if ( 'newest' !== $query['sort'] ) {
			$args['vc_sort'] = $query['sort'];
		}

		$links = paginate_links(
			array(
				'base'      => add_query_arg( 'vc_page', '%#%', $query['base'] ),
				'format'    => '',
				'current'   => $query['page'],
				'total'     => $query['pages'],
				'add_args'  => $args,
				'type'      => 'array',
				'mid_size'  => 1,
				'end_size'  => 1,
				'prev_text' => '<span aria-hidden="true">←</span><span class="screen-reader-text">' . esc_html__( 'Previous page', 'vulocart' ) . '</span>',
				'next_text' => '<span class="screen-reader-text">' . esc_html__( 'Next page', 'vulocart' ) . '</span><span aria-hidden="true">→</span>',
			)
		);

		if ( ! $links ) {
			return '';
		}

		return sprintf(
			'<nav %s aria-label="%s">%s</nav>',
			get_block_wrapper_attributes( array( 'class' => 'vulocart-pagination' ) ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			esc_attr__( 'Product pages', 'vulocart' ),
			implode( '', $links ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- core-generated, escaped markup.
		);
	}

	/**
	 * No results: its inner blocks, shown only when the query found nothing.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Rendered inner blocks.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_no_results( $attributes, $content, $block ) {
		$query = $this->query_of( $block );

		if ( ! $query || $query['total'] > 0 ) {
			return '';
		}

		return sprintf( '<div %s>%s</div>', get_block_wrapper_attributes( array( 'class' => 'vulocart-no-results' ) ), $content ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Product page: loads the product named by `?product=` and renders its inner blocks with it as context. Renders
	 * nothing on the shop (no `product` parameter), where the collection takes over.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_details( $attributes, $content, $block ) {
		$id = absint( $this->param( 'product' ) );

		if ( ! $id ) {
			return '';
		}

		$base    = $this->base_url();
		$product = \VuloCart()->product_service->get_product( $id );
		$wrapper = get_block_wrapper_attributes( array( 'class' => 'vulocart-product-details' ) );

		if ( ! $product || ( 'published' !== $product->status && ! current_user_can( 'manage_options' ) ) ) {
			return sprintf(
				'<div %s><div class="vulocart-no-results"><p><strong>%s</strong></p><p><a class="wp-element-button" href="%s">%s</a></p></div></div>',
				$wrapper, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				esc_html__( 'This product could not be found.', 'vulocart' ),
				esc_url( $base ),
				esc_html__( 'Browse all products', 'vulocart' )
			);
		}

		$context = array_merge(
			$block->context,
			array(
				'vulocart/product' => ProductView::make_detail( $product, $base ),
				'vulocart/query'   => array(
					'base' => $base,
					'cart' => true,
				),
			)
		);
		$inner   = '';

		foreach ( $block->parsed_block['innerBlocks'] as $inner_block ) {
			$inner .= ( new \WP_Block( $inner_block, $context ) )->render();
		}

		return sprintf( '<div %s>%s</div>', $wrapper, $inner ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Breadcrumbs: Home > shop page > product (replaces any "back to shop" link).
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_breadcrumbs( $attributes, $content, $block ) {
		$product = $this->product_of( $block );
		$query   = $this->query_of( $block );

		if ( ! $product || ! $query ) {
			return '';
		}

		$shop_id    = get_queried_object_id();
		$shop_title = $shop_id ? get_the_title( $shop_id ) : '';
		$shop_title = '' !== $shop_title ? $shop_title : __( 'Shop', 'vulocart' );

		return sprintf(
			'<nav %1$s aria-label="%2$s"><ol><li><a href="%3$s">%4$s</a></li><li><a href="%5$s">%6$s</a></li><li aria-current="page">%7$s</li></ol></nav>',
			get_block_wrapper_attributes( array( 'class' => 'vulocart-breadcrumbs' ) ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			esc_attr__( 'Breadcrumb', 'vulocart' ),
			esc_url( home_url( '/' ) ),
			esc_html__( 'Home', 'vulocart' ),
			esc_url( $query['base'] ),
			esc_html( $shop_title ),
			esc_html( $product['title'] )
		);
	}

	/**
	 * Gallery: the main photo with thumbnails that swap it (view.js; without JavaScript the thumbnails are links).
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_gallery( $attributes, $content, $block ) {
		$product = $this->product_of( $block );

		if ( ! $product ) {
			return '';
		}

		$gallery = $product['gallery'];
		$badge   = '';

		if ( $product['sold_out'] ) {
			$badge = '<span class="vulocart-badge is-sold-out">' . esc_html__( 'Sold out', 'vulocart' ) . '</span>';
		} elseif ( $product['on_sale'] && $product['discount'] > 0 ) {
			/* translators: %d: discount percentage. */
			$badge = '<span class="vulocart-badge is-sale">' . esc_html( sprintf( __( '-%d%%', 'vulocart' ), $product['discount'] ) ) . '</span>';
		}

		if ( $gallery ) {
			$stage = sprintf( '<img src="%s" alt="%s" data-vulocart-gallery-main decoding="async" />', esc_url( $gallery[0]['large'] ), esc_attr( $product['title'] ) );
		} else {
			$stage = '<span class="vulocart-product-image__placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L8 19"/></svg></span>';
		}

		$thumbs = '';
		if ( count( $gallery ) > 1 ) {
			foreach ( $gallery as $index => $item ) {
				$thumbs .= sprintf(
					'<li><a class="vulocart-gallery__thumb%1$s" href="%2$s" data-vulocart-thumb data-src="%3$s" aria-label="%4$s"%5$s><img src="%6$s" alt="" loading="lazy" decoding="async" /></a></li>',
					0 === $index ? ' is-active' : '',
					esc_url( $item['full'] ),
					esc_url( $item['large'] ),
					/* translators: %d: photo number. */
					esc_attr( sprintf( __( 'Show photo %d', 'vulocart' ), $index + 1 ) ),
					0 === $index ? ' aria-current="true"' : '',
					esc_url( $item['thumb'] )
				);
			}
			$thumbs = '<ul class="vulocart-gallery__thumbs">' . $thumbs . '</ul>';
		}

		return sprintf(
			'<div %s><div class="vulocart-gallery__stage">%s%s</div>%s</div>',
			get_block_wrapper_attributes( array( 'class' => 'vulocart-gallery' ) ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			$stage, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			$badge, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			$thumbs // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		);
	}

	/**
	 * Purchase: price options, quantity, the call-to-action button and stock - everything needed to buy.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_purchase( $attributes, $content, $block ) {
		$product = $this->product_of( $block );
		$query   = $this->query_of( $block );

		if ( ! $product ) {
			return '';
		}

		$out = '';

		if ( count( $product['prices'] ) > 1 && ! $product['sold_out'] ) {
			$out .= '<fieldset class="vulocart-price-options"><legend class="screen-reader-text">' . esc_html__( 'Choose a price', 'vulocart' ) . '</legend>';
			foreach ( $product['prices'] as $index => $price ) {
				$out .= sprintf(
					'<label class="vulocart-price-option"><input type="radio" name="vc_price" value="%1$s"%2$s /><span class="vulocart-price-option__name"><strong>%3$s</strong>%4$s</span><span class="vulocart-price-option__amount">%5$s%6$s</span></label>',
					esc_attr( $price['id'] ),
					0 === $index ? ' checked' : '',
					esc_html( $price['label'] ),
					$price['billing'] ? '<small>' . esc_html( $price['billing'] ) . '</small>' : '',
					$price['regular'] ? '<del>' . esc_html( $price['regular'] ) . '</del> ' : '',
					esc_html( $price['amount'] )
				);
			}
			$out .= '</fieldset>';
		}

		if ( $query && ! $query['cart'] ) {
			$out .= '<p class="vulocart-notice">' . esc_html__( 'Ordering is currently unavailable.', 'vulocart' ) . '</p>';
		} elseif ( ! $product['sold_out'] ) {
			// "Buy now" appears when the store checks out somewhere other than the Checkout page (popup, drawer,
			// hosted page, one-click): add to cart and go straight there.
			$buy_now = 'page' !== \VuloCart()->block->resolve_checkout_delivery();
			$buy     = $buy_now
				? sprintf(
					'<div class="vulocart-buy"><button type="button" class="wp-element-button vulocart-buy__button" data-vulocart-buy-now data-product-id="%1$d" data-price-id="%2$s" data-added-label="%3$s" data-label="%4$s">%4$s</button></div>',
					(int) $product['id'],
					esc_attr( $product['price_id'] ),
					esc_attr__( 'Added', 'vulocart' ),
					esc_html__( 'Buy now', 'vulocart' )
				)
				: '';

			$out .= sprintf(
				'<div class="vulocart-purchase__row"><div class="vulocart-qty" role="group" aria-label="%1$s"><button type="button" data-vulocart-qty="-1" aria-label="%2$s">−</button><input type="number" name="vc_qty" value="1" min="1" max="99" inputmode="numeric" aria-label="%1$s" /><button type="button" data-vulocart-qty="1" aria-label="%3$s">+</button></div><div class="vulocart-add"><button type="button" class="wp-element-button vulocart-add__button" data-vulocart-add data-product-id="%4$d" data-price-id="%5$s" data-added-label="%6$s">%7$s</button></div>%8$s</div>',
				esc_attr__( 'Quantity', 'vulocart' ),
				esc_attr__( 'Decrease quantity', 'vulocart' ),
				esc_attr__( 'Increase quantity', 'vulocart' ),
				(int) $product['id'],
				esc_attr( $product['price_id'] ),
				esc_attr__( 'Added', 'vulocart' ),
				esc_html( $product['cta'] ),
				$buy // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
			);
			$has_buy_now = $buy_now;
		}

		return sprintf( '<div %s>%s</div>', get_block_wrapper_attributes( array( 'class' => 'vulocart-purchase' . ( ! empty( $has_buy_now ) ? ' has-buy-now' : '' ) ) ), $out ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
	}

	/**
	 * Stock: the savings pill and the availability line.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_stock( $attributes, $content, $block ) {
		$product = $this->product_of( $block );

		if ( ! $product ) {
			return '';
		}

		$out = '';

		if ( $product['on_sale'] && $product['discount'] > 0 ) {
			/* translators: %d: discount percentage. */
			$out .= '<p class="vulocart-savings">' . esc_html( sprintf( __( 'You save %d%% on the regular price', 'vulocart' ), $product['discount'] ) ) . '</p>';
		}

		if ( $product['sold_out'] ) {
			$out .= '<p class="vulocart-stock is-out">' . esc_html__( 'Sold out', 'vulocart' ) . '</p>';
		} elseif ( null !== $product['stock_qty'] ) {
			if ( $product['stock_qty'] > 0 && $product['stock_qty'] <= 5 ) {
				/* translators: %d: units left. */
				$out .= '<p class="vulocart-stock is-low">' . esc_html( sprintf( __( 'Only %d left', 'vulocart' ), $product['stock_qty'] ) ) . '</p>';
			} else {
				$out .= '<p class="vulocart-stock is-in">' . esc_html__( 'In stock', 'vulocart' ) . '</p>';
			}
		}

		return '' === $out ? '' : sprintf( '<div %s>%s</div>', get_block_wrapper_attributes( array( 'class' => 'vulocart-stock-block' ) ), $out ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
	}

	/**
	 * Reassurance list: the first line of each policy the merchant wrote, plus a secure-checkout note.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_trust( $attributes, $content, $block ) {
		$product = $this->product_of( $block );

		if ( ! $product ) {
			return '';
		}

		// Reassurance under the button, from what the merchant wrote: the first line of each policy.
		$first = static function ( $text ) {
			$text = trim( wp_strip_all_tags( (string) $text ) );
			$cut  = preg_split( '/(?<=[.!?])\s/', $text );

			return $cut ? (string) $cut[0] : $text;
		};
		$icon  = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
		$trust = '';
		foreach ( array( 'shipping', 'refund', 'cancellation' ) as $policy ) {
			if ( '' !== $product['policies'][ $policy ] ) {
				$trust .= '<li>' . $icon . '<span>' . esc_html( $first( $product['policies'][ $policy ] ) ) . '</span></li>';
			}
		}
		$trust .= '<li>' . $icon . '<span>' . esc_html__( 'Secure checkout', 'vulocart' ) . '</span></li>';
		return sprintf( '<ul %s>%s</ul>', get_block_wrapper_attributes( array( 'class' => 'vulocart-trust' ) ), $trust ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
	}

	/**
	 * Facts: SKU, brand, collection and type as a tidy list.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_facts( $attributes, $content, $block ) {
		$product = $this->product_of( $block );

		if ( ! $product ) {
			return '';
		}

		$facts = array();
		if ( $product['sku'] ) {
			$facts[ __( 'SKU', 'vulocart' ) ] = $product['sku'];
		}
		if ( $product['brand'] ) {
			$facts[ __( 'Brand', 'vulocart' ) ] = $product['brand'];
		}
		if ( $product['collections'] ) {
			$facts[ __( 'Collection', 'vulocart' ) ] = implode( ', ', $product['collections'] );
		}
		$facts[ __( 'Type', 'vulocart' ) ] = ucfirst( str_replace( '_', ' ', $product['type'] ) );

		$out = '<dl ' . get_block_wrapper_attributes( array( 'class' => 'vulocart-facts' ) ) . '>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		foreach ( $facts as $label => $value ) {
			$out .= '<div><dt>' . esc_html( $label ) . '</dt><dd>' . esc_html( $value ) . '</dd></div>';
		}

		return $out . '</dl>';
	}

	/**
	 * The product page's reading sections, ready-made and escaped, keyed by what they are.
	 *
	 * @param array<string, mixed> $product The product as the storefront sees it.
	 * @return array<string, string> Section key => `<section>` HTML.
	 */
	private function product_sections( $product ) {
		$table = static function ( $rows ) {
			$html = '<table class="vulocart-spec-table"><tbody>';
			foreach ( $rows as $row ) {
				$html .= '<tr><th scope="row">' . esc_html( $row['key'] ) . '</th><td>' . esc_html( $row['value'] ) . '</td></tr>';
			}

			return $html . '</tbody></table>';
		};

		$sections = array();

		if ( '' !== trim( $product['description'] ) ) {
			$sections['content'] = '<section class="vulocart-section"><h2>' . esc_html__( 'Description', 'vulocart' ) . '</h2><div class="vulocart-prose">' . wp_kses_post( wpautop( $product['description'] ) ) . '</div></section>';
		}

		if ( $product['details'] ) {
			$sections['details'] = '<section class="vulocart-section is-side"><h2>' . esc_html__( 'Details', 'vulocart' ) . '</h2>' . $table( $product['details'] ) . '</section>';
		}

		$specs = $product['specs'];
		if ( '' !== $product['weight'] ) {
			$specs[] = array(
				'key'   => __( 'Weight', 'vulocart' ),
				'value' => $product['weight'],
			);
		}
		if ( $product['dimensions'] ) {
			$specs[] = array(
				'key'   => __( 'Dimensions (L × W × H)', 'vulocart' ),
				'value' => implode( ' × ', $product['dimensions'] ),
			);
		}

		if ( $specs ) {
			$sections['specifications'] = '<section class="vulocart-section is-side"><h2>' . esc_html__( 'Specifications', 'vulocart' ) . '</h2>' . $table( $specs ) . '</section>';
		}

		if ( $product['faqs'] ) {
			$faqs = '';
			foreach ( $product['faqs'] as $faq ) {
				$faqs .= '<details><summary>' . esc_html( $faq['q'] ) . '</summary><p>' . esc_html( $faq['a'] ) . '</p></details>';
			}
			$sections['faqs'] = '<section class="vulocart-section"><h2>' . esc_html__( 'Questions & answers', 'vulocart' ) . '</h2><div class="vulocart-faqs">' . $faqs . '</div></section>';
		}

		$policy_rows = array();
		$policy_name = array(
			'shipping'     => __( 'Shipping', 'vulocart' ),
			'refund'       => __( 'Returns & refunds', 'vulocart' ),
			'cancellation' => __( 'Cancellation', 'vulocart' ),
		);
		foreach ( $policy_name as $key => $label ) {
			if ( '' !== $product['policies'][ $key ] ) {
				$policy_rows[] = array(
					'key'   => $label,
					'value' => $product['policies'][ $key ],
				);
			}
		}
		if ( $policy_rows ) {
			$sections['policies'] = '<section class="vulocart-section is-side"><h2>' . esc_html__( 'Shipping & returns', 'vulocart' ) . '</h2>' . $table( $policy_rows ) . '</section>';
		}

		/**
		 * Extra sections on the product page (vulocart-pro adds the Digital Product Passport). Each entry is ready-made,
		 * escaped HTML for one `<section class="vulocart-section is-side">`.
		 *
		 * @param string[] $extra   Sections.
		 * @param array    $product The product as the storefront sees it.
		 */
		$sections['extras'] = implode( '', (array) apply_filters( 'vulocart_storefront_product_sections', array(), $product ) );

		return $sections;
	}

	/**
	 * Prints one section of the product page as its own block.
	 *
	 * @param string    $key   Section key from product_sections().
	 * @param string    $class Wrapper class.
	 * @param \WP_Block $block Block instance.
	 * @return string
	 */
	private function render_section( $key, $class, $block ) {
		$product = $this->product_of( $block );

		if ( ! $product ) {
			return '';
		}

		$sections = $this->product_sections( $product );

		if ( empty( $sections[ $key ] ) ) {
			return '';
		}

		return sprintf( '<div %s>%s</div>', get_block_wrapper_attributes( array( 'class' => $class ) ), $sections[ $key ] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
	}

	/**
	 * Content: the long description.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_content( $attributes, $content, $block ) {
		return $this->render_section( 'content', 'vulocart-description-part', $block );
	}

	/**
	 * Specs: details, specifications or shipping & returns as a card, chosen by the `source` attribute.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_specs( $attributes, $content, $block ) {
		$map    = array(
			'details'        => 'details',
			'specifications' => 'specifications',
			'policies'       => 'policies',
		);
		$source = isset( $attributes['source'], $map[ $attributes['source'] ] ) ? $map[ $attributes['source'] ] : 'specifications';

		return $this->render_section( $source, 'vulocart-description-part is-card', $block );
	}

	/**
	 * FAQs: the product's questions and answers.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_faqs( $attributes, $content, $block ) {
		return $this->render_section( 'faqs', 'vulocart-description-part', $block );
	}

	/**
	 * Extras: sections other plugins add to the product page (the Digital Product Passport).
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_extras( $attributes, $content, $block ) {
		return $this->render_section( 'extras', 'vulocart-description-part is-cards', $block );
	}

	/**
	 * Description (legacy, one block for everything): kept so product pages built before the sections became
	 * separate blocks keep working. New layouts use Content, Specs, FAQs and Extras.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_description( $attributes, $content, $block ) {
		$product = $this->product_of( $block );

		if ( ! $product ) {
			return '';
		}

		$sections = implode( '', $this->product_sections( $product ) );

		if ( '' === $sections ) {
			return '';
		}

		// Reading sections in a wide column, fact cards in a narrow one; each column stacks without gaps.
		$main = '';
		$side = '';
		if ( preg_match_all( '#<section class="vulocart-section([^"]*)".*?</section>#s', $sections, $found, PREG_SET_ORDER ) ) {
			foreach ( $found as $match ) {
				if ( false !== strpos( $match[1], 'is-side' ) ) {
					$side .= $match[0];
				} else {
					$main .= $match[0];
				}
			}
		}

		$sections = '<div class="vulocart-description__main">' . $main . '</div>' . ( '' !== $side ? '<div class="vulocart-description__side">' . $side . '</div>' : '' );

		return sprintf( '<div %s>%s</div>', get_block_wrapper_attributes( array( 'class' => 'vulocart-description' ) ), $sections ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
	}

	/**
	 * Cart: the shell the cart script fills in (the cart lives under a token in the shopper's browser, so the
	 * server cannot print it).
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_cart( $attributes, $content, $block ) {
		$shop     = $this->page_url_with( array( 'vulocart/product-collection', 'vulocart/products' ) );
		$checkout = $this->page_url_with( array( 'vulocart/checkout' ) );

		return sprintf(
			'<div %1$s data-shop-url="%2$s" data-checkout-url="%3$s"><div class="vulocart-cart__loading" aria-hidden="true"><span></span><span></span><span></span></div><noscript><p class="vulocart-notice">%4$s</p></noscript></div>',
			get_block_wrapper_attributes( array( 'class' => 'vulocart-cart' ) ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			esc_url( $shop ),
			esc_url( $checkout ),
			esc_html__( 'Please enable JavaScript to see your cart.', 'vulocart' )
		);
	}

	/**
	 * Cart link: a bag icon with the item count, for a header or navigation.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Unused.
	 * @param \WP_Block            $block      Block instance.
	 * @return string
	 */
	public function render_cart_link( $attributes, $content, $block ) {
		$cart = $this->page_url_with( array( 'vulocart/cart', 'vulocart/checkout' ) );

		return sprintf(
			'<a %1$s href="%2$s" aria-label="%3$s"><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg><span class="vulocart-cart-link__count" data-vulocart-cart-count hidden>0</span></a>',
			get_block_wrapper_attributes( array( 'class' => 'vulocart-cart-link' ) ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			esc_url( $cart ? $cart : home_url( '/' ) ),
			esc_attr__( 'View cart', 'vulocart' )
		);
	}

	/**
	 * The page the shop lives on, for product links.
	 *
	 * @return string Empty when there is none.
	 */
	public function shop_url() {
		return $this->page_url_with( array( 'vulocart/product-collection', 'vulocart/products' ) );
	}

	/**
	 * The permalink of the first published page holding any of the given blocks.
	 *
	 * @param string[] $block_names Registered block names, in order of preference.
	 * @return string Empty when none.
	 */
	private function page_url_with( array $block_names ) {
		global $wpdb;

		foreach ( $block_names as $name ) {
			$key = 'vulocart_page_url_' . str_replace( '/', '_', $name );
			$url = get_transient( $key );

			if ( false === $url ) {
				$id  = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- one lookup, cached in a transient right below.
					$wpdb->prepare(
						"SELECT ID FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_type IN ('page', 'post') AND post_content LIKE %s ORDER BY ID ASC LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- core table name.
						'%<!-- wp:' . $wpdb->esc_like( $name ) . ' %'
					)
				);
				$url = $id ? (string) get_permalink( (int) $id ) : '';
				set_transient( $key, $url, HOUR_IN_SECONDS );
			}

			if ( $url ) {
				return (string) $url;
			}
		}

		return '';
	}

	/**
	 * The shop layout, as block markup: used by the pattern, the page template and the Shop page.
	 *
	 * @param bool $with_title Start with the page title (for the Shop template).
	 * @return string
	 */
	public static function shop_markup( $with_title = false ) {
		$empty = esc_html__( 'No products match your filters. Try a different search or clear the filters.', 'vulocart' );

		// A page that uses the Shop template shows its own title as the heading (a Post Title block); on any other
		// page the theme already prints the page title, so the layout starts at the filters.
		$title = $with_title ? '<!-- wp:post-title {"level":1,"align":"wide","style":{"typography":{"fontWeight":"700","letterSpacing":"-0.02em"},"spacing":{"padding":{"top":"2.5rem"},"margin":{"bottom":"1.5rem"}}},"fontSize":"xx-large"} /-->

' : '';

		return $title . <<<MARKUP
<!-- wp:vulocart/product-collection {"align":"wide","perPage":12} -->
<!-- wp:vulocart/product-filters /-->

<!-- wp:vulocart/product-template -->
<!-- wp:vulocart/product-image /-->

<!-- wp:vulocart/product-title /-->

<!-- wp:vulocart/product-price /-->

<!-- wp:vulocart/product-add-to-cart /-->
<!-- /wp:vulocart/product-template -->

<!-- wp:vulocart/product-pagination /-->

<!-- wp:vulocart/product-no-results -->
<!-- wp:paragraph {"align":"center"} -->
<p class="has-text-align-center">{$empty}</p>
<!-- /wp:paragraph -->
<!-- /wp:vulocart/product-no-results -->
<!-- /wp:vulocart/product-collection -->

<!-- wp:vulocart/product-details {"align":"wide"} -->
<!-- wp:vulocart/product-breadcrumbs /-->

<!-- wp:columns {"className":"vulocart-details-columns"} -->
<div class="wp-block-columns vulocart-details-columns"><!-- wp:column {"width":"56%"} -->
<div class="wp-block-column" style="flex-basis:56%"><!-- wp:vulocart/product-gallery /--></div>
<!-- /wp:column -->

<!-- wp:column {"width":"44%","className":"vulocart-details-info"} -->
<div class="wp-block-column vulocart-details-info" style="flex-basis:44%"><!-- wp:vulocart/product-title {"level":1,"isLink":false} /-->

<!-- wp:vulocart/product-price /-->

<!-- wp:vulocart/product-summary {"words":45} /-->

<!-- wp:group {"className":"vulocart-buybox","layout":{"type":"flow"}} -->
<div class="wp-block-group vulocart-buybox"><!-- wp:vulocart/product-stock /-->

<!-- wp:vulocart/product-purchase /-->

<!-- wp:vulocart/product-trust /-->

<!-- wp:vulocart/product-facts /--></div>
<!-- /wp:group --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->

<!-- wp:columns {"className":"vulocart-details-more"} -->
<div class="wp-block-columns vulocart-details-more"><!-- wp:column {"width":"62%"} -->
<div class="wp-block-column" style="flex-basis:62%"><!-- wp:vulocart/product-content /-->

<!-- wp:vulocart/product-faqs /--></div>
<!-- /wp:column -->

<!-- wp:column {"width":"38%"} -->
<div class="wp-block-column" style="flex-basis:38%"><!-- wp:vulocart/product-specs {"source":"details"} /-->

<!-- wp:vulocart/product-specs {"source":"specifications"} /-->

<!-- wp:vulocart/product-specs {"source":"policies"} /-->

<!-- wp:vulocart/product-extras /--></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->
<!-- /wp:vulocart/product-details -->
MARKUP;
	}

	/**
	 * Registers the "Shop" pattern.
	 *
	 * @return void
	 */
	private function register_patterns() {
		if ( function_exists( 'register_block_pattern_category' ) ) {
			register_block_pattern_category( 'vulocart', array( 'label' => __( 'VuloCart', 'vulocart' ) ) );
		}

		register_block_pattern(
			'vulocart/shop',
			array(
				'title'       => __( 'Shop page', 'vulocart' ),
				'description' => __( 'A shop heading, filters and a product grid with pagination.', 'vulocart' ),
				'categories'  => array( 'vulocart' ),
				'keywords'    => array( 'shop', 'store', 'products', 'catalog' ),
				'content'     => self::shop_markup(),
			)
		);

		register_block_pattern(
			'vulocart/cart',
			array(
				'title'       => __( 'Cart page', 'vulocart' ),
				'description' => __( 'The shopper\'s cart with an order summary and a checkout button.', 'vulocart' ),
				'categories'  => array( 'vulocart' ),
				'keywords'    => array( 'cart', 'basket', 'bag' ),
				'content'     => self::cart_markup(),
			)
		);

		register_block_pattern(
			'vulocart/checkout',
			array(
				'title'       => __( 'Checkout page', 'vulocart' ),
				'description' => __( 'Contact, address, shipping and payment, with a live order summary.', 'vulocart' ),
				'categories'  => array( 'vulocart' ),
				'keywords'    => array( 'checkout', 'payment', 'order' ),
				'content'     => self::checkout_markup(),
			)
		);
	}

	/**
	 * The cart page layout, as block markup.
	 *
	 * @param bool $with_title Start with the page title (for the Cart template).
	 * @return string
	 */
	public static function cart_markup( $with_title = false ) {
		return self::title_markup( $with_title ) . '<!-- wp:vulocart/cart {"align":"wide"} /-->';
	}

	/**
	 * The checkout page layout, as block markup.
	 *
	 * @param bool $with_title Start with the page title (for the Checkout template).
	 * @return string
	 */
	public static function checkout_markup( $with_title = false ) {
		return self::title_markup( $with_title ) . '<!-- wp:group {"align":"wide","className":"vulocart-checkout-wrap"} --><div class="wp-block-group alignwide vulocart-checkout-wrap"><!-- wp:vulocart/checkout --><div class="wp-block-vulocart-checkout"><div class="vulocart-checkout-block"></div></div><!-- /wp:vulocart/checkout --></div><!-- /wp:group -->';
	}

	/**
	 * A wide, bold page title for the page templates.
	 *
	 * @param bool $with_title Whether to include it.
	 * @return string
	 */
	private static function title_markup( $with_title ) {
		return $with_title ? '<!-- wp:post-title {"level":1,"align":"wide","style":{"typography":{"fontWeight":"700","letterSpacing":"-0.02em"},"spacing":{"padding":{"top":"2.5rem"},"margin":{"bottom":"1.5rem"}}},"fontSize":"xx-large"} /-->

' : '';
	}

	/**
	 * Registers the Shop, Cart and Checkout page templates (block themes): the theme's header and footer around the
	 * page's layout.
	 *
	 * @return void
	 */
	private function register_template() {
		if ( ! function_exists( 'register_block_template' ) ) {
			return;
		}

		$templates = array(
			'page-shop'     => array(
				'title'       => __( 'Shop', 'vulocart' ),
				'description' => __( 'The theme header and footer around a VuloCart shop: filters, product grid and pagination.', 'vulocart' ),
				'markup'      => self::shop_markup( true ),
			),
			'page-cart'     => array(
				'title'       => __( 'Cart', 'vulocart' ),
				'description' => __( 'The theme header and footer around the shopper\'s cart.', 'vulocart' ),
				'markup'      => self::cart_markup( true ),
			),
			'page-checkout' => array(
				'title'       => __( 'Checkout', 'vulocart' ),
				'description' => __( 'The theme header and footer around the checkout.', 'vulocart' ),
				'markup'      => self::checkout_markup( true ),
			),
		);

		foreach ( $templates as $slug => $template ) {
			register_block_template(
				'vulocart//' . $slug,
				array(
					'title'       => $template['title'],
					'description' => $template['description'],
					'post_types'  => array( 'page' ),
					'content'     => '<!-- wp:template-part {"slug":"header","area":"header","tagName":"header"} /-->'
						. '<!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} --><main class="wp-block-group">'
						. $template['markup']
						. '</main><!-- /wp:group -->'
						. '<!-- wp:template-part {"slug":"footer","area":"footer","tagName":"footer"} /-->',
				)
			);
		}
	}
}
