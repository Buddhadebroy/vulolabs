<?php
/**
 * SMS gateway adapter, phone number and SMS dispatcher tests.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use VuloMail\Connections\ConnectionRepository;
use VuloMail\Logging\Logger;
use VuloMail\Security\Secrets;
use VuloMail\Settings\Settings;
use VuloMail\Sms\Dispatcher;
use VuloMail\Sms\Gateways\Clickatell;
use VuloMail\Sms\Gateways\Plivo;
use VuloMail\Sms\Gateways\Twilio;
use VuloMail\Sms\Gateways\Vonage;
use VuloMail\Sms\PhoneNumber;

/**
 * Tests the SMS gateway adapters, phone number normalisation and the SMS Dispatcher.
 */
class TestSms extends TestCase {

	/**
	 * A made-up account SID. Written in pieces so secret scanners don't mistake it for a real one.
	 *
	 * @var string
	 */
	const SID = 'AC' . '0123456789abcdef' . '0123456789abcdef'; // phpcs:ignore Generic.Strings.UnnecessaryStringConcat.Found -- split deliberately, see comment above.

	/**
	 * Phone numbers are normalised to E.164.
	 *
	 * @return void
	 */
	public function test_phone_numbers_are_normalised_to_e164() {
		$this->assertSame( '+14155550123', PhoneNumber::normalize( '+1 (415) 555-0123' ) );
		$this->assertSame( '+447911123456', PhoneNumber::normalize( '00 44 7911 123456' ) );
		$this->assertSame( '+447911123456', PhoneNumber::normalize( '07911 123456', '44' ) );
		$this->assertSame( '', PhoneNumber::normalize( '07911 123456' ) );
		$this->assertSame( '', PhoneNumber::normalize( '+12' ) );
		$this->assertSame( '', PhoneNumber::normalize( 'call me' ) );
	}

	/**
	 * Twilio builds the request.
	 *
	 * @return void
	 */
	public function test_twilio_builds_the_request() {
		$http = new FakeHttp();
		$http->queue( 201, array( 'sid' => 'SM123' ) );

		$result  = ( new Twilio(
			array(
				'account_sid' => self::SID,
				'auth_token'  => 'tw-token-12345678',
				'from'        => '+15005550006',
			),
			$http
		) )->send( '+14155550123', 'Hello' );
		$request = $http->requests[0];

		$this->assertTrue( $result->success );
		$this->assertSame( 'SM123', $result->message_id );
		$this->assertSame( 'https://api.twilio.com/2010-04-01/Accounts/' . self::SID . '/Messages.json', $request['url'] );
		$this->assertSame( 'Basic ' . base64_encode( self::SID . ':tw-token-12345678' ), $request['headers']['Authorization'] ); // phpcs:ignore
		$this->assertSame(
			array(
				'To'   => '+14155550123',
				'Body' => 'Hello',
				'From' => '+15005550006',
			),
			$request['body']
		);
	}

	/**
	 * Twilio uses a messaging service SID when given one.
	 *
	 * @return void
	 */
	public function test_twilio_uses_a_messaging_service_sid_when_given_one() {
		$http = new FakeHttp();
		$http->queue( 201, array( 'sid' => 'SM123' ) );

		( new Twilio(
			array(
				'account_sid' => self::SID,
				'auth_token'  => 'tw-token-12345678',
				'from'        => 'MG0123456789abcdef0123456789abcdef',
			),
			$http
		) )->send( '+14155550123', 'Hello' );

		$this->assertArrayHasKey( 'MessagingServiceSid', $http->requests[0]['body'] );
		$this->assertArrayNotHasKey( 'From', $http->requests[0]['body'] );
	}

	/**
	 * Twilio rejects a malformed account SID before any request.
	 *
	 * @return void
	 */
	public function test_twilio_rejects_a_malformed_account_sid_before_any_request() {
		$http   = new FakeHttp();
		$result = ( new Twilio(
			array(
				'account_sid' => 'AC123/../../evil',
				'auth_token'  => 'tw-token-12345678',
				'from'        => '+15005550006',
			),
			$http
		) )->send( '+14155550123', 'Hello' );

		$this->assertFalse( $result->success );
		$this->assertSame( 'invalid_account_sid', $result->error_code );
		$this->assertSame( array(), $http->requests );
	}

