<?php
/**
 * WooCommerceFailedOrdersScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * "Orders" — one real finding per order WooCommerce itself marked
 * `wc-failed` (a real payment attempt that didn't complete) in the last
 * LOOKBACK_DAYS. Bounded to a recent window, same
 * performance-bounding convention Pro's own
 * InventoryIntelligenceScanner::get_sales_velocity_by_product() already
 * follows for its own order query, rather than an unbounded historical
 * scan on every run.
 *
 * @class       WooCommerceFailedOrdersScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceFailedOrdersScanner extends AbstractBasicScanner {

	private const LOOKBACK_DAYS = 30;
	private const ORDERS_BATCH_SIZE = 200;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'woocommerce-failed-orders';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Failed Orders', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'woocommerce';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_orders' ) ) {
			return array();
		}

		$order_ids = wc_get_orders(
			array(
				'status'       => array( 'failed' ),
				'date_created' => '>' . ( time() - self::LOOKBACK_DAYS * DAY_IN_SECONDS ),
				'limit'        => self::ORDERS_BATCH_SIZE,
				'return'       => 'ids',
			)
		);

		$findings = array();

		foreach ( $order_ids as $order_id ) {
			$order = wc_get_order( $order_id );

			if ( ! $order instanceof \WC_Order ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: %d is the order number. */
					__( 'Payment failed for order #%d', 'vulopilot' ),
					$order->get_order_number()
				),
				Severity::HIGH,
				$this->get_category(),
				__( 'This order\'s payment attempt failed — the customer never completed checkout. Follow up or the sale is lost.', 'vulopilot' ),
				'order',
				(string) $order_id
			);
		}

		return $findings;
	}
}
