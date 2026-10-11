<?php
/**
 * FilesRestorer class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Restore;

use VuloBackup\Security\PathGuard;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Puts the files of a backup back.
 *
 * Archives are never unpacked onto the live site. They are unpacked into staging folders first, and
 * every entry is checked on the way: its path must stay inside its area (no `..`, no absolute path,
 * no backslash or control character), it must not be a symbolic link, and the archive may not hold
 * more files or bytes than its manifest declares (which is what stops a "zip bomb"). One entry that
 * fails any check stops the restore before the site has been touched.
 *
 * The plugins, themes, uploads and must-use plugins folders are then switched by renaming: the
 * live folder is moved aside and the staged one takes its place, so the site never has half a
 * folder, and the old folders stay until the whole restore has succeeded, ready to be moved back.
 *
 * The rest of wp-content and WordPress's own files are restored by copying over what is there.
 * That cannot be undone file by file, which the restore screen says before it starts.
 */
class FilesRestorer {

	/**
	 * Areas restored by switching the whole folder.
	 *
	 * @var string[]
	 */
	const SWAPPED = array( 'plugins', 'themes', 'uploads', 'mu-plugins' );

	/**
	 * Area => absolute root on this site.
	 *
	 * @var array<string, string>
	 */
	private $roots;

	/**
	 * Short random string unique to this restore.
	 *
	 * @var string
	 */
	private $token;

	/**
	 * Folder holding the files of the areas that are copied over rather than switched.
	 *
	 * @var string
	 */
	private $overlay;

	/**
	 * @param array<string, string> $roots   Area roots.
	 * @param string                $token   Restore token.
	 * @param string                $overlay Working folder inside the restore's own folder.
	 */
	public function __construct( array $roots, $token, $overlay ) {
		$this->roots   = $roots;
		$this->token   = preg_replace( '/[^a-z0-9]/', '', strtolower( (string) $token ) );
		$this->overlay = $overlay;
	}

	/**
	 * Whether a folder name is one a restore creates beside a live folder. File backups skip them.
	 *
	 * @param string $name Folder name.
	 * @return bool
	 */
	public static function is_working_name( $name ) {
		return 1 === preg_match( '/\.vb(?:new|old)-[a-z0-9]{4,16}$/', $name );
	}

	/**
	 * Where an area's files are unpacked to.
	 *
	 * @param string $area Area.
	 * @return string
	 */
	public function staging( $area ) {
		return in_array( $area, self::SWAPPED, true ) ? $this->roots[ $area ] . '.vbnew-' . $this->token : $this->overlay . '/' . $area;
	}

	/**
	 * @param string $area Area.
	 * @return string Where an area's live folder is moved to when it is switched.
	 */
	public function retired( $area ) {
		return $this->roots[ $area ] . '.vbold-' . $this->token;
	}

	/**
	 * What stands in the way of restoring the given areas, before anything is unpacked.
	 *
	 * @param string[] $areas Areas.
	 * @return string|null
	 */
	public function problem( array $areas ) {
		foreach ( $areas as $area ) {
			if ( ! isset( $this->roots[ $area ] ) ) {
				continue;
			}

			$root = $this->roots[ $area ];

			if ( in_array( $area, self::SWAPPED, true ) ) {
				// Switching a folder means renaming it, which needs write access to the folder it is in.
				if ( is_link( $root ) || ! wp_is_writable( dirname( $root ) ) || ! wp_is_writable( $root ) ) {
					return sprintf(
						/* translators: %s: folder name, e.g. plugins. */
						__( 'The %s folder cannot be replaced: the web server may not rename it, or it is a symbolic link. Fix its permissions, or restore without it.', 'vulobackup' ),
						$area
					);
				}
			} elseif ( ! wp_is_writable( $root ) ) {
				return sprintf(
					/* translators: %s: folder name. */
					__( 'The web server may not write to the %s folder, so its files cannot be restored.', 'vulobackup' ),
					'core' === $area ? 'WordPress' : 'wp-content'
				);
			}
		}

		return null;
	}

	/**
	 * @return array A fresh cursor for extract().
	 */
	public static function cursor() {
		return array(
			'part'  => 0,
			'index' => 0,
			'files' => 0,
			'bytes' => 0,
			'done'  => false,
		);
	}

