<?php
/**
 * Bundle class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Backup;

use VuloBackup\Jobs\Store;
use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * A backup as one downloadable file, and the way back in.
 *
 * On disk a backup is a manifest and several archives. For download they are wrapped, as they are,
 * in a single zip written straight to the browser: nothing is compressed again and no second copy
 * is made on disk, so downloading a large backup needs no extra space. Any zip tool can open it.
 *
 * Importing reverses that. An uploaded bundle may hold a manifest and the archives the manifest
 * names, and nothing else; anything else in it is refused and nothing is kept.
 */
class Bundle {

	/**
	 * Set in tests to write the large-file (zip64) records for small files too.
	 *
	 * @var bool
	 */
	public static $force_zip64 = false;

	/**
	 * The files a bundle of this backup holds.
	 *
	 * @param array $job Backup job.
	 * @return array|\WP_Error Each: name, path, bytes.
	 */
	public static function entries( array $job ) {
		$directory = VuloBackup()->jobs->dir( $job );
		$manifest  = Manifest::read( $directory );

		if ( is_wp_error( $manifest ) ) {
			return $manifest;
		}

		$entries = array(
			array(
				'name'  => Manifest::FILE,
				'path'  => $directory . '/' . Manifest::FILE,
				'bytes' => (int) filesize( $directory . '/' . Manifest::FILE ),
			),
		);

		foreach ( $manifest['parts'] as $part ) {
			$path = $directory . '/' . $part['name'];

			if ( ! is_file( $path ) || (int) filesize( $path ) !== $part['bytes'] ) {
				return new \WP_Error( 'vulobackup_missing', __( 'The archives of this backup are not on this server (they may be at a remote destination only), so it cannot be downloaded from here.', 'vulobackup' ), array( 'status' => 409 ) );
			}

			$entries[] = array(
				'name'  => $part['name'],
				'path'  => $path,
				'bytes' => $part['bytes'],
			);
		}

		return $entries;
	}

