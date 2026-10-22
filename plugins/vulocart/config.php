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
define( 'VULOCART_PLUGIN_NAME', 'VuloCart' );
define( 'VULOCART_PRO_SHOP_URL', 'https://vulocart.com/pricing/?utm_source=wpadmin&utm_medium=pluginsettings&utm_campaign=vulocart' );

if ( ! defined( 'VULOCART_APPLICATION_ID' ) ) {
	define( 'VULOCART_APPLICATION_ID', '5fbc199f-e6d8-4f61-a0ab-3daf9f3fbe77' );
}

if ( ! defined( 'VULOCART_VULOCLOUD_URL' ) ) {
	define( 'VULOCART_VULOCLOUD_URL', 'https://store.vulolabs.com' );
}

if ( ! defined( 'VULOCART_VULOCLOUD_HOST_ORGANIZATION_ID' ) ) {
	define( 'VULOCART_VULOCLOUD_HOST_ORGANIZATION_ID', 'b3235308-51a9-48db-ba2b-be76b93663c8' );
}
