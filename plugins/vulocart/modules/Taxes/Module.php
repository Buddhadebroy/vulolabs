<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Taxes;

defined( 'ABSPATH' ) || exit;

/**
 * Taxes module: tax classes, tax rates and tax calculation.
 *
 * Creates the tax rates table, registers the tax service (`VuloCart()->tax_service`) and the tax REST routes. The tax on
 * an order is calculated on the server when the order is created. Adds no checkout step: tax has nothing for the shopper
 * to enter, and the result appears in the Review step's summary.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Creates the tax rates table, the tax service (`VuloCart()->tax_service`) and the tax routes.
     */
    public function __construct() {
        new Install();

        $service = new Application\TaxService( new Application\RateRepository() );

        VuloCart()->tax_service = $service;

        new Rest();
    }
}
