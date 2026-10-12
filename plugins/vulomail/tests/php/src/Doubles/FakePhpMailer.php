<?php
/**
 * FakePhpMailer test double file.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

/**
 * Stand-in for PHPMailer that records how it was configured.
 */
class FakePhpMailer {

	// phpcs:disable WordPress.NamingConventions.ValidVariableName -- mirrors PHPMailer's public API.

	/**
	 * SMTP host.
	 *
	 * @var string
	 */
	public $Host = 'localhost';

	/**
	 * SMTP port.
	 *
	 * @var int
	 */
	public $Port = 25;

	/**
	 * SMTP encryption ('', 'ssl' or 'tls').
	 *
	 * @var string
	 */
	public $SMTPSecure = '';

	/**
	 * Whether SMTPSecure is auto-detected.
	 *
	 * @var bool
	 */
	public $SMTPAutoTLS = true;

	/**
	 * Whether SMTP authentication is used.
	 *
	 * @var bool
	 */
	public $SMTPAuth = false;

	/**
	 * SMTP username.
	 *
	 * @var string
	 */
	public $Username = '';

	/**
	 * SMTP password.
	 *
	 * @var string
	 */
	public $Password = '';

	/**
	 * Connection timeout, in seconds.
	 *
	 * @var int
	 */
	public $Timeout = 300;

	/**
	 * SMTP debug output level.
	 *
	 * @var int
	 */
	public $SMTPDebug = 0;

	/**
	 * Transport in use ('mail' or 'smtp').
	 *
	 * @var string
	 */
	public $Mailer = 'mail';

	/**
	 * Message character set.
	 *
	 * @var string
	 */
	public $CharSet = '';

	/**
	 * Message subject.
	 *
	 * @var string
	 */
	public $Subject = '';

	/**
	 * Message body.
	 *
	 * @var string
	 */
	public $Body = '';

	/**
	 * Message content type.
	 *
	 * @var string
	 */
	public $ContentType = '';
	// phpcs:enable

	/**
	 * Every method call made on this double, as [name, args].
	 *
	 * @var array
	 */
	public $calls = array();

	/**
	 * Thrown by send() when set.
	 *
	 * @var \Exception|null
	 */
	public $fail_with = null;

	/**
	 * Records a call to any undefined PHPMailer property-setting method.
	 *
	 * @param string $name Method name.
	 * @param array  $args Method arguments.
	 * @return void
	 */
	public function __call( $name, $args ) {
		$this->calls[] = array( $name, $args );
	}

	/**
	 * Switches the mailer into SMTP mode.
	 *
	 * @return void
	 */
	public function isSMTP() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName
		$this->Mailer = 'smtp'; // phpcs:ignore WordPress.NamingConventions.ValidVariableName
	}

	/**
	 * Sets whether the body is HTML.
	 *
	 * @param bool $html Whether the body is HTML.
	 * @return void
	 */
	public function isHTML( $html ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName
		$this->ContentType = $html ? 'text/html' : 'text/plain'; // phpcs:ignore WordPress.NamingConventions.ValidVariableName
	}

	/**
	 * Sends the message, or throws the scripted failure.
	 *
	 * @throws \Exception When fail_with is set.
	 * @return bool
	 */
	public function send() {
		if ( $this->fail_with ) {
			throw $this->fail_with;
		}

		return true;
	}

	/**
	 * Returns a fake provider-side message id.
	 *
	 * @return string
	 */
	public function getLastMessageID() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName
		return '<abc@example.com>';
	}

	/**
	 * Arguments of every call made to a given method.
	 *
	 * @param string $method Method name.
	 * @return array<int, array> Arguments of every call to that method.
	 */
	public function calls_to( $method ) {
		$matches = array();

		foreach ( $this->calls as $call ) {
			if ( $call[0] === $method ) {
				$matches[] = $call[1];
			}
		}

		return $matches;
	}
}
