<?php
/**
 * SocketLabs mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * SocketLabs Injection API.
 */
class SocketLabs extends AbstractApiMailer {

	const ENDPOINT = 'https://inject.socketlabs.com/api/v1/email/send';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'SocketLabs', 'vulomail' ),
			'desc'   => __( 'SocketLabs Injection API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'server_id',
					'label'    => __( 'Server ID', 'vulomail' ),
					'type'     => 'text',
					'required' => true,
					'help'     => __( 'The 4 or 5 digit number shown on your server dashboard. <a href="https://cp.socketlabs.com/login" target="_blank" rel="noopener noreferrer">Log in to SocketLabs</a>.', 'vulomail' ),
				),
				array(
					'key'      => 'api_key',
					'label'    => __( 'API key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'Under Configuration → Key Manager.', 'vulomail' ),
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
							'emailAddress' => $address['email'],
							'friendlyName' => $address['name'],
						)
					);
				},
				$addresses
			);
		};

		$content = array();

		if ( $message->is_html() ) {
			$content[] = array(
				'contentType' => 'Html',
				'charSet'     => $message->charset,
				'content'     => $message->body,
			);
		} else {
			$content[] = array(
				'contentType' => 'PlainText',
				'charSet'     => $message->charset,
				'content'     => $message->body,
			);
		}

		$payload = array(
			'serverId' => (int) $this->config( 'server_id' ),
			'apiKey'   => $this->config( 'api_key' ),
			'messages' => array(
				array_filter(
					array(
						'from'    => array_filter(
							array(
								'emailAddress' => $message->from_email,
								'friendlyName' => $message->from_name,
							)
						),
						'subject' => $message->subject,
						'to'      => $map( $message->to ),
						'cc'      => $map( $message->cc ),
						'bcc'     => $map( $message->bcc ),
						'replyTo' => $message->reply_to ? $map( $message->reply_to )[0] : null,
						'content' => $content,
					)
				),
			),
		);

		if ( $message->headers ) {
			foreach ( $message->headers as $name => $value ) {
				$payload['messages'][0]['customHeaders'][] = array(
					'name'  => $name,
					'value' => $value,
				);
			}
		}

		foreach ( $files as $file ) {
			$payload['messages'][0]['attachments'][] = array(
				'name'        => $file['name'],
				'content'     => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
				'contentType' => $file['type'],
			);
		}

		$response = $this->http->post(
			self::ENDPOINT,
			array( 'Content-Type' => 'application/json' ),
			wp_json_encode( $payload )
		);

		if ( is_wp_error( $response ) || 200 !== $response['code'] || 'Success' !== ( $response['json']['ErrorCode'] ?? '' ) ) {
			$detail = is_wp_error( $response ) ? '' : (string) ( $response['json']['ErrorCode'] ?? '' );

			return $this->failure( $response, $detail );
		}

		return Result::ok( (string) ( $response['json']['TransactionReceipt'] ?? '' ) );
	}
}
