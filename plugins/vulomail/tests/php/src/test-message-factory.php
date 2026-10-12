<?php
/**
 * MessageFactory tests.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use VuloMail\Email\MessageFactory;
use VuloMail\Settings\Settings;

/**
 * Tests MessageFactory.
 */
class TestMessageFactory extends TestCase {

	/**
	 * Builds a factory backed by the given settings.
	 *
	 * @param array $settings Stored settings.
	 * @return MessageFactory
	 */
	private function factory( array $settings = array() ) {
		$this->options['vulomail_settings'] = $settings;

		return new MessageFactory( new Settings() );
	}

	/**
	 * Parses recipients in every wp_mail() format.
	 *
	 * @return void
	 */
	public function test_parses_recipients_in_every_wp_mail_format() {
		$message = $this->factory()->from_wp_mail(
			array(
				'to'      => 'a@example.com, "Doe, Jane" <jane@example.com>, not-an-email',
				'subject' => 'Hi',
				'message' => 'Body',
			)
		);

		$this->assertSame( array( 'a@example.com', 'jane@example.com' ), array_column( $message->to, 'email' ) );
		$this->assertSame( 'Doe, Jane', $message->to[1]['name'] );
	}

	/**
	 * Parses string headers.
	 *
	 * @return void
	 */
	public function test_parses_string_headers() {
		$message = $this->factory()->from_wp_mail(
			array(
				'to'      => array( 'a@example.com' ),
				'subject' => 'Hi',
				'message' => '<b>Body</b>',
				'headers' => "From: Shop <shop@example.com>\r\nContent-Type: text/html; charset=ISO-8859-1\r\nCc: c@example.com\r\nBcc: b@example.com\r\nReply-To: Help <help@example.com>\r\nX-Custom: 1",
			)
		);

		$this->assertSame( 'shop@example.com', $message->from_email );
		$this->assertSame( 'Shop', $message->from_name );
		$this->assertTrue( $message->is_html() );
		$this->assertSame( 'ISO-8859-1', $message->charset );
		$this->assertSame( 'c@example.com', $message->cc[0]['email'] );
		$this->assertSame( 'b@example.com', $message->bcc[0]['email'] );
		$this->assertSame( 'help@example.com', $message->reply_to[0]['email'] );
		$this->assertSame( array( 'X-Custom' => '1' ), $message->headers );
		$this->assertSame( array( 'a@example.com', 'c@example.com', 'b@example.com' ), $message->all_recipients() );
	}

	/**
	 * Parses array and associative headers.
	 *
	 * @return void
	 */
	public function test_parses_array_and_associative_headers() {
		$message = $this->factory()->from_wp_mail(
			array(
				'to'      => 'a@example.com',
				'subject' => 'Hi',
				'message' => 'Body',
				'headers' => array(
					'Cc: one@example.com',
					'Reply-To' => 'two@example.com',
				),
			)
		);

		$this->assertSame( 'one@example.com', $message->cc[0]['email'] );
		$this->assertSame( 'two@example.com', $message->reply_to[0]['email'] );
	}

	/**
	 * Defaults match core.
	 *
	 * @return void
	 */
	public function test_defaults_match_core() {
		$message = $this->factory()->from_wp_mail(
			array(
				'to'      => 'a@example.com',
				'subject' => 'Hi',
				'message' => 'Body',
			)
		);

		$this->assertSame( 'wordpress@shop.example.com', $message->from_email );
		$this->assertSame( 'WordPress', $message->from_name );
		$this->assertSame( 'text/plain', $message->content_type );
		$this->assertSame( 'UTF-8', $message->charset );
	}

	/**
	 * A configured sender replaces only the core default.
	 *
	 * @return void
	 */
	public function test_configured_sender_replaces_only_the_core_default() {
		$factory = $this->factory(
			array(
				'from_email' => 'hello@example.com',
				'from_name'  => 'Example Shop',
			)
		);

		$default = $factory->from_wp_mail(
			array(
				'to'      => 'a@example.com',
				'subject' => 'Hi',
				'message' => 'Body',
			)
		);
		$custom  = $factory->from_wp_mail(
			array(
				'to'      => 'a@example.com',
				'subject' => 'Hi',
				'message' => 'Body',
				'headers' => 'From: Orders <orders@example.com>',
			)
		);

		$this->assertSame( 'hello@example.com', $default->from_email );
		$this->assertSame( 'Example Shop', $default->from_name );
		$this->assertSame( 'orders@example.com', $custom->from_email );
		$this->assertSame( 'Orders', $custom->from_name );
	}

	/**
	 * A forced sender overrides a plugin-supplied From header.
	 *
	 * @return void
	 */
	public function test_forced_sender_overrides_a_plugin_supplied_from_header() {
		$message = $this->factory(
			array(
				'from_email'       => 'hello@example.com',
				'from_name'        => 'Example Shop',
				'force_from_email' => true,
				'force_from_name'  => true,
			)
		)->from_wp_mail(
			array(
				'to'      => 'a@example.com',
				'subject' => 'Hi',
				'message' => 'Body',
				'headers' => 'From: Orders <orders@example.com>',
			)
		);

		$this->assertSame( 'hello@example.com', $message->from_email );
		$this->assertSame( 'Example Shop', $message->from_name );
	}

	/**
	 * Header injection attempts are dropped.
	 *
	 * @return void
	 */
	public function test_header_injection_attempts_are_dropped() {
		$message = $this->factory()->from_wp_mail(
			array(
				'to'      => array( "victim@example.com\r\nBcc: attacker@evil.test" ),
				'subject' => 'Hi',
				'message' => 'Body',
				'headers' => array(
					'X-Ok: fine',
					"X-Bad: value\r\nBcc: attacker@evil.test",
					'Bad Name: nope',
				),
			)
		);

		$this->assertSame( array(), $message->to );
		$this->assertSame( array(), $message->bcc );
		$this->assertSame( array( 'X-Ok' => 'fine' ), $message->headers );
	}

	/**
	 * Only readable attachments are kept.
	 *
	 * @return void
	 */
	public function test_only_readable_attachments_are_kept() {
		$file = tempnam( sys_get_temp_dir(), 'vm' );
		file_put_contents( $file, 'data' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents

		$message = $this->factory()->from_wp_mail(
			array(
				'to'          => 'a@example.com',
				'subject'     => 'Hi',
				'message'     => 'Body',
				'attachments' => array(
					'invoice.pdf' => $file,
					'/no/such/file.txt',
				),
			)
		);

		unlink( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink

		$this->assertSame( array( 'invoice.pdf' => $file ), $message->attachments );
	}
}