	/**
	 * Continues unpacking the archives into the staging folders.
	 *
	 * @param array    $cursor     Cursor; updated in place.
	 * @param string[] $archives   Paths of the zip parts, in order.
	 * @param string[] $areas      Areas to restore; entries of other areas are passed over.
	 * @param int      $max_files  Most files the archives may hold (from the manifest).
	 * @param int      $max_bytes  Most bytes they may unpack to (from the manifest).
	 * @param float    $deadline   Stop when microtime(true) passes this.
	 * @param callable $checkpoint Called when the cursor is safe to save.
	 * @return bool Whether everything is unpacked.
	 * @throws \RuntimeException When an archive is damaged or holds something it must not.
	 */
	public function extract( array &$cursor, array $archives, array $areas, $max_files, $max_bytes, $deadline, callable $checkpoint ) {
		$archives = array_values( $archives );
		$count    = count( $archives );

		while ( $cursor['part'] < $count ) {
			$zip = new \ZipArchive();

			if ( true !== $zip->open( $archives[ $cursor['part'] ], \ZipArchive::RDONLY ) ) {
				throw new \RuntimeException( esc_html__( 'An archive of this backup could not be opened. It is damaged. Nothing on your site was changed.', 'vulobackup' ) );
			}

			$entries = $zip->numFiles; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase

			while ( $cursor['index'] < $entries ) {
				$this->extract_entry( $zip, $cursor['index'], $areas, $cursor, $max_files, $max_bytes );

				++$cursor['index'];

				if ( 0 === $cursor['index'] % 100 && microtime( true ) > $deadline ) {
					$zip->close();
					$checkpoint();

					return false;
				}
			}

			$zip->close();

			++$cursor['part'];
			$cursor['index'] = 0;

			$checkpoint();

			if ( microtime( true ) > $deadline && $cursor['part'] < $count ) {
				return false;
			}
		}

		$cursor['done'] = true;

		return true;
	}

