<?php
/**
 * Email provider adapter tests: request shape, success detection and failure handling.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use VuloMail\Email\Mailers\Brevo;
use VuloMail\Email\Mailers\Mailgun;
use VuloMail\Email\Mailers\Postmark;
use VuloMail\Email\Mailers\SendGrid;
use VuloMail\Email\Mailers\Smtp;
use VuloMail\Email\Message;

/**
 * Tests the email provider adapters.
 */
class TestEmailProviders extends TestCase {

	/**
	 * Builds a message exercising every address and header kind.
	 *
	 * @return Message
	 */
	private function message() {
		$message               = new Message();
		$message->to           = array(
			array(
				'email' => 'jane@example.com',
				'name'  => 'Jane',
			),
		);
		$message->cc           = array(
			array(
				'email' => 'cc@example.com',
				'name'  => '',
			),
		);
		$message->reply_to     = array(
			array(
				'email' => 'help@example.com',
				'name'  => '',
			),
		);
		$message->from_email   = 'shop@example.com';
		$message->from_name    = 'Shop';
		$message->subject      = 'Order ready';
		$message->body         = '<p>Hello</p>';
		$message->content_type = 'text/html';
		$message->headers      = array( 'X-Tag' => 'order' );

		return $message;
	}

	/**
	 * SendGrid builds the request and reads the message id.
	 *
	 * @return void
	 */
	public function test_sendgrid_builds_the_request_and_reads_the_message_id() {
		$http = new FakeHttp();
		$http->queue( 202, array(), array( 'x-message-id' => 'sg-123' ) );

		$result  = ( new SendGrid( array( 'api_key' => 'SG.secretsecret' ), $http ) )->send( $this->message() );
		$request = $http->requests[0];
		$payload = json_decode( $request['body'], true );

		$this->assertTrue( $result->success );
		$this->assertSame( 'sg-123', $result->message_id );
		$this->assertSame( SendGrid::ENDPOINT, $request['url'] );
		$this->assertSame( 'Bearer SG.secretsecret', $request['headers']['Authorization'] );
		$this->assertSame( 'jane@example.com', $payload['personalizations'][0]['to'][0]['email'] );
		$this->assertSame( 'cc@example.com', $payload['personalizations'][0]['cc'][0]['email'] );
		$this->assertSame( 'text/html', $payload['content'][0]['type'] );
		$this->assertSame( 'help@example.com', $payload['reply_to_list'][0]['email'] );
		$this->assertSame( array( 'X-Tag' => 'order' ), $payload['headers'] );
	}

	/**
	 * A SendGrid rejection is reported without leaking the key.
	 *
	 * @return void
	 */
	public function test_sendgrid_rejection_is_reported_without_leaking_the_key() {
		$http = new FakeHttp();
		$http->queue( 401, array( 'errors' => array( array( 'message' => 'The provided authorization grant SG.secretsecret is invalid' ) ) ) );

		$result = ( new SendGrid( array( 'api_key' => 'SG.secretsecret' ), $http ) )->send( $this->message() );

		$this->assertFalse( $result->success );
		$this->assertSame( 'http_401', $result->error_code );
		$this->assertStringContainsString( 'authorization grant', $result->error_message );
		$this->assertStringNotContainsString( 'SG.secretsecret', $result->error_message );
	}

	/**
	 * Network errors become failed results.
	 *
	 * @return void
	 */
	public function test_network_errors_become_failed_results() {
		$http = new FakeHttp();
		$http->queue_error( new \WP_Error( 'http_request_failed', 'cURL error 28: Operation timed out' ) );

		$result = ( new Brevo( array( 'api_key' => 'xkeysib-abcdefgh' ), $http ) )->send( $this->message() );

		$this->assertFalse( $result->success );
		$this->assertSame( 'network_error', $result->error_code );
		$this->assertStringContainsString( 'timed out', $result->error_message );
	}

	/**
	 * Brevo builds the request.
	 *
	 * @return void
	 */
	public function test_brevo_builds_the_request() {
		$http = new FakeHttp();
		$http->queue( 201, array( 'messageId' => '<brevo-1@example>' ) );

		$result  = ( new Brevo( array( 'api_key' => 'xkeysib-abcdefgh' ), $http ) )->send( $this->message() );
		$request = $http->requests[0];
		$payload = json_decode( $request['body'], true );

		$this->assertTrue( $result->success );
		$this->assertSame( '<brevo-1@example>', $result->message_id );
		$this->assertSame( 'xkeysib-abcdefgh', $request['headers']['api-key'] );
		$this->assertSame( 'shop@example.com', $payload['sender']['email'] );
		$this->assertSame( '<p>Hello</p>', $payload['htmlContent'] );
		$this->assertArrayNotHasKey( 'textContent', $payload );
		$this->assertSame( array( 'email' => 'help@example.com' ), $payload['replyTo'] );
	}

