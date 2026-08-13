<?php
/**
 * WooCommerceStaleOnHoldOrdersScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * "Orders" — one real finding per order still `wc-on-hold` after
 * STALE_AFTER_DAYS. WooCommerce itself uses on-hold for orders awaiting
 * manual verification (offline payment, manual fraud review, stock
 * awaiting confirmation) — a real order sitting in that state this long
 * usually means it was never actually reviewed, not that review is still
 * genuinely in progress.
 *
 * @class       WooCommerceStaleOnHoldOrdersScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceStaleOnHoldOrdersScanner extends AbstractBasicScanner {

	private const STALE_AFTER_DAYS = 7;
	private const ORDERS_BATCH_SIZE = 200;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'woocommerce-stale-onhold-orders';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Stale On-Hold Orders', 'vulopilot' );
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
				'status'       => array( 'on-hold' ),
				'date_created' => '<' . ( time() - self::STALE_AFTER_DAYS * DAY_IN_SECONDS ),
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
					/* translators: 1: the order number, 2: how many days it's been on hold. */
					__( 'Order #%1$d has been on hold for over %2$d days', 'vulopilot' ),
					$order->get_order_number(),
					self::STALE_AFTER_DAYS
				),
				Severity::MEDIUM,
				$this->get_category(),
				__( 'This order has been awaiting manual review (payment verification, stock, or fraud check) longer than usual — it likely needs attention.', 'vulopilot' ),
				'order',
				(string) $order_id
			);
		}

		return $findings;
	}
}
