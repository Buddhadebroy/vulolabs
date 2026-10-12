<?php
/**
 * Brevo mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Brevo (formerly Sendinblue) transactional email API v3.
 */
class Brevo extends AbstractApiMailer {

	const ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Brevo', 'vulomail' ),
			'desc'   => __( 'Brevo (formerly Sendinblue) transactional email API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'API key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'A v3 API key from SMTP & API in your Brevo account. <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noopener noreferrer">Create one in Brevo</a>.', 'vulomail' ),
				),
			),
		);
	}

	/**
	 * Sends one message.
	 *
	 * @param Message $message Message to send.
	 * @return Result
	 */
	public function send( Message $message ) {
		$files = $this->read_attachments( $message );

		if ( is_wp_error( $files ) ) {
			return Result::fail( $files->get_error_code(), $files->get_error_message() );
		}

		$map = static function ( array $addresses ) {
			return array_map(
				static function ( $address ) {
					return array_filter( $address );
				},
				$addresses
			);
		};

		$payload = array(
			'sender'  => array_filter(
				array(
					'email' => $message->from_email,
					'name'  => $message->from_name,
				)
			),
			'to'      => $map( $message->to ),
			'subject' => $message->subject,
		);

		$payload[ $message->is_html() ? 'htmlContent' : 'textContent' ] = $message->body;

		if ( $message->cc ) {
			$payload['cc'] = $map( $message->cc );
		}

		if ( $message->bcc ) {
			$payload['bcc'] = $map( $message->bcc );
		}

		if ( $message->reply_to ) {
			$payload['replyTo'] = array_filter( $message->reply_to[0] );
		}

		if ( $message->headers ) {
			$payload['headers'] = $message->headers;
		}

		foreach ( $files as $file ) {
			$payload['attachment'][] = array(
				'name'    => $file['name'],
				'content' => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
			);
		}

		$response = $this->http->post(
			self::ENDPOINT,
			array(
				'api-key'      => $this->config( 'api_key' ),
				'Content-Type' => 'application/json',
				'Accept'       => 'application/json',
			),
			wp_json_encode( $payload )
		);

		if ( is_wp_error( $response ) || $response['code'] < 200 || $response['code'] >= 300 ) {
			return $this->failure( $response, is_wp_error( $response ) ? '' : (string) ( $response['json']['message'] ?? '' ) );
		}

		return Result::ok( $response['json']['messageId'] ?? '' );
	}
}
