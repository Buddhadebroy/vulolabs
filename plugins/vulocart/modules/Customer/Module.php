<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer;

defined( 'ABSPATH' ) || exit;

/**
 * Customer module: customer records, addresses and notes.
 *
 * Every order dispatches `vulocart_order_created`; this module then finds or creates the customer and updates their
 * order count and lifetime spend. It also adds the Customer step to the checkout, refreshes the totals when an order's
 * payment or fulfillment status changes or the order is deleted, and fills in the totals of customers that were created
 * before they were tracked.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * This module's own customer service - promoted to an instance
     * property because `maybe_record_order()` (the
     * `vulocart_order_created` listener) reaches it outside the
     * constructor.
     *
     * @var Application\CustomerService
     */
    private $service;

    /**
     * Creates the customer service (`VuloCart()->customer_service`) and routes, adds the Customer checkout step, and
     * keeps customer order totals up to date as orders change.
     */
    public function __construct() {
        new Install();

        $customers = new Infrastructure\WPDBCustomerRepository();
        $addresses = new Infrastructure\WPDBAddressRepository();
        $notes     = new Infrastructure\WPDBNoteRepository();

        $this->service = new Application\CustomerService( $customers, $addresses, $notes );

        VuloCart()->customer_service = $this->service;

        new Rest();

        add_filter( 'vulocart_checkout_steps', array( $this, 'register_checkout_step' ) );
        add_action( 'vulocart_order_created', array( $this, 'maybe_record_order' ) );
        add_action( 'vulocart_order_payment_status_changed', array( $this, 'maybe_refresh_totals' ) );
        add_action( 'vulocart_order_fulfillment_status_changed', array( $this, 'maybe_refresh_totals' ) );
        add_action( 'vulocart_order_deleted', array( $this, 'maybe_refresh_totals' ) );
        add_action( 'init', array( $this, 'maybe_backfill_totals' ) );
    }

    /**
     * Keeps a customer's totals in step with a status change on one of their orders.
     *
     * @param array{order: object} $payload Order\Domain\Order under the 'order' key.
     * @return void
     */
    public function maybe_refresh_totals( $payload ) {
        $this->service->refresh_for_order( $payload['order'] );
    }

    /**
     * One-time pass: recomputes every customer's totals from their orders. Earlier versions added an order to the
     * totals when it was placed (paid or not) and never subtracted it.
     *
     * @return void
     */
    public function maybe_backfill_totals() {
        if ( get_option( 'vulocart_customer_totals_derived' ) ) {
            return;
        }

        $this->service->refresh_all_totals();
        update_option( 'vulocart_customer_totals_derived', 1 );
    }

    /**
     * `vulocart_order_created`'s own listener.
     *
     * @param array{order: object} $payload Order\Domain\Order under the 'order' key.
     * @return void
     */
    public function maybe_record_order( $payload ) {
        $this->service->record_order( $payload['order'] );
    }

    /**
     * Registers this module's own step into the Checkout Engine's step
     * registry.
     *
     * @param array<int, array<string, mixed>> $steps Already-registered step descriptors.
     * @return array<int, array<string, mixed>>
     */
    public function register_checkout_step( $steps ) {
        $steps[] = array(
            'id'        => 'customer',
            'label'     => __( 'Customer', 'vulocart' ),
            'order'     => 10,
            'rest_base' => 'customer',
        );

        return $steps;
    }
}
