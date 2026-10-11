<?php
/**
 * Redactor class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Security;

defined( 'ABSPATH' ) || exit;

/**
 * Strips credentials and server paths out of text before it is logged or shown.
 */
class Redactor {

	/**
	 * Removes anything that looks like a credential, and shortens absolute paths to ones relative to
	 * the WordPress folder.
	 *
	 * @param string   $text    Raw text (a provider response, a PHP error...).
	 * @param string[] $secrets Known secret values to remove verbatim.
	 * @return string
	 */
	public static function scrub( $text, array $secrets = array() ) {
		$text = (string) $text;

		foreach ( $secrets as $secret ) {
			$secret = (string) $secret;

			if ( strlen( $secret ) >= 4 ) {
				$text = str_replace( $secret, '[redacted]', $text );
			}
		}

		// Authorization headers, signatures, and key/token/password pairs in query strings, XML or JSON.
		$text = preg_replace( '/(authorization\s*[:=]\s*)(?:(?:basic|bearer|aws4-hmac-sha256)\s+)?[^\s,]{4,}/i', '$1[redacted]', $text );
		$text = preg_replace( '/((?:x-amz-signature|x-amz-credential|signature|credential)=)[^\s&"\']{4,}/i', '$1[redacted]', $text );
		$text = preg_replace( '/((?:api[_-]?key|api[_-]?secret|secret[_-]?key|access[_-]?key|auth[_-]?token|access[_-]?token|password|passwd|passphrase|private[_-]?key|secret)["\']?\s*[:=]\s*["\']?)[^\s"\'&,}<]{4,}/i', '$1[redacted]', $text );
		$text = preg_replace( '/-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----/s', '[redacted private key]', $text );

		return trim( self::relative_paths( wp_strip_all_tags( (string) $text ) ) );
	}

	/**
	 * Replaces the server's absolute WordPress paths with short labels, so a log line does not
	 * reveal where the site lives on disk.
	 *
	 * @param string $text Text that may contain paths.
	 * @return string
	 */
	public static function relative_paths( $text ) {
		$roots = array();

		if ( defined( 'WP_CONTENT_DIR' ) ) {
			$roots[ wp_normalize_path( WP_CONTENT_DIR ) ] = 'wp-content';
		}

		if ( defined( 'ABSPATH' ) ) {
			$roots[ untrailingslashit( wp_normalize_path( ABSPATH ) ) ] = '[site]';
		}

		foreach ( $roots as $root => $label ) {
			if ( strlen( $root ) > 1 ) {
				$text = str_replace( $root, $label, (string) $text );
			}
		}

		return (string) $text;
	}
}
