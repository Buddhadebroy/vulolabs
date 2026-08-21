<?php
/**
 * StoreReadiness controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\AutomationsRunRepository;

defined( 'ABSPATH' ) || exit;

/**
 * GET /store-readiness — "Commerce"'s live store-status checklist
 * (`StoreReadinessCard.tsx`) and the informational (not "problem")
 * numbers its category-card grid needs. Deliberately separate from the
 * Findings/scanner system: these are live facts about the store's
 * *current* configuration (a page either exists and is published right
 * now, or it doesn't), not persistent issues with an open/resolve/ignore
 * lifecycle — recomputed fresh on every request rather than only as-of
 * the last scan run. Real order/checkout *problems* (failed orders,
 * stale orders, gateway test-mode, outdated templates) are genuine
 * scanner findings instead (WooCommerceFailedOrdersScanner and its
 * siblings in classes/Scanners/Basic/) so they get the real
 * open/resolve/ignore workflow and show up in the same findings table
 * everything else does.
 *
 * @class       StoreReadiness controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class StoreReadiness extends \WP_REST_Controller {

	/**
	 * @var string
	 */
	protected $rest_base = 'store-readiness';

	/**
	 * @inheritDoc
	 */
	public function register_routes() {
		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base,
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_items' ),
					'permission_callback' => array( $this, 'get_items_permissions_check' ),
				),
			)
		);
	}

	/**
	 * @inheritDoc
	 */
	public function get_items_permissions_check( $request ) {
		return current_user_can( 'manage_options' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_items( $request ) {
		$automation_runs = new AutomationsRunRepository();

		return rest_ensure_response(
			array(
				'has_woocommerce'         => class_exists( 'WooCommerce' ) && function_exists( 'wc_get_page_id' ),
				'readiness'               => $this->build_readiness(),
				'payment_methods_active'  => $this->count_active_payment_methods(),
				'secure_checkout'         => is_ssl(),
				'automation_failed_count' => $automation_runs->get_failed_count_since(
					gmdate( 'Y-m-d H:i:s', strtotime( '-30 days' ) )
				),
			)
		);
	}

	/**
	 * @return array<string, bool>
	 */
	private function build_readiness(): array {
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_page_id' ) ) {
			return array(
				'shop'       => false,
				'cart'       => false,
				'checkout'   => false,
				'my_account' => false,
			);
		}

		return array(
			'shop'       => $this->is_page_ready( 'shop' ),
			'cart'       => $this->is_page_ready( 'cart' ),
			'checkout'   => $this->is_page_ready( 'checkout' ),
			'my_account' => $this->is_page_ready( 'myaccount' ),
		);
	}

	/**
	 * @param string $page_id_key WooCommerce's own `wc_get_page_id()` key.
	 * @return bool
	 */
	private function is_page_ready( string $page_id_key ): bool {
		$page_id = wc_get_page_id( $page_id_key );

		return $page_id > 0 && 'publish' === get_post_status( $page_id );
	}

	/**
	 * @return int
	 */
	private function count_active_payment_methods(): int {
		if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
			return 0;
		}

		return count( WC()->payment_gateways()->get_available_payment_gateways() );
	}
}
