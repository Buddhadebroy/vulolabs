<?php
/**
 * Sweego mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Sweego Email API.
 */
class Sweego extends AbstractApiMailer {

	const ENDPOINT = 'https://api.sweego.io/send';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Sweego', 'vulomail' ),
			'desc'   => __( 'Sweego email and SMS API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'API key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'From the Email section of your dashboard. Shown only once. <a href="https://app.sweego.io" target="_blank" rel="noopener noreferrer">Open Sweego</a>.', 'vulomail' ),
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
					return array_filter(
						array(
							'email' => $address['email'],
							'name'  => $address['name'],
						)
					);
				},
				$addresses
			);
		};

		$payload = array(
			'channel'    => 'email',
			'from'       => array_filter(
				array(
					'email' => $message->from_email,
					'name'  => $message->from_name,
				)
			),
			'recipients' => $map( $message->to ),
			'subject'    => $message->subject,
		);

		if ( $message->is_html() ) {
			$payload['message-html'] = $message->body;
		} else {
			$payload['message-txt'] = $message->body;
		}

		if ( $message->cc ) {
			$payload['cc'] = $map( $message->cc );
		}

		if ( $message->bcc ) {
			$payload['bcc'] = $map( $message->bcc );
		}

		if ( $message->reply_to ) {
			$payload['reply-to'] = $message->reply_to[0]['email'];
		}

		if ( $message->headers ) {
			$payload['headers'] = $message->headers;
		}

		foreach ( $files as $file ) {
			$payload['attachments'][] = array(
				'filename' => $file['name'],
				'content'  => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
				'type'     => $file['type'],
			);
		}

		$response = $this->http->post(
			self::ENDPOINT,
			array(
				'Api-Key'      => $this->config( 'api_key' ),
				'Content-Type' => 'application/json',
			),
			wp_json_encode( $payload )
		);

		if ( is_wp_error( $response ) || $response['code'] >= 300 ) {
			$detail = is_wp_error( $response ) ? '' : (string) ( $response['json']['message'] ?? '' );

			return $this->failure( $response, $detail );
		}

		return Result::ok( (string) ( $response['json']['message-id'] ?? $response['json']['id'] ?? '' ) );
	}
}
