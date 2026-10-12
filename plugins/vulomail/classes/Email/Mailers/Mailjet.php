<?php
/**
 * Mailjet mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Mailjet Send API v3.1.
 */
class Mailjet extends AbstractApiMailer {

	const ENDPOINT = 'https://api.mailjet.com/v3.1/send';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Mailjet', 'vulomail' ),
			'desc'   => __( 'Mailjet transactional email API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'API key', 'vulomail' ),
					'type'     => 'text',
					'required' => true,
					'help'     => __( '<a href="https://app.mailjet.com/account/apikeys" target="_blank" rel="noopener noreferrer">Find both keys in Mailjet</a>, under Account Settings → API Key Management.', 'vulomail' ),
				),
				array(
					'key'      => 'secret_key',
					'label'    => __( 'Secret key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
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
							'Email' => $address['email'],
							'Name'  => $address['name'],
						)
					);
				},
				$addresses
			);
		};

		$email = array(
			'From'    => array_filter(
				array(
					'Email' => $message->from_email,
					'Name'  => $message->from_name,
				)
			),
			'To'      => $map( $message->to ),
			'Subject' => $message->subject,
		);

		if ( $message->is_html() ) {
			$email['HTMLPart'] = $message->body;
		} else {
			$email['TextPart'] = $message->body;
		}

		if ( $message->cc ) {
			$email['Cc'] = $map( $message->cc );
		}

		if ( $message->bcc ) {
			$email['Bcc'] = $map( $message->bcc );
		}

		if ( $message->reply_to ) {
			$reply_to         = $message->reply_to[0];
			$email['ReplyTo'] = array_filter(
				array(
					'Email' => $reply_to['email'],
					'Name'  => $reply_to['name'],
				)
			);
		}

		if ( $message->headers ) {
			$email['Headers'] = $message->headers;
		}

		foreach ( $files as $file ) {
			$email['Attachments'][] = array(
				'ContentType'   => $file['type'],
				'Filename'      => $file['name'],
				'Base64Content' => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
			);
		}

		$response = $this->http->post(
			self::ENDPOINT,
			array(
				'Authorization' => 'Basic ' . base64_encode( $this->config( 'api_key' ) . ':' . $this->config( 'secret_key' ) ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- HTTP Basic auth, not obfuscation.
				'Content-Type'  => 'application/json',
			),
			wp_json_encode( array( 'Messages' => array( $email ) ) )
		);

		if ( is_wp_error( $response ) || 200 !== $response['code'] ) {
			$detail = is_wp_error( $response ) ? '' : (string) ( $response['json']['Messages'][0]['Errors'][0]['ErrorMessage'] ?? '' );

			return $this->failure( $response, $detail );
		}

		return Result::ok( (string) ( $response['json']['Messages'][0]['To'][0]['MessageID'] ?? '' ) );
	}
}
