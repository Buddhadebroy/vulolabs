<?php
/**
 * ServerRequest class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Reads web-server-provided request values (client IP, raw request URI, user agent, server
 * software) that WordPress core has no accessor for.
 *
 * @class       ServerRequest class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ServerRequest {

	/**
	 * Sanitized value of a web-server variable.
	 *
	 * @param string $name Server variable name, e.g. 'REQUEST_URI'.
	 * @return string Sanitized value, or '' if unavailable.
	 */
	public static function get( string $name ): string {
		$value = filter_input( INPUT_SERVER, $name, FILTER_UNSAFE_RAW );

		if ( ! is_string( $value ) || '' === $value ) {
			$value = getenv( $name );
		}

		return is_string( $value ) ? sanitize_text_field( $value ) : '';
	}

	/**
	 * Real client IP - the connecting address only, never a client-supplied `X-Forwarded-
	 * For`-style header.
	 *
	 * @return string Real IP, or '0.0.0.0' if genuinely unavailable (e.g. CLI context).
	 */
	public static function client_ip(): string {
		$valid = filter_var( self::get( 'REMOTE_ADDR' ), FILTER_VALIDATE_IP );

		return $valid ? $valid : '0.0.0.0';
	}
}
