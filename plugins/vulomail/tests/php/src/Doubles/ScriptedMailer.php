<?php
/**
 * ScriptedMailer test double file.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use VuloMail\Delivery\Result;
use VuloMail\Email\MailerInterface;
use VuloMail\Email\Message;

/**
 * Email adapter whose outcome is scripted per connection through its `outcome` setting.
 */
class ScriptedMailer implements MailerInterface {

	/**
	 * Every message handed to send(), across all instances.
	 *
	 * @var array<int, array{config: array, message: Message}>
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
		return array(
			'label'  => 'Scripted',
			'desc'   => '',
			'fields' => array(
				array(
					'key'      => 'outcome',
					'label'    => 'Outcome',
					'type'     => 'text',
					'required' => true,
				),
				array(
					'key'    => 'token',
					'label'  => 'Token',
					'type'   => 'password',
					'secret' => true,
				),
			),
		);
	}

	/**
	 * Records the message and returns the scripted outcome.
	 *
	 * @param Message $message Message to send.
	 * @throws \RuntimeException When the scripted outcome is 'throw'.
	 * @return Result
	 */
	public function send( Message $message ) {
		self::$sent[] = array(
			'config'  => $this->config,
			'message' => $message,
		);

		if ( 'throw' === $this->config['outcome'] ) {
			throw new \RuntimeException( 'boom' );
		}

		return 'ok' === $this->config['outcome'] ? Result::ok( 'msg-1' ) : Result::fail( 'rejected', 'Provider said no' );
	}
}
