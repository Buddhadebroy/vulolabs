<?php
/**
 * Storefront product view-model.
 *
 * @package VuloCart
 */

namespace VuloCart\Storefront;

use VuloCart\Application\PriceCatalog;
use VuloCart\Domain\Product\Product;

defined( 'ABSPATH' ) || exit;

/**
 * Turns a domain Product into the flat array the storefront blocks print - one place decides what a shopper sees
 * (price, sale state, stock, call-to-action), so every block (image badge, price, add-to-cart) agrees.
 */
class ProductView {

	/**
	 * Types that can be added to the cart straight from a card when they have a single purchasable price. The rest
	 * (booking dates, donation amount, gift-card recipient, rental period) need the product page first.
	 */
	const QUICK_ADD_TYPES = array( 'physical', 'digital', 'subscription', 'membership', 'course', 'service' );

	/**
	 * Currency symbols for the common currencies; anything else prints its code after the amount.
	 */
	const SYMBOLS = array(
		'USD' => '$',
		'EUR' => '€',
		'GBP' => '£',
		'INR' => '₹',
		'JPY' => '¥',
		'CNY' => '¥',
		'AUD' => 'A$',
		'CAD' => 'C$',
		'NZD' => 'NZ$',
		'SGD' => 'S$',
		'HKD' => 'HK$',
		'CHF' => 'CHF ',
		'KRW' => '₩',
		'BRL' => 'R$',
		'MXN' => 'MX$',
		'ZAR' => 'R',
		'SEK' => 'kr ',
		'NOK' => 'kr ',
		'DKK' => 'kr ',
		'AED' => 'AED ',
		'BDT' => '৳',
	);

	/**
	 * Currencies with no minor unit.
	 */
	const ZERO_DECIMAL = array( 'JPY', 'KRW' );

	/**
	 * Formats an amount for display: symbol, thousands separator and the currency's decimals.
	 *
	 * @param float       $amount   Amount.
	 * @param string|null $currency ISO code; null uses the store default.
	 * @return string
	 */
	public static function money( $amount, $currency = null ) {
		$currency = strtoupper( (string) ( $currency ? $currency : self::default_currency() ) );
		$decimals = in_array( $currency, self::ZERO_DECIMAL, true ) ? 0 : 2;
		$number   = number_format_i18n( (float) $amount, $decimals );

		return isset( self::SYMBOLS[ $currency ] ) ? self::SYMBOLS[ $currency ] . $number : $number . ' ' . $currency;
	}

	/**
	 * The store's default currency code.
	 *
	 * @return string
	 */
	public static function default_currency() {
		$settings = get_option( \VuloCart\Utill::SETTINGS_KEY, array() );

		return is_array( $settings ) && ! empty( $settings['default_currency'] ) ? (string) $settings['default_currency'] : 'USD';
	}

	/**
	 * The label of the call-to-action button, which reads like what is being sold.
	 *
	 * @param string $type Product type.
	 * @return string
	 */
	public static function cta_label( $type ) {
		switch ( $type ) {
			case 'booking':
				return __( 'Book now', 'vulocart' );
			case 'donation':
				return __( 'Donate', 'vulocart' );
			case 'course':
				return __( 'Enroll', 'vulocart' );
			case 'subscription':
			case 'membership':
				return __( 'Subscribe', 'vulocart' );
			case 'service':
				return __( 'Request this service', 'vulocart' );
			case 'rental':
				return __( 'Rent now', 'vulocart' );
			case 'gift_card':
				return __( 'Buy gift card', 'vulocart' );
			default:
				return __( 'Add to cart', 'vulocart' );
		}
	}

