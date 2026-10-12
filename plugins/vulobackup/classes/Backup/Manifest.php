<?php
/**
 * Manifest class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Backup;

use VuloBackup\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * The manifest: a small JSON file that says what a backup holds, where it came from and what every
 * one of its files should hash to. It is what lets a backup be inspected, verified and restored on
 * any site. It holds no password, key, cookie or other secret.
 */
class Manifest {

	const FILE = 'manifest.json';

	/**
	 * File names a backup may consist of. Nothing else is ever read from, or written into, a backup
	 * folder on the strength of a manifest.
	 */
	const PART_PATTERN = '/^(?:database\.sql\.gz|files-[0-9]{3,4}\.zip)(?:\.enc)?$/';

	/**
	 * Describes the site the backup is taken from.
	 *
	 * @return array
	 */
	public static function site() {
		global $wpdb, $wp_version;

		return array(
			'home'       => home_url(),
			'siteurl'    => site_url(),
			'name'       => wp_specialchars_decode( (string) get_bloginfo( 'name' ), ENT_QUOTES ),
			'multisite'  => is_multisite(),
			'prefix'     => (string) $wpdb->base_prefix,
			'charset'    => (string) $wpdb->charset,
			'wp_version' => (string) $wp_version,
			'php'        => PHP_VERSION,
			'db'         => (string) $wpdb->db_version(),
			'locale'     => get_locale(),
		);
	}

