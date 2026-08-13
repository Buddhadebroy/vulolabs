<?php
/**
 * WooCommerceStalePendingOrdersScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * "Orders" — one real finding per order still stuck in `wc-pending`
 * (payment initiated but never confirmed) after STALE_AFTER_HOURS. A
 * pending order this old almost always means the customer abandoned
 * checkout mid-payment or a payment webhook never arrived — distinct
 * from WooCommerceFailedOrdersScanner's own `wc-failed` orders (WooCommerce
 * only marks an order failed when a gateway explicitly reports failure;
 * plenty of abandoned payments just sit in `pending` forever instead).
 *
 * @class       WooCommerceStalePendingOrdersScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceStalePendingOrdersScanner extends AbstractBasicScanner {

	private const STALE_AFTER_HOURS = 48;
	private const ORDERS_BATCH_SIZE = 200;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'woocommerce-stale-pending-orders';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Stale Pending Orders', 'vulopilot' );
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
				'status'       => array( 'pending' ),
				'date_created' => '<' . ( time() - self::STALE_AFTER_HOURS * HOUR_IN_SECONDS ),
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
					/* translators: 1: the order number, 2: how many hours it's been pending. */
					__( 'Order #%1$d has been pending for over %2$d hours', 'vulopilot' ),
					$order->get_order_number(),
					self::STALE_AFTER_HOURS
				),
				Severity::MEDIUM,
				$this->get_category(),
				__( 'This order was created but payment was never confirmed — the customer likely abandoned checkout or a payment webhook never arrived.', 'vulopilot' ),
				'order',
				(string) $order_id
			);
		}

		return $findings;
	}
}
