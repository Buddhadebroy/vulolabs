<?php
/**
 * Notifier class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Notifications;

use VuloForm\Forms\Conditions;
use VuloForm\Submissions\Formatter;
use VuloForm\Submissions\SubmissionRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Sends a form's email and SMS notifications after a submission is accepted.
 *
 * Email goes through VuloMail's public API when that plugin is active, otherwise through
 * wp_mail(). SMS is only possible through VuloMail. Either way, what is recorded is whether the
 * message was handed to the mail or SMS system, never that it was delivered: VuloForm can't know.
 */
class Notifier {

	/**
	 * @var SubmissionRepository
	 */
	private $submissions;

	/**
	 * Most addresses or numbers one notification is sent to.
	 */
	const MAX_RECIPIENTS = 10;

	/**
	 * @param SubmissionRepository $submissions Submission storage.
	 */
	public function __construct( SubmissionRepository $submissions ) {
		$this->submissions = $submissions;

		add_action( 'vuloform_submission_created', array( $this, 'send_all' ), 10, 3 );
	}

	/**
	 * `vuloform_submission_created` callback.
	 *
	 * @param int   $submission_id Submission id (0 when not stored).
	 * @param array $values        Field key => value.
	 * @param array $form          Form.
	 * @return void
	 */
	public function send_all( $submission_id, array $values, array $form ) {
		$events = array();

		foreach ( $form['schema']['settings']['notifications'] as $notification ) {
			if ( empty( $notification['enabled'] ) ) {
				continue;
			}

			if ( ! Conditions::applies( $notification['conditions'] ?? null, $values ) ) {
				// Recorded, so "why was nobody told?" has an answer on the submission.
				$events[] = self::event( $notification, 'skipped', __( 'Not sent: this submission does not meet the notification\'s conditions.', 'vuloform' ) );
				continue;
			}

			$channel = $notification['channel'];

			if ( 'sms' !== $channel ) {
				$events[] = $this->send_email( array_merge( $notification, array( 'channel' => 'email' ) ), $form, $values );
			}

			if ( 'sms' === $channel ) {
				$events[] = $this->send_sms( $notification, $form, $values );
			} elseif ( 'both' === $channel ) {
				// The same notification as a text message, to its own number and with its own, shorter text.
				$events[] = $this->send_sms(
					array_merge(
						$notification,
						array(
							'channel' => 'sms',
							'to'      => (string) ( $notification['sms_to'] ?? '' ),
							'message' => (string) ( $notification['sms_message'] ?? '' ),
						)
					),
					$form,
					$values
				);
			}
		}

		if ( $events && $submission_id ) {
			$submission = $this->submissions->get( $submission_id );

			if ( $submission ) {
				$meta           = $submission['meta'];
				$meta['events'] = array_merge( isset( $meta['events'] ) && is_array( $meta['events'] ) ? $meta['events'] : array(), $events );

				$this->submissions->update_meta( $submission_id, $meta );
			}
		}
	}

