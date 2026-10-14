<?php
/**
 * Product class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Domain\Product;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Product entity.
 *
 * Plain domain object - no `$wpdb`, no WordPress function calls, no REST
 * request handling. `Infrastructure\Database\WPDBProductRepository` is the
 * only class that knows how a Product is actually stored; everything above
 * it (Application\ProductService, RestAPI\Controllers\Products) works with
 * this object, never a raw row array.
 *
 * No constructor property promotion / named arguments (both PHP 8.0+) -
 * this repo's phpcs.xml.dist targets PHP 7.4 (testVersion, coding-standards.md),
 * so plain property declarations + constructor assignment is used
 * throughout, matching every other class in this codebase despite
 * composer.json's own `>=8.0` platform requirement.
 *
 * @class       Product class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Product {

    /**
     * Product id.
     *
     * @var int|null Null for a product not yet persisted.
     */
    public $id;

    /**
     * Product type.
     *
     * @var string One of ProductType's constants.
     */
    public $type;

    /**
     * Display title.
     *
     * @var string Display title.
     */
    public $title;

    /**
     * URL-safe slug.
     *
     * @var string URL-safe slug.
     */
    public $slug;

    /**
     * Stock-keeping unit.
     *
     * @var string|null Stock-keeping unit, if any.
     */
    public $sku;

    /**
     * Lifecycle status.
     *
     * @var string 'draft'|'published'|'archived'.
     */
    public $status;

    /**
     * Base price.
     *
     * @var float|null Base price, in $currency's minor-agnostic decimal form.
     */
    public $price;

    /**
     * Currency code.
     *
     * @var string|null ISO 4217 currency code.
     */
    public $currency;

    /**
     * Extensible, type-specific attributes.
     *
     * @var array<string, mixed> Extensible, type-specific attributes.
     */
    public $meta;

    /**
     * Creation timestamp.
     *
     * @var string|null MySQL datetime string, once persisted.
     */
    public $created_at;

    /**
     * Last-updated timestamp.
     *
     * @var string|null MySQL datetime string, once persisted.
     */
    public $updated_at;

    /**
     * When the product was first published - null while it has only ever been a draft.
     *
     * @var string|null MySQL datetime string (UTC).
     */
    public $published_at;

    /**
     * Product constructor.
     *
     * @param int|null             $id         Null for a product not yet persisted.
     * @param string               $type       One of ProductType's constants.
     * @param string               $title      Display title.
     * @param string               $slug       URL-safe slug.
     * @param string|null          $sku        Stock-keeping unit, if any.
     * @param string               $status     'draft'|'published'|'archived'.
     * @param float|null           $price      Base price, in $currency's minor-agnostic decimal form.
     * @param string|null          $currency   ISO 4217 currency code.
     * @param array<string, mixed> $meta       Extensible, type-specific attributes.
     * @param string|null          $created_at MySQL datetime string, once persisted.
     * @param string|null          $updated_at MySQL datetime string, once persisted.
     * @param string|null          $published_at MySQL datetime string (UTC) of the first publish, or null.
     */
    public function __construct(
        $id,
        $type,
        $title,
        $slug,
        $sku = null,
        $status = 'draft',
        $price = null,
        $currency = null,
        $meta = array(),
        $created_at = null,
        $updated_at = null,
        $published_at = null
    ) {
        $this->id         = $id;
        $this->type       = $type;
        $this->title      = $title;
        $this->slug       = $slug;
        $this->sku        = $sku;
        $this->status     = $status;
        $this->price      = $price;
        $this->currency   = $currency;
        $this->meta       = $meta;
        $this->created_at = $created_at;
        $this->updated_at = $updated_at;
        $this->published_at = $published_at;
    }

    /**
     * Every price this product can be bought at, normalised.
     *
     * A product saved from the editor carries them in `meta['prices']`; one that predates that (or was written by
     * something that only knows `price` / `meta['sale_price']`) gets a single one-time price made from those, so
     * every reader can treat "a product has prices" as always true.
     *
     * Each entry: id, type, label, amount, sale_amount|null, interval, interval_count, payments|null, trial_days,
     * is_default, active.
     *
     * @return array<int, array<string, mixed>>
     */
    public function prices() {
        $stored = isset( $this->meta['prices'] ) && is_array( $this->meta['prices'] ) ? $this->meta['prices'] : array();
        $prices = array();

        foreach ( $stored as $entry ) {
            if ( is_array( $entry ) && isset( $entry['id'], $entry['type'] ) ) {
                $prices[] = $entry;
            }
        }

        if ( $prices ) {
            return $prices;
        }

        $sale = isset( $this->meta['sale_price'] ) && is_numeric( $this->meta['sale_price'] ) ? (float) $this->meta['sale_price'] : null;

        return array(
            array(
                'id'             => 'default',
                'type'           => 'one_time',
                'label'          => '',
                'amount'         => null === $this->price ? 0.0 : (float) $this->price,
                'sale_amount'    => $sale,
                'interval'       => '',
                'interval_count' => 1,
                'payments'       => null,
                'trial_days'     => 0,
                'is_default'     => true,
                'active'         => true,
            ),
        );
    }

    /**
     * The price used wherever only one is needed (listings, "from" prices, add-to-cart without a choice): the one
     * flagged as default if it is active, else the first active one, else the first.
     *
     * @return array<string, mixed>
     */
    public function default_price() {
        $prices = $this->prices();

        foreach ( $prices as $price ) {
            if ( ! empty( $price['is_default'] ) && ( ! isset( $price['active'] ) || $price['active'] ) ) {
                return $price;
            }
        }

        foreach ( $prices as $price ) {
            if ( ! isset( $price['active'] ) || $price['active'] ) {
                return $price;
            }
        }

        return $prices[0];
    }

    /**
     * One price by id; the default price when no id is given.
     *
     * @param string|null $price_id Price id, or null/'' for the default.
     * @return array<string, mixed>|null Null when an id was given but no price has it.
     */
    public function find_price( $price_id = null ) {
        if ( null === $price_id || '' === $price_id ) {
            return $this->default_price();
        }

        foreach ( $this->prices() as $price ) {
            if ( (string) $price['id'] === (string) $price_id ) {
                return $price;
            }
        }

        return null;
    }

    /**
     * What a price charges before any pricing rules: its sale amount when that is set and lower than the regular
     * amount, otherwise the regular amount.
     *
     * @param array<string, mixed> $price One entry from prices().
     * @return float
     */
    public static function price_amount( $price ) {
        $regular = isset( $price['amount'] ) && is_numeric( $price['amount'] ) ? (float) $price['amount'] : 0.0;
        $sale    = isset( $price['sale_amount'] ) && is_numeric( $price['sale_amount'] ) ? (float) $price['sale_amount'] : 0.0;

        return ( $sale > 0 && ( $regular <= 0 || $sale < $regular ) ) ? $sale : $regular;
    }

    /**
     * The price a customer is charged by default, before any pricing rules - the default price's amount (sale
     * amount when lower). Cart and the pricing-rules preview both start from this (or from a chosen price), so
     * what the storefront displays is what the cart charges.
     *
     * @return float
     */
    public function current_price() {
        return self::price_amount( $this->default_price() );
    }

    /**
     * Writes a regular/sale amount into the default price, when this product has stored prices - for writers that
     * only know the `price` column and `meta['sale_price']` (bulk edit, import) and would otherwise leave
     * `meta['prices']` showing a stale default.
     *
     * @param float|null $amount      New regular amount, or null to leave it.
     * @param bool       $set_sale    Whether $sale_amount should be written (null then clears the sale amount).
     * @param float|null $sale_amount New sale amount.
     * @return void
     */
    public function set_default_price( $amount, $set_sale = false, $sale_amount = null ) {
        if ( empty( $this->meta['prices'] ) || ! is_array( $this->meta['prices'] ) ) {
            return;
        }

        $default_id = (string) $this->default_price()['id'];

        foreach ( $this->meta['prices'] as $index => $price ) {
            if ( (string) $price['id'] !== $default_id ) {
                continue;
            }

            if ( null !== $amount ) {
                $this->meta['prices'][ $index ]['amount'] = (float) $amount;
            }

            if ( $set_sale ) {
                $this->meta['prices'][ $index ]['sale_amount'] = null === $sale_amount ? null : (float) $sale_amount;
            }
        }
    }
}
