<?php
/**
 * A stand-in for DNS, so the webhook tests never touch the network. PHP resolves an unqualified
 * function call in the plugin's namespace first, so this replaces `gethostbynamel()` for
 * VuloForm\Notifications only.
 *
 * @package VuloForm
 */

namespace VuloForm\Notifications;

/**
 * @param string $host Host name.
 * @return string[]|false
 */
function gethostbynamel( $host ) {
	$known = array(
		'hooks.example.com'    => array( '93.184.216.34' ),
		'internal.example.com' => array( '10.0.0.7' ),
		'mixed.example.com'    => array( '93.184.216.34', '127.0.0.1' ),
	);

	return isset( $known[ $host ] ) ? $known[ $host ] : false;
}
