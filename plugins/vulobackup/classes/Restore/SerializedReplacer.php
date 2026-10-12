<?php
/**
 * SerializedReplacer class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Restore;

defined( 'ABSPATH' ) || exit;

/**
 * Replaces text inside a database value without breaking PHP-serialized data.
 *
 * WordPress stores arrays and objects as serialized strings, in which every piece of text is
 * preceded by its length in bytes: `s:19:"http://old.example";`. Changing the text without changing
 * the number corrupts the value, and WordPress then reads it as empty. A plain search and replace
 * over a database dump does exactly that.
 *
 * This class reads the serialized structure, replaces inside each string and writes the new length.
 * It never calls unserialize(), so no object is ever created from data in a backup, and it follows
 * serialized data nested inside serialized strings. Anything it cannot fully parse is returned
 * unchanged rather than guessed at.
 */
class SerializedReplacer {

	/**
	 * Regular expression matching every form of the old address.
	 *
	 * @var string
	 */
	private $pattern;

	/**
	 * Lower-cased match => replacement.
	 *
	 * @var array<string, string>
	 */
	private $map = array();

	/**
	 * How many values were left unchanged because their structure could not be read.
	 *
	 * @var int
	 */
	public $skipped = 0;

	/**
	 * Constructor.
	 *
	 * @param array<string, string> $pairs Old address => new address, each without a trailing
	 *                                     slash, e.g. `https://old.example/blog` => `https://new.example`.
	 */
	public function __construct( array $pairs ) {
		$variants = array();

		foreach ( $pairs as $old => $new ) {
			$old_rest = (string) preg_replace( '#^https?:#i', '', (string) $old );
			$new_rest = (string) preg_replace( '#^https?:#i', '', (string) $new );

			if ( 0 !== strpos( $old_rest, '//' ) || 0 !== strpos( $new_rest, '//' ) || strlen( $old_rest ) < 5 ) {
				continue;
			}

			$forms = array(
				'http:' . $old_rest  => $new,
				'https:' . $old_rest => $new,
				// Protocol-relative: //old.example/path.
				$old_rest            => $new_rest,
			);

			foreach ( $forms as $from => $to ) {
				$variants[ $from ] = $to;
				// As written inside JSON, and inside a URL parameter.
				$variants[ str_replace( '/', '\\/', $from ) ] = str_replace( '/', '\\/', $to );
				$variants[ rawurlencode( $from ) ]            = rawurlencode( $to );
			}
		}

		// Longest first, so "https://old" wins over the "//old" inside it.
		uksort(
			$variants,
			static function ( $a, $b ) {
				return strlen( $b ) - strlen( $a );
			}
		);

		$alternatives = array();

		foreach ( $variants as $from => $to ) {
			$this->map[ strtolower( $from ) ] = $to;
			$alternatives[]                   = preg_quote( $from, '~' );
		}

		// The address must end there: "old.example" must not match inside "old.example.org" or
		// "old.example-shop.com", nor "/blog" inside "/blog2".
		$this->pattern = $alternatives ? '~(?:' . implode( '|', $alternatives ) . ')(?![A-Za-z0-9_\-]|\.[A-Za-z0-9]|%2D|%2E[A-Za-z0-9])~i' : '';
	}

	/**
	 * Checks whether there is anything to replace.
	 *
	 * @return bool Whether there is anything to replace.
	 */
	public function is_active() {
		return '' !== $this->pattern;
	}

	/**
	 * Replaces the old address in a value from the database.
	 *
	 * @param string $value Value.
	 * @return string The value, changed or not.
	 */
	public function replace( $value ) {
		if ( '' === $this->pattern || ! is_string( $value ) || '' === $value ) {
			return $value;
		}

		if ( self::looks_serialized( $value ) ) {
			$position = 0;
			$result   = $this->walk( $value, $position, 0 );

			if ( null !== $result && strlen( $value ) === $position ) {
				return $result;
			}

			// It looked serialized but is not well-formed. Replacing in it blindly could only make
			// it worse.
			++$this->skipped;

			return $value;
		}

		return $this->replace_text( $value );
	}

	/**
	 * Replaces in a piece of plain text, which may itself be serialized data.
	 *
	 * @param string $text  Text.
	 * @param int    $depth How deeply nested this text is.
	 * @return string
	 */
	private function replace_text( $text, $depth = 0 ) {
		if ( $depth < 5 && self::looks_serialized( $text ) ) {
			$position = 0;
			$result   = $this->walk( $text, $position, $depth + 1 );

			if ( null !== $result && strlen( $text ) === $position ) {
				return $result;
			}
		}

		$replaced = preg_replace_callback(
			$this->pattern,
			function ( $found ) {
				return $this->map[ strtolower( $found[0] ) ] ?? $found[0];
			},
			$text
		);

		return null === $replaced ? $text : $replaced;
	}

