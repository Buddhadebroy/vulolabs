<?php
/**
 * WPDBCheckoutSessionRepository class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Infrastructure\Database;

use VuloCart\Domain\Checkout\CheckoutSession;
use VuloCart\Domain\Checkout\CheckoutSessionRepositoryInterface;
use VuloCart\Domain\Checkout\CheckoutStatus;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart WPDBCheckoutSessionRepository.
 *
 * The only class in this codebase that runs SQL against
 * `vulocart_checkout_sessions` — implements
 * Domain\Checkout\CheckoutSessionRepositoryInterface, bound in
 * VuloCart::init_classes(). Same `$wpdb->prepare()` discipline every
 * other repository here already follows.
 *
 * @class       WPDBCheckoutSessionRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WPDBCheckoutSessionRepository implements CheckoutSessionRepositoryInterface {

    /**
     * Resolves the fully-prefixed table name.
     *
     * @return string
     */
    private function get_table(): string {
        global $wpdb;
        return $wpdb->prefix . 'vulocart_checkout_sessions';
    }

    /**
     * Converts a raw `$wpdb` row into a domain CheckoutSession object.
     *
     * @param array<string, mixed> $row A raw `vulocart_checkout_sessions` row.
     * @return CheckoutSession
     */
    private function hydrate( array $row ): CheckoutSession {
        return new CheckoutSession(
            (int) $row['id'],
            $row['cart_token'],
            $row['status'],
            $row['mode'],
            $row['current_step'],
            $row['customer_email'],
            $row['meta'] ? (array) json_decode( $row['meta'], true ) : array(),
            $row['created_at'],
            $row['updated_at']
        );
    }

    /**
     * Converts a domain CheckoutSession object into a `$wpdb`-ready row.
     *
     * @param CheckoutSession $session Session to convert to a `$wpdb`-ready row.
     * @return array<string, mixed>
     */
    private function to_row( CheckoutSession $session ): array {
        return array(
            'cart_token'     => $session->cart_token,
            'status'         => $session->status,
            'mode'           => $session->mode,
            'current_step'   => $session->current_step,
            'customer_email' => $session->customer_email,
            'meta'           => wp_json_encode( $session->meta ),
        );
    }

    /**
     * Finds a session by its cart token.
     *
     * @param string $cart_token Domain\Cart\Cart::$token.
     * @return CheckoutSession|null
     */
    public function find_by_cart_token( string $cart_token ): ?CheckoutSession {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE cart_token = %s", $cart_token ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ARRAY_A
        );

        return $row ? $this->hydrate( $row ) : null;
    }

    /**
     * Persists a new session.
     *
     * @param CheckoutSession $session A session with $id === null.
     * @return CheckoutSession The same session, with $id (and timestamps) populated.
     */
    public function insert( CheckoutSession $session ): CheckoutSession {
        global $wpdb;

        $wpdb->insert( $this->get_table(), $this->to_row( $session ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $this->find_by_cart_token( $session->cart_token );
    }

    /**
     * Persists changes to an existing session.
     *
     * @param CheckoutSession $session A session with a non-null $id.
     * @return CheckoutSession The same session, with $updated_at refreshed.
     */
    public function update( CheckoutSession $session ): CheckoutSession {
        global $wpdb;

        $wpdb->update( $this->get_table(), $this->to_row( $session ), array( 'id' => $session->id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $this->find_by_cart_token( $session->cart_token );
    }

    /**
     * Lists active sessions last touched before $before.
     *
     * @param string $before   MySQL datetime string cutoff.
     * @param int    $page     1-indexed page number.
     * @param int    $per_page Rows per page.
     * @return array{data: CheckoutSession[], total: int}
     */
    public function paginate_stale_active( string $before, int $page, int $per_page ): array {
        global $wpdb;

        $table  = $this->get_table();
        $page   = max( 1, $page );
        $offset = ( $page - 1 ) * max( 1, $per_page );

        $total = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE status = %s AND updated_at < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                CheckoutStatus::ACTIVE,
                $before
            )
        );

        $rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE status = %s AND updated_at < %s ORDER BY updated_at DESC LIMIT %d OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                CheckoutStatus::ACTIVE,
                $before,
                $per_page,
                $offset
            ),
            ARRAY_A
        );

        return array(
            'data'  => array_map( array( $this, 'hydrate' ), $rows ? $rows : array() ),
            'total' => $total,
        );
    }
}
