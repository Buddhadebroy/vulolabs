<?php
/**
 * WooCommerceCheckoutScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * "Checkout & Payments" — two real risks the original WooCommerceScanner
 * doesn't cover (that one only checks whether a gateway is enabled at
 * all, not its configuration): checkout served over plain HTTP, and a
 * payment gateway still left in test/sandbox mode. Test-mode detection is
 * necessarily a best-effort, documented list — WooCommerce core has no
 * single "is this gateway in test mode" API; each gateway extension
 * defines its own settings option and key. Covers the 4 most common
 * WooCommerce payment extensions (Stripe, PayPal Payments, Square,
 * Braintree — real settings-option/key names, confirmed against each
 * plugin's own source). A gateway outside this list is silently skipped
 * rather than guessed at.
 *
 * @class       WooCommerceCheckoutScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceCheckoutScanner extends AbstractBasicScanner {

	/**
	 * gateway_id => { option: settings option name, key: the field to
	 * read, value: (optional) the exact string that means "test mode" —
	 * omitted for plain WC-style yes/no checkboxes, where any of
	 * 'yes'/'1'/true means enabled.
	 *
	 * @var array<string, array{option: string, key: string, value?: string}>
	 */
	private const GATEWAY_TEST_MODE_CHECKS = array(
		'stripe'                => array(
			'option' => 'woocommerce_stripe_settings',
			'key'    => 'testmode',
		),
		'ppcp-gateway'          => array(
			'option' => 'woocommerce-ppcp-settings',
			'key'    => 'sandbox_on',
		),
		'square_credit_card'    => array(
			'option' => 'woocommerce_square_credit_card_settings',
			'key'    => 'sandbox',
		),
		'braintree_credit_card' => array(
			'option' => 'woocommerce_braintree_credit_card_settings',
			'key'    => 'environment',
			'value'  => 'sandbox',
		),
	);

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'woocommerce-checkout';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Checkout & Payments', 'vulopilot' );
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
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_page_id' ) ) {
			return array();
		}

		return array_merge(
			array_filter( array( $this->check_checkout_ssl() ) ),
			$this->check_gateway_test_mode()
		);
	}

	/**
	 * @return Finding|null
	 */
	private function check_checkout_ssl(): ?Finding {
		$checkout_page_id = wc_get_page_id( 'checkout' );

		if ( $checkout_page_id <= 0 || is_ssl() ) {
			return null;
		}

		return new Finding(
			__( 'Checkout is not served over HTTPS', 'vulopilot' ),
			Severity::HIGH,
			$this->get_category(),
			__( 'Customers are asked for payment details on an insecure connection — enable SSL and force HTTPS on the checkout page.', 'vulopilot' ),
			'setting',
			'woocommerce_checkout_ssl'
		);
	}

	/**
	 * @return Finding[]
	 */
	private function check_gateway_test_mode(): array {
		if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
			return array();
		}

		$findings            = array();
		$enabled_gateway_ids = array_keys( WC()->payment_gateways()->get_available_payment_gateways() );

		foreach ( $enabled_gateway_ids as $gateway_id ) {
			if ( ! isset( self::GATEWAY_TEST_MODE_CHECKS[ $gateway_id ] ) ) {
				continue;
			}

			$check    = self::GATEWAY_TEST_MODE_CHECKS[ $gateway_id ];
			$settings = get_option( $check['option'], array() );
			$raw      = is_array( $settings ) ? ( $settings[ $check['key'] ] ?? null ) : null;

			if ( null === $raw ) {
				continue;
			}

			$is_test_mode = isset( $check['value'] )
				? $check['value'] === $raw
				: in_array( $raw, array( 'yes', '1', 1, true ), true );

			if ( ! $is_test_mode ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: %s is the payment gateway's id, e.g. "stripe". */
					__( '%s is in test mode', 'vulopilot' ),
					ucfirst( str_replace( array( '-gateway', '_credit_card' ), '', $gateway_id ) )
				),
				Severity::HIGH,
				$this->get_category(),
				__( 'This payment gateway is live on the store but still set to test/sandbox mode — real customers cannot complete a real payment through it.', 'vulopilot' ),
				'setting',
				'woocommerce_payment_gateway_test_mode_' . $gateway_id
			);
		}

		return $findings;
	}
}