	/**
	 * A file name for the download.
	 *
	 * @param array $job Backup job.
	 * @return string
	 */
	public static function filename( array $job ) {
		$host = preg_replace( '/[^a-z0-9.\-]/', '', strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) ) );

		return 'vulobackup-' . ( '' !== $host ? $host . '-' : '' ) . $job['id'] . '.zip';
	}

	/**
	 * Writes the bundle to a stream.
	 *
	 * @param array[]  $entries From entries().
	 * @param resource $out     Stream to write to.
	 * @return int Bytes written.
	 */
	public static function write( array $entries, $out ) {
		$offset  = 0;
		$central = '';
		$time    = self::dos_time( time() );

		foreach ( $entries as $entry ) {
			$size   = (int) $entry['bytes'];
			$crc    = hexdec( (string) hash_file( 'crc32b', $entry['path'] ) );
			$name   = $entry['name'];
			$large  = self::$force_zip64 || $size >= 0xFFFFFFFF;
			$far    = self::$force_zip64 || $offset >= 0xFFFFFFFF;
			$extra  = $large ? pack( 'vv', 1, 16 ) . self::quad( $size ) . self::quad( $size ) : '';
			$header = pack( 'VvvvvvVVVvv', 0x04034b50, $large ? 45 : 20, 0x0800, 0, $time[0], $time[1], $crc, $large ? 0xFFFFFFFF : $size, $large ? 0xFFFFFFFF : $size, strlen( $name ), strlen( $extra ) ) . $name . $extra;

			$fields = '';

			if ( $large ) {
				$fields .= self::quad( $size ) . self::quad( $size );
			}

			if ( $far ) {
				$fields .= self::quad( $offset );
			}

			$central_extra = '' !== $fields ? pack( 'vv', 1, strlen( $fields ) ) . $fields : '';
			$central      .= pack(
				'VvvvvvvVVVvvvvvVV',
				0x02014b50,
				45,
				$large || $far ? 45 : 20,
				0x0800,
				0,
				$time[0],
				$time[1],
				$crc,
				$large ? 0xFFFFFFFF : $size,
				$large ? 0xFFFFFFFF : $size,
				strlen( $name ),
				strlen( $central_extra ),
				0,
				0,
				0,
				0,
				$far ? 0xFFFFFFFF : $offset
			) . $name . $central_extra;

			fwrite( $out, $header ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite

			$in = fopen( $entry['path'], 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

			while ( $in && ! feof( $in ) ) {
				fwrite( $out, (string) fread( $in, 1048576 ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite, WordPress.WP.AlternativeFunctions.file_system_operations_fread
			}

			if ( $in ) {
				fclose( $in ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			}

			$offset += strlen( $header ) + $size;
		}

		$count = count( $entries );
		$start = $offset;
		$tail  = '';

		if ( self::$force_zip64 || $start >= 0xFFFFFFFF || strlen( $central ) >= 0xFFFFFFFF || $count >= 0xFFFF ) {
			$tail .= pack( 'V', 0x06064b50 ) . self::quad( 44 ) . pack( 'vvVV', 45, 45, 0, 0 ) . self::quad( $count ) . self::quad( $count ) . self::quad( strlen( $central ) ) . self::quad( $start );
			$tail .= pack( 'VV', 0x07064b50, 0 ) . self::quad( $start + strlen( $central ) ) . pack( 'V', 1 );
		}

		$tail .= pack( 'VvvvvVVv', 0x06054b50, 0, 0, min( $count, 0xFFFF ), min( $count, 0xFFFF ), min( strlen( $central ), 0xFFFFFFFF ), min( $start, 0xFFFFFFFF ), 0 );

		fwrite( $out, $central . $tail ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite

		return $offset + strlen( $central ) + strlen( $tail );
	}

	/**
	 * How many bytes write() will produce, for the Content-Length header.
	 *
	 * @param array[] $entries From entries().
	 * @return int
	 */
	public static function size( array $entries ) {
		$total   = 0;
		$central = 0;

		foreach ( $entries as $entry ) {
			$large    = self::$force_zip64 || $entry['bytes'] >= 0xFFFFFFFF;
			$far      = self::$force_zip64 || $total >= 0xFFFFFFFF;
			$fields   = ( $large ? 16 : 0 ) + ( $far ? 8 : 0 );
			$central += 46 + strlen( $entry['name'] ) + ( $fields ? 4 + $fields : 0 );
			$total   += 30 + strlen( $entry['name'] ) + ( $large ? 20 : 0 ) + $entry['bytes'];
		}

		$zip64 = self::$force_zip64 || $total >= 0xFFFFFFFF || $central >= 0xFFFFFFFF || count( $entries ) >= 0xFFFF;

		return $total + $central + ( $zip64 ? 56 + 20 : 0 ) + 22;
	}

	/**
	 * Turns an uploaded bundle into a backup on this site.
	 *
	 * @param string $file Path of the uploaded zip.
	 * @return array|\WP_Error The new backup job.
	 */
	public static function import( $file ) {
		$refused = new \WP_Error( 'vulobackup_import', __( 'This file is not a VuloBackup backup. Upload the .zip file exactly as it was downloaded from VuloBackup.', 'vulobackup' ), array( 'status' => 400 ) );

		if ( ! class_exists( '\ZipArchive' ) ) {
			return new \WP_Error( 'vulobackup_import', __( 'This server\'s PHP has no zip extension, which importing a backup needs.', 'vulobackup' ), array( 'status' => 400 ) );
		}

		$zip = new \ZipArchive();

		if ( true !== $zip->open( $file, \ZipArchive::RDONLY ) ) {
			return $refused;
		}

		$count = $zip->numFiles; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
		$raw   = $count >= 2 && $count <= 5001 ? $zip->getFromName( Manifest::FILE, 5 * 1024 * 1024 ) : false;

		if ( false === $raw ) {
			$zip->close();

			return $refused;
		}

		$manifest = Manifest::validate( json_decode( $raw, true ) );

		if ( is_wp_error( $manifest ) ) {
			$zip->close();

			return new \WP_Error( $manifest->get_error_code(), $manifest->get_error_message(), array( 'status' => 400 ) );
		}

		// The bundle holds the manifest and exactly the files it names, at exactly their sizes.
		$expected = array();

		foreach ( $manifest['parts'] as $part ) {
			$expected[ $part['name'] ] = $part['bytes'];
		}

		if ( count( $expected ) + 1 !== $count ) {
			$zip->close();

			return $refused;
		}

		for ( $index = 0; $index < $count; $index++ ) {
			$stat = $zip->statIndex( $index );
			$name = is_array( $stat ) ? (string) $stat['name'] : '';

			if ( Manifest::FILE === $name ) {
				continue;
			}

			if ( ! isset( $expected[ $name ] ) || (int) $stat['size'] !== $expected[ $name ] ) {
				$zip->close();

				return $refused;
			}
		}

		$free = VuloBackup()->vault->free_space();

		if ( null !== $free && $free < $manifest['total_bytes'] + 10 * 1024 * 1024 ) {
			$zip->close();

			return new \WP_Error( 'vulobackup_import', __( 'There is not enough disk space to import this backup.', 'vulobackup' ), array( 'status' => 400 ) );
		}

		$jobs = VuloBackup()->jobs;
		$job  = $jobs->create(
			Store::KIND_BACKUP,
			array(
				'type'        => $manifest['type'],
				'trigger'     => 'import',
				'name'        => '' !== $manifest['name'] ? $manifest['name'] : __( 'Imported backup', 'vulobackup' ),
				'status'      => 'completed',
				'step'        => 'done',
				'percent'     => 100,
				'options'     => array(
					'areas'        => array_keys( $manifest['files']['by_area'] ?? array() ),
					'encrypt'      => $manifest['encrypted'],
					'destinations' => array(),
				),
				'site'        => $manifest['site'],
				'origin_id'   => $manifest['id'],
				'made_at'     => $manifest['created_at'],
				'size'        => $manifest['total_bytes'],
				'parts'       => count( $manifest['parts'] ),
				'encrypted'   => $manifest['encrypted'],
				'local'       => true,
				// Not until its checksums have been checked on this server.
				'verified'    => false,
				'copies'      => array(),
				'warnings'    => $manifest['warnings'],
				'finished_at' => Utill::now(),
			)
		);

		if ( is_wp_error( $job ) ) {
			$zip->close();

			return $job;
		}

		$directory = $jobs->dir( $job );
		$ok        = true;

		foreach ( array_merge( array( Manifest::FILE => strlen( $raw ) ), $expected ) as $name => $bytes ) {
			$in  = $zip->getStream( $name );
			$out = $in ? fopen( $directory . '/' . $name, 'wb' ) : false; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

			if ( ! $in || ! $out || stream_copy_to_stream( $in, $out, (int) $bytes + 1 ) !== (int) $bytes ) {
				$ok = false;
			}

			if ( $in ) {
				fclose( $in ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			}

			if ( $out ) {
				fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			}

			if ( ! $ok ) {
				break;
			}
		}

		$zip->close();

		if ( ! $ok ) {
			$jobs->delete( Store::KIND_BACKUP, $job['id'] );

			return new \WP_Error( 'vulobackup_import', __( 'The backup file could not be unpacked. It is damaged, or the disk is full.', 'vulobackup' ), array( 'status' => 400 ) );
		}

		VuloBackup()->logger->job( $directory, __( 'Imported from an uploaded backup file.', 'vulobackup' ) );
		VuloBackup()->logger->log(
			\VuloBackup\Logging\Logger::LEVEL_INFO,
			'backup_imported',
			/* translators: 1: backup name, 2: address of the site it came from. */
			sprintf( __( 'Backup "%1$s" from %2$s was imported.', 'vulobackup' ), $job['name'], $manifest['site']['home'] ),
			array( 'job' => $job['id'] )
		);

		return $job;
	}

	/**
	 * Packs a number as a zip-format quadword.
	 *
	 * @param int $value Number.
	 * @return string The number as eight little-endian bytes.
	 */
	private static function quad( $value ) {
		return pack( 'VV', $value & 0xFFFFFFFF, ( $value >> 32 ) & 0xFFFFFFFF );
	}

	/**
	 * Converts a Unix timestamp to DOS date/time.
	 *
	 * @param int $timestamp Unix timestamp.
	 * @return int[] Time and date in the format zip files use.
	 */
	private static function dos_time( $timestamp ) {
		$parts = getdate( $timestamp );

		return array(
			( $parts['hours'] << 11 ) | ( $parts['minutes'] << 5 ) | ( $parts['seconds'] >> 1 ),
			( max( 0, $parts['year'] - 1980 ) << 9 ) | ( $parts['mon'] << 5 ) | $parts['mday'],
		);
	}
}
