<?php
/**
 * WPDBAddressRepository class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer\Infrastructure;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Customer module WPDBAddressRepository.
 *
 * Owns `vulocart_customer_addresses` — the real address book
 * `Address\Application\AddressService`'s own docblock (pre-dating this
 * pass) explicitly said this plugin didn't have yet. Kept plain-array-
 * in/out (no domain entity) — an address book entry is a flat record
 * with no behavior of its own, same reasoning `Payment\Infrastructure\
 * WPDBTransactionLedger` gives for skipping a domain entity on its table.
 *
 * @class       WPDBAddressRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WPDBAddressRepository {

    /**
     * Resolves the fully-prefixed table name.
     *
     * @return string
     */
    private function get_table(): string {
        global $wpdb;
        return $wpdb->prefix . 'vulocart_customer_addresses';
    }

    /**
     * Every address belonging to a customer.
     *
     * @param int $customer_id Owning customer's id.
     * @return array<int, array<string, mixed>>
     */
    public function list_for_customer( int $customer_id ): array {
        global $wpdb;

        return (array) $wpdb->get_results(
            $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE customer_id = %d ORDER BY id DESC", $customer_id ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ARRAY_A
        );
    }

    /**
     * Finds one address by id.
     *
     * @param int $id Address id.
     * @return array<string, mixed>|null
     */
    public function find( int $id ): ?array {
        global $wpdb;

        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        return $row ? $row : null;
    }

    /**
     * Clears an existing default-billing/default-shipping flag across
     * every one of a customer's own addresses — called before setting a
     * new default, so "default" always means exactly one row, never zero
     * or several.
     *
     * @param int    $customer_id Owning customer's id.
     * @param string $column      'is_default_billing' or 'is_default_shipping'.
     * @return void
     */
    public function clear_default( int $customer_id, string $column ): void {
        global $wpdb;

        $wpdb->update( $this->get_table(), array( $column => 0 ), array( 'customer_id' => $customer_id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    }

    /**
     * Persists a new address.
     *
     * @param array<string, mixed> $data Already-sanitized fields, `customer_id` included.
     * @return array<string, mixed> The created row.
     */
    public function insert( array $data ): array {
        global $wpdb;

        $wpdb->insert( $this->get_table(), $data ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $this->find( (int) $wpdb->insert_id );
    }

    /**
     * Updates an existing address.
     *
     * @param int                   $id   Address id.
     * @param array<string, mixed> $data Already-sanitized partial update.
     * @return array<string, mixed>|null Null if no address with this id exists.
     */
    public function update( int $id, array $data ): ?array {
        if ( ! $this->find( $id ) ) {
            return null;
        }

        global $wpdb;

        $wpdb->update( $this->get_table(), $data, array( 'id' => $id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $this->find( $id );
    }

    /**
     * Deletes an address.
     *
     * @param int $id          Address id.
     * @param int $customer_id Owning customer's id, re-checked so one customer can't delete another's address by guessing an id.
     * @return bool True if a matching row was found and deleted.
     */
    public function delete( int $id, int $customer_id ): bool {
        global $wpdb;

        return false !== $wpdb->delete( $this->get_table(), array( 'id' => $id, 'customer_id' => $customer_id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    }
}
