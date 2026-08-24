<?php
/**
 * Uninstall handler.
 *
 * WordPress core only ever includes this file directly (never via a
 * `register_uninstall_hook()` call, unlike activation/deactivation) when a
 * plugin is deleted from the Plugins screen — the file-name itself is the
 * registration. `WP_UNINSTALL_PLUGIN` is defined by core right before that
 * include, so its absence means this file was reached some other way (a
 * stray direct request) and should refuse to run.
 *
 * Honors Settings → General → "Keep VuloPilot data after uninstall"
 * (`keep_data_uninstall`, Utill::VULOPILOT_SETTINGS_DEFAULTS) — previously
 * a real, saved setting with no code anywhere that ever read it, since no
 * uninstall.php existed in this plugin at all. Defaults to the safe
 * choice (keep) whenever the setting is missing or not the exact
 * 'delete_everything' value, same as every other place in this codebase
 * treats an unrecognized/absent option value.
 *
 * @package VuloPilot
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

require_once __DIR__ . '/vendor/autoload.php';

use VuloPilot\Utill;

$settings = get_option( Utill::VULOPILOT_SETTINGS_KEY, array() );

if ( ! isset( $settings['keep_data_uninstall'] ) || 'delete_everything' !== $settings['keep_data_uninstall'] ) {
    return;
}

global $wpdb;

foreach ( Utill::TABLES as $table ) {
    // Table identifiers can't go through $wpdb->prepare()'s placeholders
    // (those only escape values) — safe here because $table only ever
    // comes from this codebase's own fixed Utill::TABLES array, never
    // user input.
    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.DirectDatabaseQuery.NoCaching
    $wpdb->query( "DROP TABLE IF EXISTS `{$wpdb->prefix}{$table}`" );
}

// Every VuloPilot option (settings, install/version tracking, crawler
// alert state) and transient (entity extraction cache, schema coverage
// snapshot, robots.txt bot-group cache, rate limits, etc.) shares the
// `vulopilot_` prefix — a wildcard sweep here is what actually matches
// this setting's own promise ("your settings and saved data"), rather
// than hand-maintaining a list of option/transient keys that's already
// spread across a few dozen classes and would silently go stale the next
// time one of them adds a new option.
// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'vulopilot\_%' OR option_name LIKE '\_transient\_vulopilot\_%' OR option_name LIKE '\_transient\_timeout\_vulopilot\_%' OR option_name LIKE '\_site\_transient\_vulopilot\_%' OR option_name LIKE '\_site\_transient\_timeout\_vulopilot\_%'" );
