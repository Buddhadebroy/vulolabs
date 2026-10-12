<?php
/**
 * Utill class file.
 *
 * @package VuloForm
 */

namespace VuloForm;

defined( 'ABSPATH' ) || exit;

/**
 * VuloForm Utill class - shared constants and small helpers.
 */
class Utill {

	/**
	 * Custom table names, without the `$wpdb->prefix`.
	 *
	 * @var array<string, string>
	 */
	const TABLES = array(
		'form'       => 'vuloform_forms',
		'submission' => 'vuloform_submissions',
	);

	/**
	 * Option holding the site-wide settings.
	 */
	const SETTINGS_KEY = 'vuloform_settings';

	/**
	 * Internal bookkeeping options.
	 *
	 * @var array<string, string>
	 */
	const OTHER_SETTINGS = array(
		'run_installer'     => 'vuloform_run_installer',
		'plugin_db_version' => 'vuloform_plugin_db_version',
		'secret'            => 'vuloform_secret',
	);

	/**
	 * Capability required for every VuloForm admin screen and private REST route.
	 */
	const CAPABILITY = 'manage_options';

	/**
	 * Site-wide settings and their defaults.
	 *
	 * @var array<string, mixed>
	 */
	const SETTINGS_DEFAULTS = array(
		// Days a submission is kept; 0 keeps it until deleted.
		'retention_days'      => 0,
		// Whether the visitor's IP address is stored with a submission.
		'store_ip'            => false,
		// Submissions one visitor may send to one form per minute; 0 disables the limit.
		'rate_limit'          => 5,
		// A hidden field only bots fill in, and the fewest seconds a person needs to fill in a form
		// (0 switches that check off). Both apply to every form.
		'honeypot'            => true,
		'min_seconds'         => 2,
		// Google reCAPTCHA: v2 (checkbox) or v3 (score), its two keys, and the lowest v3 score
		// treated as a person. Each form switches the check on for itself, in its builder.
		'recaptcha_type'       => 'v2',
		'recaptcha_site_key'   => '',
		'recaptcha_secret_key' => '',
		'recaptcha_score'      => 0.5,
		'keep_data_uninstall' => 'keep_data',
	);

	/**
	 * @return array<string, mixed> Site-wide settings merged over their defaults.
	 */
	public static function settings() {
		$stored = get_option( self::SETTINGS_KEY, array() );

		return array_merge( self::SETTINGS_DEFAULTS, array_intersect_key( is_array( $stored ) ? $stored : array(), self::SETTINGS_DEFAULTS ) );
	}

	/**
	 * A per-site secret for signing form tokens and file links. Generated once.
	 *
	 * @return string
	 */
	public static function secret() {
		$secret = get_option( self::OTHER_SETTINGS['secret'] );

		if ( ! is_string( $secret ) || '' === $secret ) {
			$secret = wp_generate_password( 64, true, true );
			add_option( self::OTHER_SETTINGS['secret'], $secret, '', false );
		}

		return $secret;
	}

	/**
	 * Formats a stored UTC datetime the way the site shows dates (Settings → General).
	 *
	 * @param string $utc_datetime UTC `Y-m-d H:i:s`.
	 * @return string
	 */
	public static function format_datetime( $utc_datetime ) {
		$timestamp = strtotime( $utc_datetime . ' UTC' );

		if ( false === $timestamp ) {
			return (string) $utc_datetime;
		}

		return wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $timestamp );
	}
}
