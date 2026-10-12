<?php
/**
 * Result class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Delivery;

defined( 'ABSPATH' ) || exit;

/**
 * Outcome of one delivery attempt through one provider.
 */
class Result {

	/**
	 * Whether the attempt succeeded.
	 *
	 * @var bool
	 */
	public $success = false;

	/**
	 * Provider id, e.g. 'smtp' or 'twilio'.
	 *
	 * @var string
	 */
	public $provider = '';

	/**
	 * Connection id the attempt was made through.
	 *
	 * @var string
	 */
	public $connection_id = '';

	/**
	 * Provider-side message id, when the provider returns one.
	 *
	 * @var string
	 */
	public $message_id = '';

	/**
	 * Machine-readable error code.
	 *
	 * @var string
	 */
	public $error_code = '';

	/**
	 * Human-readable error message.
	 *
	 * @var string
	 */
	public $error_message = '';

	/**
	 * Every attempt made for this message, in order (set by a dispatcher on its final result).
	 *
	 * @var array<int, array>
	 */
	public $attempts = array();

	/**
	 * Row id in the delivery log, when the message was logged.
	 *
	 * @var int
	 */
	public $log_id = 0;

	/**
	 * Build a successful result.
	 *
	 * @param string $message_id Provider-side message id.
	 * @return self
	 */
	public static function ok( $message_id = '' ) {
		$result             = new self();
		$result->success    = true;
		$result->message_id = substr( (string) $message_id, 0, 255 );

		return $result;
	}

	/**
	 * Build a failed result.
	 *
	 * @param string $code    Machine-readable error code.
	 * @param string $message Human-readable error, already scrubbed of credentials.
	 * @return self
	 */
	public static function fail( $code, $message ) {
		$result                = new self();
		$result->error_code    = substr( (string) $code, 0, 100 );
		$result->error_message = (string) $message;

		return $result;
	}

	/**
	 * Convert the result into a WP_Error.
	 *
	 * @return \WP_Error
	 */
	public function to_wp_error() {
		return new \WP_Error( '' !== $this->error_code ? $this->error_code : 'vulomail_send_failed', $this->error_message );
	}

	/**
	 * Convert the result into a plain array.
	 *
	 * @return array
	 */
	public function to_array() {
		return array(
			'success'       => $this->success,
			'provider'      => $this->provider,
			'connection_id' => $this->connection_id,
			'message_id'    => $this->message_id,
			'error_code'    => $this->error_code,
			'error_message' => $this->error_message,
		);
	}
}
