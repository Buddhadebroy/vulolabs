<?php
/**
 * Resend mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Resend Email API.
 */
class Resend extends AbstractApiMailer {

	const ENDPOINT = 'https://api.resend.com/emails';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Resend', 'vulomail' ),
			'desc'   => __( 'Resend transactional email API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'API key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'A sending-only key is enough. <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer">Create one in Resend</a>.', 'vulomail' ),
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

		$format = static function ( array $address ) {
			return '' !== $address['name'] ? sprintf( '%s <%s>', $address['name'], $address['email'] ) : $address['email'];
		};

		$map = static function ( array $addresses ) use ( $format ) {
			return array_map( $format, $addresses );
		};

		$payload = array(
			'from'    => $format(
				array(
					'email' => $message->from_email,
					'name'  => $message->from_name,
				)
			),
			'to'      => $map( $message->to ),
			'subject' => $message->subject,
		);

		if ( $message->is_html() ) {
			$payload['html'] = $message->body;
		} else {
			$payload['text'] = $message->body;
		}

		if ( $message->cc ) {
			$payload['cc'] = $map( $message->cc );
		}

		if ( $message->bcc ) {
			$payload['bcc'] = $map( $message->bcc );
		}

		if ( $message->reply_to ) {
			$payload['reply_to'] = $map( $message->reply_to );
		}

		if ( $message->headers ) {
			$payload['headers'] = $message->headers;
		}

		foreach ( $files as $file ) {
			$payload['attachments'][] = array(
				'filename' => $file['name'],
				'content'  => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
			);
		}

		$response = $this->http->post(
			self::ENDPOINT,
			array(
				'Authorization' => 'Bearer ' . $this->config( 'api_key' ),
				'Content-Type'  => 'application/json',
			),
			wp_json_encode( $payload )
		);

		if ( is_wp_error( $response ) || $response['code'] >= 300 ) {
			$detail = is_wp_error( $response ) ? '' : (string) ( $response['json']['message'] ?? '' );

			return $this->failure( $response, $detail );
		}

		return Result::ok( (string) ( $response['json']['id'] ?? '' ) );
	}
}
