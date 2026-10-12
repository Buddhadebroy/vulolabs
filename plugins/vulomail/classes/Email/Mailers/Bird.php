<?php
/**
 * Bird mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Bird (formerly MessageBird) Email API.
 */
class Bird extends AbstractApiMailer {

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Bird', 'vulomail' ),
			'desc'   => __( 'Bird (formerly MessageBird) email API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'Access key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( '<a href="https://bird.com/dashboard/w/api-keys" target="_blank" rel="noopener noreferrer">Create one in Bird</a>, under Developers → API keys.', 'vulomail' ),
				),
				array(
					'key'     => 'region',
					'label'   => __( 'Workspace region', 'vulomail' ),
					'type'    => 'text',
					'default' => 'us1',
					'help'    => __( 'The region prefix shown with your access key, for example us1 or eu1.', 'vulomail' ),
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
							'email'       => $address['email'],
							'displayName' => $address['name'],
						)
					);
				},
				$addresses
			);
		};

		$body = array();

		if ( $message->is_html() ) {
			$body['type']    = 'html';
			$body['content'] = $message->body;
		} else {
			$body['type']    = 'text';
			$body['content'] = $message->body;
		}

		$payload = array(
			'sender'   => array_filter(
				array(
					'email'       => $message->from_email,
					'displayName' => $message->from_name,
				)
			),
			'receiver' => array( 'contacts' => $map( $message->to ) ),
			'subject'  => $message->subject,
			'body'     => $body,
		);

		if ( $message->reply_to ) {
			$payload['replyTo'] = $message->reply_to[0]['email'];
		}

		if ( $message->cc ) {
			$payload['receiver']['cc'] = $map( $message->cc );
		}

		if ( $message->bcc ) {
			$payload['receiver']['bcc'] = $map( $message->bcc );
		}

		if ( $message->headers ) {
			$payload['headers'] = $message->headers;
		}

		foreach ( $files as $file ) {
			$payload['attachments'][] = array(
				'filename' => $file['name'],
				'content'  => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
				'mimeType' => $file['type'],
			);
		}

		$region   = preg_match( '/^[a-z0-9]+$/', (string) $this->config( 'region' ) ) ? $this->config( 'region' ) : 'us1';
		$response = $this->http->post(
			"https://{$region}.api.bird.com/v1/email/messages",
			array(
				'Authorization'   => 'Bearer ' . $this->config( 'api_key' ),
				'Content-Type'    => 'application/json',
				'Idempotency-Key' => wp_generate_uuid4(),
			),
			wp_json_encode( $payload )
		);

		if ( is_wp_error( $response ) || $response['code'] >= 300 ) {
			$detail = is_wp_error( $response ) ? '' : (string) ( $response['json']['errors'][0]['message'] ?? $response['json']['message'] ?? '' );

			return $this->failure( $response, $detail );
		}

		return Result::ok( (string) ( $response['json']['id'] ?? '' ) );
	}
}
