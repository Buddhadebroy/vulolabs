<?php
/**
 * WPDBNoteRepository class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer\Infrastructure;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Customer module WPDBNoteRepository.
 *
 * Owns `vulocart_customer_notes` — admin-only internal notes about a
 * customer (never shown to the customer themselves), same role
 * `vulocart-pro`'s own OrderNotes module plays for an Order.
 *
 * @class       WPDBNoteRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WPDBNoteRepository {

    /**
     * Resolves the fully-prefixed table name.
     *
     * @return string
     */
    private function get_table(): string {
        global $wpdb;
        return $wpdb->prefix . 'vulocart_customer_notes';
    }

    /**
     * Every note belonging to a customer, newest first.
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
     * Adds a note.
     *
     * @param int    $customer_id    Owning customer's id.
     * @param int    $author_user_id The WP user id who wrote it.
     * @param string $note           Note text.
     * @return array<string, mixed> The created row.
     */
    public function add( int $customer_id, int $author_user_id, string $note ): array {
        global $wpdb;

        $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $this->get_table(),
            array(
                'customer_id'    => $customer_id,
                'author_user_id' => $author_user_id,
                'note'           => $note,
            )
        );

        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE id = %d", $wpdb->insert_id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        return $row ? $row : array();
    }

    /**
     * Deletes a note.
     *
     * @param int $id          Note id.
     * @param int $customer_id Owning customer's id, re-checked.
     * @return bool True if a matching row was found and deleted.
     */
    public function delete( int $id, int $customer_id ): bool {
        global $wpdb;

        return false !== $wpdb->delete( $this->get_table(), array( 'id' => $id, 'customer_id' => $customer_id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    }
}
