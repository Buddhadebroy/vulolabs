<?php
/**
 * CartService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Cart\Application;

use VuloCart\Application\ProductService;
use VuloCart\Application\PriceCatalog;
use VuloCart\Cart\Domain\Cart;
use VuloCart\Cart\Domain\CartItem;
use VuloCart\Cart\Domain\CartRepositoryInterface;
use VuloCart\Domain\Product\Product;
use VuloCart\Events\EventDispatcher;
use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Cart module CartService.
 *
 * Where Cart business logic actually lives - Rest calls only this class,
 * mirroring VuloCart\Application\ProductService's role for Products. Depends
 * on the core plugin's ProductService (not the product repository directly)
 * so an added line item's price/currency is snapshotted through the same
 * business rules any other Product consumer goes through.
 *
 * @class       CartService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CartService {

    /**
     * The bound repository implementation.
     *
     * @var CartRepositoryInterface Resolved via VuloCart's ServiceContainer, not `new`d directly.
     */
    private $repository;

    /**
     * Used to validate a product exists and to snapshot its current price.
     *
     * @var ProductService
     */
    private $product_service;

    /**
     * Broadcasts what happened after each mutation.
     *
     * @var EventDispatcher
     */
    private $events;

    /**
     * CartService constructor.
     *
     * @param CartRepositoryInterface $repository    Resolved via VuloCart's ServiceContainer, not `new`d directly.
     * @param ProductService         $product_service  Used to validate a product exists and to snapshot its current price.
     * @param EventDispatcher         $events         Broadcasts what happened; never decides what should happen.
     */
    public function __construct( CartRepositoryInterface $repository, ProductService $product_service, EventDispatcher $events ) {
        $this->repository       = $repository;
        $this->product_service = $product_service;
        $this->events           = $events;
    }

    /**
     * Finds a cart by token without creating one - used for read-only
     * lookups (e.g. GET /cart for a token that was never actually used to
     * add anything) so an anonymous page view doesn't write a row.
     *
     * @param string $token Opaque client-held cart identity.
     * @return Cart|null
     */
    public function find_cart( $token ) {
        return $this->repository->find_by_token( $token );
    }

    /**
     * Finds a cart by token, creating an empty one if none exists yet.
     *
     * @param string $token Opaque client-held cart identity.
     * @return Cart
     */
    public function get_or_create_cart( $token ) {
        $cart = $this->repository->find_by_token( $token );

        if ( $cart ) {
            return $cart;
        }

        $cart = new Cart( null, $token, Utill::SETTINGS_DEFAULTS['default_currency'] );

        return $this->repository->insert( $cart );
    }

    /**
     * Adds a quantity of a product to a cart, or increments an existing
     * line item for the same product. Throws if the product doesn't exist -
     * the caller (Rest) turns that into a 400 WP_Error rather than
     * silently adding a bogus line item.
     *
     * @param string      $token       Opaque client-held cart identity.
     * @param int         $product_id VuloCart\Domain\Product\Product id.
     * @param int         $quantity    Quantity to add (must be >= 1).
     * @param string|null $price_id    Which of the product's prices to buy; null/'' means its default price.
     * @return Cart
     * @throws \InvalidArgumentException If no product with $product_id exists, or $price_id is not one of its
     *                                   prices, or that price cannot be bought (inactive, or its type's plugin is off).
     */
    public function add_item( $token, $product_id, $quantity, $price_id = null ) {
        $product = $this->product_service->get_product( $product_id );

        if ( ! $product ) {
            throw new \InvalidArgumentException( 'Unknown product.' );
        }

        $price = $product->find_price( $price_id );

        if ( ! $price || ! PriceCatalog::is_purchasable( $price ) ) {
            throw new \InvalidArgumentException( 'This price is not available.' );
        }

        $cart     = $this->get_or_create_cart( $token );
        $existing = null;

        // One line per product *and price* - the same product at two prices is two lines.
        foreach ( $cart->items as $candidate ) {
            $candidate_price = isset( $candidate->meta['price_id'] ) ? (string) $candidate->meta['price_id'] : '';

            if ( (int) $candidate->product_id === (int) $product_id && $candidate_price === (string) $price['id'] ) {
                $existing = $candidate;
                break;
            }
        }

        if ( $existing ) {
            $existing->quantity += $quantity;
            $this->repository->update_item( $existing );
        } else {
            $base_price = Product::price_amount( $price );

            /**
             * `vulocart_product_effective_price` - the one place a line
             * item's unit price gets decided before it's snapshotted onto
             * the cart (this same value then rides with the item through
             * checkout/order creation unchanged - this Domain\Cart\CartItem's
             * own docblock's "snapshotted through the same pattern"
             * reasoning). vulocart-pro's Pricing Rules module hooks this to
             * apply a percentage/fixed discount without CartService knowing
             * Pro exists - same "Pro extends Free via filters" pattern
             * `vulocart_product_edit_sections` already establishes on the
             * admin side, just a plain WordPress filter here since this
             * runs in PHP, not React.
             *
             * @param float    $base_price Product::$price (or 0.0 if unset).
             * @param Product $product   The product being added to cart.
             */
            $unit_price = (float) apply_filters( 'vulocart_product_effective_price', $base_price, $product );

            $item = new CartItem(
                null,
                $cart->id,
                $product_id,
                $quantity,
                $unit_price,
                $product->currency ? $product->currency : $cart->currency,
                array(
                    'price_id'       => (string) $price['id'],
                    'price_label'    => (string) $price['label'],
                    'price_type'     => (string) $price['type'],
                    'interval'       => (string) $price['interval'],
                    'interval_count' => (int) $price['interval_count'],
                    'payments'       => $price['payments'],
                    'trial_days'     => (int) $price['trial_days'],
                )
            );

            $this->repository->insert_item( $item );
        }

        $this->repository->touch( $cart->id );
        $this->events->dispatch( 'cart_updated', array( 'cart_token' => $token ) );

        return $this->repository->find_by_token( $token );
    }

    /**
     * Sets a line item's quantity, removing it entirely if the new
     * quantity is zero or less.
     *
     * @param string $token    Opaque client-held cart identity.
     * @param int    $item_id  Line item id.
     * @param int    $quantity New quantity.
     * @return Cart
     */
    public function update_item_quantity( $token, $item_id, $quantity ) {
        $cart = $this->get_or_create_cart( $token );

        if ( $quantity <= 0 ) {
            $this->repository->delete_item( $cart->id, $item_id );
        } else {
            foreach ( $cart->items as $item ) {
                if ( $item->id === $item_id ) {
                    $item->quantity = $quantity;
                    $this->repository->update_item( $item );
                    break;
                }
            }
        }

        $this->repository->touch( $cart->id );
        $this->events->dispatch( 'cart_updated', array( 'cart_token' => $token ) );

        return $this->repository->find_by_token( $token );
    }

    /**
     * Removes one line item from a cart.
     *
     * @param string $token   Opaque client-held cart identity.
     * @param int    $item_id Line item id.
     * @return Cart
     */
    public function remove_item( $token, $item_id ) {
        $cart = $this->get_or_create_cart( $token );

        $this->repository->delete_item( $cart->id, $item_id );
        $this->repository->touch( $cart->id );
        $this->events->dispatch( 'cart_updated', array( 'cart_token' => $token ) );

        return $this->repository->find_by_token( $token );
    }

    /**
     * Removes every line item from a cart.
     *
     * @param string $token Opaque client-held cart identity.
     * @return Cart
     */
    public function clear_cart( $token ) {
        $cart = $this->get_or_create_cart( $token );

        $this->repository->delete_items( $cart->id );
        $this->repository->touch( $cart->id );
        $this->events->dispatch( 'cart_updated', array( 'cart_token' => $token ) );

        return $this->repository->find_by_token( $token );
    }

    /**
     * Deletes carts that haven't been touched in over $days days - see
     * CartRepositoryInterface::delete_expired()'s own docblock for the
     * batching rationale. Called by Application\CartCleanupScheduler's
     * daily cron, using the Settings screen's `cart_expiry_days`.
     *
     * @param int $days Age threshold, in days.
     * @return int Total number of carts deleted.
     */
    public function delete_expired_carts( int $days ): int {
        return $this->repository->delete_expired( $days );
    }

    /**
     * Computes a cart's totals.
     *
     * `total` === `subtotal` today - there is no tax or shipping engine
     * yet (both are separate, not-yet-built modules per the vision), so
     * this deliberately doesn't fake a tax/shipping figure; once those
     * exist, this method is where they'd be added in.
     *
     * @param Cart $cart Cart to total.
     * @return array{currency: string|null, item_count: int, subtotal: float, total: float}
     */
    public function get_totals( Cart $cart ) {
        $subtotal   = 0.0;
        $item_count = 0;

        foreach ( $cart->items as $item ) {
            $subtotal   += $item->unit_price * $item->quantity;
            $item_count += $item->quantity;
        }

        return array(
            'currency'   => $cart->currency,
            'item_count' => $item_count,
            'subtotal'   => round( $subtotal, 2 ),
            'total'      => round( $subtotal, 2 ),
        );
    }
}