	/**
	 * A Twilio error carries the gateway code but not the token.
	 *
	 * @return void
	 */
	public function test_twilio_error_carries_the_gateway_code_but_not_the_token() {
		$http = new FakeHttp();
		$http->queue(
			400,
			array(
				'code'    => 21211,
				'message' => 'Invalid To number; token tw-token-12345678',
			)
		);

		$result = ( new Twilio(
			array(
				'account_sid' => self::SID,
				'auth_token'  => 'tw-token-12345678',
				'from'        => '+15005550006',
			),
			$http
		) )->send( '+14155550123', 'Hello' );

		$this->assertFalse( $result->success );
		$this->assertSame( '21211', $result->error_code );
		$this->assertStringContainsString( 'Invalid To number', $result->error_message );
		$this->assertStringNotContainsString( 'tw-token-12345678', $result->error_message );
	}

	/**
	 * Vonage treats a non-zero status in a 200 response as failure.
	 *
	 * @return void
	 */
	public function test_vonage_treats_a_non_zero_status_in_a_200_response_as_failure() {
		$http = new FakeHttp();
		$http->queue(
			200,
			array(
				'messages' => array(
					array(
						'status'     => '4',
						'error-text' => 'Bad Credentials',
					),
				),
			)
		);

		$result = ( new Vonage(
			array(
				'api_key'    => 'vkey',
				'api_secret' => 'vsecret-12345',
				'from'       => 'Shop',
			),
			$http
		) )->send( '+14155550123', 'Hello' );

		$this->assertFalse( $result->success );
		$this->assertSame( 'vonage_4', $result->error_code );
		$this->assertStringContainsString( 'Bad Credentials', $result->error_message );
	}

	/**
	 * Vonage flags unicode text and strips the plus sign.
	 *
	 * @return void
	 */
	public function test_vonage_flags_unicode_text_and_strips_the_plus_sign() {
		$http = new FakeHttp();
		$http->queue(
			200,
			array(
				'messages' => array(
					array(
						'status'     => '0',
						'message-id' => 'v-1',
					),
				),
			)
		);

		$result = ( new Vonage(
			array(
				'api_key'    => 'vkey',
				'api_secret' => 'vsecret-12345',
				'from'       => 'Shop',
			),
			$http
		) )->send( '+14155550123', 'Привет' );

		$this->assertTrue( $result->success );
		$this->assertSame( 'v-1', $result->message_id );
		$this->assertSame( '14155550123', $http->requests[0]['body']['to'] );
		$this->assertSame( 'unicode', $http->requests[0]['body']['type'] );
	}

	/**
	 * Plivo builds the request.
	 *
	 * @return void
	 */
	public function test_plivo_builds_the_request() {
		$http = new FakeHttp();
		$http->queue( 202, array( 'message_uuid' => array( 'pl-1' ) ) );

		$result  = ( new Plivo(
			array(
				'auth_id'    => 'MAXXXXXXXXXXXXXXXXXX',
				'auth_token' => 'plivo-token-1234',
				'from'       => '+15005550006',
			),
			$http
		) )->send( '+14155550123', 'Hello' );
		$payload = json_decode( $http->requests[0]['body'], true );

		$this->assertTrue( $result->success );
		$this->assertSame( 'pl-1', $result->message_id );
		$this->assertSame( 'https://api.plivo.com/v1/Account/MAXXXXXXXXXXXXXXXXXX/Message/', $http->requests[0]['url'] );
		$this->assertSame(
			array(
				'src'  => '15005550006',
				'dst'  => '14155550123',
				'text' => 'Hello',
			),
			$payload
		);
	}

	/**
	 * Clickatell detects a per-message rejection in a 202 response.
	 *
	 * @return void
	 */
	public function test_clickatell_detects_a_per_message_rejection_in_a_202_response() {
		$http = new FakeHttp();
		$http->queue(
			202,
			array(
				'messages' => array(
					array(
						'accepted'         => false,
						'errorCode'        => 114,
						'errorDescription' => 'Cannot route message',
					),
				),
			)
		);

		$result = ( new Clickatell( array( 'api_key' => 'click-key-123456' ), $http ) )->send( '+14155550123', 'Hello' );

		$this->assertFalse( $result->success );
		$this->assertSame( '114', $result->error_code );
		$this->assertSame( 'click-key-123456', $http->requests[0]['headers']['Authorization'] );
	}

