<?php
/**
 * ZeptoMail mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Zoho ZeptoMail Email API.
 */
class ZeptoMail extends AbstractApiMailer {

	const ENDPOINT = 'https://api.zeptomail.com/v1.1/email';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'ZeptoMail', 'vulomail' ),
			'desc'   => __( 'Zoho ZeptoMail transactional email API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'Send mail token', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'Generated in your Mail Agent once a verified domain is added. <a href="https://www.zoho.com/zeptomail/help/dashboard.html" target="_blank" rel="noopener noreferrer">Find it in ZeptoMail</a>, under the Mail Agent\'s Setup Info → API tab.', 'vulomail' ),
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
					return array(
						'email_address' => array_filter(
							array(
								'address' => $address['email'],
								'name'    => $address['name'],
							)
						),
					);
				},
				$addresses
			);
		};

		$payload = array(
			'from'    => array_filter(
				array(
					'address' => $message->from_email,
					'name'    => $message->from_name,
				)
			),
			'to'      => $map( $message->to ),
			'subject' => $message->subject,
		);

		if ( $message->is_html() ) {
			$payload['htmlbody'] = $message->body;
		} else {
			$payload['textbody'] = $message->body;
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
			$payload['mime_headers'] = $message->headers;
		}

		foreach ( $files as $file ) {
			$payload['attachments'][] = array(
				'content'   => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
				'mime_type' => $file['type'],
				'name'      => $file['name'],
			);
		}

		$response = $this->http->post(
			self::ENDPOINT,
			array(
				'Authorization' => 'Zoho-enczapikey ' . $this->config( 'api_key' ),
				'Content-Type'  => 'application/json',
			),
			wp_json_encode( $payload )
		);

		if ( is_wp_error( $response ) || $response['code'] >= 300 ) {
			$detail = is_wp_error( $response ) ? '' : (string) ( $response['json']['error']['details'][0]['message'] ?? $response['json']['message'] ?? '' );

			return $this->failure( $response, $detail );
		}

		return Result::ok( (string) ( $response['json']['data'][0]['additional_info']['request_id'] ?? '' ) );
	}
}
