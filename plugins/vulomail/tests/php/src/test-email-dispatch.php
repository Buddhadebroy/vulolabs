<?php
/**
 * Email dispatcher, wp_mail() interception and logging tests.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use VuloMail\Connections\ConnectionRepository;
use VuloMail\Email\Dispatcher;
use VuloMail\Email\Message;
use VuloMail\Email\WpMailInterceptor;
use VuloMail\Logging\Logger;
use VuloMail\Security\Secrets;
use VuloMail\Settings\Settings;

/**
 * Tests the email Dispatcher, wp_mail() interception and delivery logging.
 */
class TestEmailDispatch extends TestCase {

	/**
	 * In-memory delivery log.
	 *
	 * @var FakeLogs
	 */
	private $logs;

	/**
	 * Plugin settings.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Saved connections.
	 *
	 * @var ConnectionRepository
	 */
	private $connections;

	/**
	 * Registry exposing only the scripted adapters.
	 *
	 * @var ScriptedRegistry
	 */
	private $registry;

	/**
	 * Baseline wp_mail() arguments used by the interceptor tests.
	 *
	 * @var array
	 */
	const ATTS = array(
		'to'          => 'jane@example.com',
		'subject'     => 'Password reset',
		'message'     => 'Reset link: https://shop.example.com/?key=abc',
		'headers'     => '',
		'attachments' => array(),
	);

	/**
	 * Builds a dispatcher whose connections succeed or fail as scripted.
	 *
	 * @param string[] $outcomes 'ok' / 'fail' / 'throw' for the primary and, optionally, the backup.
	 * @param array    $settings Extra settings.
	 * @param string   $channel  Channel the connections belong to.
	 * @return Dispatcher
	 */
	private function dispatcher( array $outcomes, array $settings = array(), $channel = 'email' ) {
		$this->registry    = new ScriptedRegistry( new FakeHttp() );
		$this->connections = new ConnectionRepository( new Secrets(), $this->registry );
		$ids               = array();

		foreach ( $outcomes as $outcome ) {
			$ids[] = $this->connections->save(
				array(
					'channel'  => $channel,
					'provider' => 'scripted',
					'label'    => 'Conn ' . $outcome,
					'settings' => array( 'outcome' => $outcome ),
				)
			)['id'];
		}

		$this->options['vulomail_settings'] = array_merge(
			array(
				$channel . '_primary' => $ids[0] ?? '',
				$channel . '_backup'  => $ids[1] ?? '',
			),
			$settings
		);

		$this->settings = new Settings();
		$this->logs     = new FakeLogs();

		ScriptedMailer::$sent  = array();
		ScriptedGateway::$sent = array();

		return new Dispatcher( $this->settings, $this->connections, $this->registry, new Logger( $this->logs, $this->settings ) );
	}

	/**
	 * Builds a simple outgoing message.
	 *
	 * @return Message
	 */
	private function message() {
		$message             = new Message();
		$message->to         = array(
			array(
				'email' => 'jane@example.com',
				'name'  => '',
			),
		);
		$message->from_email = 'shop@example.com';
		$message->subject    = 'Hello';
		$message->body       = 'Secret body';

		return $message;
	}

	/**
	 * The primary connection delivers when healthy.
	 *
	 * @return void
	 */
	public function test_primary_connection_delivers_when_healthy() {
		Actions\expectDone( 'vulomail_email_sent' )->once();

		$result = $this->dispatcher( array( 'ok', 'ok' ) )->send( $this->message() );

		$this->assertTrue( $result->success );
		$this->assertCount( 1, ScriptedMailer::$sent, 'The backup is not used when the primary succeeds.' );
		$this->assertSame( 0, $this->logs->rows[0]['used_fallback'] );
		$this->assertSame( 'sent', $this->logs->rows[0]['status'] );
	}

	/**
	 * The backup connection delivers when the primary fails.
	 *
	 * @return void
	 */
	public function test_backup_connection_delivers_when_the_primary_fails() {
		$result = $this->dispatcher( array( 'fail', 'ok' ) )->send( $this->message() );

		$this->assertTrue( $result->success );
		$this->assertCount( 2, $result->attempts );
		$this->assertSame( 'rejected', $result->attempts[0]['error_code'] );
		$this->assertCount( 1, $this->logs->rows, 'One log row per message, not per attempt.' );
		$this->assertSame( 1, $this->logs->rows[0]['used_fallback'] );
		$this->assertStringContainsString( 'Provider said no', $this->logs->rows[0]['attempts'] );
	}