	/**
	 * Checks and unpacks one entry.
	 *
	 * @param \ZipArchive $zip       Archive.
	 * @param int         $index     Entry number.
	 * @param string[]    $areas     Areas to restore.
	 * @param array       $cursor    Cursor, for the running totals.
	 * @param int         $max_files File limit.
	 * @param int         $max_bytes Byte limit.
	 * @return void
	 * @throws \RuntimeException When the entry must not be unpacked.
	 */
	private function extract_entry( \ZipArchive $zip, $index, array $areas, array &$cursor, $max_files, $max_bytes ) {
		$stat = $zip->statIndex( $index );
		$name = is_array( $stat ) ? (string) $stat['name'] : '';

		$refused = new \RuntimeException( esc_html__( 'An archive of this backup holds something a VuloBackup archive never does, so the restore was stopped. Nothing on your site was changed.', 'vulobackup' ) );

		if ( ! is_array( $stat ) || ! PathGuard::is_safe_relative( $name ) || '/' === substr( $name, -1 ) ) {
			throw $refused;
		}

		list( $area, $relative ) = array_pad( explode( '/', $name, 2 ), 2, '' );

		if ( ! in_array( $area, Utill::AREAS, true ) || '' === $relative ) {
			throw $refused;
		}

		// Symbolic links are stored with a Unix file type of "link". The archiver never writes one.
		$system     = 0;
		$attributes = 0;

		if ( $zip->getExternalAttributesIndex( $index, $system, $attributes ) && \ZipArchive::OPSYS_UNIX === $system && 0120000 === ( ( $attributes >> 16 ) & 0170000 ) ) {
			throw $refused;
		}

		++$cursor['files'];
		$cursor['bytes'] += (int) $stat['size'];

		if ( $cursor['files'] > $max_files || $cursor['bytes'] > $max_bytes ) {
			throw new \RuntimeException( esc_html__( 'The archives of this backup hold more than its manifest says they should, so the restore was stopped. Nothing on your site was changed.', 'vulobackup' ) );
		}

		if ( ! in_array( $area, $areas, true ) || ! isset( $this->roots[ $area ] ) ) {
			return;
		}

		// The site's own configuration is never replaced by a backup's: it holds this server's
		// database password and keys.
		if ( 'core' === $area && 'wp-config.php' === $relative ) {
			return;
		}

		$base   = $this->staging( $area );
		$target = $base . '/' . $relative;

		if ( ! wp_mkdir_p( dirname( $target ) ) || ! PathGuard::would_be_within( $target, $base ) ) {
			throw new \RuntimeException( esc_html__( 'A folder for the restored files could not be created. Check the permissions of wp-content. Nothing on your site was changed.', 'vulobackup' ) );
		}

		$in  = $zip->getStream( $name );
		$out = $in ? fopen( $target, 'wb' ) : false; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

		if ( ! $in || ! $out ) {
			throw new \RuntimeException( esc_html__( 'A file of this backup could not be unpacked. The archive may be damaged or the disk full. Nothing on your site was changed.', 'vulobackup' ) );
		}

		// One byte more than declared is read, so an entry that unpacks to more than it claims is caught.
		$written = stream_copy_to_stream( $in, $out, (int) $stat['size'] + 1 );

		fclose( $in ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		if ( (int) $stat['size'] !== $written ) {
			throw new \RuntimeException( esc_html__( 'A file of this backup did not unpack to its recorded size. The archive is damaged or the disk is full. Nothing on your site was changed.', 'vulobackup' ) );
		}
	}

	/**
	 * Makes sure the staged plugins folder contains the running copy of this plugin, so the restore
	 * can finish and the site keeps a working VuloBackup whatever version the backup held.
	 *
	 * @param string $own_directory This plugin's folder.
	 * @return void
	 * @throws \RuntimeException When the plugin cannot be carried over.
	 */
	public function keep_plugin( $own_directory ) {
		$staging = $this->staging( 'plugins' );
		$own     = untrailingslashit( wp_normalize_path( $own_directory ) );
		$target  = $staging . '/' . basename( $own );

		if ( ! is_dir( $staging ) ) {
			return;
		}

		Utill::delete_tree( $target );

		if ( is_link( $own ) ) {
			$copied = symlink( (string) readlink( $own ), $target );
		} else {
			$copied = self::copy_tree( $own, $target );
		}

		if ( ! $copied ) {
			throw new \RuntimeException( esc_html__( 'VuloBackup could not carry itself over into the restored plugins folder. Nothing on your site was changed.', 'vulobackup' ) );
		}
	}

	/**
	 * Copies the staged files of an area over the live ones, moving each so that an interrupted
	 * copy carries on where it stopped.
	 *
	 * @param string $area     `others` or `core`.
	 * @param float  $deadline Stop when microtime(true) passes this.
	 * @return bool Whether the area is done.
	 * @throws \RuntimeException When a file cannot be written.
	 */
	public function overlay( $area, $deadline ) {
		$source = $this->staging( $area );

		if ( ! is_dir( $source ) || ! isset( $this->roots[ $area ] ) ) {
			return true;
		}

		return $this->move_into( $source, $this->roots[ $area ], $deadline );
	}

	/**
	 * Moves the contents of one folder into another, folder by folder.
	 *
	 * @param string $source      Folder to empty.
	 * @param string $destination Folder to fill.
	 * @param float  $deadline    Deadline.
	 * @return bool Whether the source is empty now.
	 * @throws \RuntimeException When a file cannot be written.
	 */
	private function move_into( $source, $destination, $deadline ) {
		$entries = scandir( $source );

		foreach ( is_array( $entries ) ? $entries : array() as $entry ) {
			if ( '.' === $entry || '..' === $entry ) {
				continue;
			}

			$from = $source . '/' . $entry;
			$to   = $destination . '/' . $entry;

			if ( is_dir( $from ) && ! is_link( $from ) ) {
				// A link where a folder should be could lead anywhere; it is replaced, not followed.
				if ( is_link( $to ) || ( file_exists( $to ) && ! is_dir( $to ) ) ) {
					wp_delete_file( $to );
				}

				if ( ! wp_mkdir_p( $to ) || ! $this->move_into( $from, $to, $deadline ) ) {
					if ( ! is_dir( $to ) ) {
						throw new \RuntimeException( esc_html__( 'A folder could not be created while restoring files. Some files were already restored; the rest were not.', 'vulobackup' ) );
					}

					return false;
				}

				continue;
			}

			if ( is_dir( $to ) && ! is_link( $to ) ) {
				Utill::delete_tree( $to );
			}

			// rename() replaces an existing file in one step where the filesystem allows; copy is the
			// fallback across filesystems.
			if ( ! @rename( $from, $to ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.rename_rename
				if ( ! copy( $from, $to ) ) {
					throw new \RuntimeException( esc_html__( 'A file could not be written while restoring files. Some files were already restored; the rest were not. Check the folder permissions and restore again.', 'vulobackup' ) );
				}

				wp_delete_file( $from );
			}

			if ( microtime( true ) > $deadline ) {
				return false;
			}
		}

		@rmdir( $source ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_rmdir

		return true;
	}

	/**
	 * Switches every staged folder into place.
	 *
	 * @param string[] $areas Areas that were unpacked.
	 * @return string[] The areas that were switched, for rollback() or finish().
	 * @throws \RuntimeException When a folder cannot be switched; those already switched are put back first.
	 */
	public function swap( array $areas ) {
		$done = array();

		foreach ( array_intersect( self::SWAPPED, $areas ) as $area ) {
			$staging = $this->staging( $area );

			if ( ! is_dir( $staging ) || ! isset( $this->roots[ $area ] ) ) {
				continue;
			}

			$live    = $this->roots[ $area ];
			$retired = $this->retired( $area );

			// phpcs:disable WordPress.WP.AlternativeFunctions.rename_rename, WordPress.PHP.NoSilencedErrors.Discouraged -- WP_Filesystem cannot rename a folder in one step on every transport, and the one-step rename is the point.
			if ( ! @rename( $live, $retired ) ) {
				$this->rollback( $done );

				throw new \RuntimeException(
					sprintf(
						/* translators: %s: folder name. */
						esc_html__( 'The %s folder could not be moved aside, so the restore was stopped and your site\'s files were left as they were.', 'vulobackup' ),
						esc_html( $area )
					)
				);
			}

			if ( ! @rename( $staging, $live ) ) {
				@rename( $retired, $live );
				$this->rollback( $done );

				throw new \RuntimeException(
					sprintf(
						/* translators: %s: folder name. */
						esc_html__( 'The restored %s folder could not be moved into place, so the restore was stopped and your site\'s files were left as they were.', 'vulobackup' ),
						esc_html( $area )
					)
				);
			}
			// phpcs:enable

			$done[] = $area;
		}

		if ( function_exists( 'opcache_reset' ) ) {
			@opcache_reset(); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- restricted on some hosts.
		}

		return $done;
	}

	/**
	 * Puts switched folders back the way they were.
	 *
	 * @param string[] $areas Areas returned by swap().
	 * @return bool Whether every one of them was put back.
	 */
	public function rollback( array $areas ) {
		$ok = true;

		foreach ( $areas as $area ) {
			$live    = $this->roots[ $area ];
			$retired = $this->retired( $area );
			$staging = $this->staging( $area );

			if ( ! is_dir( $retired ) ) {
				continue;
			}

			// phpcs:disable WordPress.WP.AlternativeFunctions.rename_rename, WordPress.PHP.NoSilencedErrors.Discouraged
			if ( is_dir( $live ) && ! @rename( $live, $staging ) ) {
				$ok = false;
				continue;
			}

			$ok = @rename( $retired, $live ) && $ok;
			// phpcs:enable
		}

		return $ok;
	}

	/**
	 * Every folder this restore may have left on disk, to delete once it is over.
	 *
	 * @return string[]
	 */
	public function leftovers() {
		$paths = array( $this->overlay );

		foreach ( self::SWAPPED as $area ) {
			if ( isset( $this->roots[ $area ] ) ) {
				$paths[] = $this->staging( $area );
				$paths[] = $this->retired( $area );
			}
		}

		return array_values( array_filter( $paths, 'file_exists' ) );
	}

	/**
	 * Copies a folder and everything in it. Symbolic links inside it are not copied.
	 *
	 * @param string $source      Folder to copy.
	 * @param string $destination Where to.
	 * @return bool
	 */
	private static function copy_tree( $source, $destination ) {
		if ( ! wp_mkdir_p( $destination ) ) {
			return false;
		}

		$entries = scandir( $source );

		foreach ( is_array( $entries ) ? $entries : array() as $entry ) {
			if ( '.' === $entry || '..' === $entry || is_link( $source . '/' . $entry ) ) {
				continue;
			}

			$from = $source . '/' . $entry;
			$to   = $destination . '/' . $entry;

			if ( is_dir( $from ) ? ! self::copy_tree( $from, $to ) : ! copy( $from, $to ) ) {
				return false;
			}
		}

		return true;
	}
}
