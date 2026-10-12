<?php
/**
 * Mandrill mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Mandrill (Mailchimp Transactional) API.
 */
class Mandrill extends AbstractApiMailer {

	const ENDPOINT = 'https://mandrillapp.com/api/1.4/messages/send.json';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Mandrill', 'vulomail' ),
			'desc'   => __( 'Mandrill (Mailchimp Transactional) API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'API key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'Requires a paid Mailchimp plan with Transactional Email enabled. <a href="https://mandrillapp.com/settings" target="_blank" rel="noopener noreferrer">Create one in Mandrill</a>, under SMTP & API Info.', 'vulomail' ),
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

		$map = static function ( array $addresses, $type ) {
			return array_map(
				static function ( $address ) use ( $type ) {
					return array_filter(
						array(
							'email' => $address['email'],
							'name'  => $address['name'],
							'type'  => $type,
						)
					);
				},
				$addresses
			);
		};

		$to = array_merge(
			$map( $message->to, 'to' ),
			$map( $message->cc, 'cc' ),
			$map( $message->bcc, 'bcc' )
		);

		$msg = array(
			'subject'    => $message->subject,
			'from_email' => $message->from_email,
			'from_name'  => $message->from_name,
			'to'         => $to,
		);

		if ( $message->is_html() ) {
			$msg['html'] = $message->body;
		} else {
			$msg['text'] = $message->body;
		}

		if ( $message->reply_to ) {
			$msg['headers']['Reply-To'] = $message->reply_to[0]['email'];
		}

		foreach ( $message->headers as $name => $value ) {
			$msg['headers'][ $name ] = $value;
		}

		foreach ( $files as $file ) {
			$msg['attachments'][] = array(
				'type'    => $file['type'],
				'name'    => $file['name'],
				'content' => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
			);
		}

		$response = $this->http->post(
			self::ENDPOINT,
			array( 'Content-Type' => 'application/json' ),
			wp_json_encode(
				array(
					'key'     => $this->config( 'api_key' ),
					'message' => $msg,
				)
			)
		);

		if ( is_wp_error( $response ) || 200 !== $response['code'] ) {
			$detail = is_wp_error( $response ) ? '' : (string) ( $response['json']['message'] ?? '' );

			return $this->failure( $response, $detail );
		}

		$first = $response['json'][0] ?? array();

		if ( ! empty( $first['status'] ) && in_array( $first['status'], array( 'rejected', 'invalid' ), true ) ) {
			return Result::fail( (string) $first['status'], (string) ( $first['reject_reason'] ?? $first['status'] ) );
		}

		return Result::ok( (string) ( $first['_id'] ?? '' ) );
	}
}
