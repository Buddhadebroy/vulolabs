<?php
/**
 * Diagnostics decision tests: what PHP mail() can do, and what the delivery log says.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use VuloMail\Diagnostics\Diagnostics;

/**
 * Tests the Diagnostics decisions.
 */
class TestDiagnostics extends TestCase {

	/**
	 * Baseline environment: a reachable sendmail binary, no Windows, no SMTP needed.
	 *
	 * @var array
	 */
	const ENV = array(
		'function'      => true,
		'windows'       => false,
		'sendmail_path' => '/usr/sbin/sendmail -t -i',
		'binary_found'  => true,
		'smtp'          => 'localhost:25',
	);

	/**
	 * PHP mail() is available when the mail program exists.
	 *
	 * @return void
	 */
	public function test_php_mail_is_available_when_the_mail_program_exists() {
		$this->assertSame(
			array(
				'state'  => 'available',
				'detail' => '/usr/sbin/sendmail',
			),
			Diagnostics::describe_php_mail( self::ENV )
		);
	}

	/**
	 * PHP mail() is disabled when the function is unavailable.
	 *
	 * @return void
	 */
	public function test_php_mail_is_disabled_when_the_function_is_unavailable() {
		$mail = Diagnostics::describe_php_mail( array( 'function' => false ) + self::ENV );

		$this->assertSame( 'disabled', $mail['state'] );
	}

	/**
	 * PHP mail() has no transport when the mail program is missing.
	 *
	 * @return void
	 */
	public function test_php_mail_has_no_transport_when_the_mail_program_is_missing() {
		$this->assertSame(
			array(
				'state'  => 'no_transport',
				'detail' => '/usr/sbin/sendmail',
			),
			Diagnostics::describe_php_mail( array( 'binary_found' => false ) + self::ENV )
		);
	}

	/**
	 * PHP mail() has no transport when no mail program is configured.
	 *
	 * @return void
	 */
	public function test_php_mail_has_no_transport_when_no_mail_program_is_configured() {
		$mail = Diagnostics::describe_php_mail(
			array(
				'sendmail_path' => '',
				'binary_found'  => null,
			) + self::ENV
		);

		$this->assertSame( 'no_transport', $mail['state'] );
	}

	/**
	 * An unreadable mail program is not reported as missing.
	 *
	 * @return void
	 */
	public function test_an_unreadable_mail_program_is_not_reported_as_missing() {
		// open_basedir stops PHP from looking; that is not evidence the program is absent.
		$mail = Diagnostics::describe_php_mail( array( 'binary_found' => null ) + self::ENV );

		$this->assertSame( 'available', $mail['state'] );
	}

	/**
	 * Windows relays to its SMTP setting.
	 *
	 * @return void
	 */
	public function test_windows_relays_to_its_smtp_setting() {
		$mail = Diagnostics::describe_php_mail(
			array(
				'windows'       => true,
				'sendmail_path' => '',
				'binary_found'  => null,
			) + self::ENV
		);

		$this->assertSame(
			array(
				'state'  => 'available',
				'detail' => 'localhost:25',
			),
			$mail
		);
	}

	/**
	 * Recent summary counts failures and the newest streak.
	 *
	 * @return void
	 */
	public function test_recent_summary_counts_failures_and_the_newest_streak() {
		$rows = array(
			array( 'status' => 'failed' ),
			array( 'status' => 'failed' ),
			array( 'status' => 'sent' ),
			array( 'status' => 'failed' ),
		);

		$this->assertSame(
			array(
				'total'  => 4,
				'failed' => 3,
				'streak' => 2,
			),
			Diagnostics::summarise_recent( $rows )
		);
	}

	/**
	 * Recent summary has no streak when the newest was sent.
	 *
	 * @return void
	 */
	public function test_recent_summary_has_no_streak_when_the_newest_was_sent() {
		$summary = Diagnostics::summarise_recent( array( array( 'status' => 'sent' ), array( 'status' => 'failed' ) ) );

		$this->assertSame( 0, $summary['streak'] );
		$this->assertSame( 1, $summary['failed'] );
	}
}
