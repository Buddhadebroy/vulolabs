<?php
/**
 * Logger class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Logging;

use VuloBackup\Security\Redactor;
use VuloBackup\Settings\Settings;
use VuloBackup\Storage\Vault;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * The activity log (what VuloBackup did and when) and each job's own detailed log.
 *
 * Both are plain files inside the private storage folder, one JSON object per line, so they survive
 * a database restore. Every message is scrubbed of credentials and of absolute server paths before
 * it is written; database contents are never logged.
 */
class Logger {

	const LEVEL_INFO    = 'info';
	const LEVEL_WARNING = 'warning';
	const LEVEL_ERROR   = 'error';

	/**
	 * The activity log is trimmed once it grows past this size.
	 */
	const MAX_BYTES = 2097152;

	/**
	 * Storage folder.
	 *
	 * @var Vault
	 */
	private $vault;

	/**
	 * Settings.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Secret values to remove from anything logged during this request.
	 *
	 * @var string[]
	 */
	private $secrets = array();

	/**
	 * @param Vault    $vault    Storage folder.
	 * @param Settings $settings Settings.
	 */
	public function __construct( Vault $vault, Settings $settings ) {
		$this->vault    = $vault;
		$this->settings = $settings;
	}

	/**
	 * Registers values that must never appear in a log, such as a storage secret in use.
	 *
	 * @param string[] $secrets Secret values.
	 * @return void
	 */
	public function hide( array $secrets ) {
		$this->secrets = array_values( array_unique( array_merge( $this->secrets, array_filter( array_map( 'strval', $secrets ) ) ) ) );
	}

	/**
	 * Records an event in the activity log.
	 *
	 * @param string $level   info, warning or error.
	 * @param string $event   Machine name, e.g. backup_completed.
	 * @param string $message What happened, for the administrator.
	 * @param array  $context Optional `backup` or `restore` id.
	 * @return void
	 */
	public function log( $level, $event, $message, array $context = array() ) {
		if ( ! $this->vault->ensure() ) {
			return;
		}

		$line = wp_json_encode(
			array(
				'time'    => Utill::now(),
				'level'   => in_array( $level, array( self::LEVEL_WARNING, self::LEVEL_ERROR ), true ) ? $level : self::LEVEL_INFO,
				'event'   => sanitize_key( $event ),
				'message' => Redactor::scrub( $message, $this->secrets ),
				'job'     => isset( $context['job'] ) ? sanitize_key( (string) $context['job'] ) : '',
			)
		);

		// Appending to a private log file.
		@file_put_contents( $this->file(), $line . "\n", FILE_APPEND | LOCK_EX ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
	}

	/**
	 * Appends a line to one job's own log.
	 *
	 * @param string $job_dir The job's folder.
	 * @param string $message What happened.
	 * @param string $level   info, warning or error.
	 * @return void
	 */
	public function job( $job_dir, $message, $level = self::LEVEL_INFO ) {
		if ( ! is_dir( $job_dir ) ) {
			return;
		}

		$line = wp_json_encode(
			array(
				'time'    => Utill::now(),
				'level'   => $level,
				'message' => Redactor::scrub( $message, $this->secrets ),
			)
		);

		// Appending to a private log file.
		@file_put_contents( $job_dir . '/log.jsonl', $line . "\n", FILE_APPEND | LOCK_EX ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
	}

	/**
	 * Reads log lines, newest first.
	 *
	 * @param string $file  Log file.
	 * @param int    $limit Most lines to return.
	 * @param string $level Only this level, or '' for all.
	 * @return array[]
	 */
	public static function read( $file, $limit = 200, $level = '' ) {
		if ( ! is_readable( $file ) ) {
			return array();
		}

		$size   = (int) filesize( $file );
		$handle = fopen( $file, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $handle ) {
			return array();
		}

		// Only the tail is needed; a long log is not read whole.
		if ( $size > self::MAX_BYTES ) {
			fseek( $handle, -self::MAX_BYTES, SEEK_END );
			fgets( $handle );
		}

		$rows = array();

		while ( false !== ( $line = fgets( $handle ) ) ) { // phpcs:ignore Generic.CodeAnalysis.AssignmentInCondition.FoundInWhileCondition, WordPress.CodeAnalysis.AssignmentInCondition.FoundInWhileCondition
			$row = json_decode( $line, true );

			if ( is_array( $row ) && isset( $row['time'], $row['message'] ) && ( '' === $level || ( $row['level'] ?? '' ) === $level ) ) {
				$row['time_display'] = Utill::format_datetime( (string) $row['time'] );
				$rows[]              = $row;
			}
		}

		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		return array_slice( array_reverse( $rows ), 0, max( 1, (int) $limit ) );
	}

	/**
	 * @return string Path of the activity log.
	 */
	public function file() {
		return $this->vault->base() . '/logs/activity.jsonl';
	}

	/**
	 * Drops activity older than the configured number of days.
	 *
	 * @return void
	 */
	public function prune() {
		$file = $this->file();

		if ( ! is_readable( $file ) ) {
			return;
		}

		$cutoff = gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS * (int) $this->settings->get( 'log_retention_days' ) );
		$kept   = array();

		foreach ( array_reverse( self::read( $file, 5000 ) ) as $row ) {
			if ( (string) $row['time'] >= $cutoff ) {
				unset( $row['time_display'] );
				$kept[] = wp_json_encode( $row );
			}
		}

		Utill::write_atomic( $file, $kept ? implode( "\n", $kept ) . "\n" : '' );
	}

	/**
	 * Deletes the whole activity log.
	 *
	 * @return void
	 */
	public function clear() {
		if ( file_exists( $this->file() ) ) {
			wp_delete_file( $this->file() );
		}
	}

	/**
	 * Emails the administrator that a backup or restore failed. Sent once per job, and the result is
	 * recorded as "handed to WordPress", which is all WordPress can tell us.
	 *
	 * @param array  $job     The failed job.
	 * @param string $subject What failed, e.g. "Scheduled backup failed".
	 * @return bool Whether WordPress accepted the message for sending.
	 */
	public function notify_failure( array $job, $subject ) {
		if ( ! $this->settings->get( 'notify_failure' ) ) {
			return false;
		}

		$to = (string) $this->settings->get( 'notify_email' );
		$to = '' !== $to ? $to : (string) get_option( 'admin_email' );

		if ( ! is_email( $to ) ) {
			return false;
		}

		$site = wp_specialchars_decode( (string) get_bloginfo( 'name' ), ENT_QUOTES );
		$body = implode(
			"\n\n",
			array(
				/* translators: %s: site address. */
				sprintf( __( 'VuloBackup on %s reports a problem.', 'vulobackup' ), home_url( '/' ) ),
				Redactor::scrub( (string) ( $job['error'] ?? '' ), $this->secrets ),
				/* translators: %s: admin URL. */
				sprintf( __( 'Details: %s', 'vulobackup' ), admin_url( 'admin.php?page=vulobackup#&tab=backups' ) ),
			)
		);

		$accepted = (bool) wp_mail( $to, sprintf( '[%s] %s', $site, $subject ), $body );

		$this->log(
			$accepted ? self::LEVEL_INFO : self::LEVEL_WARNING,
			'notification',
			$accepted
				? __( 'A failure notification was handed to WordPress for sending.', 'vulobackup' )
				: __( 'WordPress could not send the failure notification email.', 'vulobackup' ),
			array( 'job' => (string) ( $job['id'] ?? '' ) )
		);

		return $accepted;
	}
}
