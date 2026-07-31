<?php
/**
 * CheckoutSession class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Domain\Checkout;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart CheckoutSession entity.
 *
 * The Checkout Engine's own tracking record — one per cart that has
 * actually entered checkout (not one per cart; browsing and adding to
 * cart alone never creates one). Exists so "did this shopper ever start
 * checking out, and did they finish" is a real, queryable fact
 * (Application\CheckoutService::mark_completed()/find_abandoned()) rather
 * than inferred after the fact from whether an Order happens to exist —
 * that inference alone can't distinguish "never reached checkout" from
 * "reached checkout and gave up", which is exactly what an abandoned-
 * checkout feature needs to tell apart. Keyed by `$cart_token`, the same
 * opaque client-held identity Cart/Domain/Cart already uses — never a WP
 * post id, session, or cookie, so this stays meaningful for a delivery
 * mode with no WordPress page at all (Embedded/Hosted/Popup Checkout).
 *
 * @class       CheckoutSession class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CheckoutSession {

    /**
     * Session id.
     *
     * @var int|null Null for a session not yet persisted.
     */
    public $id;

    /**
     * The Cart this session belongs to — Domain\Cart\Cart::$token.
     *
     * @var string
     */
    public $cart_token;

    /**
     * One of CheckoutStatus's constants.
     *
     * @var string
     */
    public $status;

    /**
     * One of CheckoutMode's constants — which rendering mode the client
     * that created this session is using. Informational (drives admin
     * display/abandoned-checkout listing), never enforced server-side.
     *
     * @var string
     */
    public $mode;

    /**
     * The last step id (Application\CheckoutStepRegistry) the client
     * reported reaching — null until the first progress update.
     *
     * @var string|null
     */
    public $current_step;

    /**
     * Captured as soon as it's known (usually from the Customer step),
     * so an abandoned session can still be identified/recovered even
     * though there's no Order yet to read it from.
     *
     * @var string|null
     */
    public $customer_email;

    /**
     * Open bag for anything else worth remembering about this session's
     * progress (e.g. which optional steps were skipped) — same
     * extensible-JSON pattern `Offering::$meta` already establishes,
     * rather than a new column per future need.
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
     * CheckoutSession constructor.
     *
     * @param int|null             $id             Null for a session not yet persisted.
     * @param string               $cart_token     Domain\Cart\Cart::$token.
     * @param string               $status         One of CheckoutStatus's constants.
     * @param string               $mode           One of CheckoutMode's constants.
     * @param string|null          $current_step   Last step id the client reported reaching.
     * @param string|null          $customer_email Captured as soon as it's known.
     * @param array<string, mixed> $meta           Open bag for anything else worth remembering.
     * @param string|null          $created_at     MySQL datetime string, once persisted.
     * @param string|null          $updated_at     MySQL datetime string, once persisted.
     */
    public function __construct(
        $id,
        $cart_token,
        $status,
        $mode,
        $current_step = null,
        $customer_email = null,
        $meta = array(),
        $created_at = null,
        $updated_at = null
    ) {
        $this->id             = $id;
        $this->cart_token     = $cart_token;
        $this->status         = $status;
        $this->mode           = $mode;
        $this->current_step   = $current_step;
        $this->customer_email = $customer_email;
        $this->meta           = $meta;
        $this->created_at     = $created_at;
        $this->updated_at     = $updated_at;
    }
}
