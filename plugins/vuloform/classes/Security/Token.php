<?php
/**
 * Token class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Security;

use VuloForm\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Signed, time-stamped form tokens.
 *
 * A WordPress nonce is tied to a logged-in session and breaks on cached pages and on forms embedded
 * in another site, so public forms use this instead: proof that the form was really loaded from
 * this site, and when. The "when" is what the time-based spam check reads.
 */
class Token {

	/**
	 * How long a token stays valid.
	 */
	const LIFETIME = DAY_IN_SECONDS;

	/**
	 * @param int      $form_id Form id.
	 * @param int|null $now     Issue time; defaults to now.
	 * @return string
	 */
	public static function issue( $form_id, $now = null ) {
		$time = null === $now ? time() : (int) $now;

		return $time . '.' . self::sign( $form_id, $time );
	}

	/**
	 * @param string $token   Token from the request.
	 * @param int    $form_id Form id it must belong to.
	 * @return int|false Seconds since the token was issued, or false when it is invalid or expired.
	 */
	public static function age( $token, $form_id ) {
		$parts = explode( '.', (string) $token, 2 );

		if ( 2 !== count( $parts ) || ! ctype_digit( $parts[0] ) || ! hash_equals( self::sign( $form_id, (int) $parts[0] ), $parts[1] ) ) {
			return false;
		}

		$age = time() - (int) $parts[0];

		return $age >= 0 && $age <= self::LIFETIME ? $age : false;
	}

	/**
	 * @param int $form_id Form id.
	 * @param int $time    Issue time.
	 * @return string
	 */
	private static function sign( $form_id, $time ) {
		return hash_hmac( 'sha256', (int) $form_id . '|' . (int) $time, Utill::secret() );
	}
}
