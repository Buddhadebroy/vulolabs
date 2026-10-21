<?php
/**
 * Cart class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Cart\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * Plain domain object. The cart is identified by an opaque `token`, not by a WordPress user id or PHP session, so a
 * client with no WordPress session (a Next.js app, a mobile app, an MCP client) can address it. The caller stores the
 * token itself.
 *
 * @class       Cart class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Cart {

    /**
     * Cart id.
     *
     * @var int|null Null for a cart not yet persisted.
     */
    public $id;

    /**
     * Opaque client-held identity for this cart.
     *
     * @var string
     */
    public $token;

    /**
     * Currency code.
     *
     * @var string|null ISO 4217 currency code.
     */
    public $currency;

    /**
     * Line items belonging to this cart.
     *
     * @var CartItem[]
     */
    public $items;

    /**
     * Extensible, cart-specific attributes (coupons/shipping selection
     * belong here once Coupon/Shipping modules exist).
     *
     * @var array<string, mixed>
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
     * Cart constructor.
     *
     * @param int|null             $id         Null for a cart not yet persisted.
     * @param string               $token      Opaque client-held identity for this cart.
     * @param string|null          $currency   ISO 4217 currency code.
     * @param CartItem[]           $items      Line items belonging to this cart.
     * @param array<string, mixed> $meta       Extensible, cart-specific attributes.
     * @param string|null          $created_at MySQL datetime string, once persisted.
     * @param string|null          $updated_at MySQL datetime string, once persisted.
     */
    public function __construct(
        $id,
        $token,
        $currency = null,
        $items = array(),
        $meta = array(),
        $created_at = null,
        $updated_at = null
    ) {
        $this->id         = $id;
        $this->token      = $token;
        $this->currency   = $currency;
        $this->items      = $items;
        $this->meta       = $meta;
        $this->created_at = $created_at;
        $this->updated_at = $updated_at;
    }
}
