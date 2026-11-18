<?php
/**
 * CartItemRejected class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Cart\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * A line item a listener refused (a booking slot that is taken, a plan the customer already has). Unlike the other
 * InvalidArgumentExceptions the cart and checkout throw, its message is translated and safe to show the shopper.
 *
 * @class       CartItemRejected class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CartItemRejected extends \InvalidArgumentException {

    /**
     * Turns a listener's WP_Error into this exception.
     *
     * @param \WP_Error $error The listener's error.
     * @return self
     */
    public static function from_error( \WP_Error $error ): self {
        return new self( $error->get_error_message() );
    }
}
