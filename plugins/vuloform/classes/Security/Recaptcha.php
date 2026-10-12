<?php
/**
 * Recaptcha class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Security;

use VuloForm\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Optional Google reCAPTCHA check (v2 checkbox or v3 score).
 *
 * The keys are set once under VuloForm → Settings; each form switches the check on for itself.
 * Nothing is loaded from Google for a form that does not use it.
 */
class Recaptcha {

	/**
	 * Google's token verification endpoint.
	 */
	const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

	/**
	 * Request field the token arrives in. Google's v2 widget names it itself.
	 */
	const FIELD = 'g-recaptcha-response';

	/**
	 * Action name sent with a v3 token and checked when it comes back.
	 */
	const ACTION = 'vuloform_submit';

	/**
	 * Whether both keys are saved.
	 *
	 * @return bool
	 */
	public static function is_configured() {
		$settings = Utill::settings();

		return '' !== (string) $settings['recaptcha_site_key'] && '' !== (string) $settings['recaptcha_secret_key'];
	}

	/**
	 * Whether a form's submissions are checked.
	 *
	 * @param array $form Form (schema).
	 * @return bool
	 */
	public static function is_active( array $form ) {
		return ! empty( $form['schema']['settings']['spam']['recaptcha'] ) && self::is_configured();
	}

	/**
	 * What the form's script needs to show the check. The secret key is never part of it.
	 *
	 * @return array{type: string, sitekey: string, action: string, messages: array<string, string>}
	 */
	public static function client_config() {
		$settings = Utill::settings();

		return array(
			'type'     => 'v3' === $settings['recaptcha_type'] ? 'v3' : 'v2',
			'sitekey'  => (string) $settings['recaptcha_site_key'],
			'action'   => self::ACTION,
			'messages' => array(
				'missing'     => __( 'Please tick "I\'m not a robot" before sending.', 'vuloform' ),
				'unavailable' => __( 'The spam check could not load. Turn off any content blocker for this page, reload it and try again.', 'vuloform' ),
			),
		);
	}

	/**
	 * Verifies the token sent with a submission.
	 *
	 * @param array $post Request fields.
	 * @return array{verdict: string, message: string} verdict is ok, spam or reject.
	 */
	public static function check( array $post ) {
		$settings = Utill::settings();
		$token    = trim( (string) ( $post[ self::FIELD ] ?? '' ) );

		if ( '' === $token ) {
			return self::verdict( 'reject', __( 'Please complete the "I\'m not a robot" check and send the form again. It needs JavaScript to be switched on.', 'vuloform' ) );
		}

		// The visitor's IP address is optional for Google and is deliberately not sent.
		$response = wp_remote_post(
			self::VERIFY_URL,
			array(
				'timeout' => 8,
				'body'    => array(
					'secret'   => (string) $settings['recaptcha_secret_key'],
					'response' => $token,
				),
			)
		);

		$body = is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response )
			? null
			: json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( ! is_array( $body ) ) {
			/**
			 * Filters what happens when Google cannot be reached to verify a token. By default the
			 * submission is let through, so an outage at Google does not close every form; the
			 * trap field, minimum fill time and rate limit still apply.
			 *
			 * @param bool $accept Whether to accept the submission.
			 */
			return apply_filters( 'vuloform_recaptcha_fail_open', true )
				? self::verdict( 'ok' )
				: self::verdict( 'reject', __( 'The spam check is unavailable right now. Please try again in a moment.', 'vuloform' ) );
		}

		$outcome = self::judge( $body, (string) $settings['recaptcha_type'], (float) $settings['recaptcha_score'] );

		if ( 'failed' === $outcome ) {
			return self::verdict( 'reject', __( 'The "I\'m not a robot" check did not pass or has expired. Please try again.', 'vuloform' ) );
		}

		// A low v3 score is filed as spam without telling the sender, like the trap field.
		return self::verdict( $outcome );
	}

	/**
	 * Reads Google's answer.
	 *
	 * @param array  $body      Decoded siteverify response.
	 * @param string $type      v2 or v3.
	 * @param float  $threshold Lowest v3 score treated as a person.
	 * @return string ok, spam or failed.
	 */
	public static function judge( array $body, $type, $threshold ) {
		if ( empty( $body['success'] ) ) {
			return 'failed';
		}

		if ( 'v3' !== $type ) {
			return 'ok';
		}

		// A token minted for some other action on the site is not proof for this form.
		if ( self::ACTION !== ( $body['action'] ?? '' ) ) {
			return 'failed';
		}

		return (float) ( $body['score'] ?? 0 ) < $threshold ? 'spam' : 'ok';
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