	/**
	 * Failure is logged when every connection fails.
	 *
	 * @return void
	 */
	public function test_failure_is_logged_when_every_connection_fails() {
		Actions\expectDone( 'vulomail_email_failed' )->once();

		$result = $this->dispatcher( array( 'fail', 'fail' ) )->send( $this->message() );

		$this->assertFalse( $result->success );
		$this->assertSame( 'failed', $this->logs->rows[0]['status'] );
		$this->assertSame( 'Provider said no', $this->logs->rows[0]['error_message'] );
	}

	/**
	 * An adapter that throws is contained and the backup still runs.
	 *
	 * @return void
	 */
	public function test_an_adapter_that_throws_is_contained_and_the_backup_still_runs() {
		$result = $this->dispatcher( array( 'throw', 'ok' ) )->send( $this->message() );

		$this->assertTrue( $result->success );
		$this->assertSame( 'adapter_exception', $result->attempts[0]['error_code'] );
	}

	/**
	 * Disabled and incomplete connections are skipped.
	 *
	 * @return void
	 */
	public function test_disabled_and_incomplete_connections_are_skipped() {
		$dispatcher = $this->dispatcher( array( 'ok', 'ok' ) );
		$ids        = array_keys( $this->connections->all() );

		$this->connections->save(
			array(
				'id'      => $ids[0],
				'enabled' => false,
			)
		);

		$this->assertSame( array( $ids[1] ), array_column( $dispatcher->chain(), 'id' ) );

		$this->connections->save(
			array(
				'id'       => $ids[1],
				'settings' => array( 'outcome' => '' ),
			)
		);

		$this->assertSame( array(), $dispatcher->chain() );
		$this->assertFalse( $dispatcher->is_ready() );
		$this->assertSame( 'not_configured', $dispatcher->send( $this->message() )->error_code );
	}

	/**
	 * Message content is only stored when opted in.
	 *
	 * @return void
	 */
	public function test_message_content_is_only_stored_when_opted_in() {
		$this->dispatcher( array( 'ok' ) )->send( $this->message() );
		$this->assertNull( $this->logs->rows[0]['body'] );
		$this->assertSame( 'jane@example.com', $this->logs->rows[0]['recipients'] );

		$this->dispatcher(
			array( 'ok' ),
			array(
				'log_content'     => true,
				'mask_recipients' => true,
			)
		)->send( $this->message() );
		$this->assertSame( 'Secret body', $this->logs->rows[0]['body'] );
		$this->assertSame( 'j•••@example.com', $this->logs->rows[0]['recipients'] );

		$this->dispatcher( array( 'ok' ), array( 'log_enabled' => false ) )->send( $this->message() );
		$this->assertSame( array(), $this->logs->rows );
	}

	/**
	 * Builds a WpMailInterceptor backed by a scripted dispatcher.
	 *
	 * @param string[] $outcomes 'ok' / 'fail' / 'throw' for the primary and, optionally, the backup.
	 * @param array    $settings Extra settings.
	 * @return WpMailInterceptor
	 */
	private function interceptor( array $outcomes, array $settings = array() ) {
		$dispatcher = $this->dispatcher( $outcomes, $settings );

		return new WpMailInterceptor( $this->settings, $dispatcher, new Logger( $this->logs, $this->settings ) );
	}

	/**
	 * `wp_mail()` is left alone when nothing is configured.
	 *
	 * @return void
	 */
	public function test_wp_mail_is_left_alone_when_nothing_is_configured() {
		$this->assertNull( $this->interceptor( array() )->maybe_send( null, self::ATTS ) );
		$this->assertSame( array(), ScriptedMailer::$sent );
	}

	/**
	 * `wp_mail()` is left alone when email routing is switched off.
	 *
	 * @return void
	 */
	public function test_wp_mail_is_left_alone_when_email_routing_is_switched_off() {
		$this->assertNull( $this->interceptor( array( 'ok' ), array( 'email_enabled' => false ) )->maybe_send( null, self::ATTS ) );
		$this->assertSame( array(), ScriptedMailer::$sent );
	}

	/**
	 * Another plugin's short-circuit is respected.
	 *
	 * @return void
	 */
	public function test_another_plugins_short_circuit_is_respected() {
		$this->assertFalse( $this->interceptor( array( 'ok' ) )->maybe_send( false, self::ATTS ) );
		$this->assertSame( array(), ScriptedMailer::$sent );
	}

	/**
	 * `wp_mail()` is delivered through the connection and core is told.
	 *
	 * @return void
	 */
	public function test_wp_mail_is_delivered_through_the_connection_and_core_is_told() {
		Actions\expectDone( 'wp_mail_succeeded' )->once()->with( self::ATTS );

		$interceptor = $this->interceptor( array( 'ok' ) );

		$this->assertTrue( $interceptor->maybe_send( null, self::ATTS ) );
		$this->assertSame( 'Password reset', ScriptedMailer::$sent[0]['message']->subject );
		$this->assertCount( 1, $this->logs->rows, 'The success hook this class fires itself must not be logged a second time.' );
		$this->assertSame( 'core', $this->logs->rows[0]['source'] );
	}

