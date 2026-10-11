<?php
/**
 * Inventory class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Files;

use VuloBackup\Storage\Vault;

defined( 'ABSPATH' ) || exit;

/**
 * Walks the chosen parts of the site and writes the list of files a backup will hold.
 *
 * One folder is read at a time and the folders still to visit are kept in the cursor, so the walk
 * can stop and resume, never recurses, and never holds the whole site in memory.
 *
 * Left out, and counted so the backup can say so: anything matching an exclusion, symbolic links
 * (never followed, so a link cannot lead outside the site or into a loop), files the web server
 * cannot read, files over the size limit, and folders VuloBackup itself owns.
 */
class Inventory {

	/**
	 * A backup of more files than this is refused rather than run for hours and fail.
	 */
	const MAX_FILES = 2000000;

	/**
	 * How many example paths are kept for each kind of skipped file.
	 */
	const SAMPLES = 15;

	/**
	 * Area => absolute root.
	 *
	 * @var array<string, string>
	 */
	private $roots;

	/**
	 * Exclusions.
	 *
	 * @var Matcher
	 */
	private $matcher;

	/**
	 * Absolute paths that are never entered (the storage folder, and the roots of other areas that
	 * lie inside this one).
	 *
	 * @var string[]
	 */
	private $blocked;

	/**
	 * Skip files larger than this many bytes; 0 for no limit.
	 *
	 * @var int
	 */
	private $max_bytes;

	/**
	 * Whether wp-config.php may be included in the `core` area.
	 *
	 * @var bool
	 */
	private $with_config;

	/**
	 * @param array<string, string> $roots       Every area's root on this site.
	 * @param Matcher               $matcher     Exclusions.
	 * @param string[]              $blocked     Absolute folders never to enter.
	 * @param int                   $max_bytes   Size limit per file, 0 for none.
	 * @param bool                  $with_config Whether to include wp-config.php.
	 */
	public function __construct( array $roots, Matcher $matcher, array $blocked, $max_bytes, $with_config ) {
		$this->roots       = $roots;
		$this->matcher     = $matcher;
		$this->max_bytes   = (int) $max_bytes;
		$this->with_config = (bool) $with_config;
		$this->blocked     = array();

		foreach ( $blocked as $path ) {
			$real = realpath( $path );

			if ( false !== $real ) {
				$this->blocked[] = untrailingslashit( wp_normalize_path( $real ) );
			}
		}
	}

	/**
	 * A fresh cursor for the given areas.
	 *
	 * @param string[] $areas Areas to walk.
	 * @return array
	 */
	public static function cursor( array $areas ) {
		$stack = array();

		foreach ( array_reverse( array_values( $areas ) ) as $area ) {
			$stack[] = $area . '|';
		}

		return array(
			'stack'      => $stack,
			'files'      => 0,
			'bytes'      => 0,
			'list_bytes' => 0,
			'by_area'    => array(),
			'skipped'    => array(
				'excluded'   => 0,
				'symlinks'   => 0,
				'unreadable' => 0,
				'too_large'  => 0,
				'bad_name'   => 0,
			),
			'samples'    => array(),
			'done'       => false,
		);
	}