	/**
	 * @param array $notification Notification settings.
	 * @param array $form         Form.
	 * @param array $values       Field key => value.
	 * @return array Event record.
	 */
	public function send_email( array $notification, array $form, array $values ) {
		$recipients = array();

		foreach ( preg_split( '/[,;\s]+/', Formatter::fill( $notification['to'], $form, $values ) ) as $address ) {
			if ( is_email( $address ) ) {
				$recipients[] = $address;
			}
		}

		if ( ! $recipients ) {
			return self::event( $notification, 'skipped', __( 'No valid recipient address.', 'vuloform' ) );
		}

		// A placeholder is filled with what a visitor typed; the cap keeps a form from being used to
		// mail a long list of strangers.
		$recipients = array_slice( array_values( array_unique( $recipients ) ), 0, self::MAX_RECIPIENTS );

		// A subject is a header: it must stay on one line.
		$subject = trim( preg_replace( '/[\r\n]+/', ' ', Formatter::fill( '' !== $notification['subject'] ? $notification['subject'] : __( 'New submission: {form_title}', 'vuloform' ), $form, $values ) ) );
		$message = Formatter::fill( '' !== $notification['message'] ? $notification['message'] : '{all_fields}', $form, $values );
		$headers = array( 'Content-Type: text/plain; charset=UTF-8' );
		$reply   = '' !== $notification['reply_to'] ? (string) ( $values[ $notification['reply_to'] ] ?? '' ) : '';

		if ( is_string( $reply ) && is_email( $reply ) ) {
			$headers[] = 'Reply-To: ' . $reply;
		}

		/**
		 * Filters a notification email before it is sent. Return false to cancel it.
		 *
		 * @param array|false $email        `to`, `subject`, `message`, `headers`.
		 * @param array       $notification Notification settings.
		 * @param array       $form         Form.
		 * @param array       $values       Field key => value.
		 */
		$email = apply_filters(
			'vuloform_notification_email',
			array(
				'to'      => $recipients,
				'subject' => $subject,
				'message' => $message,
				'headers' => $headers,
			),
			$notification,
			$form,
			$values
		);

		if ( ! is_array( $email ) ) {
			return self::event( $notification, 'skipped', __( 'Cancelled by another plugin.', 'vuloform' ) );
		}

		if ( function_exists( 'vulomail_send_email' ) ) {
			$sent = vulomail_send_email( array_merge( $email, array( 'source' => 'vuloform' ) ) );

			return true === $sent
				? self::event( $notification, 'handed_off', __( 'Handed to VuloMail.', 'vuloform' ) )
				: self::event( $notification, 'failed', is_wp_error( $sent ) ? $sent->get_error_message() : '' );
		}

		return wp_mail( $email['to'], $email['subject'], $email['message'], $email['headers'] )
			? self::event( $notification, 'handed_off', __( 'Handed to WordPress mail.', 'vuloform' ) )
			: self::event( $notification, 'failed', __( 'WordPress could not send the email.', 'vuloform' ) );
	}

	/**
	 * @param array $notification Notification settings.
	 * @param array $form         Form.
	 * @param array $values       Field key => value.
	 * @return array Event record.
	 */
	public function send_sms( array $notification, array $form, array $values ) {
		if ( ! self::sms_available() ) {
			return self::event( $notification, 'skipped', __( 'SMS needs VuloMail with an SMS connection.', 'vuloform' ) );
		}

		$message = Formatter::fill( '' !== $notification['message'] ? $notification['message'] : __( 'New submission: {form_title}', 'vuloform' ), $form, $values );
		$failed  = '';
		$sent    = 0;

		$numbers = array_filter( array_map( 'trim', preg_split( '/[,;]+/', Formatter::fill( $notification['to'], $form, $values ) ) ), 'strlen' );

		foreach ( array_slice( array_values( array_unique( $numbers ) ), 0, self::MAX_RECIPIENTS ) as $number ) {
			$result = vulomail_send_sms( $number, $message, array( 'source' => 'vuloform' ) );

			if ( true === $result ) {
				++$sent;
			} else {
				$failed = is_wp_error( $result ) ? $result->get_error_message() : '';
			}
		}

		if ( 0 === $sent ) {
			return self::event( $notification, '' !== $failed ? 'failed' : 'skipped', '' !== $failed ? $failed : __( 'No phone number to send to.', 'vuloform' ) );
		}

		return self::event( $notification, 'handed_off', __( 'Handed to VuloMail.', 'vuloform' ) );
	}

	/**
	 * @return bool Whether an SMS can be sent right now.
	 */
	public static function sms_available() {
		return function_exists( 'vulomail_send_sms' ) && function_exists( 'vulomail_is_sms_ready' ) && vulomail_is_sms_ready();
	}

	/**
	 * @param array  $notification Notification settings.
	 * @param string $status       handed_off, failed or skipped.
	 * @param string $detail       Explanation.
	 * @return array
	 */
	private static function event( array $notification, $status, $detail ) {
		return array(
			'type'   => $notification['channel'],
			'name'   => $notification['name'],
			'status' => $status,
			'detail' => mb_substr( wp_strip_all_tags( (string) $detail ), 0, 300 ),
			'time'   => gmdate( 'Y-m-d H:i:s' ),
		);
	}
}
