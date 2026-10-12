<?php
/**
 * FakeHttp test double file.
 *
 * @package VuloMail
 */

namespace VuloMail\Tests;

use VuloMail\Security\HttpClient;

/**
 * Records requests and replays queued responses instead of touching the network.
 */
class FakeHttp extends HttpClient {

	/**
	 * Every request made through post().
	 *
	 * @var array<int, array{url: string, headers: array, body: mixed}>
	 */
	public $requests = array();

	/**
	 * Queued responses or errors, replayed in order.
	 *
	 * @var array
	 */
	private $queue = array();

	/**
	 * Queues a response for the next post() call.
	 *
	 * @param int    $code    HTTP status.
	 * @param array  $json    Decoded body.
	 * @param array  $headers Response headers.
	 * @param string $body    Raw body; defaults to the JSON.
	 * @return void
	 */
	public function queue( $code, array $json = array(), array $headers = array(), $body = null ) {
		$this->queue[] = array(
			'code'    => $code,
			'json'    => $json,
			'headers' => $headers,
			'body'    => null === $body ? wp_json_encode( $json ) : $body,
		);
	}

	/**
	 * Queues a transport error for the next post() call.
	 *
	 * @param \WP_Error $error Transport error to return.
	 * @return void
	 */
	public function queue_error( \WP_Error $error ) {
		$this->queue[] = $error;
	}

	/**
	 * Records the request and returns the next queued response.
	 *
	 * @param string $url     Request URL.
	 * @param array  $headers Request headers.
	 * @param mixed  $body    Request body.
	 * @return array|\WP_Error
	 */
	public function post( $url, array $headers, $body ) {
		$this->requests[] = compact( 'url', 'headers', 'body' );

		return array_shift( $this->queue );
	}
}