	/**
	 * Postmark treats an error code in a 200 response as failure.
	 *
	 * @return void
	 */
	public function test_postmark_treats_an_error_code_in_a_200_response_as_failure() {
		$http = new FakeHttp();
		$http->queue(
			200,
			array(
				'ErrorCode' => 406,
				'Message'   => 'Inactive recipient',
			)
		);

		$result = ( new Postmark( array( 'server_token' => 'pm-token-12345678' ), $http ) )->send( $this->message() );

		$this->assertFalse( $result->success );
		$this->assertStringContainsString( 'Inactive recipient', $result->error_message );
	}

	/**
	 * Postmark builds the request.
	 *
	 * @return void
	 */
	public function test_postmark_builds_the_request() {
		$http = new FakeHttp();
		$http->queue(
			200,
			array(
				'ErrorCode' => 0,
				'MessageID' => 'pm-1',
			)
		);

		$result  = ( new Postmark(
			array(
				'server_token'   => 'pm-token-12345678',
				'message_stream' => 'outbound',
			),
			$http
		) )->send( $this->message() );
		$request = $http->requests[0];
		$payload = json_decode( $request['body'], true );

		$this->assertTrue( $result->success );
		$this->assertSame( 'pm-1', $result->message_id );
		$this->assertSame( 'pm-token-12345678', $request['headers']['X-Postmark-Server-Token'] );
		$this->assertSame( '"Shop" <shop@example.com>', $payload['From'] );
		$this->assertSame( '"Jane" <jane@example.com>', $payload['To'] );
		$this->assertSame( 'outbound', $payload['MessageStream'] );
		$this->assertSame(
			array(
				array(
					'Name'  => 'X-Tag',
					'Value' => 'order',
				),
			),
			$payload['Headers']
		);
	}

	/**
	 * Mailgun uses the selected region and form fields.
	 *
	 * @return void
	 */
	public function test_mailgun_uses_the_selected_region_and_form_fields() {
		$http = new FakeHttp();
		$http->queue( 200, array( 'id' => '<mg-1@mg.example.com>' ) );

		$result  = ( new Mailgun(
			array(
				'api_key' => 'key-abcdefgh',
				'domain'  => 'mg.example.com',
				'region'  => 'eu',
			),
			$http
		) )->send( $this->message() );
		$request = $http->requests[0];

		$this->assertTrue( $result->success );
		$this->assertSame( 'mg-1@mg.example.com', $result->message_id );
		$this->assertSame( 'https://api.eu.mailgun.net/v3/mg.example.com/messages', $request['url'] );
		$this->assertSame( 'Basic ' . base64_encode( 'api:key-abcdefgh' ), $request['headers']['Authorization'] ); // phpcs:ignore
		$this->assertSame( '<p>Hello</p>', $request['body']['html'] );
		$this->assertSame( 'help@example.com', $request['body']['h:Reply-To'] );
		$this->assertSame( 'order', $request['body']['h:X-Tag'] );
	}

	/**
	 * Mailgun refuses a domain that would change the endpoint.
	 *
	 * @return void
	 */
	public function test_mailgun_refuses_a_domain_that_would_change_the_endpoint() {
		$http   = new FakeHttp();
		$result = ( new Mailgun(
			array(
				'api_key' => 'key-abcdefgh',
				'domain'  => 'evil.test/v3/other?x=',
			),
			$http
		) )->send( $this->message() );

		$this->assertFalse( $result->success );
		$this->assertSame( 'invalid_domain', $result->error_code );
		$this->assertSame( array(), $http->requests );
	}

	/**
	 * Mailgun sends attachments as multipart.
	 *
	 * @return void
	 */
	public function test_mailgun_sends_attachments_as_multipart() {
		$file = tempnam( sys_get_temp_dir(), 'vm' );
		file_put_contents( $file, 'attachment-bytes' ); // phpcs:ignore

		$message              = $this->message();
		$message->attachments = array( 'note.txt' => $file );

		$http = new FakeHttp();
		$http->queue( 200, array( 'id' => '<mg-2>' ) );

		( new Mailgun(
			array(
				'api_key' => 'key-abcdefgh',
				'domain'  => 'mg.example.com',
			),
			$http
		) )->send( $message );

		unlink( $file ); // phpcs:ignore

		$request = $http->requests[0];

		$this->assertStringStartsWith( 'multipart/form-data; boundary=', $request['headers']['Content-Type'] );
		$this->assertStringContainsString( 'name="attachment"; filename="note.txt"', $request['body'] );
		$this->assertStringContainsString( 'attachment-bytes', $request['body'] );
		$this->assertStringContainsString( 'name="subject"', $request['body'] );
	}

