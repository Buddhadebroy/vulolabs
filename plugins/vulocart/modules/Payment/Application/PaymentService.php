<?php
/**
 * PaymentService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment\Application;

use VuloCart\Payment\Domain\PaymentContext;
use VuloCart\Payment\Domain\PaymentResult;
use VuloCart\Payment\Infrastructure\WPDBTransactionLedger;
use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Payment module PaymentService.
 *
 * The Payment Framework's own orchestrator — the only class that talks
 * to both `GatewayRegistry` (resolve which gateway) and
 * `WPDBTransactionLedger` (record what happened). Deliberately has no
 * `use VuloCart\Order\...` anywhere in this file: `Order\Application\
 * OrderService` calls into this class (via `VuloCart()->payment_service`,
 * resolved optionally — PaymentService.php's own docblock history) and
 * applies the resulting `PaymentResult` onto its own Order object itself
 * — this class only ever returns plain results/ints/floats, never
 * mutates an order.
 *
 * Two charge paths, matching `PaymentGatewayInterface`'s own docblock:
 * - **Inline** (`authorize_for_order()`): offline gateways with nothing
 *   to confirm client-side. Order already exists; charge happens in the
 *   same request that created it.
 * - **Intent-first** (`create_intent()` + `finalize_intent_for_order()`):
 *   real gateways. The storefront calls `POST /payment/intent` against
 *   the cart *before* placing the order, gets back a `client_secret`
 *   (or equivalent) to finish confirming directly with the gateway's own
 *   JS SDK, then places the order referencing that intent's
 *   `gateway_transaction_id` — `finalize_intent_for_order()` just links
 *   the already-recorded ledger row to the new order id and reports back
 *   whatever state that row is currently in (a webhook may have already
 *   advanced it past what the synchronous intent call itself returned).
 *
 * @class       PaymentService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PaymentService {

    /**
     * Resolves which gateway a payment method id refers to.
     *
     * @var GatewayRegistry
     */
    private $registry;

    /**
     * Records every gateway call.
     *
     * @var WPDBTransactionLedger
     */
    private $ledger;

    /**
     * PaymentService constructor.
     *
     * @param GatewayRegistry       $registry Resolves which gateway a payment method id refers to.
     * @param WPDBTransactionLedger $ledger   Records every gateway call.
     */
    public function __construct( GatewayRegistry $registry, WPDBTransactionLedger $ledger ) {
        $this->registry = $registry;
        $this->ledger   = $ledger;
    }

    /**
     * Reads the stored settings option, defaults filled in.
     *
     * @return array Stored settings, defaults filled in for any never-saved key.
     */
    private function get_settings(): array {
        return wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );
    }

    /**
     * Every currently-usable payment method — backs `GET /payment/methods`,
     * the checkout wizard's own Payment step.
     *
     * @return array<int, array{id: string, label: string, supports_recurring: bool}>
     */
    public function get_available_methods(): array {
        return array_map(
            fn( $gateway ) => array(
                'id'                 => $gateway->get_id(),
                'label'              => $gateway->get_label(),
                'supports_recurring' => $gateway->supports_recurring(),
            ),
            $this->registry->get_active()
        );
    }

    /**
     * Whether a given method id is currently offered.
     *
     * @param string $method_id A candidate method id.
     * @return bool
     */
    public function is_valid_method( string $method_id ): bool {
        foreach ( $this->get_available_methods() as $method ) {
            if ( $method['id'] === $method_id ) {
                return true;
            }
        }

        return false;
    }

    /**
     * The payment status a new order starts at when no gateway ends up
     * running at all (Payment module inactive from the order's
     * perspective, or no payment method chosen) — the Payments tab's own
     * `default_payment_status`, same fallback `Order\Application\
     * OrderService::create_from_cart()` always had before this Framework
     * existed.
     *
     * @return string
     */
    public function get_initial_payment_status(): string {
        return (string) $this->get_settings()['default_payment_status'];
    }

    /**
     * Builds a `PaymentContext` shape shared by every entrypoint below.
     *
     * @param float                $amount   Amount to charge.
     * @param string               $currency ISO 4217 currency code.
     * @param array<string, mixed> $extra    Any of PaymentContext's other constructor args, keyed by name.
     * @return PaymentContext
     */
    private function build_context( float $amount, string $currency, array $extra = array() ): PaymentContext {
        return new PaymentContext(
            $amount,
            $currency,
            isset( $extra['cart_token'] ) ? $extra['cart_token'] : null,
            isset( $extra['order_id'] ) ? $extra['order_id'] : null,
            isset( $extra['customer_email'] ) ? $extra['customer_email'] : null,
            isset( $extra['customer_name'] ) ? $extra['customer_name'] : null,
            isset( $extra['description'] ) ? $extra['description'] : '',
            isset( $extra['capture_immediately'] ) ? $extra['capture_immediately'] : ( 'immediate' === $this->get_settings()['payment_capture_mode'] ),
            isset( $extra['save_payment_method'] ) ? $extra['save_payment_method'] : false,
            isset( $extra['saved_payment_method_ref'] ) ? $extra['saved_payment_method_ref'] : null,
            isset( $extra['payment_data'] ) ? $extra['payment_data'] : array(),
            isset( $extra['metadata'] ) ? $extra['metadata'] : array()
        );
    }

    /**
     * Creates (and, for gateways with nothing left to confirm, finishes)
     * a payment intent against a cart — the entrypoint behind
     * `POST /payment/intent`, called before an order exists. Records a
     * `type: 'intent'` ledger row with `order_id` still null.
     *
     * @param string               $gateway_id     A registered gateway's own id.
     * @param string               $cart_token     The cart this intent prices against.
     * @param float                $amount         Amount to authorize/capture.
     * @param string               $currency       ISO 4217 currency code.
     * @param array<string, mixed> $context_extra  Any other PaymentContext fields (customer_email, payment_data, etc.).
     * @return PaymentResult|\WP_Error
     */
    public function create_intent( string $gateway_id, string $cart_token, float $amount, string $currency, array $context_extra = array() ) {
        $gateway = $this->registry->get( $gateway_id );

        if ( ! $gateway || ! $gateway->is_configured() ) {
            return new \WP_Error( 'vulocart_unknown_payment_gateway', __( 'That payment method is not available.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $context_extra['cart_token'] = $cart_token;
        $context                     = $this->build_context( $amount, $currency, $context_extra );
        $result                      = $gateway->authorize( $context );

        $this->ledger->record(
            array(
                'cart_token'             => $cart_token,
                'gateway'                => $gateway_id,
                'type'                   => 'intent',
                'gateway_transaction_id' => $result->gateway_transaction_id,
                'status'                 => $result->status,
                'amount'                 => $amount,
                'currency'               => $currency,
                'raw_response'           => $result->raw,
            )
        );

        return $result;
    }

    /**
     * Links an already-created intent's ledger row to a just-placed
     * order, and reports back that row's current state — a webhook may
     * have already advanced it past whatever `create_intent()` itself
     * returned synchronously, which is why this re-reads the ledger
     * instead of trusting a value the caller might be holding onto.
     *
     * @param int    $order_id                Newly-inserted order id.
     * @param string $gateway_transaction_id  The intent id the storefront placed the order with.
     * @return PaymentResult|null Null if no ledger row matches this id (a forged/stale value).
     */
    public function finalize_intent_for_order( int $order_id, string $gateway_transaction_id ) {
        $row = $this->ledger->find_by_gateway_transaction_id( $gateway_transaction_id );

        if ( ! $row ) {
            return null;
        }

        if ( empty( $row['order_id'] ) ) {
            $this->ledger->link_order( (int) $row['id'], $order_id );
        }

        return $this->row_to_result( $row );
    }

    /**
     * Charges a previously-saved payment method with no cart/order
     * involved at all — the entrypoint a recurring-billing engine
     * (`vulocart-pro`'s Subscriptions module) uses, off-session, on its
     * own schedule. Records a `type: 'authorize'` ledger row with both
     * `order_id` and `cart_token` null; the caller links it to whatever
     * order it creates from the result via `finalize_intent_for_order()`,
     * same as the cart-based intent path.
     *
     * @param string               $gateway_id    A registered gateway's own id — must report `supports_recurring(): true`.
     * @param string               $currency      ISO 4217 currency code.
     * @param float                $amount        Amount to charge.
     * @param array<string, mixed> $context_extra Any other PaymentContext fields (customer_email, saved_payment_method_ref, payment_data, etc.).
     * @return PaymentResult|null Null if `$gateway_id` doesn't resolve to a configured, recurring-capable gateway.
     */
    public function charge_off_session( string $gateway_id, string $currency, float $amount, array $context_extra = array() ) {
        $gateway = $this->registry->get( $gateway_id );

        if ( ! $gateway || ! $gateway->is_configured() || ! $gateway->supports_recurring() ) {
            return null;
        }

        $context_extra['capture_immediately'] = true;
        $context                              = $this->build_context( $amount, $currency, $context_extra );
        $result                               = $gateway->authorize( $context );

        $this->ledger->record(
            array(
                'gateway'                => $gateway_id,
                'type'                   => 'authorize',
                'gateway_transaction_id' => $result->gateway_transaction_id,
                'status'                 => $result->status,
                'amount'                 => $amount,
                'currency'               => $currency,
                'raw_response'           => $result->raw,
            )
        );

        return $result;
    }

    /**
     * The inline charge path — an order already exists, its own
     * `payment_method` resolves to an offline gateway with nothing to
     * confirm client-side, so authorization happens synchronously in the
     * same request that created the order.
     *
     * @param string               $payment_method Order's own `payment_method` value.
     * @param int                  $order_id       Order id, already persisted.
     * @param float                $amount         Order's own total.
     * @param string               $currency       ISO 4217 currency code.
     * @param array<string, mixed> $context_extra  Any other PaymentContext fields.
     * @return PaymentResult|null Null if `$payment_method` doesn't resolve to a configured gateway.
     */
    public function authorize_for_order( string $payment_method, int $order_id, float $amount, string $currency, array $context_extra = array() ) {
        $gateway = $this->registry->get( $payment_method );

        if ( ! $gateway || ! $gateway->is_configured() ) {
            return null;
        }

        $context_extra['order_id'] = $order_id;
        $context                   = $this->build_context( $amount, $currency, $context_extra );
        $result                    = $gateway->authorize( $context );

        $this->ledger->record(
            array(
                'order_id'               => $order_id,
                'gateway'                => $payment_method,
                'type'                   => 'authorize',
                'gateway_transaction_id' => $result->gateway_transaction_id,
                'status'                 => $result->status,
                'amount'                 => $amount,
                'currency'               => $currency,
                'raw_response'           => $result->raw,
            )
        );

        return $result;
    }

    /**
     * Captures a previously-authorized order payment, in full or in part
     * — the entrypoint behind an admin-triggered "Capture payment"
     * action. Returns null (not a failed PaymentResult) when the order
     * has no gateway to call — same "nothing to do" shape as an order
     * placed before the Payment Framework existed, or one created with
     * no payment method at all.
     *
     * @param string      $payment_method          Order's own `payment_method` value.
     * @param string|null $gateway_transaction_id  Order's own `gateway_transaction_id`.
     * @param int         $order_id                Order id.
     * @param float|null  $amount                  Amount to capture; null = capture $reference_amount in full.
     * @param string      $currency                ISO 4217 currency code.
     * @param float       $reference_amount        The order's own currently-authorized amount — what `$context->amount` carries when `$amount` is null, so a gateway that reads `$context->amount` as its own "capture in full" default (the three offline gateways all do) doesn't fall back to 0.0.
     * @return PaymentResult|null
     */
    public function capture_for_order( $payment_method, $gateway_transaction_id, int $order_id, $amount, string $currency, float $reference_amount = 0.0 ) {
        $gateway = $payment_method ? $this->registry->get( $payment_method ) : null;

        if ( ! $gateway ) {
            return null;
        }

        $context = $this->build_context( null === $amount ? $reference_amount : (float) $amount, $currency, array( 'order_id' => $order_id ) );
        $result  = $gateway->capture( (string) $gateway_transaction_id, $amount, $context );

        $this->ledger->record(
            array(
                'order_id'               => $order_id,
                'gateway'                => $payment_method,
                'type'                   => 'capture',
                'gateway_transaction_id' => $gateway_transaction_id,
                'status'                 => $result->status,
                'amount'                 => null === $amount ? $result->captured_amount : (float) $amount,
                'currency'               => $currency,
                'raw_response'           => $result->raw,
            )
        );

        return $result;
    }

    /**
     * Refunds a previously-captured order payment, in full or in part.
     *
     * @param string      $payment_method          Order's own `payment_method` value.
     * @param string|null $gateway_transaction_id  Order's own `gateway_transaction_id`.
     * @param int         $order_id                Order id.
     * @param float|null  $amount                  Amount to refund; null = refund $reference_amount in full.
     * @param string      $currency                ISO 4217 currency code.
     * @param float       $reference_amount        The order's own currently-captured amount — same "what `$context->amount` carries when `$amount` is null" reasoning `capture_for_order()`'s own docblock explains.
     * @return PaymentResult|null
     */
    public function refund_for_order( $payment_method, $gateway_transaction_id, int $order_id, $amount, string $currency, float $reference_amount = 0.0 ) {
        $gateway = $payment_method ? $this->registry->get( $payment_method ) : null;

        if ( ! $gateway ) {
            return null;
        }

        $context = $this->build_context( null === $amount ? $reference_amount : (float) $amount, $currency, array( 'order_id' => $order_id ) );
        $result  = $gateway->refund( (string) $gateway_transaction_id, $amount, $context );

        $this->ledger->record(
            array(
                'order_id'               => $order_id,
                'gateway'                => $payment_method,
                'type'                   => 'refund',
                'gateway_transaction_id' => $gateway_transaction_id,
                'status'                 => $result->status,
                'amount'                 => null === $amount ? $result->refunded_amount : (float) $amount,
                'currency'               => $currency,
                'raw_response'           => $result->raw,
            )
        );

        return $result;
    }

    /**
     * Voids an authorized-but-not-yet-captured order payment.
     *
     * @param string      $payment_method          Order's own `payment_method` value.
     * @param string|null $gateway_transaction_id  Order's own `gateway_transaction_id`.
     * @param int         $order_id                Order id.
     * @param string      $currency                ISO 4217 currency code.
     * @return PaymentResult|null
     */
    public function cancel_for_order( $payment_method, $gateway_transaction_id, int $order_id, string $currency ) {
        $gateway = $payment_method ? $this->registry->get( $payment_method ) : null;

        if ( ! $gateway ) {
            return null;
        }

        $context = $this->build_context( 0.0, $currency, array( 'order_id' => $order_id ) );
        $result  = $gateway->cancel( (string) $gateway_transaction_id, $context );

        $this->ledger->record(
            array(
                'order_id'               => $order_id,
                'gateway'                => $payment_method,
                'type'                   => 'cancel',
                'gateway_transaction_id' => $gateway_transaction_id,
                'status'                 => $result->status,
                'currency'               => $currency,
                'raw_response'           => $result->raw,
            )
        );

        return $result;
    }

    /**
     * Handles an inbound webhook — resolves the gateway by the route's
     * own `{gateway}` segment, lets it verify+parse the payload, records
     * the resulting state as a new `type: 'webhook'` ledger row (against
     * whichever order that gateway_transaction_id is already linked to,
     * when it is), and returns the result so `Rest::handle_webhook()`
     * can reply 200 (acknowledge — stop retrying) or an error status.
     *
     * @param string            $gateway_id A registered gateway's own id, from the route.
     * @param \WP_REST_Request  $request    The raw inbound webhook request.
     * @return PaymentResult
     */
    public function handle_webhook( string $gateway_id, \WP_REST_Request $request ): PaymentResult {
        $gateway = $this->registry->get( $gateway_id );

        if ( ! $gateway ) {
            return PaymentResult::failed( 'Unknown gateway.' );
        }

        $result = $gateway->handle_webhook( $request );

        if ( ! $result->gateway_transaction_id ) {
            return $result;
        }

        $existing = $this->ledger->find_by_gateway_transaction_id( $result->gateway_transaction_id );

        $this->ledger->record(
            array(
                'order_id'               => $existing && ! empty( $existing['order_id'] ) ? (int) $existing['order_id'] : null,
                'cart_token'             => $existing ? $existing['cart_token'] : null,
                'gateway'                => $gateway_id,
                'type'                   => 'webhook',
                'gateway_transaction_id' => $result->gateway_transaction_id,
                'status'                 => $result->status,
                'amount'                 => $result->captured_amount ?: $result->authorized_amount,
                'currency'               => $existing ? $existing['currency'] : null,
                'raw_response'           => $result->raw,
            )
        );

        return $result;
    }

    /**
     * The full transaction history for an order — backs the admin order
     * detail screen's "payment history" panel.
     *
     * @param int $order_id Order id.
     * @return array<int, array<string, mixed>>
     */
    public function get_transaction_history( int $order_id ): array {
        return $this->ledger->list_for_order( $order_id );
    }

    /**
     * Converts a raw ledger row into a `PaymentResult` — used wherever
     * this service reports back "the current state of a transaction"
     * from a stored row rather than a fresh gateway call.
     *
     * @param array<string, mixed> $row A raw `vulocart_payment_transactions` row.
     * @return PaymentResult
     */
    private function row_to_result( array $row ): PaymentResult {
        $status          = (string) $row['status'];
        $amount          = (float) $row['amount'];
        $captured        = PaymentResult::CAPTURED === $status ? $amount : 0.0;
        $authorized      = PaymentResult::AUTHORIZED === $status ? $amount : 0.0;
        $refunded        = PaymentResult::REFUNDED === $status ? $amount : 0.0;

        return new PaymentResult(
            true,
            $status,
            isset( $row['gateway_transaction_id'] ) ? $row['gateway_transaction_id'] : null,
            $authorized,
            $captured,
            $refunded
        );
    }
}
