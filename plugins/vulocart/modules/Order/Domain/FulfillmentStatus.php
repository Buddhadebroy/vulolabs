<?php
/**
 * FulfillmentStatus class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Order\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * Fulfillment status of an order: the other of the two independent statuses an order tracks (see PaymentStatus).
 * `DRAFT` is an order an admin created manually (OrderService::create_manual_order()) that has not been placed with
 * the customer yet; the Orders menu filters on it.
 *
 * @class       FulfillmentStatus class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FulfillmentStatus {

    /**
     * Created by an admin, not yet placed/sent to the customer.
     *
     * @var string
     */
    const DRAFT = 'draft';

    /**
     * Placed, not yet started.
     *
     * @var string
     */
    const PENDING = 'pending';

    /**
     * Being prepared/picked/packed.
     *
     * @var string
     */
    const PROCESSING = 'processing';

    /**
     * Shipped/handed off for delivery - meaningful for shippable
     * products; a purely digital order can skip straight to
     * `COMPLETED`.
     *
     * @var string
     */
    const SHIPPED = 'shipped';

    /**
     * Fulfilled.
     *
     * @var string
     */
    const COMPLETED = 'completed';

    /**
     * Cancelled before completion.
     *
     * @var string
     */
    const CANCELLED = 'cancelled';

    /**
     * Every known fulfillment status.
     *
     * @return string[]
     */
    public static function all(): array {
        return array(
            self::DRAFT,
            self::PENDING,
            self::PROCESSING,
            self::SHIPPED,
            self::COMPLETED,
            self::CANCELLED,
        );
    }
}
