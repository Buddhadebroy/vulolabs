<?php
/**
 * ConnectionRepository and Settings tests.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use VuloMail\Connections\ConnectionRepository;
use VuloMail\Connections\ProviderRegistry;
use VuloMail\Security\Secrets;
use VuloMail\Settings\Settings;

/**
 * Tests ConnectionRepository and Settings.
 */
class TestConnections extends TestCase {

	/**
	 * Builds a repository backed by a fake HTTP client.
	 *
	 * @return ConnectionRepository
	 */
	private function repository() {
		return new ConnectionRepository( new Secrets(), new ProviderRegistry( new FakeHttp() ) );
	}

	/**
	 * Secret fields are encrypted at rest and masked for display.
	 *
	 * @return void
	 */
	public function test_secret_fields_are_encrypted_at_rest_and_masked_for_display() {
		$repository = $this->repository();
		$saved      = $repository->save(
			array(
				'channel'  => 'email',
				'provider' => 'sendgrid',
				'label'    => 'Main',
				'settings' => array( 'api_key' => 'SG.abcdefghijklmnop' ),
			)
		);

		$this->assertStringNotContainsString( 'SG.abcdefghijklmnop', (string) wp_json_encode( $this->options['vulomail_connections'] ) );
		$this->assertSame( 'SG.abcdefghijklmnop', $repository->config( $saved )['api_key'] );

		$display = $repository->for_display( $saved );

		$this->assertSame( '••••••••mnop', $display['settings']['api_key'] );
		$this->assertSame( array(), $display['missing'] );
	}

	/**
	 * Saving with the mask or an empty value keeps the stored secret.
	 *
	 * @return void
	 */
	public function test_saving_with_the_mask_or_an_empty_value_keeps_the_stored_secret() {
		$repository = $this->repository();
		$saved      = $repository->save(
			array(
				'channel'  => 'email',
				'provider' => 'mailgun',
				'settings' => array(
					'api_key' => 'key-1234567890abcdef',
					'domain'  => 'mg.example.com',
				),
			)
		);

		foreach ( array( '••••••••cdef', '' ) as $untouched ) {
			$updated = $repository->save(
				array(
					'id'       => $saved['id'],
					'settings' => array(
						'api_key' => $untouched,
						'domain'  => 'mg2.example.com',
						'region'  => 'eu',
					),
				)
			);

			$config = $repository->config( $updated );

			$this->assertSame( 'key-1234567890abcdef', $config['api_key'] );
			$this->assertSame( 'mg2.example.com', $config['domain'] );
			$this->assertSame( 'eu', $config['region'] );
		}
	}

	/**
	 * The provider cannot be changed on an existing connection.
	 *
	 * @return void
	 */
	public function test_provider_cannot_be_changed_on_an_existing_connection() {
		$repository = $this->repository();
		$saved      = $repository->save(
			array(
				'channel'  => 'email',
				'provider' => 'sendgrid',
				'settings' => array( 'api_key' => 'SG.abcdefghijklmnop' ),
			)
		);
		$updated    = $repository->save(
			array(
				'id'       => $saved['id'],
				'channel'  => 'sms',
				'provider' => 'twilio',
			)
		);

		$this->assertSame( 'email', $updated['channel'] );
		$this->assertSame( 'sendgrid', $updated['provider'] );
	}

	/**
	 * An unknown provider and an unknown id are both rejected.
	 *
	 * @return void
	 */
	public function test_unknown_provider_and_unknown_id_are_rejected() {
		$repository = $this->repository();

		$this->assertInstanceOf(
			\WP_Error::class,
			$repository->save(
				array(
					'channel'  => 'email',
					'provider' => 'nope',
				)
			)
		);
		$this->assertInstanceOf( \WP_Error::class, $repository->save( array( 'id' => 'cmissing' ) ) );
	}

	/**
	 * Missing fields respects conditional requirements.
	 *
	 * @return void
	 */
	public function test_missing_fields_respects_conditional_requirements() {
		$repository = $this->repository();
		$with_auth  = $repository->save(
			array(
				'channel'  => 'email',
				'provider' => 'smtp',
				'settings' => array(
					'host' => 'smtp.example.com',
					'auth' => true,
				),
			)
		);
		$no_auth    = $repository->save(
			array(
				'channel'  => 'email',
				'provider' => 'smtp',
				'settings' => array(
					'host' => 'smtp.example.com',
					'auth' => false,
				),
			)
		);

		$this->assertSame( array( 'Username', 'Password' ), $repository->missing_fields( $with_auth ) );
		$this->assertFalse( $repository->is_usable( $with_auth ) );
		$this->assertSame( array(), $repository->missing_fields( $no_auth ) );
		$this->assertTrue( $repository->is_usable( $no_auth ) );
	}

	/**
	 * Field values are validated against the schema.
	 *
	 * @return void
	 */
	public function test_field_values_are_validated_against_the_schema() {
		$repository = $this->repository();
		$saved      = $repository->save(
			array(
				'channel'  => 'email',
				'provider' => 'smtp',
				'settings' => array(
					'host'       => "smtp.example.com\r\nRCPT TO:<x@evil.test>",
					'port'       => '465abc',
					'encryption' => 'rot13',
				),
			)
		);

		$this->assertStringNotContainsString( "\n", $saved['settings']['host'] );
		$this->assertSame( 465, $saved['settings']['port'] );
		$this->assertSame( 'tls', $saved['settings']['encryption'] );
	}

	/**
	 * Delete removes the connection.
	 *
	 * @return void
	 */
	public function test_delete_removes_the_connection() {
		$repository = $this->repository();
		$saved      = $repository->save(
			array(
				'channel'  => 'sms',
				'provider' => 'clickatell',
				'settings' => array( 'api_key' => 'abcdefgh12345678' ),
			)
		);

		$this->assertTrue( $repository->delete( $saved['id'] ) );
		$this->assertNull( $repository->get( $saved['id'] ) );
		$this->assertFalse( $repository->delete( $saved['id'] ) );
	}

	/**
	 * Settings drop unknown keys and validate values.
	 *
	 * @return void
	 */
	public function test_settings_drop_unknown_keys_and_validate_values() {
		$settings = new Settings();
		$updated  = $settings->update(
			array(
				'from_email'          => 'not-an-email',
				'from_name'           => "Shop\r\nBcc: x@evil.test",
				'log_retention_days'  => -5,
				'keep_data_uninstall' => 'whatever',
				'sms_country_code'    => '+44 (0)',
				'log_content'         => 1,
				'injected'            => 'value',
				'sms_triggers'        => array(
					'user_registered' => array(
						'enabled'  => '1',
						'template' => '<b>Hi</b> {username}',
					),
				),
			)
		);

		$this->assertSame( '', $updated['from_email'] );
		$this->assertStringNotContainsString( "\n", $updated['from_name'] );
		$this->assertSame( 0, $updated['log_retention_days'] );
		$this->assertSame( 'keep_data', $updated['keep_data_uninstall'] );
		$this->assertSame( '440', $updated['sms_country_code'] );
		$this->assertTrue( $updated['log_content'] );
		$this->assertArrayNotHasKey( 'injected', $updated );
		$this->assertSame( 'Hi {username}', $updated['sms_triggers']['user_registered']['template'] );
		$this->assertTrue( $updated['sms_triggers']['user_registered']['enabled'] );
	}
}
