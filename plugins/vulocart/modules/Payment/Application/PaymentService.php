<?php
/**
 * PaymentService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Payment\Application;

use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Payment module PaymentService.
 *
 * The vision's lightweight-first payment layer: `manual` (offline
 * settlement — pay on delivery, bank transfer, cash, anything not run
 * through a gateway) is the only method until a real gateway module
 * exists, gated by the Payments tab's `enable_manual_payment` toggle. The
 * id-based `get_available_methods()` list is deliberately the same shape
 * `Shipping\Application\ShippingService::get_available_methods()` uses,
 * so a future gateway module slots in as another array entry, not a
 * reshape of this method's contract.
 *
 * @class       PaymentService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PaymentService {

    /**
     * Reads the stored settings option, defaults filled in.
     *
     * @return array Stored settings, defaults filled in for any never-saved key.
     */
    private function get_settings(): array {
        return wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );
    }

    /**
     * Every payment method currently offered.
     *
     * @return array<int, array{id: string, label: string}>
     */
    public function get_available_methods(): array {
        $settings = $this->get_settings();

        if ( empty( $settings['enable_manual_payment'] ) ) {
            return array();
        }

        return array(
            array(
                'id'    => 'manual',
                'label' => __( 'Manual / offline payment (pay on delivery, bank transfer, etc.)', 'vulocart' ),
            ),
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
     * The payment status a new order starts at — the Payments tab's
     * `default_payment_status`, already constrained to one of
     * `Order\Domain\PaymentStatus`'s own values by that setting's own
     * select options (`src/settings/Commerce/Payments.ts`), so this
     * deliberately doesn't take a hard dependency on the Order module's
     * namespace just to re-validate a value that field's own UI already
     * constrains.
     *
     * @return string
     */
    public function get_initial_payment_status(): string {
        return (string) $this->get_settings()['default_payment_status'];
    }
}