	/**
	 * Builds the view-model.
	 *
	 * @param Product $product  Product.
	 * @param string  $base_url Page the shop lives on; a product's page is `?product={id}` on it.
	 * @return array<string, mixed>
	 */
	public static function make( Product $product, $base_url ) {
		$meta     = is_array( $product->meta ) ? $product->meta : array();
		$currency = $product->currency ? $product->currency : self::default_currency();

		$buyable = array_values(
			array_filter(
				$product->prices(),
				static function ( $price ) {
					return PriceCatalog::is_purchasable( $price );
				}
			)
		);

		usort(
			$buyable,
			static function ( $a, $b ) {
				return (int) ! empty( $b['is_default'] ) - (int) ! empty( $a['is_default'] );
			}
		);

		$default = $buyable ? $buyable[0] : null;

		if ( $default ) {
			$regular = (float) ( isset( $default['amount'] ) ? $default['amount'] : 0 );
			$current = Product::price_amount( $default );
			$amounts = array_map( array( Product::class, 'price_amount' ), $buyable );
			$from    = count( array_unique( $amounts ) ) > 1;
			$lowest  = min( $amounts );
		} else {
			$regular = null === $product->price ? 0.0 : (float) $product->price;
			$current = $regular;
			$from    = false;
			$lowest  = $regular;
		}

		$has_price = $default ? true : null !== $product->price;
		$on_sale   = $has_price && ! $from && $regular > 0 && $current < $regular;
		$sold_out  = ! empty( $meta['stock_management'] ) && isset( $meta['stock_status'] ) && 'out_of_stock' === $meta['stock_status'];
		$image     = isset( $meta['featured_image'] ) && is_array( $meta['featured_image'] ) ? $meta['featured_image'] : null;

		// A recurring price reads "$9.00 / month".
		$per = '';
		if ( $default && ! empty( $default['interval'] ) && 'one_time' !== ( isset( $default['type'] ) ? $default['type'] : 'one_time' ) ) {
			$per = (string) $default['interval'];
		}

		return array(
			'id'        => (int) $product->id,
			'type'      => (string) $product->type,
			'title'     => (string) $product->title,
			'url'       => Permalinks::product_url( (int) $product->id, (string) $product->slug, $base_url ),
			'summary'   => isset( $meta['short_description'] ) ? wp_strip_all_tags( (string) $meta['short_description'] ) : '',
			'image_id'  => $image && ! empty( $image['id'] ) ? (int) $image['id'] : 0,
			'image_url' => $image && ! empty( $image['url'] ) ? (string) $image['url'] : '',
			'has_price' => $has_price,
			'on_sale'   => $on_sale,
			'discount'  => $on_sale ? (int) round( ( 1 - $current / $regular ) * 100 ) : 0,
			'regular'   => self::money( $regular, $currency ),
			'current'   => self::money( $from ? $lowest : $current, $currency ),
			'from'      => $from,
			'per'       => $per,
			'sold_out'  => $sold_out,
			'featured'  => ! empty( $meta['featured'] ),
			'price_id'  => $default && isset( $default['id'] ) ? (string) $default['id'] : '',
			'quick_add' => 1 === count( $buyable ) && in_array( $product->type, self::QUICK_ADD_TYPES, true ),
			'cta'       => self::cta_label( (string) $product->type ),
		);
	}

	/**
	 * "every month", "every 3 weeks"; empty for a one-time price.
	 *
	 * @param string $interval day|week|month|year.
	 * @param int    $count    How many intervals.
	 * @return string
	 */
	public static function interval_text( $interval, $count ) {
		$n = max( 1, (int) $count );

		switch ( $interval ) {
			case 'day':
				/* translators: %d: number of days. */
				return 1 === $n ? __( 'every day', 'vulocart' ) : sprintf( __( 'every %d days', 'vulocart' ), $n );
			case 'week':
				/* translators: %d: number of weeks. */
				return 1 === $n ? __( 'every week', 'vulocart' ) : sprintf( __( 'every %d weeks', 'vulocart' ), $n );
			case 'month':
				/* translators: %d: number of months. */
				return 1 === $n ? __( 'every month', 'vulocart' ) : sprintf( __( 'every %d months', 'vulocart' ), $n );
			case 'year':
				/* translators: %d: number of years. */
				return 1 === $n ? __( 'every year', 'vulocart' ) : sprintf( __( 'every %d years', 'vulocart' ), $n );
			default:
				return '';
		}
	}

	/**
	 * The "how often" half of a price line: nothing for one-time, "every month (4 payments)" for a plan.
	 *
	 * @param array<string, mixed> $price One price.
	 * @return string
	 */
	public static function billing_text( $price ) {
		$every    = self::interval_text( isset( $price['interval'] ) ? (string) $price['interval'] : '', isset( $price['interval_count'] ) ? (int) $price['interval_count'] : 1 );
		$payments = isset( $price['payments'] ) ? (int) $price['payments'] : 0;

		if ( '' === $every ) {
			return '';
		}

		return $payments > 0
			/* translators: 1: "every month", 2: number of payments. */
			? sprintf( _n( '%1$s (%2$d payment)', '%1$s (%2$d payments)', $payments, 'vulocart' ), $every, $payments )
			: $every;
	}

