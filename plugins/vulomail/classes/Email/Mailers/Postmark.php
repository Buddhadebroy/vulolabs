<?php
/**
 * Postmark mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Postmark Email API.
 */
class Postmark extends AbstractApiMailer {

	const ENDPOINT = 'https://api.postmarkapp.com/email';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Postmark', 'vulomail' ),
			'desc'   => __( 'Postmark transactional email API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'server_token',
					'label'    => __( 'Server API token', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( '<a href="https://account.postmarkapp.com/servers" target="_blank" rel="noopener noreferrer">Open your server in Postmark</a>, then its API Tokens tab.', 'vulomail' ),
				),
				array(
					'key'     => 'message_stream',
					'label'   => __( 'Message stream', 'vulomail' ),
					'type'    => 'text',
					'default' => 'outbound',
					'help'    => __( 'The stream ID to send through. "outbound" is the default transactional stream.', 'vulomail' ),
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

		$payload = array(
			'From'    => Message::format(
				array(
					'email' => $message->from_email,
					'name'  => $message->from_name,
				)
			),
			'To'      => Message::format_list( $message->to ),
			'Subject' => $message->subject,
		);

		$payload[ $message->is_html() ? 'HtmlBody' : 'TextBody' ] = $message->body;

		if ( $message->cc ) {
			$payload['Cc'] = Message::format_list( $message->cc );
		}

		if ( $message->bcc ) {
			$payload['Bcc'] = Message::format_list( $message->bcc );
		}

		if ( $message->reply_to ) {
			$payload['ReplyTo'] = Message::format_list( $message->reply_to );
		}

		if ( '' !== $this->config( 'message_stream' ) ) {
			$payload['MessageStream'] = $this->config( 'message_stream' );
		}

		foreach ( $message->headers as $name => $value ) {
			$payload['Headers'][] = array(
				'Name'  => $name,
				'Value' => $value,
			);
		}

		foreach ( $files as $file ) {
			$payload['Attachments'][] = array(
				'Name'        => $file['name'],
				'Content'     => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
				'ContentType' => $file['type'],
			);
		}

		$response = $this->http->post(
			self::ENDPOINT,
			array(
				'X-Postmark-Server-Token' => $this->config( 'server_token' ),
				'Content-Type'            => 'application/json',
				'Accept'                  => 'application/json',
			),
			wp_json_encode( $payload )
		);

		// Postmark reports some failures as HTTP 200 with a non-zero ErrorCode.
		if ( is_wp_error( $response ) || 200 !== $response['code'] || 0 !== (int) ( $response['json']['ErrorCode'] ?? 0 ) ) {
			return $this->failure( $response, is_wp_error( $response ) ? '' : (string) ( $response['json']['Message'] ?? '' ) );
		}

		return Result::ok( $response['json']['MessageID'] ?? '' );
	}
}
