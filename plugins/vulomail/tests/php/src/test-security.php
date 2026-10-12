<?php
/**
 * Secrets and Redactor tests.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use VuloMail\Security\Redactor;
use VuloMail\Security\Secrets;

/**
 * Tests Secrets and Redactor.
 */
class TestSecurity extends TestCase {

	/**
	 * A secret round-trips and is not stored in plain text.
	 *
	 * @return void
	 */
	public function test_secret_round_trips_and_is_not_stored_in_plain_text() {
		$secrets = new Secrets();
		$stored  = $secrets->encrypt( 'SG.super-secret-key' );

		$this->assertStringStartsWith( Secrets::PREFIX, $stored );
		$this->assertStringNotContainsString( 'super-secret', $stored );
		$this->assertSame( 'SG.super-secret-key', $secrets->decrypt( $stored ) );
	}

	/**
	 * The same secret encrypts differently each time.
	 *
	 * @return void
	 */
	public function test_same_secret_encrypts_differently_each_time() {
		$secrets = new Secrets();

		$this->assertNotSame( $secrets->encrypt( 'abc12345' ), $secrets->encrypt( 'abc12345' ) );
	}

	/**
	 * Tampered or foreign values decrypt to empty.
	 *
	 * @return void
	 */
	public function test_tampered_or_foreign_values_decrypt_to_empty() {
		$secrets = new Secrets();
		$stored  = $secrets->encrypt( 'abc12345' );

		$this->assertSame( '', $secrets->decrypt( substr( $stored, 0, -4 ) . 'AAAA' ) );
		$this->assertSame( '', $secrets->decrypt( 'plain-text-value' ) );
		$this->assertSame( '', $secrets->decrypt( '' ) );
	}

	/**
	 * A secret is unreadable after the site salt changes.
	 *
	 * @return void
	 */
	public function test_secret_is_unreadable_after_the_site_salt_changes() {
		$stored = ( new Secrets() )->encrypt( 'abc12345' );

		\Brain\Monkey\Functions\when( 'wp_salt' )->justReturn( 'rotated-salt' );

		$this->assertSame( '', ( new Secrets() )->decrypt( $stored ) );
	}

	/**
	 * Mask never reveals short secrets.
	 *
	 * @return void
	 */
	public function test_mask_never_reveals_short_secrets() {
		$this->assertSame( '', Secrets::mask( '' ) );
		$this->assertSame( '••••••••', Secrets::mask( 'short' ) );
		$this->assertSame( '••••••••7890', Secrets::mask( 'abcdef1234567890' ) );
	}

	/**
	 * Scrub removes known secrets and credential patterns.
	 *
	 * @return void
	 */
	public function test_scrub_removes_known_secrets_and_credential_patterns() {
		$text = Redactor::scrub(
			'Auth failed for key SG.abc123 at https://api.example.com/?api_key=zzzz9999&x=1 Authorization: Bearer abcdef123456',
			array( 'SG.abc123' )
		);

		$this->assertStringNotContainsString( 'SG.abc123', $text );
		$this->assertStringNotContainsString( 'zzzz9999', $text );
		$this->assertStringNotContainsString( 'abcdef123456', $text );
		$this->assertStringContainsString( 'x=1', $text );
	}

	/**
	 * The email and phone masking helpers work as expected.
	 *
	 * @return void
	 */
	public function test_masking_helpers() {
		$this->assertSame( 'j•••@example.com', Redactor::mask_email( 'jane.doe@example.com' ) );
		$this->assertSame( '•••••••••123', Redactor::mask_phone( '+14155550123' ) );
	}
}
