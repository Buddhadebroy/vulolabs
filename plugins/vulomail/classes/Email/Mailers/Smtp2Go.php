<?php
/**
 * Smtp2Go mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * SMTP2GO Email API v3.
 */
class Smtp2Go extends AbstractApiMailer {

	const ENDPOINT = 'https://api.smtp2go.com/v3/email/send';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'SMTP2GO', 'vulomail' ),
			'desc'   => __( 'SMTP2GO transactional email API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'API key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'Make sure Email Send is enabled for the key. <a href="https://app.smtp2go.com" target="_blank" rel="noopener noreferrer">Create one in SMTP2GO</a>, under Sending → API Keys.', 'vulomail' ),
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

		$payload = array(
			'sender'  => $format(
				array(
					'email' => $message->from_email,
					'name'  => $message->from_name,
				)
			),
			'to'      => array_map( $format, $message->to ),
			'subject' => $message->subject,
		);

		if ( $message->is_html() ) {
			$payload['html_body'] = $message->body;
		} else {
			$payload['text_body'] = $message->body;
		}

		if ( $message->cc ) {
			$payload['cc'] = array_map( $format, $message->cc );
		}

		if ( $message->bcc ) {
			$payload['bcc'] = array_map( $format, $message->bcc );
		}

		$headers = $message->headers;

		if ( $message->reply_to ) {
			$headers['Reply-To'] = $message->reply_to[0]['email'];
		}

		if ( $headers ) {
			foreach ( $headers as $name => $value ) {
				$payload['custom_headers'][] = array(
					'header' => $name,
					'value'  => $value,
				);
			}
		}

		foreach ( $files as $file ) {
			$payload['attachments'][] = array(
				'filename' => $file['name'],
				'fileblob' => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
				'mimetype' => $file['type'],
			);
		}

		$response = $this->http->post(
			self::ENDPOINT,
			array(
				'X-Smtp2go-Api-Key' => $this->config( 'api_key' ),
				'Content-Type'      => 'application/json',
			),
			wp_json_encode( $payload )
		);

		if ( is_wp_error( $response ) || 200 !== $response['code'] ) {
			$detail = is_wp_error( $response ) ? '' : implode( ' ', (array) ( $response['json']['data']['failures'] ?? array() ) );

			return $this->failure( $response, $detail );
		}

		if ( ! empty( $response['json']['data']['failed'] ) ) {
			return Result::fail( 'rejected', implode( ' ', (array) ( $response['json']['data']['failures'] ?? array() ) ) );
		}

		return Result::ok( (string) ( $response['json']['data']['email_id'] ?? '' ) );
	}
}
