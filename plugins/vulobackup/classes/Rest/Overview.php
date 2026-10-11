<?php
/**
 * Overview REST controller file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Rest;

use VuloBackup\Jobs\Store;
use VuloBackup\Logging\Logger;
use VuloBackup\Security\Crypto;
use VuloBackup\Storage\Vault;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * vulobackup/v1/overview, /diagnostics and /logs - the state of backups on this site, what could
 * stop them working, and the record of what was done. Every figure comes from the job records and
 * the server itself; nothing is estimated for show.
 */
class Overview extends Controller {

	/**
	 * Registers this controller's routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		$this->route( '/overview', \WP_REST_Server::READABLE, 'overview' );
		$this->route( '/diagnostics', \WP_REST_Server::READABLE, 'diagnostics' );
		$this->route( '/logs', \WP_REST_Server::READABLE, 'logs' );
		$this->route( '/logs', \WP_REST_Server::DELETABLE, 'clear_logs' );
	}

	/**
	 * The overview screen's data.
	 *
	 * @return \WP_REST_Response
	 */
	public function overview() {
		$jobs     = VuloBackup()->jobs;
		$vault    = VuloBackup()->vault;
		$settings = VuloBackup()->settings;
		$backups  = $jobs->all( Store::KIND_BACKUP );
		$last     = null;
		$failed   = null;
		$counts   = array(
			'completed'  => 0,
			'unverified' => 0,
			'bytes'      => 0,
		);

		foreach ( $backups as $job ) {
			if ( 'completed' === $job['status'] ) {
				++$counts['completed'];
				$counts['bytes'] += ! empty( $job['local'] ) ? (int) ( $job['size'] ?? 0 ) : 0;

				if ( empty( $job['verified'] ) ) {
					++$counts['unverified'];
				}

				if ( null === $last && 'safety' !== $job['trigger'] ) {
					$last = $job;
				}
			} elseif ( 'failed' === $job['status'] && null === $last && null === $failed ) {
				// Only a failure more recent than the last success is news.
				$failed = $job;
			}
		}

		$next         = VuloBackup()->scheduler->next_runs();
		$active       = $jobs->active();
		$destinations = VuloBackup()->destinations;
		$warnings     = array();

		if ( ! $vault->ensure() ) {
			$warnings[] = array(
				'type'    => 'error',
				'message' => __( 'The backup folder cannot be created or written to, so no backup can be made. Check Settings → Storage.', 'vulobackup' ),
			);
		}

		if ( null === $last ) {
			$warnings[] = array(
				'type'    => 'warning',
				'message' => __( 'This site has no backup yet.', 'vulobackup' ),
			);
		} elseif ( time() - (int) strtotime( $last['created_at'] . ' UTC' ) > 30 * DAY_IN_SECONDS ) {
			$warnings[] = array(
				'type'    => 'warning',
				'message' => __( 'The most recent backup is more than 30 days old.', 'vulobackup' ),
			);
		}

		if ( $failed ) {
			$warnings[] = array(
				'type'    => 'error',
				/* translators: 1: date, 2: error. */
				'message' => sprintf( __( 'The most recent backup, on %1$s, failed. %2$s', 'vulobackup' ), Utill::format_datetime( $failed['created_at'] ), (string) $failed['error'] ),
			);
		}

		if ( $last && ( $last['warnings'] || array_filter( (array) ( $last['copies'] ?? array() ), static fn( $copy ) => 'failed' === ( $copy['status'] ?? '' ) ) ) ) {
			$warnings[] = array(
				'type'    => 'warning',
				'message' => __( 'The most recent backup completed with warnings. Open it under Backups to read them.', 'vulobackup' ),
			);
		}

		if ( 'manual' === $settings->get( 'schedule_files' ) && 'manual' === $settings->get( 'schedule_database' ) ) {
			$warnings[] = array(
				'type'    => 'info',
				'message' => __( 'No schedule is set, so backups are only made when you start one.', 'vulobackup' ),
			);
		} elseif ( defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON ) {
			$warnings[] = array(
				'type'    => 'info',
				'message' => __( 'WP-Cron is switched off in wp-config.php. Scheduled backups only run if the server calls wp-cron.php itself.', 'vulobackup' ),
			);
		}

		if ( ! $destinations->enabled() ) {
			$warnings[] = array(
				'type'    => 'info',
				'message' => __( 'Backups are kept on this server only. If the server is lost, so are they. Add a remote destination under Settings → Storage.', 'vulobackup' ),
			);
		}

		if ( $settings->get( 'encrypt' ) && ( ! Crypto::is_available() || '' === Crypto::stored_password() ) ) {
			$warnings[] = array(
				'type'    => 'error',
				'message' => __( 'Encryption is switched on but cannot work: the password or PHP\'s sodium extension is missing. Backups will fail until this is fixed in Settings → Security.', 'vulobackup' ),
			);
		}

		$free = $vault->free_space();

		return rest_ensure_response(
			array(
				'last'         => $last ? $this->view( $last ) : null,
				'active'       => $active ? $this->view( $active ) : null,
				'counts'       => array(
					'completed'  => $counts['completed'],
					'unverified' => $counts['unverified'],
					'size'       => Utill::size( $counts['bytes'] ),
				),
				'schedule'     => array(
					'files'         => (string) $settings->get( 'schedule_files' ),
					'database'      => (string) $settings->get( 'schedule_database' ),
					'next_files'    => Utill::format_timestamp( $next['files'] ),
					'next_database' => Utill::format_timestamp( $next['database'] ),
				),
				'storage'      => array(
					'free'   => null === $free ? '' : Utill::size( $free ),
					'public' => $vault->is_in_web_root(),
					'folder' => \VuloBackup\Security\Redactor::relative_paths( $vault->base() ),
				),
				'destinations' => array_values( array_map( array( $destinations, 'for_browser' ), $destinations->all() ) ),
				'warnings'     => $warnings,
				'activity'     => Logger::read( VuloBackup()->logger->file(), 8 ),
			)
		);
	}

