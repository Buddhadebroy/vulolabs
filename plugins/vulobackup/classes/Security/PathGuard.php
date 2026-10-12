<?php
/**
 * PathGuard class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Security;

defined( 'ABSPATH' ) || exit;

/**
 * Decides whether a path that came from somewhere untrusted (an archive entry, a manifest, a
 * request) may be used. Everything that writes or deletes files goes through here.
 */
class PathGuard {

	/**
	 * Longest relative path accepted from an archive.
	 */
	const MAX_LENGTH = 1024;

	/**
	 * Whether a relative path is safe to join onto a base directory: no absolute path, no `..`
	 * step, no backslash, no control character, no empty or dot-only segment.
	 *
	 * @param mixed $path Relative path with forward slashes.
	 * @return bool
	 */
	public static function is_safe_relative( $path ) {
		if ( ! is_string( $path ) || '' === $path || strlen( $path ) > self::MAX_LENGTH ) {
			return false;
		}

		// Control characters (including NUL), a backslash, or a Windows drive or stream separator.
		if ( preg_match( '/[\x00-\x1F\x7F\\\\:]/', $path ) ) {
			return false;
		}

		if ( '/' === $path[0] ) {
			return false;
		}

		foreach ( explode( '/', rtrim( $path, '/' ) ) as $segment ) {
			if ( '' === $segment || '.' === $segment || '..' === $segment ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Whether `$path` is `$base` itself or lies inside it. Both must exist; symbolic links are
	 * resolved first, so a link pointing elsewhere does not count as inside.
	 *
	 * @param string $path Path to test.
	 * @param string $base Directory it must be within.
	 * @return bool
	 */
	public static function is_within( $path, $base ) {
		$real_path = realpath( $path );
		$real_base = realpath( $base );

		if ( false === $real_path || false === $real_base ) {
			return false;
		}

		$real_path = wp_normalize_path( $real_path );
		$real_base = untrailingslashit( wp_normalize_path( $real_base ) );

		return $real_path === $real_base || 0 === strpos( $real_path, $real_base . '/' );
	}

	/**
	 * The same test for a path that may not exist yet: its nearest existing parent is resolved.
	 *
	 * @param string $path Path to test (need not exist).
	 * @param string $base Existing directory it must be within.
	 * @return bool
	 */
	public static function would_be_within( $path, $base ) {
		$path   = wp_normalize_path( $path );
		$suffix = '';

		while ( ! file_exists( $path ) ) {
			$parent = dirname( $path );

			if ( $parent === $path ) {
				return false;
			}

			$suffix = '/' . basename( $path ) . $suffix;
			$path   = $parent;
		}

		if ( false !== strpos( $suffix, '/../' ) || '/..' === substr( $suffix, -3 ) ) {
			return false;
		}

		$real_base = realpath( $base );
		$real_path = realpath( $path );

		if ( false === $real_base || false === $real_path ) {
			return false;
		}

		$real_base = untrailingslashit( wp_normalize_path( $real_base ) );
		$candidate = untrailingslashit( wp_normalize_path( $real_path ) ) . $suffix;

		return $candidate === $real_base || 0 === strpos( $candidate, $real_base . '/' );
	}

	/**
	 * Whether an identifier of a backup or restore is well-formed. Identifiers become directory
	 * names, so nothing else is ever joined onto the storage folder.
	 *
	 * @param mixed $id Identifier.
	 * @return bool
	 */
	public static function is_id( $id ) {
		return is_string( $id ) && 1 === preg_match( '/^[a-z0-9][a-z0-9\-]{5,47}$/', $id );
	}
}