	/**
	 * API attachments are base64-encoded.
	 *
	 * @return void
	 */
	public function test_api_attachments_are_base64_encoded() {
		$file = tempnam( sys_get_temp_dir(), 'vm' );
		file_put_contents( $file, 'attachment-bytes' ); // phpcs:ignore

		$message              = $this->message();
		$message->attachments = array( 'note.txt' => $file );

		$http = new FakeHttp();
		$http->queue( 202 );

		( new SendGrid( array( 'api_key' => 'SG.secretsecret' ), $http ) )->send( $message );

		unlink( $file ); // phpcs:ignore

		$payload = json_decode( $http->requests[0]['body'], true );

		$this->assertSame( 'note.txt', $payload['attachments'][0]['filename'] );
		$this->assertSame( 'attachment-bytes', base64_decode( $payload['attachments'][0]['content'] ) ); // phpcs:ignore
	}

	/**
	 * SMTP applies the connection after other plugins touch PHPMailer.
	 *
	 * @return void
	 */
	public function test_smtp_applies_the_connection_after_other_plugins_touch_phpmailer() {
		$mailer = new FakePhpMailer();

		// A plugin trying to redirect mail to its own server through phpmailer_init.
		\Brain\Monkey\Actions\expectDone( 'phpmailer_init' )->once()->whenHappen(
			static function ( $phpmailer ) {
				$phpmailer->Host = 'hijack.example.net'; // phpcs:ignore
			}
		);

		$smtp   = new Smtp(
			array(
				'host'       => 'smtp.example.com',
				'port'       => 465,
				'encryption' => 'ssl',
				'auth'       => true,
				'username'   => 'user',
				'password'   => 'p4ssw0rd!',
			),
			null,
			static function () use ( $mailer ) {
				return $mailer;
			}
		);
		$result = $smtp->send( $this->message() );

		$this->assertTrue( $result->success );
		$this->assertSame( 'smtp', $mailer->Mailer ); // phpcs:ignore
		$this->assertSame( 'smtp.example.com', $mailer->Host ); // phpcs:ignore
		$this->assertSame( 465, $mailer->Port ); // phpcs:ignore
		$this->assertSame( 'ssl', $mailer->SMTPSecure ); // phpcs:ignore
		$this->assertTrue( $mailer->SMTPAuth ); // phpcs:ignore
		$this->assertSame( 'p4ssw0rd!', $mailer->Password ); // phpcs:ignore
		$this->assertSame( 'text/html', $mailer->ContentType ); // phpcs:ignore
		$this->assertSame( array( array( 'shop@example.com', 'Shop', false ) ), $mailer->calls_to( 'setFrom' ) );
		$this->assertSame( array( array( 'jane@example.com', 'Jane' ) ), $mailer->calls_to( 'addAddress' ) );
		$this->assertSame( array( array( 'X-Tag', 'order' ) ), $mailer->calls_to( 'addCustomHeader' ) );
	}

	/**
	 * SMTP without auth sends no credentials.
	 *
	 * @return void
	 */
	public function test_smtp_without_auth_sends_no_credentials() {
		$mailer = new FakePhpMailer();

		( new Smtp(
			array(
				'host'       => 'relay.internal.example.com',
				'port'       => 25,
				'encryption' => 'none',
				'auth'       => false,
				'username'   => 'stale',
				'password'   => 'stale-pass',
			),
			null,
			static function () use ( $mailer ) {
				return $mailer;
			}
		) )->send( $this->message() );

		$this->assertFalse( $mailer->SMTPAuth ); // phpcs:ignore
		$this->assertSame( '', $mailer->Username ); // phpcs:ignore
		$this->assertSame( '', $mailer->Password ); // phpcs:ignore
		$this->assertSame( '', $mailer->SMTPSecure ); // phpcs:ignore
		$this->assertFalse( $mailer->SMTPAutoTLS ); // phpcs:ignore
	}

	/**
	 * SMTP failure is returned with the password removed.
	 *
	 * @return void
	 */
	public function test_smtp_failure_is_returned_with_the_password_removed() {
		$mailer            = new FakePhpMailer();
		$mailer->fail_with = new \Exception( 'SMTP Error: Could not authenticate. Password p4ssw0rd! rejected' );

		$result = ( new Smtp(
			array(
				'host'     => 'smtp.example.com',
				'auth'     => true,
				'username' => 'user',
				'password' => 'p4ssw0rd!',
			),
			null,
			static function () use ( $mailer ) {
				return $mailer;
			}
		) )->send( $this->message() );

		$this->assertFalse( $result->success );
		$this->assertSame( 'smtp_error', $result->error_code );
		$this->assertStringContainsString( 'Could not authenticate', $result->error_message );
		$this->assertStringNotContainsString( 'p4ssw0rd!', $result->error_message );
	}
}
