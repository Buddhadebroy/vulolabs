<?php
/**
 * VuloCart config file.
 *
 * @package VuloCart
 */

defined( 'ABSPATH' ) || exit;

define( 'VULOCART_PLUGIN_TEXTDOMAIN', 'vulocart' );
define( 'VULOCART_PLUGIN_VERSION', '1.1.0' );
define( 'VULOCART_PLUGIN_SLUG', 'vulocart' );
// Defined free-side (not by vulocart-pro) - same "where to buy Pro" pattern
// as VULOPILOT_PRO_SHOP_URL in vulopilot's own config.php:
// the default `manage_plan_url` fallback for the "Pro not installed" case,
// overridden by vulocart-pro's own VULOCART_MY_ACCOUNT_URL once Pro
// registers via the `vulocart_update_pro_data` filter.
define( 'VULOCART_PRO_SHOP_URL', 'https://vulocart.com/pricing/?utm_source=wpadmin&utm_medium=pluginsettings&utm_campaign=vulocart' );

// VuloCloud AI gateway - the same broker VuloPilot's AI connects to. AI requests
// are served from the connected Organization's key; there is no per-site API key.
// Leave the organization id empty to let the broker ask which Organization to use.
if ( ! defined( 'VULOCART_VULOCLOUD_URL' ) ) {
	define( 'VULOCART_VULOCLOUD_URL', 'https://store.vulolabs.com' );
}

if ( ! defined( 'VULOCART_VULOCLOUD_HOST_ORGANIZATION_ID' ) ) {
	define( 'VULOCART_VULOCLOUD_HOST_ORGANIZATION_ID', '' );
}
