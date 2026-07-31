<?php
/**
 * CheckoutSessionRepositoryInterface file.
 *
 * @package VuloCart
 */

namespace VuloCart\Domain\Checkout;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart CheckoutSessionRepositoryInterface.
 *
 * Same dependency-injection seam every other Domain repository interface
 * in this codebase already establishes — VuloCart::init_classes() binds
 * this to Infrastructure\Database\WPDBCheckoutSessionRepository, and only
 * there.
 *
 * @class       CheckoutSessionRepositoryInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface CheckoutSessionRepositoryInterface {

    /**
     * Finds a session by its cart token.
     *
     * @param string $cart_token Domain\Cart\Cart::$token.
     * @return CheckoutSession|null
     */
    public function find_by_cart_token( string $cart_token ): ?CheckoutSession;

    /**
     * Persists a new session.
     *
     * @param CheckoutSession $session A session with $id === null.
     * @return CheckoutSession The same session, with $id (and timestamps) populated.
     */
    public function insert( CheckoutSession $session ): CheckoutSession;

    /**
     * Persists changes to an existing session.
     *
     * @param CheckoutSession $session A session with a non-null $id.
     * @return CheckoutSession The same session, with $updated_at refreshed.
     */
    public function update( CheckoutSession $session ): CheckoutSession;

    /**
     * Lists active sessions last touched before $before — vulocart-pro's
     * Abandoned Checkout feature's own query, exposed here since only
     * this repository talks SQL directly.
     *
     * @param string $before      MySQL datetime string cutoff.
     * @param int    $page        1-indexed page number.
     * @param int    $per_page    Rows per page.
     * @return array{data: CheckoutSession[], total: int}
     */
    public function paginate_stale_active( string $before, int $page, int $per_page ): array;
}