	/**
	 * Continues the walk until it is finished or the deadline passes.
	 *
	 * @param array    $cursor     Cursor; updated in place.
	 * @param string   $list_file  File the list is written to, one `size<TAB>area/path` per line.
	 * @param float    $deadline   Stop when microtime(true) passes this.
	 * @param callable $checkpoint Called when the cursor is safe to save.
	 * @return bool Whether the walk is complete.
	 * @throws \RuntimeException When the list cannot be written or the site has too many files.
	 */
	public function run( array &$cursor, $list_file, $deadline, callable $checkpoint ) {
		if ( ! empty( $cursor['done'] ) ) {
			return true;
		}

		$handle = fopen( $list_file, 'c+b' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $handle || ! ftruncate( $handle, (int) $cursor['list_bytes'] ) || 0 !== fseek( $handle, 0, SEEK_END ) ) {
			throw new \RuntimeException( esc_html__( 'The list of files could not be written.', 'vulobackup' ) );
		}

		$visited = 0;

		while ( $cursor['stack'] ) {
			list( $area, $relative ) = explode( '|', array_pop( $cursor['stack'] ), 2 );

			$lines = $this->read_directory( $area, $relative, $cursor );

			if ( '' !== $lines && strlen( $lines ) !== fwrite( $handle, $lines ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
				fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

				throw new \RuntimeException( esc_html__( 'The list of files could not be written. The disk may be full.', 'vulobackup' ) );
			}

			$cursor['list_bytes'] += strlen( $lines );

			if ( $cursor['files'] > self::MAX_FILES ) {
				fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

				throw new \RuntimeException( esc_html__( 'This site has more than two million files, which is more than VuloBackup can back up. Exclude some folders in Settings and try again.', 'vulobackup' ) );
			}

			++$visited;

			if ( 0 === $visited % 200 || microtime( true ) > $deadline ) {
				fflush( $handle );
				$checkpoint();

				if ( microtime( true ) > $deadline && $cursor['stack'] ) {
					fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

					return false;
				}
			}
		}

		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		$cursor['done'] = true;
		$checkpoint();

		return true;
	}

	/**
	 * Lists one folder: its files become lines, its sub-folders go on the stack.
	 *
	 * @param string $area     Area.
	 * @param string $relative Folder inside the area, '' for its root.
	 * @param array  $cursor   Cursor.
	 * @return string Lines for the list file.
	 */
	private function read_directory( $area, $relative, array &$cursor ) {
		if ( ! isset( $this->roots[ $area ] ) ) {
			return '';
		}

		$directory = $this->roots[ $area ] . ( '' === $relative ? '' : '/' . $relative );
		$entries   = @scandir( $directory ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- an unreadable folder is counted, not fatal.

		if ( ! is_array( $entries ) ) {
			$this->skip( $cursor, 'unreadable', $area . '/' . $relative );

			return '';
		}

		$lines   = '';
		$folders = array();

		foreach ( $entries as $entry ) {
			if ( '.' === $entry || '..' === $entry ) {
				continue;
			}

			$inner = '' === $relative ? $entry : $relative . '/' . $entry;
			$path  = $directory . '/' . $entry;
			$name  = $area . '/' . $inner;

			if ( is_link( $path ) ) {
				$this->skip( $cursor, 'symlinks', $name );
				continue;
			}

			$is_dir = is_dir( $path );

			if ( $is_dir ) {
				// The storage folder, another area's folder, and what a restore leaves beside a live folder.
				if ( $this->is_blocked( $path ) || file_exists( $path . '/' . Vault::MARKER ) || \VuloBackup\Restore\FilesRestorer::is_working_name( $entry ) ) {
					continue;
				}
			} elseif ( ! is_file( $path ) ) {
				// Sockets, devices and the like.
				continue;
			}

			// A tab or line break in a name would corrupt the list, and such a name is refused on restore.
			if ( preg_match( '/[\x00-\x1F\x7F\\\\:]/', $entry ) || strlen( $name ) > 1000 ) {
				$this->skip( $cursor, 'bad_name', preg_replace( '/[\x00-\x1F\x7F]/', '?', $name ) );
				continue;
			}

			if ( 'core' === $area && '' === $relative && 'wp-config.php' === $entry && ! $this->with_config ) {
				continue;
			}

			if ( $this->matcher->excludes( $name, $is_dir ) ) {
				++$cursor['skipped']['excluded'];
				continue;
			}

			if ( $is_dir ) {
				$folders[] = $area . '|' . $inner;
				continue;
			}

			if ( ! is_readable( $path ) ) {
				$this->skip( $cursor, 'unreadable', $name );
				continue;
			}

			$size = (int) filesize( $path );

			if ( $this->max_bytes > 0 && $size > $this->max_bytes ) {
				$this->skip( $cursor, 'too_large', $name );
				continue;
			}

			$lines .= $size . "\t" . $name . "\n";

			++$cursor['files'];
			$cursor['bytes'] += $size;

			if ( ! isset( $cursor['by_area'][ $area ] ) ) {
				$cursor['by_area'][ $area ] = array(
					'files' => 0,
					'bytes' => 0,
				);
			}

			++$cursor['by_area'][ $area ]['files'];
			$cursor['by_area'][ $area ]['bytes'] += $size;
		}

		// Reversed, so folders are visited in name order.
		foreach ( array_reverse( $folders ) as $folder ) {
			$cursor['stack'][] = $folder;
		}

		return $lines;
	}

	/**
	 * Whether a folder is one that must not be entered.
	 *
	 * @param string $path Absolute folder.
	 * @return bool
	 */
	private function is_blocked( $path ) {
		$real = realpath( $path );

		return false === $real || in_array( untrailingslashit( wp_normalize_path( $real ) ), $this->blocked, true );
	}

	/**
	 * Counts a skipped path and keeps a few examples.
	 *
	 * @param array  $cursor Cursor.
	 * @param string $reason Key of `skipped`.
	 * @param string $name   `area/path`.
	 * @return void
	 */
	private function skip( array &$cursor, $reason, $name ) {
		++$cursor['skipped'][ $reason ];

		if ( ! isset( $cursor['samples'][ $reason ] ) ) {
			$cursor['samples'][ $reason ] = array();
		}

		if ( count( $cursor['samples'][ $reason ] ) < self::SAMPLES ) {
			$cursor['samples'][ $reason ][] = $name;
		}
	}
}
