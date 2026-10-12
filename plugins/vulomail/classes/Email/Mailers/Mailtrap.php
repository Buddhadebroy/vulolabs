<?php
/**
 * Mailtrap mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Mailtrap Email Sending API.
 */
class Mailtrap extends AbstractApiMailer {

	const ENDPOINT = 'https://send.api.mailtrap.io/api/send';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Mailtrap', 'vulomail' ),
			'desc'   => __( 'Mailtrap transactional Email Sending API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'API token', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'Needs admin permission on the sending domain. <a href="https://mailtrap.io/api-tokens" target="_blank" rel="noopener noreferrer">Create one in Mailtrap</a>, under Settings → API Tokens.', 'vulomail' ),
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
			'from'    => array_filter(
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
			$payload['reply_to'] = $map( $message->reply_to )[0];
		}

		if ( $message->headers ) {
			$payload['headers'] = $message->headers;
		}

		foreach ( $files as $file ) {
			$payload['attachments'][] = array(
				'filename'    => $file['name'],
				'content'     => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
				'type'        => $file['type'],
				'disposition' => 'attachment',
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

		if ( is_wp_error( $response ) || 200 !== $response['code'] ) {
			$detail = is_wp_error( $response ) ? '' : implode( ' ', (array) ( $response['json']['errors'] ?? array() ) );

			return $this->failure( $response, $detail );
		}

		return Result::ok( (string) ( $response['json']['message_ids'][0] ?? '' ) );
	}
}
