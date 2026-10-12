<?php
/**
 * Vault class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Storage;

use VuloBackup\Security\PathGuard;
use VuloBackup\Settings\Settings;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * The private folder on this server where backups, their job state, logs and temporary files live.
 *
 * By default it is `wp-content/vulobackup-{random}`: the name cannot be guessed, the folder refuses
 * web requests (.htaccess, web.config, index.php), and nothing in it is ever served by a URL. A
 * download always goes through an authenticated REST route. An administrator can point it at a
 * folder outside the web root instead, which is better where the host allows it.
 */
class Vault {

	/**
	 * A file with this name marks a folder as VuloBackup's own, so a file backup never includes it.
	 */
	const MARKER = '.vulobackup-private';

	/**
	 * Settings.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Resolved base directory, once known.
	 *
	 * @var string|null
	 */
	private $base = null;

	/**
	 * Constructor.
	 *
	 * @param Settings $settings Settings.
	 */
	public function __construct( Settings $settings ) {
		$this->settings = $settings;
	}

	/**
	 * The storage folder, without a trailing slash. It is not created here; see ensure().
	 *
	 * @return string
	 */
	public function base() {
		if ( null !== $this->base ) {
			return $this->base;
		}

		$custom = (string) $this->settings->get( 'backup_dir' );

		if ( defined( 'VULOBACKUP_DIR' ) && VULOBACKUP_DIR ) {
			$custom = untrailingslashit( wp_normalize_path( (string) VULOBACKUP_DIR ) );
		}

		if ( '' !== $custom && null === self::dir_problem( $custom ) ) {
			$this->base = $custom;

			return $this->base;
		}

		$this->base = self::default_dir();

		return $this->base;
	}

	/**
	 * The folder used when none is configured.
	 *
	 * @return string
	 */
	public static function default_dir() {
		$token = get_option( Utill::OTHER_SETTINGS['dir_token'] );

		if ( ! is_string( $token ) || ! preg_match( '/^[a-f0-9]{20}$/', $token ) ) {
			$token = bin2hex( random_bytes( 10 ) );
			update_option( Utill::OTHER_SETTINGS['dir_token'], $token, false );
		}

		return untrailingslashit( wp_normalize_path( WP_CONTENT_DIR ) ) . '/vulobackup-' . $token;
	}

	/**
	 * Why a folder cannot be used for backups, or null when it can.
	 *
	 * @param string $path Absolute path.
	 * @return string|null
	 */
	public static function dir_problem( $path ) {
		$path = untrailingslashit( wp_normalize_path( (string) $path ) );

		if ( '' === $path || ! path_is_absolute( $path ) || false !== strpos( $path, '/../' ) || '/..' === substr( $path, -3 ) ) {
			return __( 'Enter the full path of a folder on this server.', 'vulobackup' );
		}

		// A backup restores these folders by swapping them, so the backups cannot live inside one.
		$roots = Utill::area_roots();

		foreach ( array( 'plugins', 'themes', 'uploads', 'mu-plugins' ) as $area ) {
			if ( isset( $roots[ $area ] ) && PathGuard::would_be_within( $path, $roots[ $area ] ) ) {
				return __( 'Backups cannot be kept inside the plugins, themes or uploads folder, because a restore replaces those folders.', 'vulobackup' );
			}
		}

		foreach ( array( 'wp-admin', WPINC ) as $core ) {
			if ( is_dir( ABSPATH . $core ) && PathGuard::would_be_within( $path, ABSPATH . $core ) ) {
				return __( 'Backups cannot be kept inside WordPress\'s own folders.', 'vulobackup' );
			}
		}

		if ( ! is_dir( $path ) && ! wp_mkdir_p( $path ) ) {
			return __( 'That folder does not exist and could not be created.', 'vulobackup' );
		}

		if ( ! wp_is_writable( $path ) ) {
			return __( 'That folder is not writable by the web server.', 'vulobackup' );
		}

		return null;
	}

	/**
	 * Creates the folder and its access protection. Safe to call often.
	 *
	 * @return bool Whether the folder exists and is writable.
	 */
	public function ensure() {
		$base = $this->base();

		foreach ( array( $base, $base . '/backups', $base . '/restores', $base . '/tmp', $base . '/logs' ) as $directory ) {
			if ( ! is_dir( $directory ) && ! wp_mkdir_p( $directory ) ) {
				return false;
			}
		}

		self::protect( $base );

		return wp_is_writable( $base );
	}

