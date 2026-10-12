<?php
/**
 * Mailgun mailer class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Email\Mailers;

use VuloMail\Delivery\Result;
use VuloMail\Email\AbstractApiMailer;
use VuloMail\Email\Message;

defined( 'ABSPATH' ) || exit;

/**
 * Mailgun Messages API (US and EU regions).
 */
class Mailgun extends AbstractApiMailer {

	const ENDPOINTS = array(
		'us' => 'https://api.mailgun.net/v3/',
		'eu' => 'https://api.eu.mailgun.net/v3/',
	);

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return array(
			'label'  => __( 'Mailgun', 'vulomail' ),
			'desc'   => __( 'Mailgun transactional email API.', 'vulomail' ),
			'fields' => array(
				array(
					'key'      => 'api_key',
					'label'    => __( 'API key', 'vulomail' ),
					'type'     => 'password',
					'secret'   => true,
					'required' => true,
					'help'     => __( 'A sending key for your domain is enough. <a href="https://app.mailgun.com/settings/api_security/api_keys" target="_blank" rel="noopener noreferrer">Find it in Mailgun</a>, under Account Settings → API Keys.', 'vulomail' ),
				),
				array(
					'key'      => 'domain',
					'label'    => __( 'Sending domain', 'vulomail' ),
					'type'     => 'text',
					'required' => true,
					'help'     => __( 'For example mg.example.com', 'vulomail' ),
				),
				array(
					'key'     => 'region',
					'label'   => __( 'Region', 'vulomail' ),
					'type'    => 'select',
					'default' => 'us',
					'options' => array(
						array(
							'value' => 'us',
							'label' => __( 'US', 'vulomail' ),
						),
						array(
							'value' => 'eu',
							'label' => __( 'EU', 'vulomail' ),
						),
					),
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
		$domain = $this->config( 'domain' );

		// The domain becomes part of the request path; anything but a hostname would change the endpoint.
		if ( ! preg_match( '/^[A-Za-z0-9]([A-Za-z0-9.\-]*[A-Za-z0-9])?$/', $domain ) ) {
			return Result::fail( 'invalid_domain', __( 'The Mailgun sending domain is not a valid domain name.', 'vulomail' ) );
		}

		$files = $this->read_attachments( $message );

		if ( is_wp_error( $files ) ) {
			return Result::fail( $files->get_error_code(), $files->get_error_message() );
		}

		$fields = array(
			'from'    => Message::format(
				array(
					'email' => $message->from_email,
					'name'  => $message->from_name,
				)
			),
			'to'      => Message::format_list( $message->to ),
			'subject' => $message->subject,
		);

		$fields[ $message->is_html() ? 'html' : 'text' ] = $message->body;

		if ( $message->cc ) {
			$fields['cc'] = Message::format_list( $message->cc );
		}

		if ( $message->bcc ) {
			$fields['bcc'] = Message::format_list( $message->bcc );
		}

		if ( $message->reply_to ) {
			$fields['h:Reply-To'] = Message::format_list( $message->reply_to );
		}

		foreach ( $message->headers as $name => $value ) {
			$fields[ 'h:' . $name ] = $value;
		}

		$headers = array(
			'Authorization' => 'Basic ' . base64_encode( 'api:' . $this->config( 'api_key' ) ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- HTTP Basic auth.
		);
		$body    = $fields;

		if ( $files ) {
			$boundary                = 'vulomail' . wp_generate_password( 24, false );
			$headers['Content-Type'] = 'multipart/form-data; boundary=' . $boundary;
			$body                    = self::multipart( $boundary, $fields, $files );
		}

		$region   = 'eu' === $this->config( 'region' ) ? 'eu' : 'us';
		$response = $this->http->post( self::ENDPOINTS[ $region ] . $domain . '/messages', $headers, $body );

		if ( is_wp_error( $response ) || 200 !== $response['code'] ) {
			return $this->failure( $response, is_wp_error( $response ) ? '' : (string) ( $response['json']['message'] ?? '' ) );
		}

		return Result::ok( trim( (string) ( $response['json']['id'] ?? '' ), '<>' ) );
	}

	/**
	 * Encodes fields and files as multipart/form-data (WordPress's HTTP API has no file-upload helper).
	 *
	 * @param string $boundary Boundary.
	 * @param array  $fields   Form fields.
	 * @param array  $files    Attachments from read_attachments().
	 * @return string
	 */
	private static function multipart( $boundary, array $fields, array $files ) {
		$body = '';

		foreach ( $fields as $name => $value ) {
			$body .= "--{$boundary}\r\n";
			$body .= 'Content-Disposition: form-data; name="' . $name . "\"\r\n\r\n";
			$body .= $value . "\r\n";
		}

		foreach ( $files as $file ) {
			$filename = str_replace( array( '"', "\r", "\n" ), '', $file['name'] );

			$body .= "--{$boundary}\r\n";
			$body .= 'Content-Disposition: form-data; name="attachment"; filename="' . $filename . "\"\r\n";
			$body .= 'Content-Type: ' . $file['type'] . "\r\n\r\n";
			$body .= $file['content'] . "\r\n";
		}

		return $body . "--{$boundary}--\r\n";
	}
}
