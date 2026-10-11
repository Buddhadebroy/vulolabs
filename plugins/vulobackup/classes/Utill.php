<?php
/**
 * Utill class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup;

defined( 'ABSPATH' ) || exit;

/**
 * VuloBackup Utill class - shared constants and small helpers.
 *
 * @class       Utill class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Utill {

	/**
	 * Option holding every admin-editable setting.
	 */
	const SETTINGS_KEY = 'vulobackup_settings';

	/**
	 * Option holding the remote storage destinations (secrets encrypted).
	 */
	const DESTINATIONS_KEY = 'vulobackup_destinations';

	/**
	 * Option holding the archive encryption password (encrypted) when encryption is on.
	 */
	const ENCRYPTION_KEY = 'vulobackup_encryption';

	/**
	 * Internal bookkeeping options. Every option this plugin owns starts with `vulobackup_`, which
	 * is how a database restore knows to carry them over (see Restore\DatabaseRestorer).
	 *
	 * @var array<string, string>
	 */
	const OTHER_SETTINGS = array(
		'run_installer'     => 'vulobackup_run_installer',
		'plugin_db_version' => 'vulobackup_plugin_db_version',
		'dir_token'         => 'vulobackup_dir_token',
		'schedule_state'    => 'vulobackup_schedule_state',
	);

	/**
	 * Capability required for every VuloBackup admin screen and REST route. On multisite a backup
	 * holds every site's data, so only a network administrator qualifies (see can_manage()).
	 */
	const CAPABILITY = 'manage_options';

	/**
	 * The parts of a site a file backup can hold. `others` is the rest of wp-content; `core` is
	 * WordPress itself (wp-admin, wp-includes and the files beside them).
	 *
	 * @var string[]
	 */
	const AREAS = array( 'plugins', 'themes', 'uploads', 'mu-plugins', 'others', 'core' );

	/**
	 * Whether the current user may manage backups.
	 *
	 * @return bool
	 */
	public static function can_manage() {
		return is_multisite() ? current_user_can( 'manage_network' ) : current_user_can( self::CAPABILITY );
	}

	/**
	 * Formats a stored UTC datetime the way the site is set up to show dates.
	 *
	 * @param string $utc_datetime UTC `Y-m-d H:i:s`.
	 * @return string
	 */
	public static function format_datetime( $utc_datetime ) {
		$timestamp = '' === (string) $utc_datetime ? false : strtotime( $utc_datetime . ' UTC' );

		if ( false === $timestamp ) {
			return '';
		}

		return wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $timestamp );
	}

	/**
	 * Formats a Unix timestamp the same way.
	 *
	 * @param int $timestamp Unix timestamp.
	 * @return string
	 */
	public static function format_timestamp( $timestamp ) {
		return $timestamp > 0 ? wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) $timestamp ) : '';
	}

	/**
	 * @return string The current UTC time as `Y-m-d H:i:s`.
	 */
	public static function now() {
		return gmdate( 'Y-m-d H:i:s' );
	}

	/**
	 * @param int|float $bytes Size in bytes.
	 * @return string Human-readable size, e.g. "12 MB".
	 */
	public static function size( $bytes ) {
		$bytes = (float) $bytes;

		return $bytes <= 0 ? '0 B' : (string) size_format( $bytes, $bytes >= 1024 * 1024 * 1024 ? 2 : ( $bytes >= 1024 * 1024 ? 1 : 0 ) );
	}

	/**
	 * Writes a file so that a reader never sees it half-written: to a temporary name, then renamed.
	 *
	 * @param string $path     Destination path.
	 * @param string $contents File contents.
	 * @return bool
	 */
	public static function write_atomic( $path, $contents ) {
		$temporary = $path . '.' . bin2hex( random_bytes( 4 ) ) . '.tmp';

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- a private state file beside the backup; WP_Filesystem may be FTP-backed and cannot rename atomically.
		if ( false === file_put_contents( $temporary, $contents, LOCK_EX ) ) {
			return false;
		}

		if ( ! rename( $temporary, $path ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename
			wp_delete_file( $temporary );

			return false;
		}

		return true;
	}

	/**
	 * Deletes a directory and everything in it, without following symbolic links.
	 *
	 * @param string     $directory Directory to delete.
	 * @param float|null $deadline  Stop (unfinished) when microtime(true) passes this.
	 * @return bool Whether the directory is gone.
	 */
	public static function delete_tree( $directory, $deadline = null ) {
		if ( is_link( $directory ) || is_file( $directory ) ) {
			return @unlink( $directory ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.unlink_unlink
		}

		if ( ! is_dir( $directory ) ) {
			return true;
		}

		$entries = @scandir( $directory ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged

		foreach ( is_array( $entries ) ? $entries : array() as $entry ) {
			if ( '.' === $entry || '..' === $entry ) {
				continue;
			}

			if ( null !== $deadline && microtime( true ) > $deadline ) {
				return false;
			}

			if ( ! self::delete_tree( $directory . '/' . $entry, $deadline ) ) {
				return false;
			}
		}

		return @rmdir( $directory ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
	}

	/**
	 * The absolute directory of each backup area on this site.
	 *
	 * @return array<string, string> Area => directory, no trailing slash. An area that does not
	 *                               exist here is left out.
	 */
	public static function area_roots() {
		$uploads = wp_get_upload_dir();
		$roots   = array(
			'plugins'    => WP_PLUGIN_DIR,
			'themes'     => get_theme_root(),
			'uploads'    => $uploads['basedir'],
			'mu-plugins' => WPMU_PLUGIN_DIR,
			'others'     => WP_CONTENT_DIR,
			'core'       => ABSPATH,
		);

		foreach ( $roots as $area => $root ) {
			$real = realpath( $root );

			if ( false === $real || ! is_dir( $real ) ) {
				unset( $roots[ $area ] );
				continue;
			}

			$roots[ $area ] = untrailingslashit( wp_normalize_path( $real ) );
		}

		return $roots;
	}
}
