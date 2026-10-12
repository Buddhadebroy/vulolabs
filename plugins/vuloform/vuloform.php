<?php
/**
 * Plugin Name: VuloForm
 * Plugin URI: https://vulolabs.com/vuloform/
 * Description: Every form your website needs. One simple builder. Drag-and-drop forms with conditional logic, multi-step pages, file uploads, submissions, notifications and webhooks.
 * Author: VuloLabs
 * Version: 1.0.0
 * Author URI: https://vulolabs.com/
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * Text Domain: vuloform
 * Domain Path: /languages/
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package VuloForm
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/vendor/autoload.php';
// The public API. It lives under classes/ because the shared release script only packages a fixed
// list of top-level paths.
require_once __DIR__ . '/classes/Integrations/functions.php';

/**
 * Returns the main instance of the VuloForm plugin.
 *
 * @return \VuloForm\VuloForm
 */
function VuloForm() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.FunctionNameInvalid -- PascalCase global accessor, same deliberate exception as VuloPilot()/VuloMail().
	return \VuloForm\VuloForm::init( __FILE__ );
}

VuloForm();
