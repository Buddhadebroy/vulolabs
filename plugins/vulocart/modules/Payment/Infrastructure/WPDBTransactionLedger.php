<?php
/**
 * WPDBTransactionLedger class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment\Infrastructure;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Payment module WPDBTransactionLedger.
 *
 * The only class in this codebase that runs SQL against
 * `vulocart_payment_transactions` — same "one repository owns the raw
 * SQL for its own table" convention `Order\Infrastructure\
 * WPDBOrderRepository` already establishes, kept plain-array-in/out
 * (no domain entity) since this table is an append-mostly audit log
 * `PaymentService` reads back in a couple of narrow shapes, not a
 * full aggregate root with its own business rules.
 *
 * @class       WPDBTransactionLedger class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WPDBTransactionLedger {

    /**
     * Resolves the fully-prefixed table name.
     *
     * @return string
     */
    private function get_table() {
        global $wpdb;
        return $wpdb->prefix . 'vulocart_payment_transactions';
    }

    /**
     * Records one gateway call — see Install.php's own docblock for what
     * `type` values are expected.
     *
     * @param array{order_id?: int|null, cart_token?: string|null, gateway: string, type: string, gateway_transaction_id?: string|null, status: string, amount?: float, currency?: string|null, raw_response?: array<string, mixed>} $data Transaction fields.
     * @return int The new row's id.
     */
    public function record( array $data ): int {
        global $wpdb;

        $wpdb->insert(
            $this->get_table(),
            array(
                'order_id'               => isset( $data['order_id'] ) ? $data['order_id'] : null,
                'cart_token'             => isset( $data['cart_token'] ) ? $data['cart_token'] : null,
                'gateway'                => $data['gateway'],
                'type'                   => $data['type'],
                'gateway_transaction_id' => isset( $data['gateway_transaction_id'] ) ? $data['gateway_transaction_id'] : null,
                'status'                 => $data['status'],
                'amount'                 => isset( $data['amount'] ) ? $data['amount'] : 0.0,
                'currency'               => isset( $data['currency'] ) ? $data['currency'] : null,
                'raw_response'           => isset( $data['raw_response'] ) ? wp_json_encode( $data['raw_response'] ) : null,
            )
        );

        return (int) $wpdb->insert_id;
    }

    /**
     * The most recent transaction row for a given gateway_transaction_id
     * — how `PaymentService::finalize_intent_for_order()` and
     * `handle_webhook()` both re-find "the row this event is about."
     *
     * @param string $gateway_transaction_id A gateway's own reference.
     * @return array<string, mixed>|null
     */
    public function find_by_gateway_transaction_id( string $gateway_transaction_id ) {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$this->get_table()} WHERE gateway_transaction_id = %s ORDER BY id DESC LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $gateway_transaction_id
            ),
            ARRAY_A
        );

        return $row ? $row : null;
    }

    /**
     * Every transaction row belonging to an order, oldest first — backs
     * the admin order detail screen's own "payment history" list.
     *
     * @param int $order_id Owning order id.
     * @return array<int, array<string, mixed>>
     */
    public function list_for_order( int $order_id ): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$this->get_table()} WHERE order_id = %d ORDER BY id ASC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $order_id
            ),
            ARRAY_A
        );

        return $rows ? $rows : array();
    }

    /**
     * Attaches an order id to a row created while still cart-scoped
     * (`order_id` was null at intent-creation time) — called once, right
     * after the order that consumed a payment intent is inserted.
     *
     * @param int $id       Ledger row id.
     * @param int $order_id Order id to attach.
     * @return void
     */
    public function link_order( int $id, int $order_id ): void {
        global $wpdb;

        $wpdb->update( $this->get_table(), array( 'order_id' => $order_id ), array( 'id' => $id ) );
    }
}
