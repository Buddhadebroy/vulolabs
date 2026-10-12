<?php
/**
 * Restore Engine class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Restore;

use VuloBackup\Backup\Engine as BackupEngine;
use VuloBackup\Backup\Manifest;
use VuloBackup\Backup\Verifier;
use VuloBackup\Database\Importer;
use VuloBackup\Jobs\Store;
use VuloBackup\Logging\Logger;
use VuloBackup\Security\Crypto;
use VuloBackup\Storage\Destinations;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Restores a backup, in an order chosen so that the site is only changed at the very end.
 *
 * Steps, in order:
 *
 *   check      the backup can be restored here at all
 *   fetch      bring the archives back from remote storage if they are not on this server
 *   verify     every archive matches the checksum in the manifest
 *   safety     back up the site as it is now
 *   preflight  folders are writable, the database user has the rights, there is room on disk
 *   decrypt    decrypt the archives into a working folder
 *   extract    unpack the files into staging folders, checking every entry
 *   import     load the database into temporary tables, checking every statement
 *   migrate    replace the old site address in those tables (when the backup is from another address)
 *   overlay    copy the "rest of wp-content" and WordPress files over the live ones
 *   commit     switch the folders, then switch the database tables, in one request
 *
 * Up to `overlay`, a failure or a cancel leaves the site exactly as it was: only staging folders and
 * temporary tables exist, and they are removed. `overlay` overwrites files one by one and cannot be
 * undone. In `commit` the folder switch is undone if the database switch fails; once the database
 * switch has succeeded the restore is complete, and going back means restoring the safety backup.
 *
 * The job record says which of the three happened (`changed`: nothing, partial or all), and every
 * message to the administrator is written from that, so a failed restore never claims to have
 * done nothing when it has, or the reverse.
 */
class Engine {

	/**
	 * Step => status shown.
	 *
	 * @var array<string, string>
	 */
	const STEPS = array(
		'check'     => 'verifying',
		'fetch'     => 'verifying',
		'verify'    => 'verifying',
		'safety'    => 'safety_backup',
		'preflight' => 'preparing',
		'decrypt'   => 'preparing',
		'extract'   => 'preparing',
		'import'    => 'preparing',
		'migrate'   => 'preparing',
		'overlay'   => 'restoring',
		'commit'    => 'restoring',
	);

	/**
	 * The job being worked on.
	 *
	 * @var array
	 */
	private $job;

	/**
	 * The job's folder.
	 *
	 * @var string
	 */
	private $dir;

	/**
	 * The backup being restored.
	 *
	 * @var array|null
	 */
	private $backup = null;

	/**
	 * The backup's manifest.
	 *
	 * @var array|null
	 */
	private $manifest = null;

	/**
	 * Works on a restore until it is finished or the deadline passes.
	 *
	 * @param array $job      Job.
	 * @param float $deadline Stop when microtime(true) passes this.
	 * @return array The job, saved.
	 */
	public function tick( array $job, $deadline ) {
		$this->job = $job;
		$this->dir = VuloBackup()->jobs->dir( $job );

		try {
			if ( 'queued' === $this->job['status'] ) {
				$this->job['step'] = 'check';
				$this->log( __( 'Restore started.', 'vulobackup' ) );
				VuloBackup()->logger->log(
					Logger::LEVEL_INFO,
					'restore_started',
					/* translators: %s: backup name. */
					sprintf( __( 'Restore of backup "%s" started.', 'vulobackup' ), (string) $this->job['backup_name'] ),
					array( 'job' => $this->job['id'] )
				);
			}

			$this->load();

			$names = array_keys( self::STEPS );

			while ( 'done' !== $this->job['step'] ) {
				$step = $this->job['step'];

				$this->job['status']  = self::STEPS[ $step ];
				$this->job['percent'] = (int) max( (int) $this->job['percent'], floor( array_search( $step, $names, true ) / count( $names ) * 100 ) );

				$finished = $this->{'step_' . $step}( $deadline );

				if ( $finished ) {
					$index             = array_search( $step, $names, true );
					$this->job['step'] = isset( $names[ $index + 1 ] ) ? $names[ $index + 1 ] : 'done';
				}

				$this->save();

				if ( ! $finished || ( microtime( true ) > $deadline && 'commit' !== $this->job['step'] ) ) {
					break;
				}
			}
		} catch ( \Throwable $error ) {
			$this->fail( $error->getMessage() );
		}

		return $this->job;
	}

	/**
	 * Marks a restore failed and removes what it had prepared.
	 *
	 * @param array  $job     Job.
	 * @param string $message Why.
	 * @return array The job, saved.
	 */
	public function fail_job( array $job, $message ) {
		$this->job = $job;
		$this->dir = VuloBackup()->jobs->dir( $job );

		$this->fail( $message );

		return $this->job;
	}

