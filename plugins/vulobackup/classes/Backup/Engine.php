<?php
/**
 * Backup Engine class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Backup;

use VuloBackup\Database\Exporter;
use VuloBackup\Files\Archiver;
use VuloBackup\Files\Inventory;
use VuloBackup\Files\Matcher;
use VuloBackup\Logging\Logger;
use VuloBackup\Security\Crypto;
use VuloBackup\Storage\Destinations;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Takes a backup job from "queued" to "completed", one time-boxed slice at a time.
 *
 * The steps, in order, each of which can stop and carry on in a later request:
 *
 *   prepare    check the server can do it, decide what is included
 *   database   export the database
 *   inventory  list the files
 *   archive    pack the files into zip parts
 *   verify     check every archive opens and holds what was put in
 *   encrypt    encrypt the parts (when a password is set)
 *   finalize   hash every part and write the manifest
 *   upload     copy the backup to each remote destination and confirm it arrived
 *   retention  remove backups beyond the number to keep
 *
 * A job is only "completed" after `finalize`: before that there is no manifest, and a backup
 * without a manifest is never offered for restore. Anything thrown along the way fails the job with
 * the message; a backup is never finished with a part of it missing.
 */
class Engine {

	/**
	 * Step => [status shown, share of the progress bar].
	 *
	 * @var array<string, array>
	 */
	const STEPS = array(
		'prepare'   => array( 'preparing', 2 ),
		'database'  => array( 'backing_up', 25 ),
		'inventory' => array( 'backing_up', 8 ),
		'archive'   => array( 'backing_up', 40 ),
		'verify'    => array( 'verifying', 5 ),
		'encrypt'   => array( 'verifying', 5 ),
		'finalize'  => array( 'verifying', 5 ),
		'upload'    => array( 'uploading', 9 ),
		'retention' => array( 'uploading', 1 ),
	);