	/**
	 * A failed message is handed back to WordPress when fallback is on.
	 *
	 * @return void
	 */
	public function test_failed_message_is_handed_back_to_wordpress_when_fallback_is_on() {
		$interceptor = $this->interceptor( array( 'fail' ) );

		$this->assertNull( $interceptor->maybe_send( null, self::ATTS ), 'Null lets wp_mail() continue with its own mailer.' );
		$this->assertSame( array(), $this->logs->rows, 'Nothing is logged until WordPress has tried.' );

		// WordPress's own mailer then succeeds.
		$interceptor->observe_success( self::ATTS );

		$this->assertCount( 1, $this->logs->rows );
		$this->assertSame( 'sent', $this->logs->rows[0]['status'] );
		$this->assertSame( 'default', $this->logs->rows[0]['provider'] );
		$this->assertSame( 1, $this->logs->rows[0]['used_fallback'] );
		$this->assertStringContainsString( 'Provider said no', $this->logs->rows[0]['attempts'] );
	}

	/**
	 * A failed message is reported as failed when fallback is off.
	 *
	 * @return void
	 */
	public function test_failed_message_is_reported_as_failed_when_fallback_is_off() {
		Actions\expectDone( 'wp_mail_failed' )->once()->with( \Mockery::type( \WP_Error::class ) );

		$interceptor = $this->interceptor( array( 'fail' ), array( 'fallback_to_default' => false ) );

		$this->assertFalse( $interceptor->maybe_send( null, self::ATTS ) );
		$this->assertCount( 1, $this->logs->rows );
		$this->assertSame( 'failed', $this->logs->rows[0]['status'] );
		$this->assertSame( 'Provider said no', $interceptor->last_result()->error_message );
	}

	/**
	 * Default mailer sends are logged when no connection exists.
	 *
	 * @return void
	 */
	public function test_default_mailer_sends_are_logged_when_no_connection_exists() {
		$interceptor = $this->interceptor( array() );

		$interceptor->observe_success( self::ATTS );
		$interceptor->observe_failure( new \WP_Error( 'wp_mail_failed', 'Could not instantiate mail function.', self::ATTS ) );

		$this->assertSame( array( 'sent', 'failed' ), array_column( $this->logs->rows, 'status' ) );
		$this->assertSame( array( 'default', 'default' ), array_column( $this->logs->rows, 'provider' ) );
		$this->assertSame( 'Could not instantiate mail function.', $this->logs->rows[1]['error_message'] );
	}

	/**
	 * The handle filter can exempt a message.
	 *
	 * @return void
	 */
	public function test_the_handle_filter_can_exempt_a_message() {
		$interceptor = $this->interceptor( array( 'ok' ) );

		Functions\when( 'apply_filters' )->alias(
			static function ( $hook, $value ) {
				return 'vulomail_should_handle_email' === $hook ? false : $value;
			}
		);

		$this->assertNull( $interceptor->maybe_send( null, self::ATTS ) );
		$this->assertSame( array(), ScriptedMailer::$sent );
	}

	/**
	 * The public API returns the provider error.
	 *
	 * @return void
	 */
	public function test_public_api_returns_the_provider_error() {
		$interceptor                 = $this->interceptor( array( 'fail' ), array( 'fallback_to_default' => false ) );
		$container                   = VuloMail();
		$container->wp_mail          = $interceptor;
		$GLOBALS['vulomail_wp_mail'] = array();

		Functions\when( 'wp_mail' )->alias(
			// phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- every parameter is read through compact() below.
			static function ( $to, $subject, $message, $headers = '', $attachments = array() ) use ( $interceptor ) {
				return (bool) $interceptor->maybe_send( null, compact( 'to', 'subject', 'message', 'headers', 'attachments' ) );
			}
		);

		$missing = vulomail_send_email( array( 'subject' => 'No recipient' ) );
		$failed  = vulomail_send_email(
			array(
				'to'      => 'jane@example.com',
				'subject' => 'Hi',
				'message' => 'Body',
				'source'  => 'My-Plugin',
			)
		);

		$this->assertSame( 'vulomail_invalid_args', $missing->get_error_code() );
		$this->assertInstanceOf( \WP_Error::class, $failed );
		$this->assertSame( 'Provider said no', $failed->get_error_message() );
		$this->assertSame( 'my-plugin', $this->logs->rows[0]['source'] );
	}
}