	/**
	 * Writes the files that stop a web server from listing or serving a folder, and the marker that
	 * keeps it out of file backups.
	 *
	 * @param string $directory Directory to protect.
	 * @return void
	 */
	public static function protect( $directory ) {
		$files = array(
			self::MARKER => "This folder belongs to VuloBackup. Do not delete it: it holds your backups.\n",
			'index.php'  => "<?php\n// Silence is golden.\n",
			'.htaccess'  => "# VuloBackup: nothing in this folder is served by the web server.\n<IfModule mod_authz_core.c>\n\tRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n\tOrder deny,allow\n\tDeny from all\n</IfModule>\n",
			'web.config' => "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<configuration>\n\t<system.webServer>\n\t\t<authorization>\n\t\t\t<deny users=\"*\" />\n\t\t</authorization>\n\t</system.webServer>\n</configuration>\n",
		);

		foreach ( $files as $name => $contents ) {
			if ( ! file_exists( $directory . '/' . $name ) ) {
				// Small static protection files in the plugin's own private folder.
				@file_put_contents( $directory . '/' . $name, $contents ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			}
		}
	}

	/**
	 * Whether the storage folder is inside the web root, where only the protection files and the
	 * unguessable name stand between a visitor and a backup.
	 *
	 * @return bool
	 */
	public function is_in_web_root() {
		$base = $this->base();
		$root = isset( $_SERVER['DOCUMENT_ROOT'] ) ? wp_normalize_path( sanitize_text_field( wp_unslash( $_SERVER['DOCUMENT_ROOT'] ) ) ) : '';

		return PathGuard::would_be_within( $base, ABSPATH ) || ( '' !== $root && is_dir( $root ) && PathGuard::would_be_within( $base, $root ) );
	}

	/**
	 * Returns a job's folder.
	 *
	 * @param string $kind `backups` or `restores`.
	 * @param string $id   Job identifier (validated by the caller with PathGuard::is_id()).
	 * @return string
	 */
	public function job_dir( $kind, $id ) {
		return $this->base() . '/' . ( 'restores' === $kind ? 'restores' : 'backups' ) . '/' . $id;
	}

	/**
	 * Returns the folder for uploads in progress and other short-lived files.
	 *
	 * @return string Folder for uploads in progress and other short-lived files.
	 */
	public function tmp_dir() {
		return $this->base() . '/tmp';
	}

	/**
	 * Bytes free on the storage folder's disk, or null when the host does not say.
	 *
	 * @return float|null
	 */
	public function free_space() {
		$base = is_dir( $this->base() ) ? $this->base() : dirname( $this->base() );
		$free = function_exists( 'disk_free_space' ) ? @disk_free_space( $base ) : false; // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- disabled or restricted on some hosts.

		return false === $free ? null : (float) $free;
	}

	/**
	 * Bytes used by everything under a folder of the vault.
	 *
	 * @param string $directory Absolute directory.
	 * @return int
	 */
	public static function dir_size( $directory ) {
		$total   = 0;
		$entries = is_dir( $directory ) ? @scandir( $directory ) : array(); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged

		foreach ( is_array( $entries ) ? $entries : array() as $entry ) {
			if ( '.' === $entry || '..' === $entry ) {
				continue;
			}

			$path = $directory . '/' . $entry;

			if ( is_link( $path ) ) {
				continue;
			}

			$total += is_dir( $path ) ? self::dir_size( $path ) : (int) @filesize( $path ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		}

		return $total;
	}

	/**
	 * Removes temporary files older than a day: uploads that were abandoned, working files of jobs
	 * that died.
	 *
	 * @return int Number of entries removed.
	 */
	public function clean_tmp() {
		$removed = 0;
		$entries = is_dir( $this->tmp_dir() ) ? scandir( $this->tmp_dir() ) : array();

		foreach ( is_array( $entries ) ? $entries : array() as $entry ) {
			$path = $this->tmp_dir() . '/' . $entry;

			if ( '.' === $entry || '..' === $entry || ! file_exists( $path ) ) {
				continue;
			}

			if ( time() - (int) filemtime( $path ) > DAY_IN_SECONDS && Utill::delete_tree( $path ) ) {
				++$removed;
			}
		}

		return $removed;
	}
}