	/**
	 * Times one file is sent to a destination before that destination is given up on.
	 */
	const UPLOAD_ATTEMPTS = 3;

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
	 * Works on a job until it is finished or the deadline passes.
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
				$this->job['step'] = 'prepare';
				$this->log( __( 'Backup started.', 'vulobackup' ) );
				VuloBackup()->logger->log(
					Logger::LEVEL_INFO,
					'backup_started',
					/* translators: %s: backup name. */
					sprintf( __( 'Backup "%s" started.', 'vulobackup' ), $this->job['name'] ),
					array( 'job' => $this->job['id'] )
				);
			}

			while ( 'done' !== $this->job['step'] ) {
				$step = $this->job['step'];

				$this->job['status'] = self::STEPS[ $step ][0];

				$finished = $this->{'step_' . $step}( $deadline );

				$this->progress();

				if ( $finished ) {
					$this->job['step'] = $this->next_step( $step );
				}

				$this->save();

				if ( ! $finished || microtime( true ) > $deadline ) {
					break;
				}
			}

			if ( 'done' === $this->job['step'] ) {
				$this->complete();
			}
		} catch ( \Throwable $error ) {
			$this->fail( $error->getMessage() );
		}

		return $this->job;
	}

	/**
	 * Marks a job failed, removes what it had built and tells the administrator.
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
	 * Stops a job at the administrator's request and removes what it had built.
	 *
	 * @param array $job Job.
	 * @return array The job, saved.
	 */
	public function cancel( array $job ) {
		$this->job = $job;
		$this->dir = VuloBackup()->jobs->dir( $job );

		$this->abort_upload();
		$this->remove_artifacts();

		$this->job['status']      = 'cancelled';
		$this->job['label']       = '';
		$this->job['finished_at'] = Utill::now();

		$this->log( __( 'Backup cancelled.', 'vulobackup' ), Logger::LEVEL_WARNING );
		VuloBackup()->logger->log(
			Logger::LEVEL_WARNING,
			'backup_cancelled',
			/* translators: %s: backup name. */
			sprintf( __( 'Backup "%s" was cancelled.', 'vulobackup' ), $this->job['name'] ),
			array( 'job' => $this->job['id'] )
		);
		$this->save();

		return $this->job;
	}

	/**
	 * The step after a given one for this job, skipping those it does not need.
	 *
	 * @param string $step Current step.
	 * @return string Next step, or `done`.
	 */
	private function next_step( $step ) {
		$names = array_keys( self::STEPS );
		$index = array_search( $step, $names, true );
		$count = count( $names );

		for ( $i = $index + 1; $i < $count; $i++ ) {
			if ( $this->needs( $names[ $i ] ) ) {
				return $names[ $i ];
			}
		}

		return 'done';
	}

	/**
	 * Checks whether the job's scope includes a given step.
	 *
	 * @param string $step Step.
	 * @return bool Whether this job runs the step.
	 */
	private function needs( $step ) {
		$has_db    = in_array( $this->job['type'], array( 'full', 'database' ), true );
		$has_files = in_array( $this->job['type'], array( 'full', 'files' ), true ) && ! empty( $this->job['options']['areas'] );

		switch ( $step ) {
			case 'database':
				return $has_db;
			case 'inventory':
			case 'archive':
				return $has_files;
			case 'encrypt':
				return ! empty( $this->job['options']['encrypt'] );
			case 'upload':
				return ! empty( $this->job['options']['destinations'] );
			default:
				return true;
		}
	}

	/**
	 * Checks the server can make this backup, and settles what goes into it.
	 *
	 * @return bool
	 * @throws \RuntimeException When the backup cannot be made here.
	 */
	private function step_prepare() {
		if ( ! VuloBackup()->vault->ensure() ) {
			throw new \RuntimeException( esc_html__( 'The backup folder could not be created or is not writable. Check Settings → Storage.', 'vulobackup' ) );
		}

		$type      = $this->job['type'];
		$has_files = in_array( $type, array( 'full', 'files' ), true );

		if ( $has_files && ! class_exists( '\ZipArchive' ) ) {
			throw new \RuntimeException( esc_html__( 'This server\'s PHP has no zip extension, which file backups need. Ask your host to enable it, or make a database-only backup.', 'vulobackup' ) );
		}

		if ( in_array( $type, array( 'full', 'database' ), true ) ) {
			if ( ! function_exists( 'gzopen' ) ) {
				throw new \RuntimeException( esc_html__( 'This server\'s PHP has no zlib extension, which database backups need. Ask your host to enable it.', 'vulobackup' ) );
			}

			$found = ( new Exporter() )->tables( (string) VuloBackup()->settings->get( 'db_scope' ) );

			if ( ! $found['tables'] ) {
				throw new \RuntimeException( esc_html__( 'No database tables were found to back up.', 'vulobackup' ) );
			}

			$this->job['cursor']['db']         = Exporter::cursor( $found['tables'] );
			$this->job['cursor']['db_skipped'] = $found['skipped'];

			if ( $found['skipped'] ) {
				$this->warn(
					sprintf(
						/* translators: %s: comma-separated names. */
						__( 'Not included, because they are views or have names a backup cannot hold: %s', 'vulobackup' ),
						implode( ', ', array_slice( $found['skipped'], 0, 20 ) )
					)
				);
			}
		}

		if ( $has_files ) {
			$roots = Utill::area_roots();
			$areas = array_values( array_intersect( (array) $this->job['options']['areas'], array_keys( $roots ) ) );

			if ( ! $areas ) {
				throw new \RuntimeException( esc_html__( 'None of the chosen folders exist on this site, so there are no files to back up.', 'vulobackup' ) );
			}

			$this->job['options']['areas'] = $areas;
			$this->job['cursor']['inv']    = Inventory::cursor( $areas );
			$this->job['cursor']['arc']    = Archiver::cursor();
		}

		if ( ! empty( $this->job['options']['encrypt'] ) ) {
			if ( ! Crypto::is_available() ) {
				throw new \RuntimeException( esc_html__( 'Encryption is switched on, but this server\'s PHP has no sodium extension. Switch encryption off in Settings, or ask your host to enable sodium.', 'vulobackup' ) );
			}

			if ( '' === Crypto::stored_password() ) {
				throw new \RuntimeException( esc_html__( 'Encryption is switched on, but no password is set. Set one in Settings → Security.', 'vulobackup' ) );
			}

			$this->job['options']['salt'] = bin2hex( random_bytes( Crypto::SALT_BYTES ) );
		}

		$this->job['site'] = Manifest::site();

		return true;
	}

	/**
	 * Exports the database.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 */
	private function step_database( $deadline ) {
		$cursor = &$this->job['cursor']['db'];
		$total  = max( 1, count( $cursor['tables'] ) );

		$this->job['label'] = sprintf(
			/* translators: 1: number of tables done, 2: number of tables. */
			__( 'Exporting the database (table %1$d of %2$d)', 'vulobackup' ),
			min( $total, $cursor['index'] + 1 ),
			$total
		);

		$done = ( new Exporter() )->run(
			$cursor,
			$this->dir . '/database.sql.gz',
			$deadline,
			function () {
				$this->save();
			}
		);

		if ( $done ) {
			$this->log(
				sprintf(
					/* translators: 1: number of tables, 2: number of rows. */
					__( 'Database exported: %1$d tables, %2$d rows.', 'vulobackup' ),
					count( $cursor['tables'] ),
					$cursor['rows']
				)
			);
		}

		return $done;
	}

	/**
	 * Lists the files to back up.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 * @throws \RuntimeException When there is not enough disk space for the backup.
	 */
	private function step_inventory( $deadline ) {
		$settings = VuloBackup()->settings;
		$roots    = Utill::area_roots();
		$cursor   = &$this->job['cursor']['inv'];

		// An area never reaches into another: wp-content's plugins folder belongs to "plugins", not "others".
		$blocked = array_merge( array_values( $roots ), array( VuloBackup()->vault->base() ) );

		$this->job['label'] = sprintf(
			/* translators: %s: number of files found so far. */
			__( 'Listing files (%s found)', 'vulobackup' ),
			number_format_i18n( $cursor['files'] )
		);

		$inventory = new Inventory(
			$roots,
			new Matcher( $settings->exclusions() ),
			$blocked,
			(int) $settings->get( 'max_file_size_mb' ) * 1024 * 1024,
			(bool) $settings->get( 'include_wp_config' )
		);

		$done = $inventory->run(
			$cursor,
			$this->dir . '/files.list',
			$deadline,
			function () {
				$this->save();
			}
		);

		if ( ! $done ) {
			return false;
		}

		$this->log(
			sprintf(
				/* translators: 1: number of files, 2: total size. */
				__( 'Files listed: %1$s files, %2$s.', 'vulobackup' ),
				number_format_i18n( $cursor['files'] ),
				Utill::size( $cursor['bytes'] )
			)
		);

		$labels = array(
			'symlinks'   => __( 'Symbolic links, which are never followed', 'vulobackup' ),
			'unreadable' => __( 'Files or folders the web server may not read', 'vulobackup' ),
			'too_large'  => __( 'Files over the size limit', 'vulobackup' ),
			'bad_name'   => __( 'Files with names a backup cannot hold', 'vulobackup' ),
		);

		foreach ( $labels as $reason => $label ) {
			if ( $cursor['skipped'][ $reason ] > 0 ) {
				$this->warn(
					sprintf(
						/* translators: 1: what was left out, 2: how many, 3: example paths. */
						__( '%1$s were left out (%2$d). For example: %3$s', 'vulobackup' ),
						$label,
						$cursor['skipped'][ $reason ],
						implode( ', ', array_slice( $cursor['samples'][ $reason ] ?? array(), 0, 5 ) )
					)
				);
			}
		}

		// Archives are at most as large as the files; images and video hardly shrink.
		$free   = VuloBackup()->vault->free_space();
		$needed = $cursor['bytes'] * ( empty( $this->job['options']['encrypt'] ) ? 1 : 1.1 ) + 20 * 1024 * 1024;

		if ( null !== $free && $free < $needed ) {
			throw new \RuntimeException(
				sprintf(
					/* translators: 1: space needed, 2: space free. */
					esc_html__( 'There is not enough disk space for this backup: about %1$s is needed and %2$s is free. Delete old backups, exclude large folders in Settings, or move the backup folder to a larger disk.', 'vulobackup' ),
					esc_html( Utill::size( $needed ) ),
					esc_html( Utill::size( $free ) )
				)
			);
		}

		return true;
	}

	/**
	 * Packs the listed files into zip parts.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 */
	private function step_archive( $deadline ) {
		$cursor = &$this->job['cursor']['arc'];
		$total  = (int) $this->job['cursor']['inv']['files'];

		$this->job['label'] = sprintf(
			/* translators: 1: files packed, 2: files in total. */
			__( 'Packing files (%1$s of %2$s)', 'vulobackup' ),
			number_format_i18n( $cursor['files'] + $cursor['missing'] ),
			number_format_i18n( $total )
		);

		$archiver = new Archiver( Utill::area_roots(), (int) VuloBackup()->settings->get( 'part_size_mb' ) * 1024 * 1024 );
		$done     = $archiver->run(
			$cursor,
			$this->dir . '/files.list',
			$this->dir,
			$deadline,
			function () {
				$this->save();
			}
		);

		if ( $done ) {
			if ( $cursor['missing'] > 0 ) {
				$this->warn(
					sprintf(
						/* translators: 1: count, 2: example paths. */
						__( '%1$d files changed or disappeared while the backup ran and are not in it. For example: %2$s', 'vulobackup' ),
						$cursor['missing'],
						implode( ', ', array_slice( $cursor['samples'], 0, 5 ) )
					)
				);
			}

			$this->log(
				sprintf(
					/* translators: 1: number of files, 2: number of archives. */
					__( 'Files packed: %1$s files in %2$d archives.', 'vulobackup' ),
					number_format_i18n( $cursor['files'] ),
					count( $cursor['parts'] )
				)
			);

			wp_delete_file( $this->dir . '/files.list' );
		}

		return $done;
	}

	/**
	 * Checks what was written before it is hashed and declared a backup: the dump is complete and
	 * decompresses to what was written, and each archive opens and holds the files put into it.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 * @throws \RuntimeException When an archive is damaged.
	 */
	private function step_verify( $deadline ) {
		$index = (int) ( $this->job['cursor']['verify'] ?? 0 );
		$parts = $this->plain_parts();

		$this->job['label'] = __( 'Checking the archives', 'vulobackup' );

		$count = count( $parts );

		while ( $index < $count ) {
			$part = $parts[ $index ];
			$path = $this->dir . '/' . $part['name'];

			if ( ! is_file( $path ) ) {
				/* translators: %s: file name. */
				throw new \RuntimeException( sprintf( esc_html__( 'The archive %s is missing.', 'vulobackup' ), esc_html( $part['name'] ) ) );
			}

			if ( 'database' === $part['role'] ) {
				$this->check_dump( $path );
			} else {
				$zip = new \ZipArchive();

				if ( true !== $zip->open( $path, \ZipArchive::RDONLY | \ZipArchive::CHECKCONS ) || $zip->numFiles !== (int) $part['entries'] ) { // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
					/* translators: %s: file name. */
					throw new \RuntimeException( sprintf( esc_html__( 'The archive %s is damaged or incomplete. The disk may be full or failing.', 'vulobackup' ), esc_html( $part['name'] ) ) );
				}

				$zip->close();
			}

			$this->job['cursor']['verify'] = ++$index;

			if ( microtime( true ) > $deadline && $index < $count ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Decompresses the dump from start to end, confirming its length and that its last line is the
	 * exporter's completion mark.
	 *
	 * @param string $path Dump file.
	 * @return void
	 * @throws \RuntimeException When the dump is damaged or unfinished.
	 */
	private function check_dump( $path ) {
		$cursor = $this->job['cursor']['db'];
		$handle = gzopen( $path, 'rb' );
		$bytes  = 0;
		$tail   = '';

		while ( $handle && ! gzeof( $handle ) ) {
			$chunk = gzread( $handle, 1048576 );

			if ( false === $chunk ) {
				break;
			}

			$bytes += strlen( $chunk );
			$tail   = substr( $tail . $chunk, -200 );
		}

		if ( $handle ) {
			gzclose( $handle );
		}

		if ( empty( $cursor['done'] ) || $bytes !== (int) $cursor['raw'] || false === strpos( $tail, '-- vulobackup-complete: tables=' . count( $cursor['tables'] ) . ' rows=' . (int) $cursor['rows'] ) ) {
			throw new \RuntimeException( esc_html__( 'The database dump is damaged or incomplete. The disk may be full or failing.', 'vulobackup' ) );
		}
	}

	/**
	 * Encrypts each part and removes the plain one.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 */
	private function step_encrypt( $deadline ) {
		$parts    = $this->plain_parts();
		$password = Crypto::stored_password();
		$salt     = (string) hex2bin( (string) $this->job['options']['salt'] );

		$this->job['label'] = __( 'Encrypting the archives', 'vulobackup' );

		foreach ( $parts as $part ) {
			$plain = $this->dir . '/' . $part['name'];

			// Already done in an earlier request: the plain file is removed last.
			if ( ! is_file( $plain ) ) {
				continue;
			}

			Crypto::encrypt_file( $plain, $plain . '.enc.tmp', $password, $salt );
			rename( $plain . '.enc.tmp', $plain . '.enc' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename
			wp_delete_file( $plain );
			$this->save();

			if ( microtime( true ) > $deadline ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Hashes every part and writes the manifest. From here on this is a backup.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 * @throws \RuntimeException When a part is missing or the manifest cannot be written.
	 */
	private function step_finalize( $deadline ) {
		$suffix = empty( $this->job['options']['encrypt'] ) ? '' : '.enc';
		$parts  = $this->plain_parts();
		$hashes = isset( $this->job['cursor']['hashes'] ) ? $this->job['cursor']['hashes'] : array();

		$this->job['label'] = __( 'Writing the manifest', 'vulobackup' );

		foreach ( $parts as $part ) {
			$name = $part['name'] . $suffix;

			if ( isset( $hashes[ $name ] ) ) {
				continue;
			}

			$path = $this->dir . '/' . $name;
			$hash = is_file( $path ) ? hash_file( 'sha256', $path ) : false;

			if ( false === $hash ) {
				/* translators: %s: file name. */
				throw new \RuntimeException( sprintf( esc_html__( 'The archive %s is missing.', 'vulobackup' ), esc_html( $name ) ) );
			}

			$hashes[ $name ] = array(
				'name'    => $name,
				'bytes'   => (int) filesize( $path ),
				'sha256'  => $hash,
				'entries' => (int) $part['entries'],
			);

			$this->job['cursor']['hashes'] = $hashes;

			if ( microtime( true ) > $deadline ) {
				$this->save();

				return false;
			}
		}

		$db  = $this->job['cursor']['db'] ?? null;
		$inv = $this->job['cursor']['inv'] ?? null;
		$arc = $this->job['cursor']['arc'] ?? null;

		$manifest = array(
			'format'         => VULOBACKUP_FORMAT_VERSION,
			'id'             => $this->job['id'],
			'name'           => $this->job['name'],
			'type'           => $this->job['type'],
			'trigger'        => $this->job['trigger'],
			'created_at'     => $this->job['created_at'],
			'completed_at'   => Utill::now(),
			'plugin_version' => VULOBACKUP_PLUGIN_VERSION,
			'site'           => $this->job['site'],
			'database'       => $db
				? array(
					'tables'  => count( $db['tables'] ),
					'rows'    => (int) $db['rows'],
					'bytes'   => (int) $db['raw'],
					'names'   => $db['tables'],
					'skipped' => (array) ( $this->job['cursor']['db_skipped'] ?? array() ),
				)
				: null,
			'files'          => $inv && $arc
				? array(
					'count'   => (int) $arc['files'],
					'bytes'   => (int) $arc['bytes'],
					'by_area' => $inv['by_area'],
					'skipped' => array_merge( $inv['skipped'], array( 'missing' => (int) $arc['missing'] ) ),
				)
				: null,
			'parts'          => array_values( $hashes ),
			'encrypted'      => '' !== $suffix,
			'salt'           => '' !== $suffix ? (string) $this->job['options']['salt'] : '',
			'warnings'       => $this->job['warnings'],
		);

		// What is written must be what a restore will accept.
		$checked = Manifest::validate( $manifest );

		if ( is_wp_error( $checked ) || ! Utill::write_atomic( $this->dir . '/' . Manifest::FILE, (string) wp_json_encode( $manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ) ) {
			throw new \RuntimeException( esc_html__( 'The manifest could not be written.', 'vulobackup' ) );
		}

		$this->job['size']        = (int) $checked['total_bytes'];
		$this->job['parts']       = count( $checked['parts'] );
		$this->job['encrypted']   = $checked['encrypted'];
		$this->job['local']       = true;
		$this->job['verified']    = true;
		$this->job['verified_at'] = Utill::now();
		$this->job['copies']      = array();

		// The large working state is in the manifest now.
		$this->job['cursor'] = array();

		$this->log(
			sprintf(
				/* translators: %s: total size. */
				__( 'Backup written and verified: %s.', 'vulobackup' ),
				Utill::size( $this->job['size'] )
			)
		);

		return true;
	}

	/**
	 * Sends the backup to each destination, one file at a time, and confirms each arrived.
	 *
	 * A destination that fails three times on the same file is given up on and recorded as failed;
	 * the others are still tried and the local copy is kept.
	 *
	 * @param float $deadline Deadline.
	 * @return bool
	 * @throws \RuntimeException When the backup's manifest can no longer be read.
	 */
	private function step_upload( $deadline ) {
		$destinations = VuloBackup()->destinations;
		$manifest     = Manifest::read( $this->dir );

		if ( is_wp_error( $manifest ) ) {
			throw new \RuntimeException( esc_html( $manifest->get_error_message() ) );
		}

		$files = array_merge( array_column( $manifest['parts'], 'name' ), array( Manifest::FILE ) );
		$up    = isset( $this->job['cursor']['up'] ) ? $this->job['cursor']['up'] : array(
			'dest'     => 0,
			'file'     => 0,
			'state'    => array(),
			'attempts' => 0,
		);
		$ids   = array_values( (array) $this->job['options']['destinations'] );

		$destination_count = count( $ids );
		$file_count        = count( $files );

		while ( $up['dest'] < $destination_count ) {
			$id          = $ids[ $up['dest'] ];
			$destination = $destinations->get( $id );
			$provider    = $destination ? $destinations->provider( $destination['provider'] ) : null;

			if ( ! $destination || ! $provider ) {
				$this->copy_failed( $id, __( 'This destination was removed before the backup could be sent to it.', 'vulobackup' ), null );
				$up = $this->next_destination( $up );
				continue;
			}

			VuloBackup()->logger->hide( $destinations->secret_values( $provider, $destination['config'] ) );

			if ( ! isset( $this->job['copies'][ $id ] ) ) {
				$this->job['copies'][ $id ] = array(
					'status'   => 'uploading',
					'name'     => '' !== $destination['name'] ? $destination['name'] : $provider->label(),
					'provider' => $provider->id(),
					'where'    => $provider->describe( $destination['config'] ),
					'error'    => '',
				);
			}

			while ( $up['file'] < $file_count ) {
				$name   = $files[ $up['file'] ];
				$local  = $this->dir . '/' . $name;
				$remote = Destinations::remote_name( $this->job['id'], $name );

				$this->job['label'] = sprintf(
					/* translators: 1: destination name, 2: file number, 3: number of files. */
					__( 'Uploading to %1$s (file %2$d of %3$d)', 'vulobackup' ),
					$this->job['copies'][ $id ]['name'],
					$up['file'] + 1,
					count( $files )
				);

				$result = $provider->upload( $destination['config'], $local, $remote, $up['state'], $deadline );

				if ( true === $result ) {
					$result = $provider->verify( $destination['config'], $remote, (int) filesize( $local ) );
				}

				if ( is_wp_error( $result ) ) {
					++$up['attempts'];

					$this->log(
						sprintf(
							/* translators: 1: destination name, 2: attempt number, 3: error. */
							__( 'Upload to %1$s failed (attempt %2$d). %3$s', 'vulobackup' ),
							$this->job['copies'][ $id ]['name'],
							$up['attempts'],
							$result->get_error_message()
						),
						Logger::LEVEL_WARNING
					);

					if ( $up['attempts'] >= self::UPLOAD_ATTEMPTS ) {
						$provider->abort( $destination['config'], $remote, $up['state'] );
						$this->copy_failed( $id, $result->get_error_message(), $destination );
						$up = $this->next_destination( $up );
						continue 2;
					}

					// Try again in the next slice rather than hammering a service that is struggling.
					$this->job['cursor']['up'] = $up;

					return false;
				}

				if ( false === $result ) {
					$this->job['cursor']['up'] = $up;

					return false;
				}

				++$up['file'];
				$up['state']    = array();
				$up['attempts'] = 0;

				$this->job['cursor']['up'] = $up;
				$this->save();

				if ( microtime( true ) > $deadline && $up['file'] < count( $files ) ) {
					return false;
				}
			}

			$this->job['copies'][ $id ]['status']      = 'uploaded';
			$this->job['copies'][ $id ]['verified_at'] = Utill::now();

			$destinations->mark( $id, true );
			$this->log(
				sprintf(
					/* translators: %s: destination name. */
					__( 'Uploaded to %s and confirmed.', 'vulobackup' ),
					$this->job['copies'][ $id ]['name']
				)
			);
			VuloBackup()->logger->log(
				Logger::LEVEL_INFO,
				'upload_completed',
				/* translators: 1: backup name, 2: destination name. */
				sprintf( __( 'Backup "%1$s" was uploaded to %2$s.', 'vulobackup' ), $this->job['name'], $this->job['copies'][ $id ]['name'] ),
				array( 'job' => $this->job['id'] )
			);

			$up = $this->next_destination( $up );
		}

		unset( $this->job['cursor']['up'] );

		return true;
	}

	/**
	 * Advances the upload cursor to the next destination.
	 *
	 * @param array $up Upload cursor.
	 * @return array The cursor moved to the start of the next destination.
	 */
	private function next_destination( array $up ) {
		$up = array(
			'dest'     => $up['dest'] + 1,
			'file'     => 0,
			'state'    => array(),
			'attempts' => 0,
		);

		$this->job['cursor']['up'] = $up;
		$this->save();

		return $up;
	}

	/**
	 * Records that a destination did not get this backup.
	 *
	 * @param string     $id          Destination id.
	 * @param string     $message     Why.
	 * @param array|null $destination The destination, when it still exists.
	 * @return void
	 */
	private function copy_failed( $id, $message, $destination ) {
		$name = isset( $this->job['copies'][ $id ]['name'] ) ? $this->job['copies'][ $id ]['name'] : __( 'A removed destination', 'vulobackup' );

		$this->job['copies'][ $id ] = array_merge(
			isset( $this->job['copies'][ $id ] ) ? $this->job['copies'][ $id ] : array(
				'name'     => $name,
				'provider' => '',
				'where'    => '',
			),
			array(
				'status' => 'failed',
				'error'  => $message,
			)
		);

		if ( $destination ) {
			VuloBackup()->destinations->mark( $id, false, $message );
		}

		$this->warn(
			sprintf(
				/* translators: 1: destination name, 2: error. */
				__( 'The copy to %1$s failed, so this backup is not stored there. %2$s', 'vulobackup' ),
				$name,
				$message
			)
		);
		VuloBackup()->logger->log(
			Logger::LEVEL_ERROR,
			'upload_failed',
			/* translators: 1: backup name, 2: destination name, 3: error. */
			sprintf( __( 'Backup "%1$s" could not be uploaded to %2$s. %3$s', 'vulobackup' ), $this->job['name'], $name, $message ),
			array( 'job' => $this->job['id'] )
		);
	}

	/**
	 * Removes the local archives when the administrator keeps backups remotely only, and applies
	 * the number of backups to keep. Runs only once this backup is verified.
	 *
	 * @return bool
	 */
	private function step_retention() {
		$copies   = (array) $this->job['copies'];
		$uploaded = array_filter(
			$copies,
			static function ( $copy ) {
				return 'uploaded' === $copy['status'];
			}
		);

		// Only when every destination has it: a failed upload must never cost the only copy.
		if ( $copies && count( $uploaded ) === count( $copies ) && ! VuloBackup()->settings->get( 'keep_local_copy' ) && 'safety' !== $this->job['trigger'] ) {
			$manifest = Manifest::read( $this->dir );

			foreach ( is_wp_error( $manifest ) ? array() : $manifest['parts'] as $part ) {
				wp_delete_file( $this->dir . '/' . $part['name'] );
			}

			$this->job['local'] = false;
			$this->log( __( 'Local archives removed: this backup is kept at the remote destinations only.', 'vulobackup' ) );
		}

		$this->save();

		foreach ( ( new Retention() )->apply( $this->job['id'] ) as $line ) {
			$this->log( $line );
		}

		return true;
	}

	/**
	 * Marks the job completed.
	 *
	 * @return void
	 */
	private function complete() {
		$failed = array_filter(
			(array) ( $this->job['copies'] ?? array() ),
			static function ( $copy ) {
				return 'failed' === $copy['status'];
			}
		);

		$this->job['status']      = 'completed';
		$this->job['percent']     = 100;
		$this->job['label']       = '';
		$this->job['finished_at'] = Utill::now();

		$this->log( __( 'Backup completed.', 'vulobackup' ) );
		VuloBackup()->logger->log(
			$failed || $this->job['warnings'] ? Logger::LEVEL_WARNING : Logger::LEVEL_INFO,
			'backup_completed',
			$failed
				/* translators: %s: backup name. */
				? sprintf( __( 'Backup "%s" completed on this server, but a remote copy failed.', 'vulobackup' ), $this->job['name'] )
				/* translators: 1: backup name, 2: size. */
				: sprintf( __( 'Backup "%1$s" completed and verified (%2$s).', 'vulobackup' ), $this->job['name'], Utill::size( (int) ( $this->job['size'] ?? 0 ) ) ),
			array( 'job' => $this->job['id'] )
		);

		if ( $failed && empty( $this->job['notified'] ) ) {
			$first = reset( $failed );

			$this->job['notified'] = true;
			$this->job['error']    = '';

			VuloBackup()->logger->notify_failure(
				array_merge( $this->job, array( 'error' => (string) $first['error'] ) ),
				__( 'A backup could not be copied to remote storage', 'vulobackup' )
			);
		}

		$this->save();

		/**
		 * Fires when a backup has completed and been verified.
		 *
		 * @param array $job The backup's job record.
		 */
		do_action( 'vulobackup_backup_completed', $this->job );
	}

	/**
	 * Marks the job failed.
	 *
	 * @param string $message Why.
	 * @return void
	 */
	private function fail( $message ) {
		$this->abort_upload();

		// A backup that already has its manifest is real; only what came after it failed.
		if ( ! is_file( $this->dir . '/' . Manifest::FILE ) ) {
			$this->remove_artifacts();
		}

		$this->job['status'] = 'failed';
		$this->job['label']  = '';
		// Exception messages are escaped where they are thrown; here they become plain text again,
		// and the admin screen escapes them when it shows them.
		$this->job['error']       = html_entity_decode( wp_strip_all_tags( (string) $message ), ENT_QUOTES, 'UTF-8' );
		$this->job['finished_at'] = Utill::now();

		$this->log( $this->job['error'], Logger::LEVEL_ERROR );
		VuloBackup()->logger->log(
			Logger::LEVEL_ERROR,
			'backup_failed',
			/* translators: 1: backup name, 2: error. */
			sprintf( __( 'Backup "%1$s" failed. %2$s', 'vulobackup' ), $this->job['name'], $this->job['error'] ),
			array( 'job' => $this->job['id'] )
		);

		if ( empty( $this->job['notified'] ) ) {
			$this->job['notified'] = true;

			VuloBackup()->logger->notify_failure(
				$this->job,
				'schedule' === $this->job['trigger'] ? __( 'A scheduled backup failed', 'vulobackup' ) : __( 'A backup failed', 'vulobackup' )
			);
		}

		// The disk may be the very thing that failed; the failure is in the activity log either way.
		VuloBackup()->jobs->save( $this->job );

		/**
		 * Fires when a backup has failed.
		 *
		 * @param array $job The backup's job record.
		 */
		do_action( 'vulobackup_backup_failed', $this->job );
	}

	/**
	 * Tells the destination being uploaded to that the upload is abandoned.
	 *
	 * @return void
	 */
	private function abort_upload() {
		$up = $this->job['cursor']['up'] ?? null;

		if ( ! is_array( $up ) || empty( $up['state'] ) ) {
			return;
		}

		$ids         = array_values( (array) ( $this->job['options']['destinations'] ?? array() ) );
		$destination = isset( $ids[ $up['dest'] ] ) ? VuloBackup()->destinations->get( $ids[ $up['dest'] ] ) : null;
		$provider    = $destination ? VuloBackup()->destinations->provider( $destination['provider'] ) : null;
		$manifest    = Manifest::read( $this->dir );

		if ( $provider && ! is_wp_error( $manifest ) ) {
			$files = array_merge( array_column( $manifest['parts'], 'name' ), array( Manifest::FILE ) );

			if ( isset( $files[ $up['file'] ] ) ) {
				$provider->abort( $destination['config'], Destinations::remote_name( $this->job['id'], $files[ $up['file'] ] ), $up['state'] );
			}
		}
	}

	/**
	 * Deletes the archives and working files of an unfinished backup. The job record and its log
	 * stay, so the failure can be read.
	 *
	 * @return void
	 */
	private function remove_artifacts() {
		$entries = is_dir( $this->dir ) ? scandir( $this->dir ) : array();

		foreach ( is_array( $entries ) ? $entries : array() as $entry ) {
			if ( in_array( $entry, array( '.', '..', 'job.json', 'log.jsonl' ), true ) ) {
				continue;
			}

			Utill::delete_tree( $this->dir . '/' . $entry );
		}

		$this->job['cursor'] = array();
		$this->job['local']  = false;
	}

	/**
	 * The parts this backup consists of, by their names before encryption.
	 *
	 * @return array[] Each: name, role, entries.
	 */
	private function plain_parts() {
		$parts = array();

		if ( ! empty( $this->job['cursor']['db'] ) ) {
			$parts[] = array(
				'name'    => 'database.sql.gz',
				'role'    => 'database',
				'entries' => 0,
			);
		}

		foreach ( (array) ( $this->job['cursor']['arc']['parts'] ?? array() ) as $part ) {
			$parts[] = array(
				'name'    => $part['name'],
				'role'    => 'files',
				'entries' => (int) $part['files'],
			);
		}

		return $parts;
	}

	/**
	 * Works out the percentage shown, from the step and how far through it the job is.
	 *
	 * @return void
	 */
	private function progress() {
		$step   = $this->job['step'];
		$done   = 0;
		$within = 0;
		$cursor = $this->job['cursor'];

		foreach ( self::STEPS as $name => $definition ) {
			if ( ! $this->needs( $name ) ) {
				continue;
			}

			if ( $name === $step ) {
				$within = $definition[1];
				break;
			}

			$done += $definition[1];
		}

		$all = 0;

		foreach ( self::STEPS as $name => $definition ) {
			$all += $this->needs( $name ) ? $definition[1] : 0;
		}

		$fraction = 0;

		if ( 'database' === $step && ! empty( $cursor['db']['tables'] ) ) {
			$fraction = $cursor['db']['index'] / count( $cursor['db']['tables'] );
		} elseif ( 'archive' === $step && ! empty( $cursor['inv']['files'] ) ) {
			$fraction = ( $cursor['arc']['files'] + $cursor['arc']['missing'] ) / $cursor['inv']['files'];
		}

		$this->job['percent'] = (int) max( (int) $this->job['percent'], min( 99, floor( ( $done + $within * min( 1, $fraction ) ) / max( 1, $all ) * 100 ) ) );
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
	 * Records something the administrator should know about a backup that still completes.
	 *
	 * @param string $message Warning.
	 * @return void
	 */
	private function warn( $message ) {
		if ( count( $this->job['warnings'] ) < 50 ) {
			$this->job['warnings'][] = $message;
		}

		$this->log( $message, Logger::LEVEL_WARNING );
	}

	/**
	 * Saves the job.
	 *
	 * @return void
	 * @throws \RuntimeException When the job's state can no longer be written.
	 */
	private function save() {
		if ( ! VuloBackup()->jobs->save( $this->job ) ) {
			throw new \RuntimeException( esc_html__( 'The backup\'s progress could not be saved. The disk may be full.', 'vulobackup' ) );
		}
	}
}
