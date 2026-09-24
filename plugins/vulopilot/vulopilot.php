<?php
/**
 * Plugin Name: VuloPilot
 * Plugin URI: https://vulopilot.com/
 * Description: An AI Operating System for WordPress - monitor, optimize, secure, and automate your website.
 * Author: VuloLabs
 * Version: 1.0.0
 * Author URI: https://vulolabs.com/
 * Requires at least: 6.7
 * Requires PHP: 8.1
 * Text Domain: vulopilot
 * Domain Path: /languages/
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package VuloPilot
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/vendor/autoload.php';

/**
 * Returns the main instance of the VuloPilot plugin.
 *
 * @return \VuloPilot\VuloPilot
 */
function VuloPilot() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.FunctionNameInvalid -- PascalCase global accessor, same deliberate exception as VuloLabs()/CatalogXPro() (naming-quality.md).
    return \VuloPilot\VuloPilot::init( __FILE__ );
}

VuloPilot();
