<?php
/**
 * Netcore mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Netcore Email API v5 (formerly Pepipost).
 */
class Netcore extends AbstractApiMailer {

	const ENDPOINT = 'https://api.pepipost.com/v5/mail/send';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Netcore Email API', 'vulomail' ),
			'desc'   => __( 'Netcore (formerly Pepipost) transactional email API v5.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'API key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( '<a href="https://email.netcorecloud.com" target="_blank" rel="noopener noreferrer">Log in to Netcore</a>, then Settings → Integrations → API.', 'vulomail' ),
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

		$personalization = array( 'to' => $map( $message->to ) );

		if ( $message->cc ) {
			$personalization['cc'] = $map( $message->cc );
		}

		if ( $message->bcc ) {
			$personalization['bcc'] = $map( $message->bcc );
		}

		$payload = array(
			'from'             => array_filter(
				array(
					'email' => $message->from_email,
					'name'  => $message->from_name,
				)
			),
			'subject'          => $message->subject,
			'content'          => array(
				array(
					'type'  => $message->is_html() ? 'html' : 'plain',
					'value' => $message->body,
				),
			),
			'personalizations' => array( $personalization ),
		);

		if ( $message->reply_to ) {
			$payload['reply_to'] = $map( $message->reply_to )[0];
		}

		if ( $message->headers ) {
			$payload['headers'] = $message->headers;
		}

		foreach ( $files as $file ) {
			$payload['attachments'][] = array(
				'content'     => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
				'name'        => $file['name'],
				'type'        => $file['type'],
				'disposition' => 'attachment',
			);
		}

		$response = $this->http->post(
			self::ENDPOINT,
			array(
				'api_key'      => $this->config( 'api_key' ),
				'Content-Type' => 'application/json',
			),
			wp_json_encode( $payload )
		);

		if ( is_wp_error( $response ) || $response['code'] >= 300 ) {
			$detail = is_wp_error( $response ) ? '' : (string) ( $response['json']['errors'][0]['message'] ?? '' );

			return $this->failure( $response, $detail );
		}

		return Result::ok( (string) ( $response['json']['message_id'] ?? '' ) );
	}
}
