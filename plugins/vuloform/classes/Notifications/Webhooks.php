<?php
/**
 * Webhooks class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Notifications;

use VuloForm\Forms\Conditions;
use VuloForm\Forms\FormRepository;
use VuloForm\Submissions\Formatter;
use VuloForm\Submissions\SubmissionRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Posts a submission to the form's webhook URLs.
 *
 * Delivery runs in the background so a slow endpoint never holds up the visitor. A failed attempt
 * is retried a fixed number of times, and every attempt for one submission carries the same
 * delivery id so the receiver can ignore a repeat.
 */
class Webhooks {

	/**
	 * Cron hook that performs one delivery attempt.
	 */
	const HOOK = 'vuloform_send_webhook';

	/**
	 * Attempts per webhook per submission, and the wait before each retry.
	 */
	const MAX_ATTEMPTS = 3;
	const RETRY_DELAYS = array( 5 * MINUTE_IN_SECONDS, 30 * MINUTE_IN_SECONDS );

	/**
	 * @var FormRepository
	 */
	private $forms;

	/**
	 * @var SubmissionRepository
	 */
	private $submissions;

	/**
	 * @param FormRepository       $forms       Form storage.
	 * @param SubmissionRepository $submissions Submission storage.
	 */
	public function __construct( FormRepository $forms, SubmissionRepository $submissions ) {
		$this->forms       = $forms;
		$this->submissions = $submissions;

		add_action( 'vuloform_submission_created', array( $this, 'queue' ), 20, 3 );
		add_action( self::HOOK, array( $this, 'attempt' ), 10, 3 );
	}

	/**
	 * `vuloform_submission_created` callback.
	 *
	 * @param int   $submission_id Submission id (0 when not stored).
	 * @param array $values        Field key => value.
	 * @param array $form          Form.
	 * @return void
	 */
	public function queue( $submission_id, array $values, array $form ) {
		foreach ( $form['schema']['settings']['webhooks'] as $webhook ) {
			if ( empty( $webhook['enabled'] ) || '' === $webhook['url'] || ! Conditions::applies( $webhook['conditions'] ?? null, $values ) ) {
				continue;
			}

			if ( $submission_id ) {
				wp_schedule_single_event( time(), self::HOOK, array( (int) $submission_id, $webhook['id'], 1 ) );
			} else {
				// Nothing is stored to retry from, so this is the one attempt.
				$this->send( $webhook, $form, 0, $values, gmdate( 'Y-m-d H:i:s' ) );
			}
		}
	}

	/**
	 * Cron callback: one delivery attempt.
	 *
	 * @param int    $submission_id Submission id.
	 * @param string $webhook_id    Webhook id within the form.
	 * @param int    $attempt       1-based attempt number.
	 * @return void
	 */
	public function attempt( $submission_id, $webhook_id, $attempt ) {
		$submission = $this->submissions->get( $submission_id );
		$form       = $submission ? $this->forms->get( $submission['form_id'] ) : null;

		if ( ! $form ) {
			return;
		}

		foreach ( $form['schema']['settings']['webhooks'] as $webhook ) {
			if ( $webhook['id'] !== $webhook_id || empty( $webhook['enabled'] ) ) {
				continue;
			}

			$event = $this->send( $webhook, $form, $submission['id'], $submission['data'], $submission['created_at'] );

			$event['attempt'] = (int) $attempt;

			if ( 'retry' === $event['status'] && $attempt < self::MAX_ATTEMPTS ) {
				wp_schedule_single_event( time() + self::RETRY_DELAYS[ $attempt - 1 ], self::HOOK, array( (int) $submission_id, $webhook_id, $attempt + 1 ) );
			} elseif ( 'retry' === $event['status'] ) {
				$event['status'] = 'failed';
			}

			$meta           = $submission['meta'];
			$meta['events'] = array_merge( isset( $meta['events'] ) && is_array( $meta['events'] ) ? $meta['events'] : array(), array( $event ) );

			$this->submissions->update_meta( $submission['id'], $meta );
		}
	}

