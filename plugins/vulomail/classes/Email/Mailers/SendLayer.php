<?php
/**
 * SendLayer mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * SendLayer Email API.
 */
class SendLayer extends AbstractApiMailer {

	const ENDPOINT = 'https://console.sendlayer.com/api/v1/email';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'SendLayer', 'vulomail' ),
			'desc'   => __( 'SendLayer transactional email API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'API key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( '<a href="https://sendlayer.com/docs/managing-api-keys/" target="_blank" rel="noopener noreferrer">Find it in SendLayer</a>, under Settings → API Keys.', 'vulomail' ),
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
			'From'    => array_filter(
				array(
					'email' => $message->from_email,
					'name'  => $message->from_name,
				)
			),
			'To'      => $map( $message->to ),
			'Subject' => $message->subject,
		);

		if ( $message->is_html() ) {
			$payload['ContentType'] = 'html';
			$payload['HTMLContent'] = $message->body;
		} else {
			$payload['ContentType']  = 'text';
			$payload['PlainContent'] = $message->body;
		}

		if ( $message->cc ) {
			$payload['CC'] = $map( $message->cc );
		}

		if ( $message->bcc ) {
			$payload['BCC'] = $map( $message->bcc );
		}

		if ( $message->reply_to ) {
			$payload['ReplyTo'] = $map( $message->reply_to )[0];
		}

		if ( $message->headers ) {
			$payload['Headers'] = $message->headers;
		}

		foreach ( $files as $file ) {
			$payload['Attachments'][] = array(
				'content'  => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
				'filename' => $file['name'],
				'type'     => $file['type'],
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
			$detail = is_wp_error( $response ) ? '' : (string) ( $response['json']['Errors'][0]['message'] ?? $response['json']['message'] ?? '' );

			return $this->failure( $response, $detail );
		}

		return Result::ok( (string) ( $response['json']['MessageID'] ?? '' ) );
	}
}
