<?php
/**
 * Plugin Name: VuloCart
 * Plugin URI: https://vulolabs.com/vulocart/
 * Description: An AI-native, API-first commerce engine — Assets, Passports, and a headless-ready REST core for WordPress.
 * Author: VuloLabs
 * Version: 1.0.0
 * Author URI: https://vulolabs.com/
 * Requires at least: 6.3
 * Tested up to: 7.0.1
 * Text Domain: vulocart
 * Domain Path: /languages/
 *
 * @package VuloCart
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/vendor/autoload.php';

/**
 * Returns the main instance of the VuloCart plugin.
 *
 * @return \VuloCart\VuloCart
 */
function VuloCart() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.FunctionNameInvalid -- PascalCase global accessor, same deliberate exception as VuloLabs()/VuloPilot() (naming-quality.md).
    return \VuloCart\VuloCart::init( __FILE__ );
}

VuloCart();
