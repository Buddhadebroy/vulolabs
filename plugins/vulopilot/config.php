<?php
/**
 * VuloPilot config file.
 *
 * @package VuloPilot
 */

defined( 'ABSPATH' ) || exit;

define( 'VULOPILOT_PLUGIN_TEXTDOMAIN', 'vulopilot' );
define( 'VULOPILOT_PLUGIN_VERSION', '1.1.0' );
define( 'VULOPILOT_PLUGIN_SLUG', 'vulopilot' );
// Defined free-side (not by vulopilot-pro) — same "where to buy Pro"
// pattern as MULTIVENDORX_PRO_SHOP_URL in vulolabs/plugins/vulolabs/
// config.php: the default `manage_plan_url` fallback for the "Pro not
// installed" case, overridden by vulopilot-pro's own VULOPILOT_MY_ACCOUNT_URL
// once Pro registers via the `vulopilot_update_pro_data` filter.
define( 'VULOPILOT_PRO_SHOP_URL', 'https://vulopilot.com/pricing/?utm_source=wpadmin&utm_medium=pluginsettings&utm_campaign=vulopilot' );

/**
 * VuloPilot's OWN shared Google Cloud OAuth Client — ONE Client ID/Secret
 * registered by VuloLabs, used by every install's "Connect Google
 * Services" button (Settings → Scanning → Google Services,
 * GoogleServicesPanel.tsx). A site owner never sees or enters a Client
 * ID/Secret themselves — just clicks Connect, same one-click flow the
 * RankMath reference screenshots this feature was built from show.
 *
 * Deliberately different from VULOPILOT_PRO_APPLICATION_ID/SALT's own
 * wp-config.php-only pattern (see vulopilot-pro/config.php's docblock) —
 * kept directly in THIS file per explicit instruction, not wp-config.php.
 *
 * Two real trade-offs this choice accepts, not hidden:
 *
 * 1. Confidentiality — this file ships inside the distributed plugin
 *    zip, so VULOPILOT_GOOGLE_CLIENT_SECRET is only ever as confidential
 *    as the plugin's own file access on a customer's server (their host,
 *    anyone with file access, can read it in plain text). Every
 *    "embedded" OAuth client accepts this same trade-off — it's why
 *    Google's own docs class browser/installed apps as unable to keep a
 *    secret truly confidential. A true broker (VuloCloud's server
 *    holding the secret, relaying tokens back, never handing it to the
 *    site at all) would close this gap, but needs a new endpoint on the
 *    separate VuloCloud repo — out of scope here, left as a documented
 *    next step if this ever needs hardening.
 *
 * 2. Redirect URI scaling — Google OAuth Clients only accept a fixed,
 *    pre-registered allowlist of "Authorized redirect URIs" (no
 *    wildcards), but GoogleServicesConnection::get_redirect_uri() returns
 *    each site's own domain-specific admin-post.php URL. With ONE shared
 *    Client ID, only domains actually added to this Client's redirect
 *    URI allowlist in Google Cloud Console will complete the OAuth
 *    handshake. Fine for a fixed/small set of known installs (this dev
 *    site included); does NOT scale to arbitrary customer domains
 *    without either manually allowlisting each one or the broker
 *    redirect described above. Documented, not silently papered over.
 *
 * Empty placeholders so the plugin doesn't behave as if configured
 * before VuloLabs fills in a real Client ID/Secret —
 * GoogleServicesConnection::has_client_credentials() reports false, and
 * the Settings panel shows an honest "not available yet" state, until
 * these are real values.
 */
if ( ! defined( 'VULOPILOT_GOOGLE_CLIENT_ID' ) ) {
	define( 'VULOPILOT_GOOGLE_CLIENT_ID', '' );
}
if ( ! defined( 'VULOPILOT_GOOGLE_CLIENT_SECRET' ) ) {
	define( 'VULOPILOT_GOOGLE_CLIENT_SECRET', '' );
}
