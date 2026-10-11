<?php
/**
 * Settings class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Settings;

use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Reads, validates and stores the single `vulobackup_settings` option.
 *
 * Every key has a default and a type, and anything not listed in DEFAULTS is dropped on save.
 */
class Settings {

	/**
	 * Default value for every known setting key.
	 *
	 * @var array<string, mixed>
	 */
	const DEFAULTS = array(
		// What a backup holds.
		'areas'                  => array( 'plugins', 'themes', 'uploads', 'mu-plugins', 'others' ),
		'include_wp_config'      => false,
		'exclude_patterns'       => '',
		'max_file_size_mb'       => 0,
		'db_scope'               => 'prefix',
		// Schedules: manual, daily, weekly or monthly, for files and for the database.
		'schedule_files'         => 'manual',
		'schedule_database'      => 'manual',
		'schedule_hour'          => 3,
		'schedule_weekday'       => 1,
		'schedule_monthday'      => 1,
		// How many verified backups are kept; 0 keeps every one.
		'retention_count'        => 5,
		'retention_remote_count' => 5,
		'keep_local_copy'        => true,
		// Restore.
		'safety_backup'          => true,
		// Archives.
		'encrypt'                => false,
		'part_size_mb'           => 100,
		'step_seconds'           => 20,
		'backup_dir'             => '',
		// Notifications and logs.
		'notify_failure'         => true,
		'notify_email'           => '',
		'log_retention_days'     => 30,
		// Data.
		'keep_data_uninstall'    => 'keep_data',
	);

	/**
	 * Paths left out of every file backup, relative to the area they are in. `*` matches within a
	 * folder name and `**` across folders.
	 *
	 * @var string[]
	 */
	const DEFAULT_EXCLUSIONS = array(
		'others/cache/**',
		'others/upgrade/**',
		'others/upgrade-temp-backup/**',
		'others/wflogs/**',
		'others/et-cache/**',
		'others/litespeed/**',
		'others/w3tc-config/**',
		'others/backups-dup-lite/**',
		'others/updraft/**',
		'others/ai1wm-backups/**',
		'others/backup-migration/**',
		'others/debug.log',
		'others/advanced-cache.php',
		'others/object-cache.php',
		'uploads/cache/**',
		'uploads/wp-file-manager-pro/fm_backup/**',
		'**/.git/**',
		'**/.svn/**',
		'**/node_modules/**',
		'**/.DS_Store',
		'**/Thumbs.db',
		'**/error_log',
		'**/*.tmp',
	);

	/**
	 * Cached merged settings.
	 *
	 * @var array|null
	 */
	private $cache = null;

	/**
	 * Get every setting, merged with its defaults.
	 *
	 * @return array<string, mixed>
	 */
	public function all() {
		if ( null === $this->cache ) {
			$stored      = get_option( Utill::SETTINGS_KEY, array() );
			$this->cache = array_merge( self::DEFAULTS, array_intersect_key( is_array( $stored ) ? $stored : array(), self::DEFAULTS ) );
		}

		return $this->cache;
	}

	/**
	 * Get one setting value.
	 *
	 * @param string $key Setting key.
	 * @return mixed
	 */
	public function get( $key ) {
		$all = $this->all();

		return $all[ $key ] ?? null;
	}

	/**
	 * Merges validated values into the stored settings.
	 *
	 * @param array $input Raw values, typically a REST request body.
	 * @return array<string, mixed> The full settings after the update.
	 */
	public function update( array $input ) {
		$settings = $this->all();

		foreach ( $input as $key => $value ) {
			if ( array_key_exists( $key, self::DEFAULTS ) ) {
				$settings[ $key ] = self::sanitize( $key, $value );
			}
		}

		update_option( Utill::SETTINGS_KEY, $settings, false );
		$this->cache = $settings;

		return $settings;
	}

	/**
	 * The exclusion patterns in force: the built-in ones plus the administrator's.
	 *
	 * @return string[]
	 */
	public function exclusions() {
		$custom = preg_split( '/[\r\n]+/', (string) $this->get( 'exclude_patterns' ) );
		$custom = array_filter( array_map( 'trim', is_array( $custom ) ? $custom : array() ) );

		/**
		 * Filters the paths left out of file backups.
		 *
		 * @param string[] $patterns `area/path` patterns; `*` matches within a name, `**` across folders.
		 */
		return array_values( array_unique( (array) apply_filters( 'vulobackup_exclusions', array_merge( self::DEFAULT_EXCLUSIONS, $custom ) ) ) );
	}

	/**
	 * Sanitize a raw value for a given setting key.
	 *
	 * @param string $key   Setting key.
	 * @param mixed  $value Raw value.
	 * @return mixed
	 */
	public static function sanitize( $key, $value ) {
		switch ( $key ) {
			case 'areas':
				return array_values( array_intersect( Utill::AREAS, array_map( 'strval', is_array( $value ) ? $value : array() ) ) );

			case 'exclude_patterns':
				$lines = array();

				foreach ( preg_split( '/[\r\n]+/', (string) $value ) as $line ) {
					$line = trim( str_replace( '\\', '/', sanitize_text_field( $line ) ), " \t/" );

					// A pattern is matched against paths inside the site; it can never point outside it.
					if ( '' !== $line && false === strpos( $line, '..' ) && strlen( $line ) <= 300 ) {
						$lines[] = $line;
					}
				}

				return implode( "\n", array_slice( array_unique( $lines ), 0, 200 ) );

			case 'max_file_size_mb':
				return max( 0, min( 102400, (int) $value ) );

			case 'db_scope':
				return 'all' === $value ? 'all' : 'prefix';

			case 'schedule_files':
			case 'schedule_database':
				return in_array( $value, array( 'daily', 'weekly', 'monthly' ), true ) ? $value : 'manual';

			case 'schedule_hour':
				return max( 0, min( 23, (int) $value ) );

			case 'schedule_weekday':
				return max( 0, min( 6, (int) $value ) );

			case 'schedule_monthday':
				return max( 1, min( 28, (int) $value ) );

			case 'retention_count':
			case 'retention_remote_count':
				return max( 0, min( 365, (int) $value ) );

			case 'part_size_mb':
				return max( 10, min( 2000, (int) $value ) );

			case 'step_seconds':
				return max( 5, min( 120, (int) $value ) );

			case 'backup_dir':
				$path = trim( (string) $value );

				return '' === $path ? '' : untrailingslashit( wp_normalize_path( sanitize_text_field( $path ) ) );

			case 'notify_email':
				$email = sanitize_email( (string) $value );

				return is_email( $email ) ? $email : '';

			case 'log_retention_days':
				return max( 1, min( 365, (int) $value ) );

			case 'keep_data_uninstall':
				return 'delete_everything' === $value ? 'delete_everything' : 'keep_data';

			default:
				return (bool) $value;
		}
	}
}