	/**
	 * What this server can and cannot do, checked now.
	 *
	 * @return \WP_REST_Response
	 */
	public function diagnostics() {
		global $wpdb, $wp_version;

		$vault  = VuloBackup()->vault;
		$checks = array();

		$check = static function ( $label, $ok, $detail, $severity = 'error' ) use ( &$checks ) {
			$checks[] = array(
				'label'  => $label,
				'status' => $ok ? 'ok' : $severity,
				'detail' => $detail,
			);
		};

		$writable = $vault->ensure();

		$check(
			__( 'Backup folder', 'vulobackup' ),
			$writable,
			$writable ? __( 'Exists and is writable.', 'vulobackup' ) : __( 'Cannot be created or written to. Choose another folder in Settings → Storage, or fix its permissions.', 'vulobackup' )
		);
		$check(
			__( 'Backup folder location', 'vulobackup' ),
			! $vault->is_in_web_root(),
			$vault->is_in_web_root()
				? __( 'Inside the web root. It has an unguessable name and refuses web requests, and downloads only go through WordPress. A folder outside the web root is safer still, if your host allows one.', 'vulobackup' )
				: __( 'Outside the web root.', 'vulobackup' ),
			'info'
		);

		if ( $writable && $vault->is_in_web_root() ) {
			$exposed = self::is_exposed( $vault );

			$check(
				__( 'Backup folder is closed to the web', 'vulobackup' ),
				true !== $exposed,
				true === $exposed
					? __( 'A test file in the backup folder could be fetched by its address. Your web server ignores the protection files (this is usual on nginx). Move the backup folder outside the web root in Settings → Storage, or block the folder in the server configuration.', 'vulobackup' )
					: ( false === $exposed ? __( 'A test file in the folder could not be fetched by its address.', 'vulobackup' ) : __( 'Could not be tested from the server itself.', 'vulobackup' ) ),
				'error'
			);
		}

		$check( __( 'PHP zip extension', 'vulobackup' ), class_exists( '\ZipArchive' ), class_exists( '\ZipArchive' ) ? __( 'Available.', 'vulobackup' ) : __( 'Missing. Files cannot be backed up or restored; the database can.', 'vulobackup' ) );
		$check( __( 'PHP zlib extension', 'vulobackup' ), function_exists( 'gzopen' ), function_exists( 'gzopen' ) ? __( 'Available.', 'vulobackup' ) : __( 'Missing. The database cannot be backed up.', 'vulobackup' ) );
		$check( __( 'PHP sodium extension', 'vulobackup' ), Crypto::is_available(), Crypto::is_available() ? __( 'Available. Archives can be encrypted.', 'vulobackup' ) : __( 'Missing. Archives cannot be encrypted, and stored passwords use WordPress\'s slower built-in encryption.', 'vulobackup' ), 'info' );

		$free = $vault->free_space();

		$check(
			__( 'Free disk space', 'vulobackup' ),
			null === $free || $free > 200 * 1024 * 1024,
			null === $free ? __( 'This host does not report it.', 'vulobackup' ) : Utill::size( $free ),
			'warning'
		);

		$limit = (int) ini_get( 'max_execution_time' );
		$step  = (int) VuloBackup()->settings->get( 'step_seconds' );

		$check(
			__( 'PHP time limit', 'vulobackup' ),
			0 === $limit || $limit >= $step + 10,
			0 === $limit
				? __( 'No limit.', 'vulobackup' )
				/* translators: 1: PHP's limit in seconds, 2: the plugin's step length in seconds. */
				: sprintf( __( '%1$d seconds. VuloBackup works in steps of %2$d seconds; if backups keep stopping, lower "Seconds per step" in Settings.', 'vulobackup' ), $limit, $step ),
			'warning'
		);
		$check( __( 'PHP memory limit', 'vulobackup' ), true, (string) ini_get( 'memory_limit' ) );

		$cron_off = defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON;

		$check(
			__( 'WP-Cron', 'vulobackup' ),
			! $cron_off,
			$cron_off
				? __( 'Switched off in wp-config.php. Scheduled backups run only if the server calls wp-cron.php on a timer.', 'vulobackup' )
				: __( 'On. It runs when the site is visited, so on a quiet site a scheduled backup starts, and continues, at the next visit.', 'vulobackup' ),
			'info'
		);

		$next = wp_next_scheduled( \VuloBackup\Schedule\Scheduler::HOOK_CHECK );

		$check(
			__( 'Schedule check', 'vulobackup' ),
			(bool) $next,
			$next
				/* translators: %s: date and time. */
				? sprintf( __( 'Next hourly check at %s.', 'vulobackup' ), Utill::format_timestamp( $next ) )
				: __( 'Not scheduled. Deactivate and activate VuloBackup to restore it.', 'vulobackup' )
		);

		$orphans = $wpdb->get_col( "SHOW TABLES LIKE 'vb_\\_%'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$orphans = array_filter( (array) $orphans, static fn( $name ) => 1 === preg_match( '/^vb[to][a-z0-9]{4,16}_[0-9]+$/', $name ) );

		if ( $orphans && ! VuloBackup()->jobs->active() ) {
			$check(
				__( 'Tables left by a restore', 'vulobackup' ),
				false,
				/* translators: %d: number of tables. */
				sprintf( _n( '%d table from an earlier restore is still in the database. It is removed automatically within a few minutes.', '%d tables from an earlier restore are still in the database. They are removed automatically within a few minutes.', count( $orphans ), 'vulobackup' ), count( $orphans ) ),
				'info'
			);
		}

		return rest_ensure_response(
			array(
				'checks' => $checks,
				'system' => array(
					array( __( 'VuloBackup', 'vulobackup' ), VULOBACKUP_PLUGIN_VERSION ),
					array( __( 'Backup format', 'vulobackup' ), (string) VULOBACKUP_FORMAT_VERSION ),
					array( __( 'WordPress', 'vulobackup' ), $wp_version . ( is_multisite() ? ' (multisite)' : '' ) ),
					array( __( 'PHP', 'vulobackup' ), PHP_VERSION ),
					array( __( 'Database', 'vulobackup' ), (string) $wpdb->db_server_info() ),
					array( __( 'Database character set', 'vulobackup' ), (string) $wpdb->charset ),
					array( __( 'Table prefix', 'vulobackup' ), (string) $wpdb->base_prefix ),
					array( __( 'Backup folder', 'vulobackup' ), \VuloBackup\Security\Redactor::relative_paths( $vault->base() ) ),
					array( __( 'Space used by backups', 'vulobackup' ), Utill::size( Vault::dir_size( $vault->base() ) ) ),
				),
			)
		);
	}

	/**
	 * The activity log.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function logs( $request ) {
		$level = sanitize_key( (string) $request->get_param( 'level' ) );
		$rows  = Logger::read( VuloBackup()->logger->file(), 1000, in_array( $level, array( 'info', 'warning', 'error' ), true ) ? $level : '' );

		$per_page = max( 1, min( 100, absint( $request->get_param( 'per_page' ) ) ?: 20 ) ); // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
		$page     = max( 1, absint( $request->get_param( 'page' ) ) );

		return rest_ensure_response(
			array(
				'data'  => array_slice( $rows, ( $page - 1 ) * $per_page, $per_page ),
				'total' => count( $rows ),
			)
		);
	}

	/**
	 * Empties the activity log.
	 *
	 * @return \WP_REST_Response
	 */
	public function clear_logs() {
		VuloBackup()->logger->clear();

		return rest_ensure_response( array( 'cleared' => true ) );
	}

	/**
	 * Asks this site's own web server for a file in the backup folder.
	 *
	 * @param Vault $vault Storage folder.
	 * @return bool|null True when it was served (the folder is exposed), false when it was refused,
	 *                   null when the test could not be made.
	 */
	private static function is_exposed( Vault $vault ) {
		$base = wp_normalize_path( $vault->base() );
		$root = untrailingslashit( wp_normalize_path( ABSPATH ) );

		if ( 0 !== strpos( $base, $root . '/' ) ) {
			return null;
		}

		$name  = 'probe-' . bin2hex( random_bytes( 6 ) ) . '.txt';
		$token = bin2hex( random_bytes( 8 ) );

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- a throwaway file in the plugin's own folder.
		if ( false === file_put_contents( $base . '/' . $name, $token ) ) {
			return null;
		}

		$response = wp_remote_get(
			site_url( substr( $base, strlen( $root ) ) . '/' . $name ),
			array(
				'timeout'     => 5,
				'redirection' => 0,
				'sslverify'   => false,
			)
		);

		wp_delete_file( $base . '/' . $name );

		if ( is_wp_error( $response ) ) {
			return null;
		}

		return 200 === (int) wp_remote_retrieve_response_code( $response ) && false !== strpos( (string) wp_remote_retrieve_body( $response ), $token );
	}
}
