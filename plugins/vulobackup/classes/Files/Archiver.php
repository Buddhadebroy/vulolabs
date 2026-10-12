<?php
/**
 * Archiver class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Files;

defined( 'ABSPATH' ) || exit;

/**
 * Packs the files named in an inventory list into zip archives.
 *
 * Files are added a batch at a time and the archive is closed after each batch, so a request that
 * runs out of time loses at most one batch. Archives are split into parts of a set size: a part is
 * rewritten whenever a batch is added to it, and small parts keep that cheap, keep memory flat and
 * let a remote upload resume part by part.
 *
 * Each file is read from disk by the zip library as a stream, so a large file does not need to fit
 * in memory.
 */
class Archiver {

	const BATCH_FILES = 400;
	const BATCH_BYTES = 33554432;

	/**
	 * Formats that are compressed already; they are stored as they are to save time.
	 *
	 * @var string[]
	 */
	const STORED = array( 'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'mp3', 'mp4', 'm4a', 'm4v', 'mov', 'avi', 'mkv', 'webm', 'ogg', 'zip', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'pdf', 'woff', 'woff2', 'docx', 'xlsx', 'pptx' );

	/**
	 * Area => absolute root.
	 *
	 * @var array<string, string>
	 */
	private $roots;

	/**
	 * Bytes of files after which a new part is started.
	 *
	 * @var int
	 */
	private $part_bytes;

	/**
	 * @param array<string, string> $roots      Area roots.
	 * @param int                   $part_bytes Size of one part, in bytes of files before compression.
	 */
	public function __construct( array $roots, $part_bytes ) {
		$this->roots      = $roots;
		$this->part_bytes = max( 1048576, (int) $part_bytes );
	}

	/**
	 * @return array A fresh cursor.
	 */
	public static function cursor() {
		return array(
			'offset'     => 0,
			'part'       => 1,
			'part_bytes' => 0,
			'part_files' => 0,
			'files'      => 0,
			'bytes'      => 0,
			'missing'    => 0,
			'samples'    => array(),
			'parts'      => array(),
			'done'       => false,
		);
	}

	/**
	 * @param int $number Part number, from 1.
	 * @return string File name of a part.
	 */
	public static function part_name( $number ) {
		return sprintf( 'files-%03d.zip', $number );
	}

	/**
	 * Continues archiving until every listed file is packed or the deadline passes.
	 *
	 * @param array    $cursor     Cursor; updated in place.
	 * @param string   $list_file  Inventory list.
	 * @param string   $directory  Folder the parts are written to.
	 * @param float    $deadline   Stop when microtime(true) passes this.
	 * @param callable $checkpoint Called when the cursor is safe to save.
	 * @return bool Whether archiving is complete.
	 * @throws \RuntimeException When an archive cannot be written.
	 */
	public function run( array &$cursor, $list_file, $directory, $deadline, callable $checkpoint ) {
		if ( ! empty( $cursor['done'] ) ) {
			return true;
		}

		$list = fopen( $list_file, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $list ) {
			throw new \RuntimeException( esc_html__( 'The list of files could not be read.', 'vulobackup' ) );
		}

		fseek( $list, (int) $cursor['offset'] );

		while ( true ) {
			$batch = array();
			$bytes = 0;

			while ( count( $batch ) < self::BATCH_FILES && $bytes < self::BATCH_BYTES && $cursor['part_bytes'] + $bytes < $this->part_bytes ) { // phpcs:ignore Squiz.PHP.DisallowSizeFunctionsInLoops.Found -- the list grows inside the loop.
				$line = fgets( $list );

				if ( false === $line ) {
					break;
				}

				$parts = explode( "\t", rtrim( $line, "\n" ), 2 );

				if ( 2 === count( $parts ) ) {
					$batch[] = $parts[1];
					$bytes  += (int) $parts[0];
				}
			}

			$offset = ftell( $list );
			$ended  = feof( $list ) || false === $offset;

			if ( $batch ) {
				$path = $directory . '/' . self::part_name( $cursor['part'] );

				// A part left over from an earlier, abandoned attempt at this part number.
				if ( 0 === $cursor['part_files'] && file_exists( $path ) ) {
					wp_delete_file( $path );
				}

				$added = $this->add( $path, $batch, $cursor );

				$cursor['part_files'] += $added['files'];
				$cursor['part_bytes'] += $bytes;
				$cursor['files']      += $added['files'];
				$cursor['bytes']      += $added['bytes'];
			}

			$cursor['offset'] = false === $offset ? (int) filesize( $list_file ) : $offset;

			if ( $cursor['part_bytes'] >= $this->part_bytes || ( $ended && $cursor['part_files'] > 0 ) ) {
				$cursor['parts'][]    = array(
					'name'  => self::part_name( $cursor['part'] ),
					'files' => $cursor['part_files'],
				);
				$cursor['part_files'] = 0;
				$cursor['part_bytes'] = 0;
				++$cursor['part'];
			}

			if ( $ended ) {
				$cursor['done'] = true;
			}

			$checkpoint();

			if ( $ended ) {
				break;
			}

			if ( microtime( true ) > $deadline ) {
				fclose( $list ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

				return false;
			}
		}

		fclose( $list ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		return true;
	}

	/**
	 * Adds a batch of files to a part.
	 *
	 * The zip library reads the files when the archive is closed, and refuses to close if one of
	 * them has gone or become unreadable since it was listed. When that happens the batch is added
	 * again one file at a time, so only the files that really cannot be read are left out.
	 *
	 * @param string   $path   The part's file.
	 * @param string[] $names  `area/path` names.
	 * @param array    $cursor Cursor, for counting files that could not be added.
	 * @return array{files: int, bytes: int}
	 * @throws \RuntimeException When the archive itself cannot be written.
	 */
	private function add( $path, array $names, array &$cursor ) {
		$result = $this->add_all( $path, $names, $cursor, true );

		if ( null !== $result ) {
			return $result;
		}

		$total = array(
			'files' => 0,
			'bytes' => 0,
		);

		foreach ( $names as $name ) {
			$one = $this->add_all( $path, array( $name ), $cursor, false );

			if ( null === $one ) {
				$this->missing( $cursor, $name );
				continue;
			}

			$total['files'] += $one['files'];
			$total['bytes'] += $one['bytes'];
		}

		// Nothing at all could be written: that is the disk or the folder, not the files.
		if ( 0 === $total['files'] && ! file_exists( $path ) && count( $names ) > 1 ) {
			throw new \RuntimeException( esc_html__( 'A backup archive could not be written. The disk may be full, or the backup folder is not writable.', 'vulobackup' ) );
		}

		return $total;
	}

	/**
	 * @param string   $path   The part's file.
	 * @param string[] $names  `area/path` names.
	 * @param array    $cursor Cursor.
	 * @param bool     $count  Whether to count files that are missing before the archive is closed.
	 * @return array{files: int, bytes: int}|null Null when the archive could not be closed.
	 * @throws \RuntimeException When the archive cannot be opened.
	 */
	private function add_all( $path, array $names, array &$cursor, $count ) {
		$zip = new \ZipArchive();

		if ( true !== $zip->open( $path, \ZipArchive::CREATE ) ) {
			throw new \RuntimeException( esc_html__( 'A backup archive could not be created. Check that the backup folder is writable and the disk is not full.', 'vulobackup' ) );
		}

		$files   = 0;
		$bytes   = 0;
		$skipped = array();

		foreach ( $names as $name ) {
			list( $area, $relative ) = array_pad( explode( '/', $name, 2 ), 2, '' );

			$source = isset( $this->roots[ $area ] ) ? $this->roots[ $area ] . '/' . $relative : '';

			if ( '' === $source || is_link( $source ) || ! is_file( $source ) || ! is_readable( $source ) ) {
				$skipped[] = $name;
				continue;
			}

			if ( ! $zip->addFile( $source, $name ) ) {
				$skipped[] = $name;
				continue;
			}

			if ( in_array( strtolower( pathinfo( $name, PATHINFO_EXTENSION ) ), self::STORED, true ) ) {
				$zip->setCompressionName( $name, \ZipArchive::CM_STORE );
			}

			++$files;
			$bytes += (int) filesize( $source );
		}

		// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- a failed close is handled by the caller; the warning would only repeat it.
		if ( ! @$zip->close() ) {
			return null;
		}

		if ( $count ) {
			foreach ( $skipped as $name ) {
				$this->missing( $cursor, $name );
			}
		} elseif ( $skipped ) {
			return null;
		}

		return array(
			'files' => $files,
			'bytes' => $bytes,
		);
	}

	/**
	 * Counts a file that was listed but could not be archived.
	 *
	 * @param array  $cursor Cursor.
	 * @param string $name   `area/path`.
	 * @return void
	 */
	private function missing( array &$cursor, $name ) {
		++$cursor['missing'];

		if ( count( $cursor['samples'] ) < Inventory::SAMPLES ) {
			$cursor['samples'][] = $name;
		}
	}
}
