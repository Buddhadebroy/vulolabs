<?php
/**
 * Spam class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Security;

use VuloForm\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Spam and abuse checks. A honeypot, a minimum fill time and a per-visitor rate limit need no
 * external service; Google reCAPTCHA is an optional extra a form can switch on (see Recaptcha).
 */
class Spam {

	/**
	 * Name of the hidden field a person never fills in.
	 */
	const HONEYPOT = 'vf_website';

	/**
	 * Decides what to do with a submission before it is validated.
	 *
	 * @param array $form Form (id, schema).
	 * @param array $post Request fields.
	 * @return array{verdict: string, message: string} verdict is ok, spam (accept silently, store as
	 *                                                 spam) or reject (tell the visitor).
	 */
	public static function check( array $form, array $post ) {
		$spam = Utill::settings();
		$age  = Token::age( (string) ( $post['vf_token'] ?? '' ), $form['id'] );

		if ( false === $age ) {
			return self::verdict( 'reject', __( 'This form has expired. Please reload the page and try again.', 'vuloform' ) );
		}

		if ( self::is_rate_limited( $form['id'] ) ) {
			return self::verdict( 'reject', __( 'You are sending messages too quickly. Please wait a minute and try again.', 'vuloform' ) );
		}

		// A bot that fills the honeypot is told it succeeded, so it learns nothing.
		if ( ! empty( $spam['honeypot'] ) && '' !== trim( (string) ( $post[ self::HONEYPOT ] ?? '' ) ) ) {
			return self::verdict( 'spam' );
		}

		if ( $age < (int) $spam['min_seconds'] ) {
			return self::verdict( 'spam' );
		}

		// Last, so Google is only asked about submissions the free checks have let through.
		if ( Recaptcha::is_active( $form ) ) {
			$recaptcha = Recaptcha::check( $post );

			if ( 'ok' !== $recaptcha['verdict'] ) {
				return $recaptcha;
			}
		}

		/**
		 * Filters the spam verdict, for anti-spam integrations.
		 *
		 * @param array $verdict `verdict` (ok|spam|reject) and `message`.
		 * @param array $form    Form.
		 * @param array $post    Request fields.
		 */
		$verdict = apply_filters( 'vuloform_spam_check', self::verdict( 'ok' ), $form, $post );

		return is_array( $verdict ) && isset( $verdict['verdict'] ) ? $verdict : self::verdict( 'ok' );
	}

	/**
	 * Counts this request against the visitor's allowance for the form.
	 *
	 * @param int $form_id Form id.
	 * @return bool Whether the visitor is over the limit.
	 */
	public static function is_rate_limited( $form_id ) {
		$limit = (int) Utill::settings()['rate_limit'];

		if ( $limit <= 0 ) {
			return false;
		}

		$key    = 'vuloform_rl_' . md5( (int) $form_id . '|' . self::visitor_hash() );
		$window = get_transient( $key );
		$now    = time();

		// A fixed one-minute window: the count starts over when the window that opened it ends.
		if ( ! is_array( $window ) || $window['until'] <= $now ) {
			$window = array(
				'count' => 0,
				'until' => $now + MINUTE_IN_SECONDS,
			);
		}

		if ( $window['count'] >= $limit ) {
			return true;
		}

		++$window['count'];
		set_transient( $key, $window, $window['until'] - $now );

		return false;
	}

	/**
	 * A one-way fingerprint of the visitor's address, so the rate limit never stores the address itself.
	 *
	 * @return string
	 */
	public static function visitor_hash() {
		return hash_hmac( 'sha256', self::ip(), Utill::secret() );
	}

	/**
	 * The address the request came from. Forwarding headers are ignored: they are set by the client
	 * and would let anyone dodge the rate limit.
	 *
	 * @return string
	 */
	public static function ip() {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';

		return filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : '';
	}

	/**
	 * @param string $verdict ok, spam or reject.
	 * @param string $message Message for the visitor (reject only).
	 * @return array
	 */
	private static function verdict( $verdict, $message = '' ) {
		return array(
			'verdict' => $verdict,
			'message' => $message,
		);
	}
}
