<?php
/**
 * Plugin Name: VuloBackup
 * Plugin URI: https://vulolabs.com/vulobackup/
 * Description: Back up your WordPress site. Restore it when it matters. Database and file backups, schedules, retention, remote storage, integrity checks, restore and migration.
 * Author: VuloLabs
 * Version: 1.0.0
 * Author URI: https://vulolabs.com/
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * Text Domain: vulobackup
 * Domain Path: /languages/
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package VuloBackup
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/vendor/autoload.php';

/**
 * Returns the main instance of the VuloBackup plugin.
 *
 * @return \VuloBackup\VuloBackup
 */
function VuloBackup() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.FunctionNameInvalid -- PascalCase global accessor, same deliberate exception as VuloPilot()/VuloCart().
	return \VuloBackup\VuloBackup::init( __FILE__ );
}

VuloBackup();
