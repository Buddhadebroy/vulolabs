<?php
/**
 * VuloCart config file.
 *
 * @package VuloCart
 */

defined( 'ABSPATH' ) || exit;

define( 'VULOCART_PLUGIN_TEXTDOMAIN', 'vulocart' );
define( 'VULOCART_PLUGIN_VERSION', '1.0.0' );
define( 'VULOCART_PLUGIN_SLUG', 'vulocart' );
// Defined in the free plugin: the default `manage_plan_url` for when Pro is not installed. vulocart-pro overrides it
// with its own VULOCART_MY_ACCOUNT_URL through the `vulocart_update_pro_data` filter.
define( 'VULOCART_PRO_SHOP_URL', 'https://vulocart.com/pricing/?utm_source=wpadmin&utm_medium=pluginsettings&utm_campaign=vulocart' );

// VuloCloud AI gateway. AI requests are served from the connected Organization's key; there is no per-site API key.
// Leave the organization id empty to let the broker ask which Organization to use.
if ( ! defined( 'VULOCART_VULOCLOUD_URL' ) ) {
	define( 'VULOCART_VULOCLOUD_URL', 'https://store.vulolabs.com' );
}

if ( ! defined( 'VULOCART_VULOCLOUD_HOST_ORGANIZATION_ID' ) ) {
	define( 'VULOCART_VULOCLOUD_HOST_ORGANIZATION_ID', '' );
}