	/**
	 * Stops a restore at the administrator's request.
	 *
	 * @param array $job Job.
	 * @return array The job, saved.
	 */
	public function cancel( array $job ) {
		$this->job = $job;
		$this->dir = VuloBackup()->jobs->dir( $job );

		$this->discard();

		$this->job['status']      = 'cancelled';
		$this->job['label']       = '';
		$this->job['finished_at'] = Utill::now();
		$this->job['error']       = 'partial' === $this->job['changed']
			? __( 'The restore was cancelled while files were being copied. Some files were already replaced; the database was not changed.', 'vulobackup' )
			: __( 'The restore was cancelled. Nothing on your site was changed.', 'vulobackup' );

		$this->log( $this->job['error'], Logger::LEVEL_WARNING );
		VuloBackup()->logger->log( Logger::LEVEL_WARNING, 'restore_cancelled', $this->job['error'], array( 'job' => $this->job['id'] ) );
		VuloBackup()->jobs->save( $this->job );

		return $this->job;
	}

	/**
	 * Deletes what finished restores left behind (old folders, old tables) when the request that
	 * completed them ran out of time to tidy up. Called by the watchdog.
	 *
	 * @param float $deadline Stop when microtime(true) passes this.
	 * @return void
	 */
	public static function sweep( $deadline ) {
		$jobs = VuloBackup()->jobs;

		foreach ( $jobs->all( Store::KIND_RESTORE ) as $job ) {
			if ( ! in_array( $job['status'], Store::FINAL_STATUSES, true ) || ( empty( $job['leftovers'] ) && empty( $job['cursor']['db'] ) ) ) {
				continue;
			}

			$engine      = new self();
			$engine->job = $job;
			$engine->dir = $jobs->dir( $job );

			$engine->tidy( $deadline );
			$jobs->save( $engine->job );

			if ( microtime( true ) > $deadline ) {
				return;
			}
		}
	}

	/**
	 * Loads the backup and its manifest.
	 *
	 * @return void
	 * @throws \RuntimeException When the backup is gone or its manifest is unusable.
	 */
	private function load() {
		$this->backup = VuloBackup()->jobs->get( Store::KIND_BACKUP, (string) $this->job['backup_id'] );

		if ( ! $this->backup || 'completed' !== $this->backup['status'] ) {
			throw new \RuntimeException( esc_html__( 'The backup to restore no longer exists.', 'vulobackup' ) );
		}

		$manifest = Manifest::read( VuloBackup()->jobs->dir( $this->backup ) );

		if ( is_wp_error( $manifest ) ) {
			throw new \RuntimeException( esc_html( $manifest->get_error_message() ) );
		}

		$this->manifest = $manifest;
	}

	/**
	 * Checks the backup can be restored on this site.
	 *
	 * @return bool
	 * @throws \RuntimeException When it cannot.
	 */
	private function step_check() {
		$manifest   = $this->manifest;
		$components = $this->job['components'];

		$this->job['label'] = __( 'Checking the backup', 'vulobackup' );

		if ( is_multisite() !== $manifest['site']['multisite'] ) {
			throw new \RuntimeException(
				$manifest['site']['multisite']
					? esc_html__( 'This backup is of a multisite network and can only be restored to a multisite network.', 'vulobackup' )
					: esc_html__( 'This backup is of a single site and cannot be restored over a multisite network.', 'vulobackup' )
			);
		}

		if ( ! empty( $components['database'] ) && ! $manifest['database'] ) {
			throw new \RuntimeException( esc_html__( 'This backup does not contain a database.', 'vulobackup' ) );
		}

		$areas = array_values( array_intersect( (array) $components['areas'], array_keys( $manifest['files']['by_area'] ?? array() ) ) );

		if ( empty( $components['database'] ) && ! $areas ) {
			throw new \RuntimeException( esc_html__( 'Nothing was chosen to restore, or the backup does not hold what was chosen.', 'vulobackup' ) );
		}

		$this->job['components']['areas'] = $areas;

		if ( $areas && ! class_exists( '\ZipArchive' ) ) {
			throw new \RuntimeException( esc_html__( 'This server\'s PHP has no zip extension, which restoring files needs. Ask your host to enable it.', 'vulobackup' ) );
		}

		if ( $manifest['encrypted'] ) {
			if ( ! Crypto::is_available() ) {
				throw new \RuntimeException( esc_html__( 'This backup is encrypted, and this server\'s PHP has no sodium extension to decrypt it. Ask your host to enable sodium.', 'vulobackup' ) );
			}

			if ( '' === $this->password() ) {
				throw new \RuntimeException( esc_html__( 'This backup is encrypted. Enter the password it was made with.', 'vulobackup' ) );
			}
		}

		$this->job['changed'] = 'nothing';
		$this->job['cursor']  = array(
			'verify'  => 0,
			'fetch'   => array(),
			'extract' => FilesRestorer::cursor(),
			'db'      => Importer::cursor( (string) $this->job['token'] ),
			'migrate' => Migrator::cursor(),
		);

		return true;
	}

