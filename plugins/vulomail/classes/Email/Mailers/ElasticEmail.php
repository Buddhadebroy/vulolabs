<?php
/**
 * ElasticEmail mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Elastic Email transactional API v4.
 */
class ElasticEmail extends AbstractApiMailer {

	const ENDPOINT = 'https://api.elasticemail.com/v4/emails/transactional';

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Elastic Email', 'vulomail' ),
			'desc'   => __( 'Elastic Email transactional API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'API key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( '<a href="https://elasticemail.com/account#/settings/new/manage-api" target="_blank" rel="noopener noreferrer">Create one in Elastic Email</a>, under Settings → API.', 'vulomail' ),
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
					return '' !== $address['name'] ? sprintf( '%s <%s>', $address['name'], $address['email'] ) : $address['email'];
				},
				$addresses
			);
		};

		$content = array(
			'Subject' => $message->subject,
			'From'    => '' !== $message->from_name ? sprintf( '%s <%s>', $message->from_name, $message->from_email ) : $message->from_email,
			'Body'    => array(
				array(
					'ContentType' => $message->is_html() ? 'HTML' : 'PlainText',
					'Content'     => $message->body,
				),
			),
		);

		if ( $message->reply_to ) {
			$content['ReplyTo'] = $map( $message->reply_to )[0];
		}

		$payload = array(
			'Recipients' => array( 'To' => $map( $message->to ) ),
			'Content'    => $content,
		);

		if ( $message->cc ) {
			$payload['Recipients']['CC'] = $map( $message->cc );
		}

		if ( $message->bcc ) {
			$payload['Recipients']['BCC'] = $map( $message->bcc );
		}

		if ( $message->headers ) {
			$payload['Content']['Headers'] = $message->headers;
		}

		foreach ( $files as $file ) {
			$payload['Content']['Attachments'][] = array(
				'BinaryContent' => base64_encode( $file['content'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- required attachment encoding.
				'Name'          => $file['name'],
				'ContentType'   => $file['type'],
			);
		}

		$response = $this->http->post(
			self::ENDPOINT,
			array(
				'X-ElasticEmail-ApiKey' => $this->config( 'api_key' ),
				'Content-Type'          => 'application/json',
			),
			wp_json_encode( $payload )
		);

		if ( is_wp_error( $response ) || $response['code'] >= 300 ) {
			$detail = is_wp_error( $response ) ? '' : (string) ( $response['json']['Error'] ?? '' );

			return $this->failure( $response, $detail );
		}

		return Result::ok( (string) ( $response['json']['TransactionID'] ?? '' ) );
	}
}
