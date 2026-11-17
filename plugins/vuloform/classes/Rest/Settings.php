<?php
/**
 * Settings REST controller file.
 *
 * @package VuloForm
 */

namespace VuloForm\Rest;

use VuloForm\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * GET/POST vuloform/v1/settings - the site-wide settings.
 */
class Settings extends Controller {

	/**
	 * Integer settings clamped to a range: setting key => [min, max].
	 *
	 * @var array<string, array{0: int, 1: int}>
	 */
	private const BOUNDED_INTEGERS = array(
		'retention_days' => array( 0, 3650 ),
		'rate_limit'     => array( 0, 120 ),
		'min_seconds'    => array( 0, 60 ),
	);

	/**
	 * On/off settings, and the key the browser's auto-saving toggle wraps each in:
	 * `{ privacy_options: { store_ip: { enable: bool } } }`.
	 *
	 * @var array<string, string>
	 */
	private const TOGGLE_WRAPPERS = array(
		'store_ip' => 'privacy_options',
		'honeypot' => 'spam_options',
	);

	/**
	 * Registers this controller's routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		$this->route( '/settings', \WP_REST_Server::READABLE, 'get_items' );
		$this->route( '/settings', \WP_REST_Server::CREATABLE, 'update_item' );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request ) {
		return rest_ensure_response( self::for_browser( Utill::settings() ) );
	}

	/**
	 * Accepts a flat body or zyra's auto-saving `{ setting, settingName }` body. Merges submitted
	 * fields into the stored settings, then re-checks them: bounds are clamped, toggle-wrapped
	 * settings are read out of their envelope, and an empty secret keeps its stored value.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function update_item( $request ) {
		$input   = (array) $request->get_json_params();
		$is_form = isset( $input['setting'] ) && is_array( $input['setting'] );
		$input   = $is_form ? $input['setting'] : $input;
		$before  = Utill::settings();

		// Only known setting keys are merged in; toggle wrappers and the secret are handled below.
		$after = array_merge(
			$before,
			array_diff_key( array_intersect_key( $input, $before ), array( 'recaptcha_secret_key' => true ) )
		);

		$after = self::clamp_bounded_integers( $after );
		$after = self::apply_recaptcha_rules( $input, $before, $after );
		$after = self::apply_toggles( $input, $after );

		$after['recaptcha_type']      = 'v3' === $after['recaptcha_type'] ? 'v3' : 'v2';
		$after['keep_data_uninstall'] = 'delete_everything' === $after['keep_data_uninstall'] ? 'delete_everything' : 'keep_data';

		update_option( Utill::SETTINGS_KEY, $after, false );

		if ( ! $is_form ) {
			return rest_ensure_response( self::for_browser( $after ) );
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => $after !== $before ? __( 'Settings saved.', 'vuloform' ) : '',
			)
		);
	}

	/**
	 * @param array $after Settings so far.
	 * @return array
	 */
	private static function clamp_bounded_integers( array $after ) {
		foreach ( self::BOUNDED_INTEGERS as $key => $range ) {
			$after[ $key ] = max( $range[0], min( $range[1], (int) $after[ $key ] ) );
		}

		return $after;
	}

	/**
	 * @param array $input  Submitted settings, as sent.
	 * @param array $before Settings before this save.
	 * @param array $after  Settings so far.
	 * @return array
	 */
	private static function apply_recaptcha_rules( array $input, array $before, array $after ) {
		$after['recaptcha_score'] = max( 0.1, min( 0.9, round( (float) $after['recaptcha_score'], 1 ) ) );

		if ( isset( $input['recaptcha_site_key'] ) ) {
			$after['recaptcha_site_key'] = sanitize_text_field( (string) $input['recaptcha_site_key'] );
		}

		if ( '' === $after['recaptcha_site_key'] ) {
			// Clearing the site key switches reCAPTCHA off, so its secret goes too.
			$after['recaptcha_secret_key'] = '';
		} elseif ( isset( $input['recaptcha_secret_key'] ) && '' !== trim( (string) $input['recaptcha_secret_key'] ) ) {
			$after['recaptcha_secret_key'] = sanitize_text_field( (string) $input['recaptcha_secret_key'] );
		} else {
			$after['recaptcha_secret_key'] = $before['recaptcha_secret_key'];
		}

		return $after;
	}

	/**
	 * @param array $input Submitted settings.
	 * @param array $after Settings so far.
	 * @return array
	 */
	private static function apply_toggles( array $input, array $after ) {
		foreach ( self::TOGGLE_WRAPPERS as $toggle => $wrapper ) {
			if ( isset( $input[ $wrapper ][ $toggle ] ) ) {
				$after[ $toggle ] = is_array( $input[ $wrapper ][ $toggle ] ) && ! empty( $input[ $wrapper ][ $toggle ]['enable'] );
			} elseif ( array_key_exists( $toggle, $input ) && ! is_array( $input[ $toggle ] ) ) {
				$after[ $toggle ] = (bool) $input[ $toggle ];
			}
		}

		return $after;
	}

	/**
	 * The settings as the admin screen may see them: the reCAPTCHA secret is replaced by a flag
	 * saying whether one is saved.
	 *
	 * @param array $settings Site settings.
	 * @return array
	 */
	private static function for_browser( array $settings ) {
		$settings['recaptcha_secret_set'] = '' !== (string) $settings['recaptcha_secret_key'];
		$settings['recaptcha_secret_key'] = '';

		return $settings;
	}
}