	/**
	 * Sends one request.
	 *
	 * @param array  $webhook       Webhook settings.
	 * @param array  $form          Form.
	 * @param int    $submission_id Submission id.
	 * @param array  $values        Field key => stored value.
	 * @param string $created_at    UTC datetime of the submission.
	 * @return array Event record: status is delivered, retry or failed.
	 */
	public function send( array $webhook, array $form, $submission_id, array $values, $created_at ) {
		$problem = self::url_problem( $webhook['url'] );

		if ( '' !== $problem ) {
			return self::event( $webhook, 'failed', $problem );
		}

		$fields = array();

		foreach ( Formatter::rows( $form, $values ) as $row ) {
			if ( ! $webhook['fields'] || in_array( $row['key'], $webhook['fields'], true ) ) {
				$fields[ $row['key'] ] = $row['text'];
			}
		}

		$payload = array(
			'form_id'       => (int) $form['id'],
			'form_title'    => $form['title'],
			'submission_id' => (int) $submission_id,
			'submitted_at'  => gmdate( 'c', (int) strtotime( $created_at . ' UTC' ) ),
			'fields'        => $fields,
		);

		/**
		 * Filters the webhook payload.
		 *
		 * @param array $payload Payload to send as JSON.
		 * @param array $webhook Webhook settings.
		 * @param array $form    Form.
		 */
		$body    = wp_json_encode( apply_filters( 'vuloform_webhook_payload', $payload, $webhook, $form ) );
		$headers = array(
			'Content-Type'        => 'application/json',
			// The same for every attempt, so a receiver can drop a repeat.
			'X-VuloForm-Delivery' => (int) $submission_id . '-' . $webhook['id'],
		);

		if ( '' !== $webhook['secret'] ) {
			$headers['X-VuloForm-Signature'] = 'sha256=' . hash_hmac( 'sha256', $body, $webhook['secret'] );
		}

		// wp_safe_remote_post() refuses private and loopback addresses; no redirect is followed, so
		// an endpoint can't bounce the request somewhere it was not allowed to go.
		$response = wp_safe_remote_post(
			$webhook['url'],
			array(
				'timeout'     => 8,
				'redirection' => 0,
				'headers'     => $headers,
				'body'        => $body,
				'user-agent'  => 'VuloForm/' . VULOFORM_PLUGIN_VERSION,
			)
		);

		if ( is_wp_error( $response ) ) {
			return self::event( $webhook, 'retry', $response->get_error_message() );
		}

		$code = (int) wp_remote_retrieve_response_code( $response );

		if ( $code >= 200 && $code < 300 ) {
			/* translators: %d: HTTP status code. */
			return self::event( $webhook, 'delivered', sprintf( __( 'The endpoint answered HTTP %d.', 'vuloform' ), $code ) );
		}

		// A busy or broken server may recover; a 4xx means the request itself is wrong.
		/* translators: %d: HTTP status code. */
		return self::event( $webhook, $code >= 500 || 429 === $code ? 'retry' : 'failed', sprintf( __( 'The endpoint answered HTTP %d.', 'vuloform' ), $code ) );
	}

	/**
	 * Why a URL can't be used as a webhook destination, or '' when it can.
	 *
	 * @param string $url Destination.
	 * @return string
	 */
	public static function url_problem( $url ) {
		$parts = wp_parse_url( (string) $url );

		if ( empty( $parts['host'] ) || 'https' !== ( $parts['scheme'] ?? '' ) ) {
			return __( 'A webhook URL must start with https://.', 'vuloform' );
		}

		if ( ! empty( $parts['user'] ) || ! empty( $parts['pass'] ) ) {
			return __( 'A webhook URL can\'t contain a username or password.', 'vuloform' );
		}

		// Same checks WordPress applies before a "safe" request: no private, loopback or reserved address.
		$private = __( 'That address is not allowed. Webhooks can only be sent to public servers.', 'vuloform' );

		if ( ! wp_http_validate_url( $url ) ) {
			return $private;
		}

		// WordPress exempts the site's own host from that check; a webhook has no reason to call back
		// into the server it runs on, so the resolved address is checked here without exceptions.
		$host      = trim( $parts['host'], '[]' );
		$addresses = filter_var( $host, FILTER_VALIDATE_IP ) ? array( $host ) : gethostbynamel( $host );

		foreach ( $addresses ? $addresses : array( '' ) as $address ) {
			if ( ! filter_var( $address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE ) ) {
				return $private;
			}
		}

		return '';
	}

	/**
	 * @param array  $webhook Webhook settings.
	 * @param string $status  delivered, retry or failed.
	 * @param string $detail  Explanation. Never contains the response body or the secret.
	 * @return array
	 */
	private static function event( array $webhook, $status, $detail ) {
		return array(
			'type'   => 'webhook',
			'name'   => $webhook['name'],
			'status' => $status,
			'detail' => mb_substr( wp_strip_all_tags( (string) $detail ), 0, 300 ),
			'time'   => gmdate( 'Y-m-d H:i:s' ),
		);
	}
}
