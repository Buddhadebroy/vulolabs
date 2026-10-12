<?php
/**
 * VuloMail config file.
 *
 * @package VuloMail
 */

defined( 'ABSPATH' ) || exit;

define( 'VULOMAIL_PLUGIN_TEXTDOMAIN', 'vulomail' );
define( 'VULOMAIL_PLUGIN_VERSION', '1.0.0' );
define( 'VULOMAIL_PLUGIN_SLUG', 'vulomail' );
define( 'VULOMAIL_PLUGIN_NAME', 'VuloMail' );

// Version of the public integration API in classes/Integrations/functions.php (vulomail_send_email() and friends).
// Bumped only when that surface changes; see docs/developer/INTEGRATION-API.md.
define( 'VULOMAIL_API_VERSION', '1.0' );