	/**
	 * Downloads archives that are only at a remote destination.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 * @throws \RuntimeException When an archive cannot be fetched.
	 */
	private function step_fetch( $deadline ) {
		$directory = VuloBackup()->jobs->dir( $this->backup );
		$missing   = array();

		foreach ( $this->needed_parts() as $part ) {
			if ( ! is_file( $directory . '/' . $part['name'] ) || (int) filesize( $directory . '/' . $part['name'] ) !== $part['bytes'] ) {
				$missing[] = $part;
			}
		}

		if ( ! $missing ) {
			return true;
		}

		$copy_id = null;

		foreach ( (array) ( $this->backup['copies'] ?? array() ) as $id => $copy ) {
			if ( 'uploaded' === ( $copy['status'] ?? '' ) && VuloBackup()->destinations->get( $id ) ) {
				$copy_id = $id;
				break;
			}
		}

		if ( null === $copy_id ) {
			throw new \RuntimeException( esc_html__( 'Archives of this backup are missing from this server, and no remote destination holds a copy. It cannot be restored.', 'vulobackup' ) );
		}

		$destination = VuloBackup()->destinations->get( $copy_id );
		$provider    = VuloBackup()->destinations->provider( $destination['provider'] );

		VuloBackup()->logger->hide( VuloBackup()->destinations->secret_values( $provider, $destination['config'] ) );

		foreach ( $missing as $part ) {
			$this->job['label'] = sprintf(
				/* translators: %s: destination name. */
				__( 'Downloading the backup from %s', 'vulobackup' ),
				(string) $this->backup['copies'][ $copy_id ]['name']
			);

			$state  = isset( $this->job['cursor']['fetch'][ $part['name'] ] ) ? $this->job['cursor']['fetch'][ $part['name'] ] : array();
			$result = $provider->download( $destination['config'], Destinations::remote_name( $this->backup['id'], $part['name'] ), $directory . '/' . $part['name'], $part['bytes'], $state, $deadline );

			$this->job['cursor']['fetch'][ $part['name'] ] = $state;

			if ( is_wp_error( $result ) ) {
				throw new \RuntimeException( esc_html( $result->get_error_message() ) );
			}

			if ( ! $result ) {
				return false;
			}
		}

		// Only the archives this restore needs were fetched; the backup is "on this server" again
		// only if that is all of them.
		$complete = true;

		foreach ( $this->manifest['parts'] as $part ) {
			$complete = $complete && is_file( $directory . '/' . $part['name'] );
		}

		if ( $complete ) {
			$this->backup['local'] = true;

			VuloBackup()->jobs->save( $this->backup );
		}

		$this->log( __( 'Archives downloaded from remote storage.', 'vulobackup' ) );

		return true;
	}

	/**
	 * Hashes every archive that will be used and compares it with the manifest.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 * @throws \RuntimeException When an archive does not match.
	 */
	private function step_verify( $deadline ) {
		$directory = VuloBackup()->jobs->dir( $this->backup );
		$parts     = $this->needed_parts();
		$count     = count( $parts );

		$this->job['label'] = __( 'Verifying the backup', 'vulobackup' );

		while ( $this->job['cursor']['verify'] < $count ) {
			$problem = Verifier::part_problem( $directory, $parts[ $this->job['cursor']['verify'] ] );

			if ( null !== $problem ) {
				throw new \RuntimeException( esc_html( $problem . ' ' . __( 'The backup cannot be trusted, so it was not restored.', 'vulobackup' ) ) );
			}

			++$this->job['cursor']['verify'];

			if ( microtime( true ) > $deadline && $this->job['cursor']['verify'] < $count ) {
				return false;
			}
		}

		$this->log( __( 'Every archive matches its checksum.', 'vulobackup' ) );

		return true;
	}

