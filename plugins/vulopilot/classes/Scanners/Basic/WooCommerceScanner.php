<?php
/**
 * WooCommerceScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;


use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * "Store Health" (readme.txt Phase 9) — four checks over whether the
 * store is even minimally able to sell, bundled into one scanner rather
 * than four (same "several related hardening checks, one scanner"
 * pattern BasicVulnerabilitiesScanner's own docblock already establishes
 * for a different category): a missing/unpublished checkout page (the
 * original, pre-Phase-9 check — customers can't complete an order at
 * all), a missing/unpublished cart page, a missing/unpublished My Account
 * page, no store base location configured, and no enabled payment
 * gateway. VuloPilot itself has no hard dependency on WooCommerce (unlike
 * vulolabs-pro — see plugin-families.md) — this is the one scanner that's
 * inherently WooCommerce-specific, so it guards on WooCommerce actually
 * being active and simply returns no findings otherwise, rather than the
 * whole plugin requiring WooCommerce to load.
 *
 * @class       WooCommerceScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'WooCommerce', 'vulopilot' );
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

        return array_values(
            array_filter(
                array(
                    $this->check_essential_page( 'checkout', __( 'checkout', 'vulopilot' ), Severity::CRITICAL ),
                    $this->check_essential_page( 'cart', __( 'cart', 'vulopilot' ), Severity::HIGH ),
                    $this->check_essential_page( 'myaccount', __( 'My Account', 'vulopilot' ), Severity::MEDIUM ),
                    $this->check_base_location(),
                    $this->check_payment_gateways(),
                )
            )
        );
    }

    /**
     * @param string $page_id_key WooCommerce's own `wc_get_page_id()` key ('checkout'/'cart'/'myaccount').
     * @param string $page_label  Human-readable name for the Finding text.
     * @param string $severity    One of Severity's constants.
     * @return Finding|null
     */
    private function check_essential_page( string $page_id_key, string $page_label, string $severity ): ?Finding {
        $page_id = wc_get_page_id( $page_id_key );

        if ( $page_id > 0 && 'publish' === get_post_status( $page_id ) ) {
            return null;
        }

        return new Finding(
            sprintf(
                /* translators: %s is the page's own name, e.g. "checkout". */
                __( 'No published %s page configured', 'vulopilot' ),
                $page_label
            ),
            $severity,
            $this->get_category(),
            sprintf(
                /* translators: %s is the page's own name, e.g. "checkout". */
                __( 'WooCommerce > Settings > Advanced must point this to a published page, or customers cannot use the %s.', 'vulopilot' ),
                $page_label
            ),
            'setting',
            'woocommerce_' . $page_id_key . '_page_id'
        );
    }

    /**
     * `woocommerce_default_country` is a real WooCommerce core setting,
     * never empty on a normally-configured store (its own onboarding wizard
     * requires it) — an empty value here means the store setup wizard was
     * skipped or the option was cleared, and every location-dependent
     * feature (tax rates, shipping zones, currency defaults) has nothing to
     * key off.
     *
     * @return Finding|null
     */
    private function check_base_location(): ?Finding {
        if ( '' !== trim( (string) get_option( 'woocommerce_default_country', '' ) ) ) {
            return null;
        }

        return new Finding(
            __( 'No store base location configured', 'vulopilot' ),
            Severity::HIGH,
            $this->get_category(),
            __( 'WooCommerce > Settings > General\'s "Store address" country/state must be set — tax rates, shipping zones, and currency defaults all key off this.', 'vulopilot' ),
            'setting',
            'woocommerce_default_country'
        );
    }

    /**
     * @return Finding|null
     */
    private function check_payment_gateways(): ?Finding {
        if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
            return null;
        }

        if ( ! empty( WC()->payment_gateways()->get_available_payment_gateways() ) ) {
            return null;
        }

        return new Finding(
            __( 'No payment gateway is enabled', 'vulopilot' ),
            Severity::CRITICAL,
            $this->get_category(),
            __( 'WooCommerce > Settings > Payments has no enabled gateway — customers can reach checkout but cannot actually pay.', 'vulopilot' ),
            'setting',
            'woocommerce_payment_gateways'
        );
    }
}
