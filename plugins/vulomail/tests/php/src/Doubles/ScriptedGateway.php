<?php
/**
 * ScriptedGateway test double file.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use VuloMail\Delivery\Result;
use VuloMail\Sms\GatewayInterface;

/**
 * SMS adapter scripted the same way.
 */
class ScriptedGateway implements GatewayInterface {

	/**
	 * Every message handed to send(), across all instances.
	 *
	 * @var array<int, array{to: string, body: string}>
	 */
	public static $sent = array();

	/**
	 * Connection settings, secrets decrypted.
	 *
	 * @var array
	 */
	private $config;

	/**
	 * Constructor.
	 *
	 * @param array $config Connection settings, secrets decrypted.
	 * @param mixed $http   Unused.
	 */
	public function __construct( array $config, $http = null ) {
		$this->config = $config;
	}

	/**
	 * Describes the provider and its connection fields.
	 *
	 * @return array
	 */
	public static function definition() {
		return ScriptedMailer::definition();
	}

	/**
	 * Records the message and returns the scripted outcome.
	 *
	 * @param string $to   Recipient number.
	 * @param string $body Message text.
	 * @return Result
	 */
	public function send( $to, $body ) {
		self::$sent[] = compact( 'to', 'body' );

		return 'ok' === $this->config['outcome'] ? Result::ok( 'sms-1' ) : Result::fail( 'rejected', 'Gateway said no' );
	}
}
