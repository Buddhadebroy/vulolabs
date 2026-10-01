<?php
namespace VuloPilot\Performance;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Real Mobile/Desktop performance scores for "Performance" Overview's
 * PerformanceScoreCard.tsx, via Google's real PageSpeed Insights API.
 *
 * @class       PageSpeedInsightsFetcher class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PageSpeedInsightsFetcher {

	private const CRON_HOOK = 'vulopilot_psi_fetch';

	private const REQUEST_TIMEOUT_SECONDS = 30;

	private const API_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runpagespeed';

	private const USAGE_COUNT_OPTION = 'vulopilot_psi_requests_today';

	private const USAGE_DATE_OPTION = 'vulopilot_psi_requests_date';

	/**
	 * PageSpeedInsightsFetcher constructor.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'ensure_daily_fetch_scheduled' ) );
		add_action( self::CRON_HOOK, array( $this, 'fetch_and_store' ) );
		add_action( 'update_option_' . Utill::VULOPILOT_SETTINGS_KEY, array( $this, 'maybe_schedule_immediate_fetch' ), 10, 2 );
	}

	/**
	 * @return void
	 */
	public function ensure_daily_fetch_scheduled(): void {
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::CRON_HOOK );
		}
	}

	/**
	 * Schedules an immediate one-off fetch when `psi_api_key` was just set or changed.
	 *
	 * @param mixed $old_value Previous `vulopilot_settings` option value.
	 * @param mixed $new_value New `vulopilot_settings` option value.
	 * @return void
	 */
	public function maybe_schedule_immediate_fetch( $old_value, $new_value ): void {
		$old_key = is_array( $old_value ) ? (string) ( $old_value['psi_api_key'] ?? '' ) : '';
		$new_key = is_array( $new_value ) ? (string) ( $new_value['psi_api_key'] ?? '' ) : '';

		if ( '' === $new_key || $old_key === $new_key ) {
			return;
		}

		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_single_event( time() + 5, self::CRON_HOOK );
		}
	}

	/**
	 * @return void
	 */
	public function fetch_and_store(): void {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
		$api_key  = trim( (string) ( $settings['psi_api_key'] ?? '' ) );

		if ( '' === $api_key ) {
			return;
		}

		$mobile_score  = $this->fetch_score( $api_key, 'mobile' );
		$desktop_score = $this->fetch_score( $api_key, 'desktop' );

		if ( null !== $mobile_score ) {
			update_option( 'vulopilot_psi_mobile_score', $mobile_score );
		}

		if ( null !== $desktop_score ) {
			update_option( 'vulopilot_psi_desktop_score', $desktop_score );
		}

		if ( null !== $mobile_score || null !== $desktop_score ) {
			update_option( 'vulopilot_psi_checked_at', current_time( 'mysql' ) );
		}
	}

	/**
	 * Settings → Connections → PageSpeed Insights' own "Test Connection" button - the one
	 * place besides the daily cron that ever calls Google's real API.
	 *
	 * @return array{success: bool, message: string, mobile: int|null, desktop: int|null}
	 */
	public function test_connection(): array {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
		$api_key  = trim( (string) ( $settings['psi_api_key'] ?? '' ) );

		if ( '' === $api_key ) {
			return array(
				'success' => false,
				'message' => __( 'Enter an API key first.', 'vulopilot' ),
				'mobile'  => null,
				'desktop' => null,
			);
		}

		if ( ! $this->has_quota_remaining( $settings ) ) {
			return array(
				'success' => false,
				'message' => __( "Today's PageSpeed Insights API limit has already been reached.", 'vulopilot' ),
				'mobile'  => null,
				'desktop' => null,
			);
		}

		$mobile_score  = $this->fetch_score( $api_key, 'mobile' );
		$desktop_score = $this->fetch_score( $api_key, 'desktop' );

		if ( null === $mobile_score && null === $desktop_score ) {
			return array(
				'success' => false,
				'message' => __( 'Could not reach Google PageSpeed Insights - check your API key and try again.', 'vulopilot' ),
				'mobile'  => null,
				'desktop' => null,
			);
		}

		if ( null !== $mobile_score ) {
			update_option( 'vulopilot_psi_mobile_score', $mobile_score );
		}

		if ( null !== $desktop_score ) {
			update_option( 'vulopilot_psi_desktop_score', $desktop_score );
		}

		update_option( 'vulopilot_psi_checked_at', current_time( 'mysql' ) );

		return array(
			'success' => true,
			'message' => __( 'Connected - Google PageSpeed Insights responded successfully.', 'vulopilot' ),
			'mobile'  => $mobile_score,
			'desktop' => $desktop_score,
		);
	}

	/**
	 * Settings → Connections → PageSpeed Insights' own on-load state - the real
	 * "Connected"/"Not Connected" pill and "Daily API Usage" bar.
	 *
	 * @return array{connected: bool, mobile: int|null, desktop: int|null, checked_at: string|null, requests_today: int, daily_limit: int}
	 */
	public function get_status(): array {
		$settings   = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
		$checked_at = get_option( 'vulopilot_psi_checked_at', null );
		$today      = current_time( 'Y-m-d' );

		return array(
			'connected'      => '' !== trim( (string) ( $settings['psi_api_key'] ?? '' ) ) && null !== $checked_at,
			'mobile'         => get_option( 'vulopilot_psi_mobile_score', null ),
			'desktop'        => get_option( 'vulopilot_psi_desktop_score', null ),
			'checked_at'     => $checked_at,
			'requests_today' => get_option( self::USAGE_DATE_OPTION ) === $today ? (int) get_option( self::USAGE_COUNT_OPTION, 0 ) : 0,
			'daily_limit'    => absint( $settings['psi_daily_limit'] ?? 0 ),
		);
	}

	/**
	 * Real daily request counter behind "Daily API Usage" - rolls over the moment the
	 * stored date no longer matches today's.
	 *
	 * @return void
	 */
	private function record_request(): void {
		$today = current_time( 'Y-m-d' );

		if ( get_option( self::USAGE_DATE_OPTION ) !== $today ) {
			update_option( self::USAGE_DATE_OPTION, $today );
			update_option( self::USAGE_COUNT_OPTION, 0 );
		}

		update_option( self::USAGE_COUNT_OPTION, (int) get_option( self::USAGE_COUNT_OPTION, 0 ) + 1 );
	}

	/**
	 * Whether today's real request count is still under `psi_daily_limit`.
	 *
	 * @param array $settings Real, already-defaulted `vulopilot_settings`.
	 * @return bool
	 */
	private function has_quota_remaining( array $settings ): bool {
		$today = current_time( 'Y-m-d' );
		$used  = get_option( self::USAGE_DATE_OPTION ) === $today ? (int) get_option( self::USAGE_COUNT_OPTION, 0 ) : 0;
		$limit = absint( $settings['psi_daily_limit'] ?? 0 );

		return ! $limit || $used < $limit;
	}

	/**
	 * @param string $api_key  PSI API key.
	 * @param string $strategy 'mobile' or 'desktop'.
	 * @return int|null 0-100, or null if the request failed or the daily quota was hit.
	 */
	private function fetch_score( string $api_key, string $strategy ): ?int {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( ! $this->has_quota_remaining( $settings ) ) {
			return null;
		}

		$url = add_query_arg(
			array(
				'url'      => rawurlencode( home_url( '/' ) ),
				'key'      => $api_key,
				'strategy' => $strategy,
				'category' => 'performance',
			),
			self::API_BASE
		);

		$response = wp_remote_get(
			$url,
			array( 'timeout' => self::REQUEST_TIMEOUT_SECONDS )
		);

		$this->record_request();

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return null;
		}

		$body  = json_decode( wp_remote_retrieve_body( $response ), true );
		$score = $body['lighthouseResult']['categories']['performance']['score'] ?? null;

		if ( ! is_numeric( $score ) ) {
			return null;
		}

		return (int) round( ( (float) $score ) * 100 );
	}
}
