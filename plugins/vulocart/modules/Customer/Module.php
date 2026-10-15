<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Customer Module.
 *
 * Now owns a real persistent Customer entity (`Install.php`,
 * `Domain\Customer`'s own docblock) - every order dispatches
 * `vulocart_order_created`, this module listens and finds-or-creates the
 * customer, advancing their running totals
 * (`Application\CustomerService::record_order()`). Still no hard
 * cross-module dependency to defer on: this listener is optional (a
 * plain `add_action`, silently a no-op if Order somehow never fires it),
 * so this module still wires everything synchronously in its own
 * constructor, same as before.
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
     * Module constructor. Constructs this module's own classes and
     * registers its service on the main plugin container
     * (`VuloCart()->customer_service`).
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
     * One-time pass: totals used to be added up when an order was placed (paid or not, never reduced), so recompute
     * them from the orders themselves.
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