	/**
	 * Builds a Dispatcher whose connections succeed or fail as scripted.
	 *
	 * @param string[]      $outcomes 'ok' / 'fail' for the primary and, optionally, the backup.
	 * @param array         $settings Extra settings.
	 * @param FakeLogs|null $logs     Set by reference to the dispatcher's in-memory log.
	 * @return Dispatcher
	 */
	private function dispatcher( array $outcomes, array $settings = array(), ?FakeLogs &$logs = null ) {
		$registry    = new ScriptedRegistry( new FakeHttp() );
		$connections = new ConnectionRepository( new Secrets(), $registry );
		$ids         = array();

		foreach ( $outcomes as $outcome ) {
			$ids[] = $connections->save(
				array(
					'channel'  => 'sms',
					'provider' => 'scripted',
					'label'    => 'Gateway ' . $outcome,
					'settings' => array( 'outcome' => $outcome ),
				)
			)['id'];
		}

		$this->options['vulomail_settings'] = array_merge(
			array(
				'sms_primary' => $ids[0] ?? '',
				'sms_backup'  => $ids[1] ?? '',
			),
			$settings
		);

		$store = new Settings();
		$logs  = new FakeLogs();

		ScriptedGateway::$sent = array();

		return new Dispatcher( $store, $connections, $registry, new Logger( $logs, $store ) );
	}

	/**
	 * The dispatcher fails over to the backup gateway.
	 *
	 * @return void
	 */
	public function test_dispatcher_fails_over_to_the_backup_gateway() {
		$logs   = null;
		$result = $this->dispatcher( array( 'fail', 'ok' ), array(), $logs )->send( '+1 415 555 0123', 'Your code is ready', 'my-plugin' );

		$this->assertTrue( $result->success );
		$this->assertCount( 2, $result->attempts );
		$this->assertFalse( $result->attempts[0]['success'] );
		$this->assertCount( 2, ScriptedGateway::$sent );
		$this->assertSame( '+14155550123', ScriptedGateway::$sent[0]['to'] );
		$this->assertSame( 'sent', $logs->rows[0]['status'] );
		$this->assertSame( 1, $logs->rows[0]['used_fallback'] );
		$this->assertSame( 'my-plugin', $logs->rows[0]['source'] );
		$this->assertNull( $logs->rows[0]['body'], 'Message text is not stored unless content logging is on.' );
	}

	/**
	 * The dispatcher reports failure when every gateway fails.
	 *
	 * @return void
	 */
	public function test_dispatcher_reports_failure_when_every_gateway_fails() {
		$logs = null;

		\Brain\Monkey\Actions\expectDone( 'vulomail_sms_failed' )->once();

		$result = $this->dispatcher( array( 'fail', 'fail' ), array(), $logs )->send( '+14155550123', 'Hello' );

		$this->assertFalse( $result->success );
		$this->assertCount( 2, $result->attempts );
		$this->assertSame( 'failed', $logs->rows[0]['status'] );
		$this->assertSame( 'Gateway said no', $logs->rows[0]['error_message'] );
	}

	/**
	 * The dispatcher rejects invalid numbers without calling a gateway.
	 *
	 * @return void
	 */
	public function test_dispatcher_rejects_invalid_numbers_without_calling_a_gateway() {
		$result = $this->dispatcher( array( 'ok' ) )->send( 'not a number', 'Hello' );

		$this->assertFalse( $result->success );
		$this->assertSame( 'invalid_number', $result->error_code );
		$this->assertSame( array(), ScriptedGateway::$sent );
	}

	/**
	 * The dispatcher sends nothing when SMS is switched off.
	 *
	 * @return void
	 */
	public function test_dispatcher_sends_nothing_when_sms_is_switched_off() {
		$dispatcher = $this->dispatcher( array( 'ok' ), array( 'sms_enabled' => false ) );
		$result     = $dispatcher->send( '+14155550123', 'Hello' );

		$this->assertFalse( $dispatcher->is_ready() );
		$this->assertSame( 'sms_disabled', $result->error_code );
		$this->assertSame( array(), ScriptedGateway::$sent );
	}

	/**
	 * The dispatcher strips markup and applies the default country code.
	 *
	 * @return void
	 */
	public function test_dispatcher_strips_markup_and_applies_the_default_country_code() {
		$this->dispatcher( array( 'ok' ), array( 'sms_country_code' => '44' ) )->send( '07911 123456', '<b>Hello</b> there' );

		$this->assertSame(
			array(
				'to'   => '+447911123456',
				'body' => 'Hello there',
			),
			ScriptedGateway::$sent[0]
		);
	}
}
