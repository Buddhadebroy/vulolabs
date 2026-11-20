<?php
/**
 * SMS Dispatcher class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Sms;

use VuloMail\Connections\ConnectionRepository;
use VuloMail\Connections\ProviderRegistry;
use VuloMail\Delivery\Result;
use VuloMail\Email\Tracking;
use VuloMail\Logging\Logger;
use VuloMail\Settings\Settings;
use VuloMail\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Sends a text message through the primary SMS connection, then the backup if the primary fails.
 */
class Dispatcher {

	/**
	 * Longest message accepted (ten concatenated segments).
	 */
	const MAX_LENGTH = 1530;

	/**
	 * Plugin settings.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Saved connections.
	 *
	 * @var ConnectionRepository
	 */
	private $connections;

	/**
	 * Provider adapters.
	 *
	 * @var ProviderRegistry
	 */
	private $providers;

	/**
	 * Delivery log.
	 *
	 * @var Logger
	 */
	private $logger;

	/**
	 * Click tracking, shared with email - the redirect endpoint it serves has nothing
	 * email-specific about it.
	 *
	 * @var Tracking|null
	 */
	private $tracking;

	/**
	 * Constructor.
	 *
	 * @param Settings             $settings    Plugin settings.
	 * @param ConnectionRepository $connections Saved connections.
	 * @param ProviderRegistry     $providers   Provider adapters.
	 * @param Logger               $logger      Delivery log.
	 * @param Tracking|null        $tracking    Click tracking.
	 */
	public function __construct( Settings $settings, ConnectionRepository $connections, ProviderRegistry $providers, Logger $logger, ?Tracking $tracking = null ) {
		$this->settings    = $settings;
		$this->connections = $connections;
		$this->providers   = $providers;
		$this->logger      = $logger;
		$this->tracking    = $tracking;
	}

	/**
	 * Usable connections, tried in order: primary, then backup.
	 *
	 * @return array<int, array>
	 */
	public function chain() {
		$chain = array();

		foreach ( array_unique( array( (string) $this->settings->get( 'sms_primary' ), (string) $this->settings->get( 'sms_backup' ) ) ) as $id ) {
			$connection = ! empty( $id ) ? $this->connections->get( $id ) : null;

			if ( $connection && Utill::CHANNEL_SMS === $connection['channel'] && $this->connections->is_usable( $connection ) ) {
				$chain[] = $connection;
			}
		}

		return $chain;
	}

	/**
	 * Whether an SMS can be sent right now.
	 *
	 * @return bool
	 */
	public function is_ready() {
		return (bool) $this->settings->get( 'sms_enabled' ) && (bool) $this->chain();
	}

	/**
	 * Sends a text message through the chain.
	 *
	 * @param string $to     Recipient; national numbers use the default country code.
	 * @param string $body   Message text.
	 * @param string $source Sender slug, for the log.
	 * @return Result Final outcome, ->attempts filled in.
	 */
	public function send( $to, $body, $source = '' ) {
		$number = PhoneNumber::normalize( $to, (string) $this->settings->get( 'sms_country_code' ) );
		$body   = trim( wp_strip_all_tags( (string) $body ) );

		/**
		 * Filters an SMS before it is sent. Return an empty string to cancel it.
		 *
		 * @param string $body   Message text.
		 * @param string $number Recipient in E.164 format ('' if the number was invalid).
		 * @param string $source Sender slug.
		 */
		$body = (string) apply_filters( 'vulomail_sms_message', $body, $number, $source );

		if ( ! $this->settings->get( 'sms_enabled' ) ) {
			return Result::fail( 'sms_disabled', __( 'SMS sending is switched off.', 'vulomail' ) );
		}

		if ( '' === $number ) {
			$final = Result::fail( 'invalid_number', __( 'The recipient is not a valid phone number. Use international format, or set a default country code.', 'vulomail' ) );
		} elseif ( '' === $body ) {
			return Result::fail( 'empty_message', __( 'The message is empty.', 'vulomail' ) );
		} elseif ( mb_strlen( $body ) > self::MAX_LENGTH ) {
			$final = Result::fail( 'message_too_long', __( 'The message is too long to send as an SMS.', 'vulomail' ) );
		} else {
			$final = Result::fail( 'not_configured', __( 'No SMS connection is configured.', 'vulomail' ) );

			// The log keeps $body as submitted, so a resend tracks fresh under its own token;
			// only the copy actually handed to the gateway gets its links rewritten.
			$tracking      = $this->click_tracking();
			$outgoing_body = $tracking ? $this->tracking->rewrite_plain_text_links( $body, $tracking['token'] ) : $body;

			$attempts = array();

			foreach ( $this->chain() as $index => $connection ) {
				$final           = $this->send_via( $connection, $number, $outgoing_body );
				$attempts[]      = $final->to_array();
				$final->attempts = $attempts;

				if ( $final->success ) {
					$final->log_id = $this->logger->sms( $number, $body, $final, $index > 0, $source, $tracking );

					/**
					 * Fires after an SMS is accepted by a gateway.
					 *
					 * @param string $number Recipient.
					 * @param string $body   Message text.
					 * @param Result $final  Outcome.
					 */
					do_action( 'vulomail_sms_sent', $number, $body, $final );

					return $final;
				}
			}
		}

		$final->log_id = $this->logger->sms( ! empty( $number ) ? $number : (string) $to, $body, $final, false, $source );

		/**
		 * Fires when an SMS could not be sent.
		 *
		 * @param string $number Recipient ('' if invalid).
		 * @param string $body   Message text.
		 * @param Result $final  Outcome of the last attempt; ->attempts lists them all.
		 */
		do_action( 'vulomail_sms_failed', $number, $body, $final );

		return $final;
	}

	/**
	 * A fresh click-tracking token for a text message about to be sent, when the site owner
	 * opted in. A message with no link in it still gets one - rewrite_plain_text_links() is a
	 * no-op without a URL to match, same as email tracking a message with no links.
	 *
	 * @return array{token: string, clicks: true}|null
	 */
	private function click_tracking() {
		if ( ! $this->tracking || ! $this->settings->get( 'sms_track_clicks' ) ) {
			return null;
		}

		return array(
			'token'  => Utill::random_token(),
			'clicks' => true,
		);
	}

	/**
	 * Sends through one specific connection; no failover, no logging.
	 *
	 * @param array  $connection Stored connection record.
	 * @param string $number     Recipient, E.164.
	 * @param string $body       Message text.
	 * @return Result
	 */
	public function send_via( array $connection, $number, $body ) {
		$gateway = $this->providers->make( Utill::CHANNEL_SMS, $connection['provider'], $this->connections->config( $connection ) );

		if ( ! $gateway ) {
			$result = Result::fail( 'unknown_provider', __( 'This connection uses a gateway that is no longer available.', 'vulomail' ) );
		} else {
			try {
				$result = $gateway->send( $number, $body );
			} catch ( \Throwable $e ) {
				$result = Result::fail( 'adapter_exception', __( 'The SMS gateway adapter failed unexpectedly.', 'vulomail' ) );
			}
		}

		$result->provider      = $connection['provider'];
		$result->connection_id = $connection['id'];

		return $result;
	}
}
