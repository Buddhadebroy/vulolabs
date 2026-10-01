<?php
namespace VuloPilot\SeoVisibility;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Serves this site's IndexNow key file at `/{key}.txt`.
 *
 * @class       IndexNowKeyFileServer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class IndexNowKeyFileServer {

	private const QUERY_VAR = 'vulopilot_indexnow_key_file';

	/**
	 * IndexNowKeyFileServer constructor.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'register_rewrite_rule' ) );
		add_filter( 'query_vars', array( $this, 'add_query_var' ) );
		// Priority 1 - must run before WordPress core's own redirect_canonical() (hooked on this
		// same action at its default priority 10).
		add_action( 'template_redirect', array( $this, 'maybe_serve' ), 1 );
	}

	/**
	 * @return void
	 */
	public function register_rewrite_rule(): void {
		add_rewrite_rule( '^([a-f0-9]{32})\.txt$', 'index.php?' . self::QUERY_VAR . '=$matches[1]', 'top' );
	}

	/**
	 * @param string[] $vars Existing public query vars.
	 * @return string[]
	 */
	public function add_query_var( array $vars ): array {
		$vars[] = self::QUERY_VAR;
		return $vars;
	}

	/**
	 * @return void
	 */
	public function maybe_serve(): void {
		$requested_key = get_query_var( self::QUERY_VAR );

		if ( ! $requested_key ) {
			return;
		}

		$settings   = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
		$stored_key = (string) ( $settings['indexnow_api_key'] ?? '' );

		// No stored key yet, or it doesn't match what was requested - force a real 404 rather than
		// a bare `return`.
		if ( '' === $stored_key || ! hash_equals( $stored_key, $requested_key ) ) {
			global $wp_query;
			$wp_query->set_404();
			status_header( 404 );
			return;
		}

		header( 'Content-Type: text/plain; charset=utf-8' );
		echo esc_html( $stored_key );
		exit;
	}

	/**
	 * Writes the key straight to a real `/{key}.txt` at the site root.
	 *
	 * @param string $key The key to write a file for.
	 * @return bool True if the file was written.
	 */
	public function write_key_file( string $key ): bool {
		if ( '' === $key || ! wp_is_writable( ABSPATH ) ) {
			return false;
		}

		$file_path = trailingslashit( ABSPATH ) . $key . '.txt';

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents, PluginCheck.CodeAnalysis.WriteFile.ABSPATHDetected -- the IndexNow protocol itself requires this key file to be served from the site root, not wp_upload_dir(); a virtual-route fallback also exists above for hosts where ABSPATH isn't writable.
		return false !== file_put_contents( $file_path, $key );
	}

	/**
	 * Generates a fresh 32-character lowercase hex key.
	 *
	 * @return string
	 */
	public static function generate_new_key(): string {
		return bin2hex( random_bytes( 16 ) );
	}
}
