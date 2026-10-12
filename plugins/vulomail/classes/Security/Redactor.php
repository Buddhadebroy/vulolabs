<?php
/**
 * Redactor class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Security;

defined( 'ABSPATH' ) || exit;

/**
 * Strips credentials and personal data out of text before it is logged or shown.
 */
class Redactor {

	/**
	 * Removes anything that looks like a credential from a provider error message.
	 *
	 * @param string   $text    Raw text (a provider response, an SMTP transcript line...).
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

		// Authorization headers, and key/token/password pairs in query strings or JSON.
		$text = preg_replace( '/(authorization\s*[:=]\s*)(basic|bearer)?\s*[A-Za-z0-9+\/=._\-]{8,}/i', '$1[redacted]', $text );
		$text = preg_replace( '/((?:api[_-]?key|api[_-]?secret|auth[_-]?token|access[_-]?token|password|passwd|secret)["\']?\s*[:=]\s*["\']?)[^\s"\'&,}]{4,}/i', '$1[redacted]', $text );

		return trim( wp_strip_all_tags( (string) $text ) );
	}

	/**
	 * Masks an email address: `jane.doe@example.com` becomes `j•••@example.com`.
	 *
	 * @param string $email Address.
	 * @return string
	 */
	public static function mask_email( $email ) {
		$email = (string) $email;
		$at    = strrpos( $email, '@' );

		if ( false === $at || 0 === $at ) {
			return $email;
		}

		return substr( $email, 0, 1 ) . '•••' . substr( $email, $at );
	}

	/**
	 * Masks a phone number, keeping the last three digits.
	 *
	 * @param string $phone Number.
	 * @return string
	 */
	public static function mask_phone( $phone ) {
		$phone = (string) $phone;

		if ( strlen( $phone ) <= 3 ) {
			return $phone;
		}

		return str_repeat( '•', strlen( $phone ) - 3 ) . substr( $phone, -3 );
	}
}
