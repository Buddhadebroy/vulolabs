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
 * GoogleServicesPanel.tsx) whenever VULOPILOT_GOOGLE_BROKER_URL below
 * isn't set. A site owner never sees or enters a Client ID/Secret
 * themselves — just clicks Connect, same one-click flow the RankMath
 * reference screenshots this feature was built from show.
 *
 * NOW wp-config.php-only, same pattern VULOPILOT_PRO_APPLICATION_SALT
 * already uses (see vulopilot-pro/config.php's docblock) — reversed from
 * this file's earlier "kept directly in config.php" choice specifically
 * because config.php ships inside the distributed plugin zip AND is
 * committed to this repo's own git history: a real secret defined here
 * is readable by anyone with file access on a customer's server, and
 * permanently recoverable from git history even if later edited out.
 * Empty defaults below are safe to ship/commit; the real values for THIS
 * dev environment live in `plugins/vulopilot-pro/.wp-env.override.json`
 * (gitignored, loaded into the wp-env container's own wp-config.php by
 * `@wordpress/env` — never committed). A real production deployment
 * defines these the same way any other secret constant is defined
 * outside version control: directly in that site's own wp-config.php.
 *
 * Two real trade-offs this embedded-Client path still accepts even once
 * the secret itself isn't shipped in a committed file:
 *
 * 1. Confidentiality — wp-config.php still lives on the customer's own
 *    server, so this is still only as confidential as that server's file
 *    access, same limitation every "embedded" OAuth client has (it's why
 *    Google's own docs class browser/installed apps as unable to keep a
 *    secret truly confidential). Moving the value out of a committed
 *    file closes the "leaked via git/plugin-zip" exposure; it does not
 *    close this one. VULOPILOT_GOOGLE_BROKER_URL below is what closes
 *    it for real — VuloCloud's own secret never reaches any customer
 *    server at all.
 *
 * 2. Redirect URI scaling — Google OAuth Clients only accept a fixed,
 *    pre-registered allowlist of "Authorized redirect URIs" (no
 *    wildcards), but GoogleServicesConnection::get_redirect_uri() returns
 *    each site's own domain-specific admin-post.php URL. With ONE shared
 *    Client ID, only domains actually added to this Client's redirect
 *    URI allowlist in Google Cloud Console will complete the OAuth
 *    handshake. Fine for a fixed/small set of known installs; does NOT
 *    scale to arbitrary customer domains — that's exactly what
 *    VULOPILOT_GOOGLE_BROKER_URL below replaces this whole embedded-Client
 *    path with, once VuloCloud implements GOOGLE_CONNECT_BROKER.md.
 */
if ( ! defined( 'VULOPILOT_GOOGLE_CLIENT_ID' ) ) {
	define( 'VULOPILOT_GOOGLE_CLIENT_ID', '' );
}
if ( ! defined( 'VULOPILOT_GOOGLE_CLIENT_SECRET' ) ) {
	define( 'VULOPILOT_GOOGLE_CLIENT_SECRET', '' );
}

/**
 * Optional dynamic "Google Connect" broker on the VuloCloud platform —
 * the real fix for trade-off #2 above ("Redirect URI scaling"), same
 * shape RankMath's own Google Connect uses. When set,
 * GoogleServicesConnection routes "Connect Google Services" through
 * `{this url}/plugin/google/authorize` instead of straight to
 * accounts.google.com: VuloCloud holds the ONE Google Cloud OAuth Client
 * actually registered with Google (its own fixed, permanently-registered
 * redirect URI), relays the browser through the real consent screen, and
 * hands this site back a short-lived, single-use code to redeem
 * server-to-server — so ANY customer domain works without ever being
 * individually added to a Google-side allowlist, and
 * VULOPILOT_GOOGLE_CLIENT_SECRET above is no longer the thing actually
 * protecting anything once this is set (VuloCloud's own client secret
 * never leaves its server). See GOOGLE_CONNECT_BROKER.md (this plugin's
 * own root) for the exact contract VuloCloud's `/plugin/google/*`
 * endpoints must implement — ported from the same
 * reference-client/server relationship VULOPILOT_PRO_LICENSE_SERVER_URL
 * already has with VuloCloud's Licensing bounded context.
 *
 * Empty by default — no broker deployed for this build yet, so
 * GoogleServicesConnection::has_broker() honestly reports false and
 * "Connect Google Services" falls back to the embedded shared-Client
 * flow above, exactly as it worked before this constant existed.
 */
if ( ! defined( 'VULOPILOT_GOOGLE_BROKER_URL' ) ) {
	define( 'VULOPILOT_GOOGLE_BROKER_URL', '' );
}