	/**
	 * Backs up what is about to be replaced.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 * @throws \RuntimeException When the safety backup fails.
	 */
	private function step_safety( $deadline ) {
		if ( empty( $this->job['options']['safety'] ) ) {
			$this->log( __( 'No safety backup was made, as chosen.', 'vulobackup' ), Logger::LEVEL_WARNING );

			return true;
		}

		$this->job['label'] = __( 'Backing up the site as it is now', 'vulobackup' );

		$jobs = VuloBackup()->jobs;

		if ( empty( $this->job['safety_id'] ) ) {
			$components = $this->job['components'];
			$has_db     = ! empty( $components['database'] );
			$has_files  = ! empty( $components['areas'] );
			$safety     = VuloBackup()->runner->start_backup(
				array(
					'type'    => $has_db && $has_files ? 'full' : ( $has_db ? 'database' : 'files' ),
					'areas'   => $components['areas'],
					'trigger' => 'safety',
				)
			);

			if ( is_wp_error( $safety ) ) {
				throw new \RuntimeException( esc_html( $safety->get_error_message() ) );
			}

			$this->job['safety_id'] = $safety['id'];
			$this->save();
		}

		$safety = $jobs->get( Store::KIND_BACKUP, (string) $this->job['safety_id'] );

		if ( $safety && ! in_array( $safety['status'], Store::FINAL_STATUSES, true ) ) {
			$safety = ( new BackupEngine() )->tick( $safety, $deadline );
		}

		if ( ! $safety || in_array( $safety['status'], array( 'failed', 'cancelled' ), true ) ) {
			throw new \RuntimeException(
				sprintf(
					/* translators: %s: error. */
					esc_html__( 'The safety backup of your current site could not be made, so the restore did not go ahead. %s You can restore without a safety backup, but then there is no way back.', 'vulobackup' ),
					esc_html( (string) ( $safety['error'] ?? '' ) )
				)
			);
		}

		if ( 'completed' !== $safety['status'] ) {
			$this->job['label'] = sprintf(
				/* translators: %s: what the safety backup is doing. */
				__( 'Safety backup: %s', 'vulobackup' ),
				(string) $safety['label']
			);

			// Progress of the safety backup is progress of the restore.
			$this->job['cursor']['safety'] = $safety['percent'] . '|' . $safety['label'];

			return false;
		}

		$this->log( __( 'Safety backup of the current site completed.', 'vulobackup' ) );

		return true;
	}

	/**
	 * Checks everything the restore will need, while nothing has been touched yet.
	 *
	 * @return bool
	 * @throws \RuntimeException When something would make the restore fail part-way.
	 */
	private function step_preflight() {
		$components = $this->job['components'];

		$this->job['label'] = __( 'Checking the server', 'vulobackup' );

		if ( $components['areas'] ) {
			$problem = $this->files()->problem( $components['areas'] );

			if ( null !== $problem ) {
				throw new \RuntimeException( esc_html( $problem ) );
			}

			$needed = 0;

			foreach ( $components['areas'] as $area ) {
				$needed += (int) ( $this->manifest['files']['by_area'][ $area ]['bytes'] ?? 0 );
			}

			$free = function_exists( 'disk_free_space' ) ? @disk_free_space( WP_CONTENT_DIR ) : false; // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged

			if ( false !== $free && $free < $needed + 20 * 1024 * 1024 ) {
				throw new \RuntimeException(
					sprintf(
						/* translators: 1: space needed, 2: space free. */
						esc_html__( 'There is not enough disk space to restore the files: %1$s is needed and %2$s is free. The old files are kept until the restore has succeeded, so both must fit.', 'vulobackup' ),
						esc_html( Utill::size( $needed ) ),
						esc_html( Utill::size( $free ) )
					)
				);
			}
		}

		if ( ! empty( $components['database'] ) ) {
			$problem = ( new Importer() )->privilege_problem( (string) $this->job['token'] );

			if ( null !== $problem ) {
				throw new \RuntimeException( esc_html( $problem ) );
			}
		}

		return true;
	}

