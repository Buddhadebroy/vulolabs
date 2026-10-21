<?php
/**
 * Logger class file.
 *
 * @package VuloCart
 */

namespace VuloCart;

defined( 'ABSPATH' ) || exit;

/**
 * Debug log file.
 *
 * When Settings → Advanced → "Enable debug logging" is on, problems such as a module that failed to load are written
 * to one file in the uploads folder, one line per entry (`Y-m-d H:i:s:message`). The file name contains a random token and the folder refuses direct web access,
 * so the log cannot be read from outside. Settings → Advanced shows the end of the file and can clear it.
 *
 * @class       Logger class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Logger {

	/**
	 * Option that stores the random part of the log file name.
	 *
	 * @var string
	 */
	const TOKEN_OPTION = 'vulocart_log_token';

	/**
	 * Largest size the log may reach, in bytes. When it is bigger, the oldest half is dropped.
	 *
	 * @var int
	 */
	const MAX_BYTES = 524288;

	/**
	 * Whether debug logging is switched on in Settings → Advanced.
	 *
	 * @return bool
	 */
	public static function is_enabled(): bool {
		$settings = wp_parse_args( get_option( Utill::SETTINGS_KEY, array() ), Utill::SETTINGS_DEFAULTS );

		return ! empty( $settings['enable_debug_logging'] );
	}

	/**
	 * Absolute path of the log file. Creating the folder and its protection files is part of resolving it.
	 *
	 * @return string Empty string when the uploads folder cannot be used.
	 */
	public static function path(): string {
		$uploads = wp_upload_dir( null, false );

		if ( ! empty( $uploads['error'] ) ) {
			return '';
		}

		$dir = trailingslashit( $uploads['basedir'] ) . 'vulocart-logs';

		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
			file_put_contents( $dir . '/index.php', "<?php\n// Silence is golden.\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- a one-off placeholder file.
			file_put_contents( $dir . '/.htaccess', "Require all denied\nDeny from all\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- a one-off access rule.
		}

		$token = get_option( self::TOKEN_OPTION );

		if ( ! $token ) {
			$token = wp_generate_password( 16, false );
			update_option( self::TOKEN_OPTION, $token, false );
		}

		return $dir . '/debug-' . $token . '.log';
	}

	/**
	 * Appends one line to the log, when logging is switched on.
	 *
	 * @param string $message What happened.
	 * @return void
	 */
	public static function write( string $message ): void {
		if ( ! self::is_enabled() ) {
			return;
		}

		$path = self::path();

		if ( '' === $path ) {
			return;
		}

		if ( file_exists( $path ) && filesize( $path ) > self::MAX_BYTES ) {
			$kept = substr( (string) file_get_contents( $path ), -(int) ( self::MAX_BYTES / 2 ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local file.
			file_put_contents( $path, $kept ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- trimming the log.
		}

		$message = trim( preg_replace( '/\s+/', ' ', $message ) );

		file_put_contents( $path, sprintf( "%s:%s\n", gmdate( 'Y-m-d H:i:s' ), $message ), FILE_APPEND | LOCK_EX ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- appending to the plugin's own log.
	}

	/**
	 * The last lines of the log, oldest first. Each line is `Y-m-d H:i:s:message`, the format the log viewer field of
	 * the admin UI splits into a date and a message.
	 *
	 * @param int $lines How many lines to return.
	 * @return string[] Empty when nothing has been logged.
	 */
	public static function tail( int $lines = 100 ): array {
		$path = self::path();

		if ( '' === $path || ! file_exists( $path ) ) {
			return array();
		}

		$all = file( $path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES );

		return $all ? array_values( array_slice( $all, -$lines ) ) : array();
	}

	/**
	 * Empties the log.
	 *
	 * @return void
	 */
	public static function clear(): void {
		$path = self::path();

		if ( '' !== $path && file_exists( $path ) ) {
			wp_delete_file( $path );
		}
	}
}
