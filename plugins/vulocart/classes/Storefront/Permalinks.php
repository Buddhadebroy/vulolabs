<?php
/**
 * Product page permalinks.
 *
 * @package VuloCart
 */

namespace VuloCart\Storefront;

use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Where a product's page lives: `/shop/blue-bottle/` (on the shop page), `/product/blue-bottle/` (a base of your
 * choice) or the plain `?product=12`. Chosen under Settings → Permalinks, like WooCommerce. The plain form keeps
 * working whatever is chosen and sends the visitor on to the pretty address.
 */
class Permalinks {

	const OPTION = 'vulocart_permalinks';

	const QUERY_VAR = 'vulocart_product';

	/**
	 * The product id resolved from a pretty address on this request, or null.
	 *
	 * @var int|null
	 */
	private static $resolved_product_id = null;

	/**
	 * Hooks everything up.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'register_rules' ) );
		add_action( 'init', array( $this, 'flush_if_changed' ), 99 );
		add_filter( 'query_vars', array( $this, 'register_query_var' ) );
		add_action( 'parse_request', array( $this, 'resolve_slug' ) );
		add_action( 'template_redirect', array( $this, 'redirect_plain_links' ), 1 );
		add_action( 'update_option_' . self::OPTION, array( $this, 'schedule_flush' ) );
		add_action( 'load-options-permalink.php', array( $this, 'permalink_screen' ) );
	}

	/**
	 * The saved choice, with defaults: pretty links on the shop page.
	 *
	 * @return array{structure: string, base: string}
	 */
	public static function settings(): array {
		$saved = get_option( self::OPTION, array() );
		$saved = is_array( $saved ) ? $saved : array();
		$base  = isset( $saved['base'] ) ? trim( sanitize_text_field( (string) $saved['base'] ), '/' ) : '';

		return array(
			'structure' => isset( $saved['structure'] ) && in_array( $saved['structure'], array( 'plain', 'shop', 'base' ), true ) ? $saved['structure'] : 'shop',
			'base'      => '' !== $base ? $base : 'product',
		);
	}

	/**
	 * The shop page's path, e.g. `shop-test`; empty when there is none or it is the front page.
	 *
	 * @return string
	 */
	private static function shop_path(): string {
		$url  = \VuloCart()->storefront->shop_url();
		$home = home_url( '/' );

		if ( '' === $url || 0 !== strpos( $url, $home ) ) {
			return '';
		}

		return trim( (string) strtok( substr( $url, strlen( $home ) ), '?' ), '/' );
	}

	/**
	 * The address of a product's page.
	 *
	 * @param int    $id       Product id.
	 * @param string $slug     Product slug.
	 * @param string $fallback Page the shop lives on, used for the plain form.
	 * @return string
	 */
	public static function product_url( int $id, string $slug, string $fallback ): string {
		$settings  = self::settings();
		$shop_path = self::shop_path();

		if ( '' !== $slug && '' !== $shop_path && 'plain' !== $settings['structure'] ) {
			if ( 'base' === $settings['structure'] ) {
				return home_url( user_trailingslashit( $settings['base'] . '/' . $slug ) );
			}

			return home_url( user_trailingslashit( $shop_path . '/' . $slug ) );
		}

		return add_query_arg( 'product', $id, $fallback );
	}

	/**
	 * The rewrite rule for the chosen form.
	 *
	 * @return void
	 */
	public function register_rules() {
		$settings  = self::settings();
		$shop_path = self::shop_path();

		if ( '' === $shop_path || 'plain' === $settings['structure'] ) {
			return;
		}

		$prefix = 'base' === $settings['structure'] ? $settings['base'] : $shop_path;

		add_rewrite_rule( '^' . preg_quote( $prefix, '#' ) . '/([^/]+)/?$', 'index.php?pagename=' . $shop_path . '&' . self::QUERY_VAR . '=$matches[1]', 'top' );
	}

	/**
	 * Registers the slug query var.
	 *
	 * @param string[] $vars Query vars.
	 * @return string[]
	 */
	public function register_query_var( $vars ) {
		$vars[] = self::QUERY_VAR;

		return $vars;
	}

	/**
	 * Turns the slug in the address into the `product` id the product blocks read.
	 *
	 * @param \WP $wp Request.
	 * @return void
	 */
	public function resolve_slug( $wp ) {
		if ( empty( $wp->query_vars[ self::QUERY_VAR ] ) ) {
			return;
		}

		global $wpdb;

		$table = $wpdb->prefix . Utill::TABLES['product'];
		$id    = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- one indexed lookup per product page view.
			$wpdb->prepare( "SELECT id FROM {$table} WHERE slug = %s ORDER BY id ASC LIMIT 1", sanitize_title( (string) $wp->query_vars[ self::QUERY_VAR ] ) ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- plugin table name.
		);

		self::$resolved_product_id = $id;
	}

	/**
	 * The product id resolved from a pretty address on this request.
	 *
	 * @return int|null Null when the address was not a pretty product address.
	 */
	public static function resolved_product_id() {
		return self::$resolved_product_id;
	}