	/**
	 * Decrypts the archives into the working folder.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 */
	private function step_decrypt( $deadline ) {
		if ( ! $this->manifest['encrypted'] ) {
			return true;
		}

		$this->job['label'] = __( 'Decrypting the backup', 'vulobackup' );

		$source = VuloBackup()->jobs->dir( $this->backup );

		wp_mkdir_p( $this->dir . '/work' );

		foreach ( $this->needed_parts() as $part ) {
			$plain = $this->dir . '/work/' . substr( $part['name'], 0, -4 );

			if ( is_file( $plain ) ) {
				continue;
			}

			Crypto::decrypt_file( $source . '/' . $part['name'], $plain . '.tmp', $this->password() );
			rename( $plain . '.tmp', $plain ); // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename

			if ( microtime( true ) > $deadline ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Unpacks the files into staging folders.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 */
	private function step_extract( $deadline ) {
		$areas = $this->job['components']['areas'];

		if ( ! $areas ) {
			return true;
		}

		$archives = array();

		foreach ( $this->needed_parts() as $part ) {
			if ( 'files' === $part['role'] ) {
				$archives[] = $this->part_path( $part );
			}
		}

		$this->job['label'] = sprintf(
			/* translators: %s: number of files unpacked. */
			__( 'Unpacking files (%s so far)', 'vulobackup' ),
			number_format_i18n( $this->job['cursor']['extract']['files'] )
		);

		$files = $this->files();
		$done  = $files->extract(
			$this->job['cursor']['extract'],
			$archives,
			$areas,
			(int) $this->manifest['files']['count'],
			// Sizes are from when the files were listed; a file that grew before it was archived is allowed for.
			(int) ( $this->manifest['files']['bytes'] * 1.05 ) + 10 * 1024 * 1024,
			$deadline,
			function () {
				$this->save();
			}
		);

		if ( $done ) {
			if ( in_array( 'plugins', $areas, true ) ) {
				$files->keep_plugin( WP_PLUGIN_DIR . '/' . dirname( VuloBackup()->plugin_base ) );
			}

			$this->log(
				sprintf(
					/* translators: %s: number of files. */
					__( 'Files unpacked and checked: %s.', 'vulobackup' ),
					number_format_i18n( $this->job['cursor']['extract']['files'] )
				)
			);
		}

		return $done;
	}

	/**
	 * Loads the database into temporary tables.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 */
	private function step_import( $deadline ) {
		if ( empty( $this->job['components']['database'] ) ) {
			return true;
		}

		$this->job['label'] = sprintf(
			/* translators: 1: tables loaded so far, 2: tables in the backup. */
			__( 'Loading the database (table %1$d of %2$d)', 'vulobackup' ),
			count( $this->job['cursor']['db']['tables'] ),
			(int) $this->manifest['database']['tables']
		);

		$dump = null;

		foreach ( $this->needed_parts() as $part ) {
			if ( 'database' === $part['role'] ) {
				$dump = $this->part_path( $part );
			}
		}

		$done = ( new Importer() )->run(
			$this->job['cursor']['db'],
			(string) $dump,
			$deadline,
			function () {
				$this->save();
			}
		);

		if ( $done ) {
			$this->log(
				sprintf(
					/* translators: 1: number of tables, 2: number of rows. */
					__( 'Database loaded into temporary tables and counted: %1$d tables, %2$d rows.', 'vulobackup' ),
					count( $this->job['cursor']['db']['tables'] ),
					$this->job['cursor']['db']['rows']
				)
			);
		}

		return $done;
	}

	/**
	 * Adapts a database from another address or table prefix to this site.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 */
	private function step_migrate( $deadline ) {
		if ( empty( $this->job['components']['database'] ) ) {
			return true;
		}

		$cursor = &$this->job['cursor']['db'];
		$tables = array_values( $cursor['tables'] );
		$site   = $this->manifest['site'];
		$pairs  = array();

		foreach ( array(
			'home'    => home_url(),
			'siteurl' => site_url(),
		) as $key => $current ) {
			$old = untrailingslashit( (string) $site[ $key ] );
			$new = untrailingslashit( $current );

			if ( '' !== $old && $old !== $new ) {
				$pairs[ $old ] = $new;
			}
		}

		$migrator = new Migrator();

		if ( empty( $this->job['cursor']['migrate']['prefixed'] ) ) {
			$migrator->fix_prefix( $tables, (string) $cursor['prefix'] );
			$this->job['cursor']['migrate']['prefixed'] = true;
		}

		if ( ! $pairs ) {
			return true;
		}

		$this->job['label'] = __( 'Replacing the old site address', 'vulobackup' );

		$replacer = new SerializedReplacer( $pairs );
		$needle   = (string) wp_parse_url( (string) $site['home'], PHP_URL_HOST );

		$replacer->skipped = (int) $this->job['cursor']['migrate']['skipped'];

		$done = '' === $needle || $migrator->run(
			$this->job['cursor']['migrate'],
			$tables,
			$replacer,
			$needle,
			$deadline,
			function () {
				$this->save();
			}
		);

		if ( $done ) {
			$this->job['migrated'] = array(
				'from'    => (string) $site['home'],
				'to'      => home_url(),
				'changed' => (int) $this->job['cursor']['migrate']['changed'],
				'skipped' => (int) $this->job['cursor']['migrate']['skipped'],
			);

			$this->log(
				sprintf(
					/* translators: 1: old address, 2: new address, 3: number of rows changed. */
					__( 'Site address replaced: %1$s became %2$s in %3$d rows.', 'vulobackup' ),
					(string) $site['home'],
					home_url(),
					(int) $this->job['cursor']['migrate']['changed']
				)
			);
		}

		return $done;
	}

	/**
	 * Copies the files of the areas that cannot be switched as a folder. From here on the site has
	 * been changed.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 */
	private function step_overlay( $deadline ) {
		$areas = array_diff( $this->job['components']['areas'], FilesRestorer::SWAPPED );

		if ( ! $areas ) {
			return true;
		}

		$this->job['label']   = __( 'Copying files into place', 'vulobackup' );
		$this->job['changed'] = 'partial';

		$this->save();

		foreach ( $areas as $area ) {
			if ( ! $this->files()->overlay( $area, $deadline ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Switches the folders and the database tables, and finishes the restore. Runs in one request,
	 * because once the database has been switched the administrator's session may no longer exist
	 * to ask for another.
	 *
	 * @return bool
	 * @throws \RuntimeException When a switch fails.
	 */
	private function step_commit() {
		$components = $this->job['components'];
		$files      = $this->files();

		$this->job['label'] = __( 'Switching to the restored site', 'vulobackup' );

		$swapped = $files->swap( $components['areas'] );

		if ( ! empty( $components['database'] ) ) {
			try {
				$this->carry_over();
				( new Importer() )->swap( $this->job['cursor']['db'] );
			} catch ( \Throwable $error ) {
				$restored = $files->rollback( $swapped );

				throw new \RuntimeException(
					esc_html(
						$error->getMessage() . ' ' . (
							$restored
								? __( 'The folders that had been switched were put back.', 'vulobackup' )
								: __( 'Some folders that had been switched could not be put back; the previous ones are beside them with ".vbold" in their names.', 'vulobackup' )
						)
					)
				);
			}

			wp_cache_flush();

			// The database is switched. What follows cannot fail the restore, only leave a note.
			try {
				$importer = new Importer();

				$importer->drop_leftovers( $this->job['cursor']['db'] );
				$importer->add_foreign_keys( $this->job['cursor']['db'] );
			} catch ( \Throwable $error ) {
				$this->job['cursor']['db']['adjusted'][] = __( 'Some tidying up after the database switch could not be finished; it is retried automatically.', 'vulobackup' );
			}
		}

		$db = $this->job['cursor']['db'];

		$this->job['changed']     = 'all';
		$this->job['status']      = 'completed';
		$this->job['percent']     = 100;
		$this->job['label']       = '';
		$this->job['finished_at'] = Utill::now();
		$this->job['result']      = array(
			'tables' => empty( $components['database'] ) ? 0 : (int) $this->manifest['database']['tables'],
			'rows'   => empty( $components['database'] ) ? 0 : (int) $db['rows'],
			'files'  => (int) $this->job['cursor']['extract']['files'],
			'areas'  => $components['areas'],
			'notes'  => array_values( array_unique( (array) $db['adjusted'] ) ),
		);

		unset( $this->job['options']['password'] );

		$this->log( __( 'Restore completed.', 'vulobackup' ) );
		VuloBackup()->logger->log(
			Logger::LEVEL_INFO,
			'restore_completed',
			/* translators: %s: backup name. */
			sprintf( __( 'Backup "%s" was restored.', 'vulobackup' ), (string) $this->job['backup_name'] ),
			array( 'job' => $this->job['id'] )
		);

		// The record is written first: whatever happens while tidying up, the restore is done.
		VuloBackup()->jobs->save( $this->job );

		$this->tidy( microtime( true ) + 15 );

		/**
		 * Fires when a restore has completed.
		 *
		 * @param array $job The restore's job record.
		 */
		do_action( 'vulobackup_restore_completed', $this->job );

		return true;
	}

	/**
	 * Makes the loaded database fit this site before it is switched in: this site's address,
	 * VuloBackup's own settings and records, the plugin still active, and the administrator who is
	 * doing the restore still signed in where that is possible.
	 *
	 * @return void
	 */
	private function carry_over() {
		global $wpdb;

		$tmp = array();

		foreach ( $this->job['cursor']['db']['tables'] as $table ) {
			$tmp[ $table['final'] ] = \VuloBackup\Database\SqlGuard::ident( $table['tmp'] );
		}

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- table names are this restore's own temporary tables and WordPress's own; values are placeholders.
		if ( isset( $tmp[ $wpdb->options ] ) ) {
			$options = $tmp[ $wpdb->options ];
			$own     = $wpdb->esc_like( 'vulobackup_' ) . '%';

			$wpdb->query( $wpdb->prepare( "DELETE FROM {$options} WHERE option_name LIKE %s", $own ) );
			$wpdb->query( $wpdb->prepare( "INSERT INTO {$options} ( option_name, option_value, autoload ) SELECT option_name, option_value, autoload FROM {$wpdb->options} WHERE option_name LIKE %s", $own ) );

			foreach ( array(
				'siteurl' => site_url(),
				'home'    => home_url(),
			) as $name => $value ) {
				$wpdb->query( $wpdb->prepare( "UPDATE {$options} SET option_value = %s WHERE option_name = %s", $value, $name ) );
			}

			$active = $wpdb->get_var( "SELECT option_value FROM {$options} WHERE option_name = 'active_plugins'" );
			$active = is_string( $active ) ? @unserialize( $active, array( 'allowed_classes' => false ) ) : array(); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.PHP.DiscouragedPHPFunctions.serialize_unserialize -- a list of plugin paths; no object can be created.
			$active = array_values( array_filter( is_array( $active ) ? $active : array(), 'is_string' ) );

			if ( ! in_array( VuloBackup()->plugin_base, $active, true ) && ! is_multisite() ) {
				$active[] = VuloBackup()->plugin_base;

				sort( $active );
				$wpdb->query( $wpdb->prepare( "UPDATE {$options} SET option_value = %s WHERE option_name = 'active_plugins'", serialize( $active ) ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.serialize_serialize -- the format WordPress stores this option in.
			}
		}

		$user = wp_get_current_user();

		if ( $user && $user->exists() && isset( $tmp[ $wpdb->users ], $tmp[ $wpdb->usermeta ] ) ) {
			$users    = $tmp[ $wpdb->users ];
			$usermeta = $tmp[ $wpdb->usermeta ];

			// Only when the same person exists in the backup under the same id.
			if ( $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$users} WHERE ID = %d AND user_login = %s", $user->ID, $user->user_login ) ) ) {
				$wpdb->query( $wpdb->prepare( "DELETE FROM {$usermeta} WHERE user_id = %d AND meta_key = 'session_tokens'", $user->ID ) );
				$wpdb->query( $wpdb->prepare( "INSERT INTO {$usermeta} ( user_id, meta_key, meta_value ) SELECT user_id, meta_key, meta_value FROM {$wpdb->usermeta} WHERE user_id = %d AND meta_key = 'session_tokens'", $user->ID ) );
			}
		}
		// phpcs:enable
	}

	/**
	 * Marks the restore failed, saying truthfully how much of the site was changed.
	 *
	 * @param string $message Why.
	 * @return void
	 */
	private function fail( $message ) {
		$changed = (string) ( $this->job['changed'] ?? 'nothing' );

		$this->discard();

		$suffix = array(
			'nothing' => __( 'Nothing on your site was changed.', 'vulobackup' ),
			'partial' => __( 'Some files outside the plugins, themes and uploads folders had already been replaced and stay replaced. The database was not changed.', 'vulobackup' ),
			'all'     => '',
		);

		// Exception messages are escaped where they are thrown; here they become plain text again,
		// and the admin screen escapes them when it shows them.
		$message = html_entity_decode( wp_strip_all_tags( (string) $message ), ENT_QUOTES, 'UTF-8' );

		// Many messages already say it.
		if ( 'nothing' === $changed && false !== strpos( $message, $suffix['nothing'] ) ) {
			$suffix['nothing'] = '';
		}

		$this->job['status']      = 'failed';
		$this->job['label']       = '';
		$this->job['error']       = trim( $message . ' ' . ( $suffix[ $changed ] ?? '' ) );
		$this->job['finished_at'] = Utill::now();

		if ( ! empty( $this->job['safety_id'] ) && 'nothing' !== $changed ) {
			$this->job['error'] .= ' ' . __( 'To go back to how the site was, restore the safety backup made before this restore.', 'vulobackup' );
		}

		unset( $this->job['options']['password'] );

		$this->log( $this->job['error'], Logger::LEVEL_ERROR );
		VuloBackup()->logger->log(
			Logger::LEVEL_ERROR,
			'restore_failed',
			/* translators: 1: backup name, 2: error. */
			sprintf( __( 'Restore of backup "%1$s" failed. %2$s', 'vulobackup' ), (string) ( $this->job['backup_name'] ?? '' ), $this->job['error'] ),
			array( 'job' => $this->job['id'] )
		);
		VuloBackup()->jobs->save( $this->job );

		/**
		 * Fires when a restore has failed.
		 *
		 * @param array $job The restore's job record.
		 */
		do_action( 'vulobackup_restore_failed', $this->job );
	}

	/**
	 * Throws away what an unfinished restore prepared: the temporary tables and staging folders.
	 *
	 * @return void
	 */
	private function discard() {
		if ( isset( $this->job['cursor']['db'] ) && empty( $this->job['cursor']['db']['swapped'] ) ) {
			try {
				( new Importer() )->drop_leftovers( $this->job['cursor']['db'] );
			} catch ( \Throwable $error ) {
				$this->log( __( 'Temporary database tables could not be removed. They are named vbt… and can be dropped.', 'vulobackup' ), Logger::LEVEL_WARNING );
			}
		}

		$this->tidy( microtime( true ) + 15 );
	}

	/**
	 * Deletes the working folders and the replaced tables and folders, as far as time allows. What
	 * is left is recorded and removed later by the watchdog.
	 *
	 * @param float $deadline Stop when microtime(true) passes this.
	 * @return void
	 */
	private function tidy( $deadline ) {
		// Before the switch these are the temporary tables, after it the replaced ones.
		if ( ! empty( $this->job['cursor']['db'] ) ) {
			try {
				( new Importer() )->drop_leftovers( $this->job['cursor']['db'] );
			} catch ( \Throwable $error ) {
				$this->log( __( 'Some database tables left by this restore could not be removed yet.', 'vulobackup' ), Logger::LEVEL_WARNING );
			}
		}

		$paths = array_unique( array_merge( (array) ( $this->job['leftovers'] ?? array() ), $this->files()->leftovers(), array( $this->dir . '/work' ) ) );
		$left  = array();

		foreach ( $paths as $path ) {
			if ( ! file_exists( $path ) && ! is_link( $path ) ) {
				continue;
			}

			// Only ever a folder this restore created: its own working folders, or a folder with the
			// restore's token in its name beside a live one.
			$own = 0 === strpos( wp_normalize_path( $path ), wp_normalize_path( $this->dir ) . '/' ) || FilesRestorer::is_working_name( basename( $path ) );

			if ( ! $own || ! Utill::delete_tree( $path, $deadline ) ) {
				$left[] = $path;
			}
		}

		$this->job['leftovers'] = $left;

		if ( in_array( $this->job['status'], Store::FINAL_STATUSES, true ) && ! $left && empty( $this->job['cursor']['db']['old_tables'] ) && empty( $this->job['cursor']['db']['tables'] ) ) {
			$this->job['cursor'] = array();
		}

		VuloBackup()->jobs->save( $this->job );
	}

	/**
	 * The parts of the backup this restore reads.
	 *
	 * @return array[]
	 */
	private function needed_parts() {
		$components = $this->job['components'];
		$parts      = array();

		foreach ( $this->manifest['parts'] as $part ) {
			if ( ( 'database' === $part['role'] && ! empty( $components['database'] ) ) || ( 'files' === $part['role'] && ! empty( $components['areas'] ) ) ) {
				$parts[] = $part;
			}
		}

		return $parts;
	}

	/**
	 * Where the readable (decrypted) file of a part is.
	 *
	 * @param array $part Part from the manifest.
	 * @return string Where the readable (decrypted) file of a part is.
	 */
	private function part_path( array $part ) {
		return $this->manifest['encrypted']
			? $this->dir . '/work/' . substr( $part['name'], 0, -4 )
			: VuloBackup()->jobs->dir( $this->backup ) . '/' . $part['name'];
	}

	/**
	 * Builds the files restorer for this job.
	 *
	 * @return FilesRestorer
	 */
	private function files() {
		return new FilesRestorer( Utill::area_roots(), (string) $this->job['token'], $this->dir . '/overlay' );
	}

	/**
	 * The password for an encrypted backup: the one given for this restore, or this site's own.
	 *
	 * @return string
	 */
	private function password() {
		$given = (string) ( $this->job['options']['password'] ?? '' );

		return '' !== $given ? VuloBackup()->secrets->decrypt( $given ) : Crypto::stored_password();
	}

	/**
	 * Appends a line to the job's log.
	 *
	 * @param string $message Line for the job's log.
	 * @param string $level   Level.
	 * @return void
	 */
	private function log( $message, $level = Logger::LEVEL_INFO ) {
		VuloBackup()->logger->job( $this->dir, $message, $level );
	}

	/**
	 * Saves the job.
	 *
	 * @return void
	 * @throws \RuntimeException When the job's state can no longer be written.
	 */
	private function save() {
		if ( ! VuloBackup()->jobs->save( $this->job ) ) {
			throw new \RuntimeException( esc_html__( 'The restore\'s progress could not be saved. The disk may be full.', 'vulobackup' ) );
		}
	}
}
