<?php
/**
 * CheckoutService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Application;

use VuloCart\Domain\Checkout\CheckoutMode;
use VuloCart\Domain\Checkout\CheckoutSession;
use VuloCart\Domain\Checkout\CheckoutSessionRepositoryInterface;
use VuloCart\Domain\Checkout\CheckoutStatus;
use VuloCart\Events\EventDispatcher;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart CheckoutService — the Checkout Engine's orchestration core.
 *
 * Where session lifecycle logic lives: creating a session the first time
 * a cart enters checkout, recording step progress, marking a session
 * completed once its Order exists, and finding stale ones for the
 * Abandoned Checkout feature. Backs
 * `classes/RestAPI/Controllers/Checkout.php`. Deliberately holds no
 * WordPress-page concept anywhere — every method here is keyed by
 * `cart_token`/session id, the same page-agnostic identity Cart/Order
 * already use, so this class works identically whether the checkout UI
 * consuming it is the free Gutenberg block or vulocart-pro's Embedded/
 * Hosted/Popup delivery modes.
 *
 * @class       CheckoutService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CheckoutService {

    /**
     * The bound repository implementation.
     *
     * @var CheckoutSessionRepositoryInterface Resolved via ServiceContainer, not `new`d directly.
     */
    private $repository;

    /**
     * Broadcasts what happened after each mutation.
     *
     * @var EventDispatcher Broadcasts what happened; never decides what should happen.
     */
    private $events;

    /**
     * CheckoutService constructor.
     *
     * @param CheckoutSessionRepositoryInterface $repository Resolved via ServiceContainer, not `new`d directly.
     * @param EventDispatcher                    $events     Broadcasts what happened; never decides what should happen.
     */
    public function __construct( CheckoutSessionRepositoryInterface $repository, EventDispatcher $events ) {
        $this->repository = $repository;
        $this->events     = $events;

        // Marks the session completed the moment its Order exists — the
        // one place session lifecycle reacts to something outside this
        // class's own API, via the same EventDispatcher transport every
        // other cross-module reaction in this codebase already uses
        // rather than Order\Application\OrderService knowing this class
        // exists.
        add_action( 'vulocart_order_created', array( $this, 'handle_order_created' ) );
    }

    /**
     * Finds a session by its cart token.
     *
     * @param string $cart_token Domain\Cart\Cart::$token.
     * @return CheckoutSession|null
     */
    public function get_session( string $cart_token ): ?CheckoutSession {
        return $this->repository->find_by_cart_token( $cart_token );
    }

    /**
     * Finds a session by cart token, creating a new ACTIVE one if none
     * exists yet — the entry point every checkout delivery mode calls the
     * moment a shopper actually reaches checkout (not on every cart
     * mutation; see CheckoutSession's own docblock for why that
     * distinction matters for Abandoned Checkout).
     *
     * @param string $cart_token Domain\Cart\Cart::$token.
     * @param string $mode       One of CheckoutMode's constants.
     * @return CheckoutSession
     */
    public function start_session( string $cart_token, string $mode ): CheckoutSession {
        $existing = $this->repository->find_by_cart_token( $cart_token );

        if ( $existing ) {
            return $existing;
        }

        $mode = in_array( $mode, CheckoutMode::all(), true ) ? $mode : CheckoutMode::MULTI_STEP;

        return $this->repository->insert(
            new CheckoutSession( null, $cart_token, CheckoutStatus::ACTIVE, $mode )
        );
    }

    /**
     * Records step progress — called as the shopper moves through
     * whichever steps Application\CheckoutStepRegistry reports, so
     * `current_step`/`customer_email` (once known) stay current for
     * Abandoned Checkout's own listing.
     *
     * @param string                                          $cart_token Domain\Cart\Cart::$token.
     * @param array{current_step?: string, customer_email?: string, meta?: array<string, mixed>} $data Partial update.
     * @return CheckoutSession|null Null if no session with this cart_token exists yet.
     */
    public function update_progress( string $cart_token, array $data ): ?CheckoutSession {
        $session = $this->repository->find_by_cart_token( $cart_token );

        if ( ! $session ) {
            return null;
        }

        $session->current_step   = isset( $data['current_step'] ) ? $data['current_step'] : $session->current_step;
        $session->customer_email = isset( $data['customer_email'] ) ? $data['customer_email'] : $session->customer_email;
        $session->meta           = isset( $data['meta'] ) ? array_merge( $session->meta, $data['meta'] ) : $session->meta;

        return $this->repository->update( $session );
    }

    /**
     * `vulocart_order_created` listener — marks the session matching the
     * new Order's `cart_token` COMPLETED, if one exists. A guest who
     * never actually used the checkout UI (e.g. an order created directly
     * via the REST API by a third party) has no session to complete,
     * which is fine — this is a no-op in that case, not an error.
     *
     * @param array{order: \VuloCart\Order\Domain\Order} $payload EventDispatcher's own payload shape.
     * @return void
     */
    public function handle_order_created( array $payload ): void {
        $order = isset( $payload['order'] ) ? $payload['order'] : null;

        if ( ! $order || empty( $order->cart_token ) ) {
            return;
        }

        $session = $this->repository->find_by_cart_token( $order->cart_token );

        if ( ! $session ) {
            return;
        }

        $session->status = CheckoutStatus::COMPLETED;
        $this->repository->update( $session );

        $this->events->dispatch( 'checkout_session_completed', array( 'session' => $session ) );
    }

    /**
     * Lists active sessions untouched for at least $minutes minutes —
     * vulocart-pro's Abandoned Checkout feature's own data source.
     *
     * @param int $minutes  How stale (in minutes) a still-ACTIVE session must be to count.
     * @param int $page     1-indexed page number.
     * @param int $per_page Rows per page.
     * @return array{data: CheckoutSession[], total: int}
     */
    public function find_abandoned( int $minutes, int $page = 1, int $per_page = 20 ): array {
        $cutoff = gmdate( 'Y-m-d H:i:s', time() - ( max( 1, $minutes ) * MINUTE_IN_SECONDS ) );

        return $this->repository->paginate_stale_active( $cutoff, $page, $per_page );
    }
}