	/**
	 * Reads and checks a backup's manifest.
	 *
	 * @param string $directory The backup's folder.
	 * @return array|\WP_Error
	 */
	public static function read( $directory ) {
		$file = $directory . '/' . self::FILE;

		if ( ! is_readable( $file ) || filesize( $file ) > 5 * 1024 * 1024 ) {
			return new \WP_Error( 'vulobackup_manifest', __( 'This backup has no manifest, so it cannot be verified or restored.', 'vulobackup' ) );
		}

		return self::validate( json_decode( (string) file_get_contents( $file ), true ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file.
	}

	/**
	 * Checks that data is a manifest this version can use, and returns it with nothing unexpected
	 * in it. A manifest can come from an uploaded archive, so nothing in it is trusted.
	 *
	 * @param mixed $data Decoded JSON.
	 * @return array|\WP_Error
	 */
	public static function validate( $data ) {
		$invalid = new \WP_Error( 'vulobackup_manifest', __( 'The manifest of this backup is damaged or is not a VuloBackup manifest.', 'vulobackup' ) );

		if ( ! is_array( $data ) || ! isset( $data['format'], $data['id'], $data['type'], $data['parts'], $data['site'] ) || ! is_array( $data['parts'] ) || ! is_array( $data['site'] ) ) {
			return $invalid;
		}

		if ( (int) $data['format'] > VULOBACKUP_FORMAT_VERSION ) {
			return new \WP_Error( 'vulobackup_manifest_newer', __( 'This backup was made by a newer version of VuloBackup. Update VuloBackup on this site, then try again.', 'vulobackup' ) );
		}

		if ( (int) $data['format'] < 1 || ! in_array( $data['type'], array( 'full', 'database', 'files' ), true ) || ! $data['parts'] || count( $data['parts'] ) > 5000 ) {
			return $invalid;
		}

		$parts = array();
		$names = array();
		$roles = array();

		foreach ( $data['parts'] as $part ) {
			if (
				! is_array( $part )
				|| ! isset( $part['name'], $part['bytes'], $part['sha256'] )
				|| ! is_string( $part['name'] )
				|| ! preg_match( self::PART_PATTERN, $part['name'] )
				|| isset( $names[ $part['name'] ] )
				|| ! is_string( $part['sha256'] )
				|| ! preg_match( '/^[a-f0-9]{64}$/', $part['sha256'] )
				|| ! is_numeric( $part['bytes'] )
				|| $part['bytes'] < 0
			) {
				return $invalid;
			}

			$role                   = 0 === strpos( $part['name'], 'database.' ) ? 'database' : 'files';
			$names[ $part['name'] ] = true;
			$roles[ $role ]         = true;
			$parts[]                = array(
				'name'    => $part['name'],
				'role'    => $role,
				'bytes'   => (int) $part['bytes'],
				'sha256'  => $part['sha256'],
				'entries' => max( 0, (int) ( $part['entries'] ?? 0 ) ),
			);
		}

		$encrypted = ! empty( $data['encrypted'] );
		$salt      = (string) ( $data['salt'] ?? '' );

		if ( $encrypted && ! preg_match( '/^[a-f0-9]{32}$/', $salt ) ) {
			return $invalid;
		}

		foreach ( $parts as $part ) {
			if ( ( '.enc' === substr( $part['name'], -4 ) ) !== $encrypted ) {
				return $invalid;
			}
		}

		$site     = $data['site'];
		$database = isset( $data['database'] ) && is_array( $data['database'] ) && isset( $roles['database'] ) ? $data['database'] : null;
		$files    = isset( $data['files'] ) && is_array( $data['files'] ) && isset( $roles['files'] ) ? $data['files'] : null;
		$by_area  = array();

		foreach ( is_array( $files['by_area'] ?? null ) ? $files['by_area'] : array() as $area => $counts ) {
			if ( in_array( $area, Utill::AREAS, true ) && is_array( $counts ) ) {
				$by_area[ $area ] = array(
					'files' => max( 0, (int) ( $counts['files'] ?? 0 ) ),
					'bytes' => max( 0, (int) ( $counts['bytes'] ?? 0 ) ),
				);
			}
		}

		$text = static function ( $value, $length = 200 ) {
			return is_scalar( $value ) ? substr( sanitize_text_field( (string) $value ), 0, $length ) : '';
		};

		return array(
			'format'         => (int) $data['format'],
			'id'             => $text( $data['id'], 60 ),
			'name'           => $text( $data['name'] ?? '' ),
			'type'           => $data['type'],
			'trigger'        => $text( $data['trigger'] ?? 'manual', 20 ),
			'created_at'     => $text( $data['created_at'] ?? '', 19 ),
			'completed_at'   => $text( $data['completed_at'] ?? '', 19 ),
			'plugin_version' => $text( $data['plugin_version'] ?? '', 20 ),
			'site'           => array(
				'home'       => esc_url_raw( (string) ( $site['home'] ?? '' ) ),
				'siteurl'    => esc_url_raw( (string) ( $site['siteurl'] ?? '' ) ),
				'name'       => $text( $site['name'] ?? '' ),
				'multisite'  => ! empty( $site['multisite'] ),
				'prefix'     => preg_replace( '/[^A-Za-z0-9_$]/', '', (string) ( $site['prefix'] ?? '' ) ),
				'charset'    => preg_replace( '/[^a-z0-9_]/', '', strtolower( (string) ( $site['charset'] ?? '' ) ) ),
				'wp_version' => $text( $site['wp_version'] ?? '', 20 ),
				'php'        => $text( $site['php'] ?? '', 20 ),
				'db'         => $text( $site['db'] ?? '', 40 ),
				'locale'     => $text( $site['locale'] ?? '', 20 ),
			),
			'database'       => $database
				? array(
					'tables'  => max( 0, (int) ( $database['tables'] ?? 0 ) ),
					'rows'    => max( 0, (int) ( $database['rows'] ?? 0 ) ),
					'bytes'   => max( 0, (int) ( $database['bytes'] ?? 0 ) ),
					'names'   => array_values( array_filter( array_map( 'strval', is_array( $database['names'] ?? null ) ? $database['names'] : array() ), array( \VuloBackup\Database\SqlGuard::class, 'is_table_name' ) ) ),
					'skipped' => array_slice( array_map( $text, is_array( $database['skipped'] ?? null ) ? $database['skipped'] : array() ), 0, 200 ),
				)
				: null,
			'files'          => $files
				? array(
					'count'   => max( 0, (int) ( $files['count'] ?? 0 ) ),
					'bytes'   => max( 0, (int) ( $files['bytes'] ?? 0 ) ),
					'by_area' => $by_area,
					'skipped' => array_map( 'intval', is_array( $files['skipped'] ?? null ) ? array_intersect_key( $files['skipped'], array_flip( array( 'excluded', 'symlinks', 'unreadable', 'too_large', 'bad_name', 'missing' ) ) ) : array() ),
				)
				: null,
			'parts'          => $parts,
			'encrypted'      => $encrypted,
			'salt'           => $encrypted ? $salt : '',
			'total_bytes'    => array_sum( array_column( $parts, 'bytes' ) ),
			'warnings'       => array_slice( array_map( $text, is_array( $data['warnings'] ?? null ) ? $data['warnings'] : array() ), 0, 50 ),
		);
	}
}
