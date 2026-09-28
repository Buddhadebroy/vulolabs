<?php
/**
 * VuloPilot config file.
 *
 * @package VuloPilot
 */

defined( 'ABSPATH' ) || exit;

define( 'VULOPILOT_PLUGIN_TEXTDOMAIN', 'vulopilot' );
define( 'VULOPILOT_PLUGIN_VERSION', '1.0.0' );
define( 'VULOPILOT_PLUGIN_SLUG', 'vulopilot' );
define( 'VULOPILOT_PLUGIN_NAME', 'VuloPilot' );
define( 'VULOPILOT_PRO_SHOP_URL', 'https://vulopilot.com/pricing/?utm_source=wpadmin&utm_medium=pluginsettings&utm_campaign=vulopilot' );

/**
 * VuloPilot's own shared Google Cloud OAuth client: one Client ID/Secret used by every install's
 * "Connect Google Services" button when VULOPILOT_GOOGLE_BROKER_URL below isn't set, so site owners
 * never enter their own.
 *
 * wp-config.php-only (not defined here): config.php ships in the zip and is committed to git, so a
 * real secret here would be recoverable from history. Dev values live in a gitignored local override.
 */
if ( ! defined( 'VULOPILOT_GOOGLE_CLIENT_ID' ) ) {
	define( 'VULOPILOT_GOOGLE_CLIENT_ID', '' );
}
if ( ! defined( 'VULOPILOT_GOOGLE_CLIENT_SECRET' ) ) {
	define( 'VULOPILOT_GOOGLE_CLIENT_SECRET', '' );
}

/**
 * "Connect Google Services" goes through VuloCloud's Google connect broker by default: Google accepts
 * only redirect URIs registered on the OAuth client and every site has its own address, so the broker
 * owns the one fixed redirect URI and hands the browser back with a single-use code (see
 * GoogleOAuthBrokerClient). The OAuth client is set up once in VuloCloud's organization panel.
 *
 * Both are overridable in wp-config.php. Set VULOPILOT_GOOGLE_BROKER_URL to '' to fall back to the
 * embedded Client ID/Secret above (only workable when that client lists this site's callback URL).
 */
if ( ! defined( 'VULOPILOT_GOOGLE_BROKER_URL' ) ) {
	define( 'VULOPILOT_GOOGLE_BROKER_URL', 'https://vulocloud-api.vercel.app' );
}

if ( ! defined( 'VULOPILOT_GOOGLE_APPLICATION_ID' ) ) {
	define( 'VULOPILOT_GOOGLE_APPLICATION_ID', '506dde24-bdff-425e-a501-a7df14ed80b5' );
}

if ( ! defined( 'VULOPILOT_VULOCLOUD_URL' ) ) {
	define( 'VULOPILOT_VULOCLOUD_URL', 'https://vulocloud-api.vercel.app' );
}


/**
 * Browser-facing base for the connect link when it differs from the API host above (e.g. a local dev
 * server reaching VuloCloud at a docker-internal address). Empty means "use VULOPILOT_VULOCLOUD_URL".
 * The link must start on the API host, which creates the session and redirects to the store's connect
 * page (`VULOPILOT_VULOCLOUD_CONFIG['domain']`/connect-site), so don't point this at the store domain.
 */
if ( ! defined( 'VULOPILOT_VULOCLOUD_PUBLIC_URL' ) ) {
	define( 'VULOPILOT_VULOCLOUD_PUBLIC_URL', '' );
}

if ( ! defined( 'VULOPILOT_VULOCLOUD_HOST_ORGANIZATION_ID' ) ) {
	define( 'VULOPILOT_VULOCLOUD_HOST_ORGANIZATION_ID', '9a1e8c91-bbb9-4f7b-b4f1-b5f1190287d3' );
}

if ( ! defined( 'VULOPILOT_VULOCLOUD_CONFIG' ) ) {
	define(
		'VULOPILOT_VULOCLOUD_CONFIG',
		array(
			'plugin_id'       => 'vulopilot',
			'organization_id' => '9a1e8c91-bbb9-4f7b-b4f1-b5f1190287d3',
			'brand_id'        => '506dde24-bdff-425e-a501-a7df14ed80b5',
			'domain'          => 'https://store.vulolabs.com',
		)
	);
}
