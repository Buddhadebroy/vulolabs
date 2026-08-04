<?php
/**
 * PaymentResult class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Payment module PaymentResult.
 *
 * What every `PaymentGatewayInterface` method returns — a plain value
 * object, never a raw gateway SDK response, so `PaymentService` and its
 * callers never branch on a gateway-specific shape. `$status` is one of
 * this class's own constants, deliberately richer than
 * `Order\Domain\PaymentStatus`'s four values (an authorized-but-not-
 * captured payment and a captured one are different gateway states, even
 * though this app's simpler Order-level status only distinguishes
 * pending/paid/failed/refunded) — `to_order_payment_status()` is where
 * that collapse happens, kept here (not in Order\Domain\PaymentStatus)
 * so the Payment module never needs a `use VuloCart\Order\...` import for
 * something that's really "how does a payment-level state read as an
 * order-level one," not order business logic.
 *
 * @class       PaymentResult class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PaymentResult {

    /**
     * The gateway needs a client-side step (3DS challenge, redirect,
     * SDK confirmation) before this payment can be considered settled.
     *
     * @var string
     */
    const REQUIRES_ACTION = 'requires_action';

    /**
     * Funds are held but not yet captured/settled.
     *
     * @var string
     */
    const AUTHORIZED = 'authorized';

    /**
     * Funds have been captured/settled (in full or in part — see
     * `$captured_amount`).
     *
     * @var string
     */
    const CAPTURED = 'captured';

    /**
     * The attempt did not succeed.
     *
     * @var string
     */
    const FAILED = 'failed';

    /**
     * Previously captured funds have been returned (in full or in part —
     * see `$captured_amount`, which a refund also reduces).
     *
     * @var string
     */
    const REFUNDED = 'refunded';

    /**
     * An authorization was voided before capture.
     *
     * @var string
     */
    const CANCELED = 'canceled';

    /**
     * Whether the gateway call itself succeeded (a `REQUIRES_ACTION`
     * result is still `$success = true` — the call worked, it just isn't
     * finished yet).
     *
     * @var bool
     */
    public $success;

    /**
     * One of this class's own constants.
     *
     * @var string
     */
    public $status;

    /**
     * The gateway's own reference for this payment (PaymentIntent id,
     * order id, charge id) — null for a failed attempt that never reached
     * the gateway.
     *
     * @var string|null
     */
    public $gateway_transaction_id;

    /**
     * Amount currently authorized (held), after this call.
     *
     * @var float
     */
    public $authorized_amount;

    /**
     * Amount currently captured/settled, after this call.
     *
     * @var float
     */
    public $captured_amount;

    /**
     * Amount refunded, after this call.
     *
     * @var float
     */
    public $refunded_amount;

    /**
     * An opaque client-side handle a storefront widget needs to finish a
     * `REQUIRES_ACTION` result — a Stripe `client_secret`, a PayPal/
     * Razorpay order id to hand to that gateway's own JS SDK. Null once
     * a payment is past that stage.
     *
     * @var string|null
     */
    public $client_secret;

    /**
     * Human-readable failure reason, only set when `$success` is false.
     *
     * @var string|null
     */
    public $error_message;

    /**
     * The gateway's raw response, kept for the transaction ledger's own
     * audit trail — never returned to the storefront, admin-only.
     *
     * @var array<string, mixed>
     */
    public $raw;

    /**
     * PaymentResult constructor.
     *
     * @param bool                  $success                Whether the gateway call itself succeeded.
     * @param string                $status                 One of this class's own constants.
     * @param string|null           $gateway_transaction_id The gateway's own reference for this payment.
     * @param float                 $authorized_amount      Amount currently authorized, after this call.
     * @param float                 $captured_amount        Amount currently captured/settled, after this call.
     * @param float                 $refunded_amount        Amount refunded, after this call.
     * @param string|null           $client_secret          Opaque client-side handle for a `REQUIRES_ACTION` result.
     * @param string|null           $error_message          Human-readable failure reason.
     * @param array<string, mixed>  $raw                    The gateway's raw response.
     */
    public function __construct(
        bool $success,
        string $status,
        $gateway_transaction_id = null,
        float $authorized_amount = 0.0,
        float $captured_amount = 0.0,
        float $refunded_amount = 0.0,
        $client_secret = null,
        $error_message = null,
        array $raw = array()
    ) {
        $this->success                = $success;
        $this->status                 = $status;
        $this->gateway_transaction_id = $gateway_transaction_id;
        $this->authorized_amount      = $authorized_amount;
        $this->captured_amount        = $captured_amount;
        $this->refunded_amount        = $refunded_amount;
        $this->client_secret          = $client_secret;
        $this->error_message          = $error_message;
        $this->raw                    = $raw;
    }

    /**
     * Collapses this gateway-level status onto one of
     * `Order\Domain\PaymentStatus`'s four values — see class docblock for
     * why this lives here rather than on that class.
     *
     * @return string One of 'pending', 'paid', 'failed', 'refunded'.
     */
    public function to_order_payment_status(): string {
        switch ( $this->status ) {
            case self::CAPTURED:
                return 'paid';
            case self::FAILED:
            case self::CANCELED:
                return 'failed';
            case self::REFUNDED:
                return 'refunded';
            case self::AUTHORIZED:
            case self::REQUIRES_ACTION:
            default:
                return 'pending';
        }
    }

    /**
     * A failed result — the shape most gateway adapters return from a
     * caught exception/non-2xx response.
     *
     * @param string               $message Human-readable failure reason.
     * @param array<string, mixed> $raw     The gateway's raw response, if any.
     * @return self
     */
    public static function failed( string $message, array $raw = array() ): self {
        return new self( false, self::FAILED, null, 0.0, 0.0, 0.0, null, $message, $raw );
    }
}