	/**
	 * The view-model plus everything a product page shows: gallery, description, specifications, FAQs, stock and
	 * every price the shopper can pick.
	 *
	 * @param Product $product  Product.
	 * @param string  $base_url Shop page URL.
	 * @return array<string, mixed>
	 */
	public static function make_detail( Product $product, $base_url ) {
		$view     = self::make( $product, $base_url );
		$meta     = is_array( $product->meta ) ? $product->meta : array();
		$currency = $product->currency ? $product->currency : self::default_currency();

		$gallery = array();
		$seen    = array();
		$items   = array();

		if ( ! empty( $meta['featured_image'] ) && is_array( $meta['featured_image'] ) ) {
			$items[] = $meta['featured_image'];
		}
		if ( ! empty( $meta['gallery'] ) && is_array( $meta['gallery'] ) ) {
			$items = array_merge( $items, $meta['gallery'] );
		}

		foreach ( $items as $item ) {
			$id = isset( $item['id'] ) ? (int) $item['id'] : 0;

			if ( ! $id || isset( $seen[ $id ] ) ) {
				continue;
			}

			$seen[ $id ] = true;
			$file        = get_attached_file( $id );

			// A photo whose file is gone is skipped rather than shown broken.
			if ( $file && file_exists( $file ) ) {
				$gallery[] = array(
					'id'    => $id,
					'large' => (string) wp_get_attachment_image_url( $id, 'large' ),
					'thumb' => (string) wp_get_attachment_image_url( $id, 'thumbnail' ),
					'full'  => (string) wp_get_attachment_image_url( $id, 'full' ),
				);
			}
		}

		$prices = array();
		foreach ( $product->prices() as $price ) {
			if ( ! PriceCatalog::is_purchasable( $price ) ) {
				continue;
			}

			$regular  = (float) ( isset( $price['amount'] ) ? $price['amount'] : 0 );
			$current  = Product::price_amount( $price );
			$prices[] = array(
				'id'      => (string) $price['id'],
				'label'   => ! empty( $price['label'] ) ? (string) $price['label'] : __( 'Standard', 'vulocart' ),
				'amount'  => self::money( $current, $currency ),
				'regular' => $current < $regular ? self::money( $regular, $currency ) : '',
				'billing' => self::billing_text( $price ),
				'default' => ! empty( $price['is_default'] ),
			);
		}
		usort(
			$prices,
			static function ( $a, $b ) {
				return (int) $b['default'] - (int) $a['default'];
			}
		);

		$specs = array();
		if ( ! empty( $meta['specifications'] ) && is_array( $meta['specifications'] ) ) {
			foreach ( $meta['specifications'] as $row ) {
				if ( ! empty( $row['key'] ) ) {
					$specs[] = array(
						'key'   => (string) $row['key'],
						'value' => isset( $row['value'] ) ? (string) $row['value'] : '',
					);
				}
			}
		}

		$faqs = array();
		if ( ! empty( $meta['faqs'] ) && is_array( $meta['faqs'] ) ) {
			foreach ( $meta['faqs'] as $row ) {
				if ( ! empty( $row['question'] ) ) {
					$faqs[] = array(
						'q' => (string) $row['question'],
						'a' => isset( $row['answer'] ) ? (string) $row['answer'] : '',
					);
				}
			}
		}

		$details = array();
		if ( ! empty( $meta['type_details'] ) && is_array( $meta['type_details'] ) ) {
			foreach ( $meta['type_details'] as $key => $value ) {
				if ( is_scalar( $value ) && '' !== (string) $value ) {
					$details[] = array(
						'key'   => ucfirst( str_replace( '_', ' ', (string) $key ) ),
						'value' => is_bool( $value ) ? ( $value ? __( 'Yes', 'vulocart' ) : __( 'No', 'vulocart' ) ) : (string) $value,
					);
				}
			}
		}

		$managed  = ! empty( $meta['stock_management'] );
		$quantity = $managed && isset( $meta['stock_quantity'] ) && is_numeric( $meta['stock_quantity'] ) ? (int) $meta['stock_quantity'] : null;

		return array_merge(
			$view,
			array(
				'gallery'     => $gallery,
				'description' => isset( $meta['full_description'] ) ? (string) $meta['full_description'] : '',
				'specs'       => $specs,
				'faqs'        => $faqs,
				'details'     => $details,
				'prices'      => $prices,
				'sku'         => (string) $product->sku,
				'stock_qty'   => $quantity,
				'brand'       => ! empty( $meta['brand'] ) ? ucwords( str_replace( '-', ' ', (string) $meta['brand'] ) ) : '',
				'collections' => isset( $meta['collections'] ) && is_array( $meta['collections'] ) ? array_map(
					static function ( $slug ) {
						return ucwords( str_replace( '-', ' ', (string) $slug ) );
					},
					$meta['collections']
				) : array(),
				'policies'    => array(
					'shipping'     => isset( $meta['shipping_policy'] ) ? (string) $meta['shipping_policy'] : '',
					'refund'       => isset( $meta['refund_policy'] ) ? (string) $meta['refund_policy'] : '',
					'cancellation' => isset( $meta['cancellation_policy'] ) ? (string) $meta['cancellation_policy'] : '',
				),
				'weight'      => isset( $meta['weight'] ) ? (string) $meta['weight'] : '',
				'dimensions'  => array_filter( array( isset( $meta['length'] ) ? (string) $meta['length'] : '', isset( $meta['width'] ) ? (string) $meta['width'] : '', isset( $meta['height'] ) ? (string) $meta['height'] : '' ) ),
				'backorder'   => isset( $meta['stock_status'] ) && 'backorder' === $meta['stock_status'],
			)
		);
	}
}
