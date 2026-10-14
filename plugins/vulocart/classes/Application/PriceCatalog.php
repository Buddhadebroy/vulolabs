<?php
/**
 * PriceCatalog class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Application;

defined( 'ABSPATH' ) || exit;

/**
 * The price types a product can be sold at, and cleaning/reconciling a product's price list.
 *
 * A product carries its prices in `meta['prices']` (see Domain\Product\Product::prices()). Free ships one type,
 * `one_time`. Anything else is added by a plugin through two filters, so Free never needs to know it exists:
 *
 * - `vulocart_price_types`            every type that may be stored: `array( id => array( 'label' => ... ) )`.
 * - `vulocart_purchasable_price_types` the ids the cart will actually sell; default `one_time` only. A price whose
 *   type is not in this list (its plugin was deactivated) is kept on the product, untouched, but cannot be bought.
 *
 * @class       PriceCatalog class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PriceCatalog {

	const ONE_TIME = 'one_time';

	const INTERVALS = array( 'day', 'week', 'month', 'year' );

	const MAX_PRICES = 20;

	/**
	 * Every price type that may be stored.
	 *
	 * @return array<string, array<string, string>>
	 */
	public static function types() {
		return (array) apply_filters(
			'vulocart_price_types',
			array(
				self::ONE_TIME => array( 'label' => __( 'One-time', 'vulocart' ) ),
			)
		);
	}

	/**
	 * Type ids the cart will sell.
	 *
	 * @return string[]
	 */
	public static function purchasable_types() {
		return array_values( array_map( 'strval', (array) apply_filters( 'vulocart_purchasable_price_types', array( self::ONE_TIME ) ) ) );
	}

	/**
	 * Whether a stored price can be added to a cart right now.
	 *
	 * @param array<string, mixed> $price One entry from Product::prices().
	 * @return bool
	 */
	public static function is_purchasable( $price ) {
		return ( ! isset( $price['active'] ) || $price['active'] ) && in_array( (string) $price['type'], self::purchasable_types(), true );
	}

	/**
	 * Cleans a submitted price list: known fields only, typed, ids unique, exactly one default.
	 *
	 * Unknown types are kept (not turned into one-time) so deactivating the plugin that adds a type never
	 * destroys the prices already set up with it.
	 *
	 * @param mixed $prices Raw `meta['prices']`.
	 * @return array<int, array<string, mixed>> Empty when nothing usable was submitted.
	 */
	public static function sanitize( $prices ) {
		if ( ! is_array( $prices ) ) {
			return array();
		}

		$clean = array();
		$seen  = array();

		foreach ( array_slice( array_values( $prices ), 0, self::MAX_PRICES ) as $price ) {
			if ( ! is_array( $price ) ) {
				continue;
			}

			$id = isset( $price['id'] ) ? sanitize_key( (string) $price['id'] ) : '';

			if ( '' === $id || isset( $seen[ $id ] ) ) {
				$id = 'price_' . strtolower( wp_generate_password( 8, false ) );
			}

			$seen[ $id ] = true;

			$type     = isset( $price['type'] ) ? sanitize_key( (string) $price['type'] ) : self::ONE_TIME;
			$interval = isset( $price['interval'] ) ? sanitize_key( (string) $price['interval'] ) : '';
			$sale     = isset( $price['sale_amount'] ) && is_numeric( $price['sale_amount'] ) && (float) $price['sale_amount'] > 0 ? (float) $price['sale_amount'] : null;
			$amount   = isset( $price['amount'] ) && is_numeric( $price['amount'] ) ? max( 0.0, (float) $price['amount'] ) : 0.0;

			$clean[] = array(
				'id'             => $id,
				'type'           => '' === $type ? self::ONE_TIME : $type,
				'label'          => isset( $price['label'] ) ? mb_substr( sanitize_text_field( (string) $price['label'] ), 0, 80 ) : '',
				'amount'         => $amount,
				'sale_amount'    => $sale,
				'interval'       => in_array( $interval, self::INTERVALS, true ) ? $interval : '',
				'interval_count' => isset( $price['interval_count'] ) ? max( 1, absint( $price['interval_count'] ) ) : 1,
				'payments'       => isset( $price['payments'] ) && is_numeric( $price['payments'] ) && absint( $price['payments'] ) > 0 ? absint( $price['payments'] ) : null,
				'trial_days'     => isset( $price['trial_days'] ) ? absint( $price['trial_days'] ) : 0,
				'is_default'     => ! empty( $price['is_default'] ),
				'active'         => ! isset( $price['active'] ) || (bool) $price['active'],
			);
		}

		if ( ! $clean ) {
			return array();
		}

		// Exactly one default: the first flagged one, else the first active one, else the first.
		$default = null;

		foreach ( $clean as $index => $price ) {
			if ( $price['is_default'] && $price['active'] ) {
				$default = $index;
				break;
			}
		}

		if ( null === $default ) {
			foreach ( $clean as $index => $price ) {
				if ( $price['active'] ) {
					$default = $index;
					break;
				}
			}
		}

		$default = null === $default ? 0 : $default;

		foreach ( $clean as $index => $price ) {
			$clean[ $index ]['is_default'] = ( $index === $default );
		}

		return $clean;
	}

	/**
	 * Keeps the `price` column, `meta['sale_price']` and the default price of `meta['prices']` saying the same
	 * thing.
	 *
	 * The editor sends all three already agreeing. A writer that only knows the old fields (quick edit, bulk edit,
	 * import) sends a changed `price` or `sale_price` next to a stale `prices` - in that case the change is applied
	 * to the default price rather than being overwritten by it.
	 *
	 * @param float|null           $request_price The submitted `price`, or null if none was.
	 * @param array<string, mixed> $meta          Sanitized meta.
	 * @return array{0: float|null, 1: array<string, mixed>} The value for the `price` column (null: leave it) and the meta to store.
	 */
	public static function reconcile( $request_price, $meta ) {
		if ( empty( $meta['prices'] ) || ! is_array( $meta['prices'] ) ) {
			return array( $request_price, $meta );
		}

		$prices  = $meta['prices'];
		$default = 0;

		foreach ( $prices as $index => $price ) {
			if ( ! empty( $price['is_default'] ) ) {
				$default = $index;
				break;
			}
		}

		if ( null !== $request_price && abs( (float) $request_price - (float) $prices[ $default ]['amount'] ) > 0.00001 ) {
			$prices[ $default ]['amount'] = (float) $request_price;
		}

		if ( array_key_exists( 'sale_price', $meta ) ) {
			$sale    = null === $meta['sale_price'] ? null : (float) $meta['sale_price'];
			$current = $prices[ $default ]['sale_amount'];

			if ( ( null === $sale ) !== ( null === $current ) || ( null !== $sale && abs( $sale - (float) $current ) > 0.00001 ) ) {
				$prices[ $default ]['sale_amount'] = $sale;
			}
		}

		$meta['prices']     = $prices;
		$meta['sale_price'] = $prices[ $default ]['sale_amount'];

		return array( (float) $prices[ $default ]['amount'], $meta );
	}

	/**
	 * Which price a cart/order line was bought at, read back from the line's meta - or null for a line created
	 * before products had several prices.
	 *
	 * @param array<string, mixed> $line_meta CartItem/OrderItem meta.
	 * @return array<string, mixed>|null
	 */
	public static function line_price( $line_meta ) {
		if ( empty( $line_meta['price_id'] ) ) {
			return null;
		}

		return array(
			'id'             => $line_meta['price_id'],
			'label'          => isset( $line_meta['price_label'] ) ? $line_meta['price_label'] : '',
			'type'           => isset( $line_meta['price_type'] ) ? $line_meta['price_type'] : self::ONE_TIME,
			'interval'       => isset( $line_meta['interval'] ) ? $line_meta['interval'] : '',
			'interval_count' => isset( $line_meta['interval_count'] ) ? (int) $line_meta['interval_count'] : 1,
			'payments'       => isset( $line_meta['payments'] ) ? $line_meta['payments'] : null,
			'trial_days'     => isset( $line_meta['trial_days'] ) ? (int) $line_meta['trial_days'] : 0,
		);
	}
}
