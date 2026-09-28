<?php
namespace VuloPilot\Settings;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Outputs `gtag.js` on the front end, honoring the Analytics panel toggles (anonymize IP,
 * exclude logged-in users, self-hosted JS file).
 *
 * @class       GoogleAnalyticsTracker class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleAnalyticsTracker {

	private const CACHE_FILENAME = 'vulopilot-ga-gtag.js';

	public function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'maybe_output_tracking_code' ) );
	}

	/**
	 * @return void
	 */
	public function maybe_output_tracking_code(): void {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		// Same `array('key')`-means-on/`array()`-means-off toggle-checkbox convention every other
		// single ToggleInput-driven setting in this codebase uses.
		if ( empty( $settings['ga_install_tracking_code'] ) ) {
			return;
		}

		if ( ! empty( $settings['ga_exclude_logged_in_users'] ) && is_user_logged_in() ) {
			return;
		}

		$connection     = ( new GoogleServicesConnection() )->get_status();
		$measurement_id = $connection['ga4_measurement_id'] ?? '';

		if ( '' === $measurement_id ) {
			return;
		}

		$script_src = ! empty( $settings['ga_self_hosted_js'] )
			? $this->get_self_hosted_url( $measurement_id )
			: 'https://www.googletagmanager.com/gtag/js?id=' . rawurlencode( $measurement_id );

		$config_options = array();

		if ( ! empty( $settings['ga_anonymize_ip'] ) ) {
			$config_options['anonymize_ip'] = true;
		}

		wp_enqueue_script(
			'vulopilot-ga-gtag',
			$script_src,
			array(),
			null, // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion -- $script_src is Google's own external gtag.js URL (or a self-hosted proxy of it), not a local plugin asset; a cache-busting version query has no meaning for it.
			array( 'strategy' => 'async' )
		);

		wp_add_inline_script(
			'vulopilot-ga-gtag',
			sprintf(
				"window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '%s'%s);",
				esc_js( $measurement_id ),
				$config_options ? ', ' . wp_json_encode( $config_options ) : ''
			)
		);
	}

	/**
	 * Fetches (once, then caches) Google's own real gtag.js for this property and returns
	 * the local URL to serve it from.
	 *
	 * @param string $measurement_id Real GA4 Measurement ID (e.g. "G-XXXXXXX").
	 * @return string
	 */
	private function get_self_hosted_url( string $measurement_id ): string {
		$upload_dir = wp_upload_dir();
		$cache_dir  = trailingslashit( $upload_dir['basedir'] ) . 'vulopilot';
		$cache_file = $cache_dir . '/' . self::CACHE_FILENAME;
		$cache_url  = trailingslashit( $upload_dir['baseurl'] ) . 'vulopilot/' . self::CACHE_FILENAME;
		$remote_url = 'https://www.googletagmanager.com/gtag/js?id=' . rawurlencode( $measurement_id );

		// Re-fetched once a day (real gtag.js content does change) rather than only ever once.
		if ( file_exists( $cache_file ) && ( time() - filemtime( $cache_file ) ) < DAY_IN_SECONDS ) {
			return $cache_url;
		}

		$response = wp_remote_get( $remote_url, array( 'timeout' => 15 ) );

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return file_exists( $cache_file ) ? $cache_url : $remote_url;
		}

		if ( ! file_exists( $cache_dir ) ) {
			wp_mkdir_p( $cache_dir );
		}

		global $wp_filesystem;

		if ( ! function_exists( 'WP_Filesystem' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		WP_Filesystem();

		if ( $wp_filesystem && $wp_filesystem->put_contents( $cache_file, wp_remote_retrieve_body( $response ), FS_CHMOD_FILE ) ) {
			return $cache_url;
		}

		return $remote_url;
	}
}
