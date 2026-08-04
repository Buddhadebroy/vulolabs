<?php
/**
 * GatewayRegistry class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment\Application;

use VuloCart\Payment\Domain\PaymentGatewayInterface;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Payment module GatewayRegistry.
 *
 * Where every `PaymentGatewayInterface` implementation becomes known to
 * `PaymentService` — collected via the `vulocart_payment_gateways` filter
 * (fired once, lazily, on first use), the exact same "module contributes
 * an array entry to a filter this plugin's own core collects" shape
 * `vulocart_checkout_steps` already establishes for checkout wizard
 * steps. This plugin's own `Module.php` registers the three offline
 * gateways this way; `vulocart-pro`'s Stripe/PayPal/Razorpay modules
 * (and Subscriptions, indirectly, by reusing an already-registered
 * gateway) hook the same filter with zero coupling to this class beyond
 * the filter name.
 *
 * @class       GatewayRegistry class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GatewayRegistry {

    /**
     * Every registered gateway, keyed by id — null until first resolved.
     *
     * @var array<string, PaymentGatewayInterface>|null
     */
    private $gateways = null;

    /**
     * Collects every registered gateway, calling the filter exactly once
     * per request.
     *
     * @return array<string, PaymentGatewayInterface>
     */
    private function resolve(): array {
        if ( null !== $this->gateways ) {
            return $this->gateways;
        }

        $registered     = (array) apply_filters( 'vulocart_payment_gateways', array() );
        $this->gateways = array();

        foreach ( $registered as $gateway ) {
            if ( $gateway instanceof PaymentGatewayInterface ) {
                $this->gateways[ $gateway->get_id() ] = $gateway;
            }
        }

        return $this->gateways;
    }

    /**
     * Every registered gateway, regardless of configuration state —
     * backs the admin Payments settings tab (which needs to show an
     * unconfigured gateway's own credential fields, not just active
     * ones).
     *
     * @return PaymentGatewayInterface[]
     */
    public function all(): array {
        return array_values( $this->resolve() );
    }

    /**
     * Every registered gateway that's actually usable right now — backs
     * `GET /payment/methods`, the checkout wizard's own Payment step.
     *
     * @return PaymentGatewayInterface[]
     */
    public function get_active(): array {
        return array_values( array_filter( $this->resolve(), fn( $gateway ) => $gateway->is_configured() ) );
    }

    /**
     * Resolves one gateway by id, regardless of configuration state —
     * `PaymentService` itself re-checks `is_configured()` before actually
     * charging anything.
     *
     * @param string $id A gateway's own `get_id()` value.
     * @return PaymentGatewayInterface|null Null if no gateway with this id is registered.
     */
    public function get( string $id ): ?PaymentGatewayInterface {
        $gateways = $this->resolve();

        return isset( $gateways[ $id ] ) ? $gateways[ $id ] : null;
    }
}
