<?php
/**
 * Matcher class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Files;

defined( 'ABSPATH' ) || exit;

/**
 * Tests paths against exclusion patterns.
 *
 * A path is `area/relative/path`, for example `uploads/2024/05/photo.jpg`. In a pattern `*` matches
 * within one folder or file name, `**` matches across folders and `?` matches one character. A
 * pattern without a slash is compared with the file or folder name alone, so `*.zip` leaves out
 * every zip file.
 */
class Matcher {

	/**
	 * Patterns compiled to regular expressions.
	 *
	 * @var string[]
	 */
	private $expressions = array();

	/**
	 * Constructor.
	 *
	 * @param string[] $patterns Patterns.
	 */
	public function __construct( array $patterns ) {
		foreach ( $patterns as $pattern ) {
			$pattern = trim( str_replace( '\\', '/', (string) $pattern ), " \t/" );

			if ( '' === $pattern ) {
				continue;
			}

			if ( false === strpos( $pattern, '/' ) ) {
				$pattern = '**/' . $pattern;
			}

			$regex = '';

			foreach ( preg_split( '/(\*\*\/|\*\*|\*|\?)/', $pattern, -1, PREG_SPLIT_DELIM_CAPTURE ) as $piece ) {
				if ( '**/' === $piece ) {
					$regex .= '(?:.*/)?';
				} elseif ( '**' === $piece ) {
					$regex .= '.*';
				} elseif ( '*' === $piece ) {
					$regex .= '[^/]*';
				} elseif ( '?' === $piece ) {
					$regex .= '[^/]';
				} else {
					$regex .= preg_quote( $piece, '#' );
				}
			}

			$this->expressions[] = '#^' . $regex . '$#i';
		}
	}

	/**
	 * Whether a path is excluded. A folder is excluded when it, or everything in it, matches.
	 *
	 * @param string $path   `area/relative/path`.
	 * @param bool   $is_dir Whether the path is a folder.
	 * @return bool
	 */
	public function excludes( $path, $is_dir = false ) {
		foreach ( $this->expressions as $expression ) {
			if ( preg_match( $expression, $path ) || ( $is_dir && preg_match( $expression, $path . '/' ) ) || ( $is_dir && preg_match( $expression, $path . '/x' ) && preg_match( $expression, $path . '/x/y' ) ) ) {
				return true;
			}
		}

		return false;
	}
}
