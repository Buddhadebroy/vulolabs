<?php
/**
 * Uninstall handler.
 *
 * Core includes this file directly (no `register_uninstall_hook()`) when the plugin is deleted, right
 * after defining `WP_UNINSTALL_PLUGIN`; its absence means a stray direct request, so refuse to run.
 *
 * Honors Settings → General → "Keep VuloPilot data after uninstall" (`keep_data_uninstall`). Defaults to
 * keep unless the value is exactly 'delete_everything'.
 *
 * @package VuloPilot
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

require_once __DIR__ . '/vendor/autoload.php';

use VuloPilot\Utill;

$vulopilot_uninstall_settings = get_option( Utill::VULOPILOT_SETTINGS_KEY, array() );

if ( ! isset( $vulopilot_uninstall_settings['keep_data_uninstall'] ) || 'delete_everything' !== $vulopilot_uninstall_settings['keep_data_uninstall'] ) {
	return;
}

global $wpdb;

foreach ( Utill::TABLES as $vulopilot_uninstall_table ) {
	// Table identifiers can't use $wpdb->prepare() placeholders (values only). Safe: the name comes from
	// this codebase's fixed Utill::TABLES array, never user input.
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.DirectDatabaseQuery.NoCaching
	$wpdb->query( "DROP TABLE IF EXISTS `{$wpdb->prefix}{$vulopilot_uninstall_table}`" );
}

// Every VuloPilot option and transient shares the `vulopilot_` prefix, so a wildcard sweep matches
// the setting's promise ("your settings and saved data") without a hand-maintained key list that
// would go stale.
// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'vulopilot\_%' OR option_name LIKE '\_transient\_vulopilot\_%' OR option_name LIKE '\_transient\_timeout\_vulopilot\_%' OR option_name LIKE '\_site\_transient\_vulopilot\_%' OR option_name LIKE '\_site\_transient\_timeout\_vulopilot\_%'" );