	/**
	 * Reads one serialized value starting at `$position` and returns it rewritten.
	 *
	 * @param string $data     Serialized data.
	 * @param int    $position Offset; moved past the value.
	 * @param int    $depth    Nesting depth.
	 * @return string|null Null when the data is not well-formed.
	 */
	private function walk( $data, &$position, $depth ) {
		if ( $depth > 60 || ! isset( $data[ $position + 1 ] ) ) {
			return null;
		}

		$type = $data[ $position ];

		switch ( $type ) {
			case 'N':
				if ( ';' !== $data[ $position + 1 ] ) {
					return null;
				}

				$position += 2;

				return 'N;';

			case 'b':
			case 'i':
			case 'd':
			case 'r':
			case 'R':
				$end = strpos( $data, ';', $position );

				if ( false === $end || ':' !== $data[ $position + 1 ] || $end - $position > 64 ) {
					return null;
				}

				$chunk    = substr( $data, $position, $end - $position + 1 );
				$position = $end + 1;

				return $chunk;

			case 's':
				$length = $this->read_number( $data, $position + 1 );

				if ( null === $length ) {
					return null;
				}

				$start = $length[1] + 2;

				if ( ':"' !== substr( $data, $length[1], 2 ) || '";' !== substr( $data, $start + $length[0], 2 ) ) {
					return null;
				}

				$text     = $this->replace_text( substr( $data, $start, $length[0] ), $depth );
				$position = $start + $length[0] + 2;

				return 's:' . strlen( $text ) . ':"' . $text . '";';

			case 'a':
				$count = $this->read_number( $data, $position + 1 );

				if ( null === $count || ':{' !== substr( $data, $count[1], 2 ) ) {
					return null;
				}

				$position = $count[1] + 2;
				$inner    = $this->walk_members( $data, $position, $count[0] * 2, $depth );

				return null === $inner ? null : 'a:' . $count[0] . ':{' . $inner . '}';

			case 'O':
				$name_length = $this->read_number( $data, $position + 1 );

				if ( null === $name_length || ':"' !== substr( $data, $name_length[1], 2 ) ) {
					return null;
				}

				$name  = substr( $data, $name_length[1] + 2, $name_length[0] );
				$after = $name_length[1] + 2 + $name_length[0];

				if ( '"' !== ( $data[ $after ] ?? '' ) ) {
					return null;
				}

				$count = $this->read_number( $data, $after + 1 );

				if ( null === $count || ':{' !== substr( $data, $count[1], 2 ) ) {
					return null;
				}

				$position = $count[1] + 2;
				$inner    = $this->walk_members( $data, $position, $count[0] * 2, $depth );

				return null === $inner ? null : 'O:' . $name_length[0] . ':"' . $name . '":' . $count[0] . ':{' . $inner . '}';

			default:
				// Custom-serialized objects (C:), enums (E:) and escaped strings (S:) have layouts
				// only their own class understands.
				return null;
		}
	}

	/**
	 * Reads the keys and values of an array or object, up to its closing brace.
	 *
	 * @param string $data     Serialized data.
	 * @param int    $position Offset; moved past the closing brace.
	 * @param int    $members  How many values to read (keys and values together).
	 * @param int    $depth    Nesting depth.
	 * @return string|null
	 */
	private function walk_members( $data, &$position, $members, $depth ) {
		$inner = '';

		for ( $i = 0; $i < $members; $i++ ) {
			// Keys (even positions) are copied as they are: renaming a key would change the data.
			if ( 0 === $i % 2 ) {
				$start = $position;
				$key   = $this->walk( $data, $position, $depth + 1 );

				if ( null === $key ) {
					return null;
				}

				$inner .= substr( $data, $start, $position - $start );
				continue;
			}

			$value = $this->walk( $data, $position, $depth + 1 );

			if ( null === $value ) {
				return null;
			}

			$inner .= $value;
		}

		if ( '}' !== ( $data[ $position ] ?? '' ) ) {
			return null;
		}

		++$position;

		return $inner;
	}

	/**
	 * Reads `:123` at an offset.
	 *
	 * @param string $data     Serialized data.
	 * @param int    $position Offset of the colon.
	 * @return array{0: int, 1: int}|null The number, and the offset just after it.
	 */
	private function read_number( $data, $position ) {
		if ( ':' !== ( $data[ $position ] ?? '' ) ) {
			return null;
		}

		$digits = strspn( $data, '0123456789', $position + 1 );

		if ( 0 === $digits || $digits > 10 ) {
			return null;
		}

		return array( (int) substr( $data, $position + 1, $digits ), $position + 1 + $digits );
	}

	/**
	 * A quick test for the shape of serialized data, before the real parse.
	 *
	 * @param string $value Value.
	 * @return bool
	 */
	private static function looks_serialized( $value ) {
		if ( strlen( $value ) < 4 ) {
			return false;
		}

		$last = substr( $value, -1 );

		return ':' === $value[1] && in_array( $value[0], array( 'a', 'O', 's' ), true ) && ( '}' === $last || ';' === $last );
	}
}
