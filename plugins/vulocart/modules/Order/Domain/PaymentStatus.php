<?php
/**
 * PaymentStatus class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Order\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * Payment status of an order: one of the two independent statuses an order tracks (the other is FulfillmentStatus),
 * so "has it been paid?" and "has it been shipped?" are separate columns. The values match the options of
 * `default_payment_status` in `src/settings/Payments.ts`; keep the two in sync.
 *
 * @class       PaymentStatus class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PaymentStatus {

    /**
     * No successful payment recorded yet.
     *
     * @var string
     */
    const PENDING = 'pending';

    /**
     * Payment received in full.
     *
     * @var string
     */
    const PAID = 'paid';

    /**
     * A payment attempt did not succeed.
     *
     * @var string
     */
    const FAILED = 'failed';

    /**
     * Previously paid, now refunded (partially or fully - see
     * `Order::$refunded_amount`).
     *
     * @var string
     */
    const REFUNDED = 'refunded';

    /**
     * Every known payment status.
     *
     * @return string[]
     */
    public static function all(): array {
        return array(
            self::PENDING,
            self::PAID,
            self::FAILED,
            self::REFUNDED,
        );
    }
}