	/**
	 * An old `?product=12` link goes to the pretty address.
	 *
	 * @return void
	 */
	public function redirect_plain_links() {
		$product_id = filter_input( INPUT_GET, 'product', FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 1 ) ) );

		if ( 'plain' === self::settings()['structure'] || ! $product_id || get_query_var( self::QUERY_VAR ) ) {
			return;
		}

		$product = \VuloCart()->product_service->get_product( $product_id );

		if ( ! $product || '' === (string) $product->slug ) {
			return;
		}

		$pretty = self::product_url( (int) $product->id, (string) $product->slug, '' );

		if ( '' !== $pretty && false === strpos( $pretty, '?product=' ) ) {
			wp_safe_redirect( $pretty, 301 );
			exit;
		}
	}

	/**
	 * Rewrite rules are rebuilt after the choice (or the shop page) changes.
	 *
	 * @return void
	 */
	public function schedule_flush() {
		delete_option( 'vulocart_permalinks_flushed' );
	}

	/**
	 * Rebuilds the rewrite rules once whenever the choice or the shop page changes.
	 *
	 * @return void
	 */
	public function flush_if_changed() {
		$hash = md5( wp_json_encode( self::settings() ) . self::shop_path() );

		if ( get_option( 'vulocart_permalinks_flushed' ) !== $hash ) {
			update_option( 'vulocart_permalinks_flushed', $hash );
			flush_rewrite_rules( false );
		}
	}

	/**
	 * Settings → Permalinks: the product page section, and saving it.
	 *
	 * @return void
	 */
	public function permalink_screen() {
		add_settings_section( 'vulocart-permalinks', __( 'VuloCart product page', 'vulocart' ), '__return_false', 'permalink' );
		add_settings_field( 'vulocart_product_permalink', __( 'Product permalink', 'vulocart' ), array( $this, 'render_field' ), 'permalink', 'vulocart-permalinks' );

		$posted_structure = filter_input( INPUT_POST, 'vulocart_permalink_structure', FILTER_UNSAFE_RAW );

		if ( is_string( $posted_structure ) && check_admin_referer( 'update-permalink' ) && current_user_can( 'manage_options' ) ) {
			$structure = sanitize_key( $posted_structure );
			$base      = trim( sanitize_title_with_dashes( (string) filter_input( INPUT_POST, 'vulocart_permalink_base', FILTER_UNSAFE_RAW ) ), '/' );

			update_option(
				self::OPTION,
				array(
					'structure' => $structure,
					'base'      => $base,
				)
			);
		}
	}

	/**
	 * The field, in the same markup as WordPress's own permalink choices.
	 *
	 * @return void
	 */
	public function render_field() {
		$settings = self::settings();
		$shop     = self::shop_path();
		$shop     = '' !== $shop ? $shop : 'shop';
		$home     = untrailingslashit( home_url() );
		$rows     = array(
			'plain' => array( __( 'Plain', 'vulocart' ), $home . '/' . $shop . '/?product=123' ),
			'shop'  => array( __( 'On the shop page', 'vulocart' ), $home . '/' . $shop . '/product-name/' ),
		);

		// The same look as WordPress's own choices (core scopes that CSS to its own table).
		echo '<style>.vulocart-structure .row{display:flex;align-items:flex-start;gap:.5rem;margin-bottom:1rem}.vulocart-structure .row input[type=radio]{margin-top:.2rem}.vulocart-structure .row label{font-weight:600}.vulocart-structure .row p{margin:.25rem 0 0}</style>';
		echo '<fieldset class="structure-selection vulocart-structure"><legend class="screen-reader-text">' . esc_html__( 'Product permalink', 'vulocart' ) . '</legend>';

		foreach ( $rows as $value => $row ) {
			printf(
				'<div class="row"><input id="vulocart_permalink_%1$s" name="vulocart_permalink_structure" type="radio" value="%1$s"%2$s /><div><label for="vulocart_permalink_%1$s">%3$s</label><p><code class="structure-url">%4$s</code></p></div></div>',
				esc_attr( $value ),
				checked( $settings['structure'], $value, false ),
				esc_html( $row[0] ),
				esc_html( $row[1] )
			);
		}

		printf(
			'<div class="row"><input id="vulocart_permalink_base" name="vulocart_permalink_structure" type="radio" value="base"%1$s /><div><label for="vulocart_permalink_base_text">%2$s</label><p><code>%3$s</code> <input name="vulocart_permalink_base" id="vulocart_permalink_base_text" type="text" value="%4$s" class="regular-text code" onfocus="document.getElementById(\'vulocart_permalink_base\').checked=true" /> <code>product-name/</code></p></div></div>',
			checked( $settings['structure'], 'base', false ),
			esc_html__( 'Own base', 'vulocart' ),
			esc_html( $home ),
			esc_attr( '/' . $settings['base'] . '/' )
		);

		echo '</fieldset>';
		echo '<p class="description">' . esc_html__( 'Old ?product=123 links keep working and send visitors to the new address.', 'vulocart' ) . '</p>';

		if ( '' === self::shop_path() ) {
			echo '<p class="description">' . esc_html__( 'No shop page was found (or it is the front page), so plain links are used for now.', 'vulocart' ) . '</p>';
		}
	}
}
