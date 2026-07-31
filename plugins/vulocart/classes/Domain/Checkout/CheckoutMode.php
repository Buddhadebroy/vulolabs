<?php
/**
 * CheckoutMode class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Domain\Checkout;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart CheckoutMode class.
 *
 * How the same pluggable step sequence (Application\CheckoutStepRegistry)
 * gets rendered/delivered — deliberately a separate axis from the steps
 * themselves: every mode here renders whatever steps the registry reports
 * for the active checkout template, just arranged/mounted differently.
 * SINGLE_PAGE/MULTI_STEP are free; the rest are vulocart-pro delivery
 * modes (POPUP/EMBEDDED/HOSTED wrap the same UI in a different mount
 * context, ONE_CLICK skips straight to order placement using a returning
 * customer's saved defaults).
 *
 * @class       CheckoutMode class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CheckoutMode {

    /** Every step rendered on one scrollable page. */
    const SINGLE_PAGE = 'single_page';

    /** One step at a time, wizard-style — Checkout.tsx's existing behavior. */
    const MULTI_STEP = 'multi_step';

    /** vulocart-pro: the same engine mounted in a modal/overlay rather than inline in page content. */
    const POPUP = 'popup';

    /** vulocart-pro: the same engine mounted via a standalone script into any container div, on any page (WP or not). */
    const EMBEDDED = 'embedded';

    /** vulocart-pro: served from a dedicated, non-WP-page URL a customer can be redirected to. */
    const HOSTED = 'hosted';

    /** vulocart-pro: bypasses the step sequence entirely for a returning customer with saved defaults. */
    const ONE_CLICK = 'one_click';

    /**
     * Every known mode.
     *
     * @return string[]
     */
    public static function all(): array {
        return array( self::SINGLE_PAGE, self::MULTI_STEP, self::POPUP, self::EMBEDDED, self::HOSTED, self::ONE_CLICK );
    }

    /**
     * Modes available without vulocart-pro.
     *
     * @return string[]
     */
    public static function free(): array {
        return array( self::SINGLE_PAGE, self::MULTI_STEP );
    }
}
