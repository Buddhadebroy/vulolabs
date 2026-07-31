<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Taxes;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Taxes Module.
 *
 * Same toggleable-addon pattern as VuloCart\Cart\Module. No own table, no
 * cross-module dependency — reads the Taxes tab's own settings
 * (`enable_tax_calculation`/`default_tax_rate_percent`/
 * `prices_include_tax`, `src/settings/Commerce/Taxes.ts`) and turns them
 * into a real, calculable tax amount: `Order\Application\OrderService::
 * create_from_cart()` resolves this module's own service (when active) to
 * compute `Order::$tax_amount` server-side.
 *
 * Deliberately does NOT register a `vulocart_checkout_steps` entry (unlike
 * Customer/Address/Shipping/Payment/Review/Confirmation) — tax has no
 * shopper-facing input to collect; its result is a computed line item the
 * Review step's own summary already shows. A "step" with nothing to
 * interact with isn't a step in the Checkout Engine's own sense.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Container for this module's own class instances.
     *
     * @var array
     */
    private $container = array();

    /**
     * Module constructor.
     */
    public function __construct() {
        $this->init_classes();
    }

    /**
     * Constructs this module's own classes and registers its service on
     * the main plugin container (`VuloCart()->tax_service`).
     *
     * @return void
     */
    public function init_classes() {
        $this->container['service'] = new Application\TaxService();

        VuloCart()->tax_service = $this->container['service'];

        $this->container['rest'] = new Rest();
    }

    /**
     * Magic getter for this module's own container.
     *
     * @param string $class_name Container key to retrieve.
     * @return mixed
     * @throws \Exception If the requested key does not exist in the container.
     */
    public function __get( $class_name ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.classFound
        if ( array_key_exists( $class_name, $this->container ) ) {
            return $this->container[ $class_name ];
        }

        throw new \Exception( sprintf( 'Call to unknown class %s.', esc_html( $class_name ) ) );
    }
}
