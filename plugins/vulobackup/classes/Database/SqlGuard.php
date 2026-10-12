<?php
/**
 * SqlGuard class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Database;

defined( 'ABSPATH' ) || exit;

/**
 * The SQL dialect of a VuloBackup dump, and the check that a line of a dump is nothing else.
 *
 * A dump is ordinary SQL (it can be imported with phpMyAdmin or the mysql client in an emergency),
 * but VuloBackup's own restore never trusts it. Every statement is exactly one line, and a line is
 * only run when it is one of the few shapes the exporter writes:
 *
 *   -- comment
 *   SET NAMES utf8mb4;   SET FOREIGN_KEY_CHECKS = 0;   SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
 *   DROP TABLE IF EXISTS `table`;
 *   CREATE TABLE `table` ( ... );
 *   INSERT INTO `table` VALUES (...),(...);
 *
 * INSERT values may only be quoted strings, hex literals, numbers and NULL. Anything else, such as
 * a second statement smuggled into the line, a function call or a comment, is refused, so an
 * edited or forged archive cannot make the restore run SQL of its choosing.
 *
 * The scanner works on bytes. That is only sound for character sets in which a backslash or quote
 * byte never appears inside a multi-byte character, which is why Importer refuses any other.
 */
class SqlGuard {

	/**
	 * Connection character sets a dump may declare.
	 *
	 * @var string[]
	 */
	const SAFE_CHARSETS = array( 'utf8mb4', 'utf8mb3', 'utf8', 'latin1', 'ascii', 'binary' );

	/**
	 * Quotes a table or column name.
	 *
	 * @param string $name Identifier.
	 * @return string
	 */
	public static function ident( $name ) {
		return '`' . str_replace( '`', '``', (string) $name ) . '`';
	}

	/**
	 * Whether a table name can be written to, and restored from, a dump.
	 *
	 * @param string $name Table name.
	 * @return bool
	 */
	public static function is_table_name( $name ) {
		return is_string( $name ) && 1 === preg_match( '/^[A-Za-z0-9_$]{1,64}$/', $name );
	}

	/**
	 * Writes a value as an SQL literal.
	 *
	 * @param string|null $value  Value from the database.
	 * @param bool        $binary Whether the column holds binary data.
	 * @return string
	 */
	public static function literal( $value, $binary = false ) {
		if ( null === $value ) {
			return 'NULL';
		}

		$value = (string) $value;

		if ( $binary ) {
			return '' === $value ? "''" : '0x' . strtoupper( bin2hex( $value ) );
		}

		return "'" . strtr(
			$value,
			array(
				'\\'   => '\\\\',
				"\0"   => '\\0',
				"\n"   => '\\n',
				"\r"   => '\\r',
				"'"    => "\\'",
				"\x1a" => '\\Z',
			)
		) . "'";
	}

	/**
	 * Identifies one line of a dump.
	 *
	 * @param string $line Line without its line break.
	 * @return array{type: string, table: string} type is blank, comment, set, drop, create or insert.
	 * @throws \RuntimeException When the line is not a statement the exporter writes.
	 */
	public static function classify( $line ) {
		if ( '' === trim( $line ) ) {
			return self::result( 'blank' );
		}

		if ( 0 === strpos( $line, '-- ' ) || '--' === $line ) {
			return self::result( 'comment' );
		}

		if ( preg_match( '/^SET (?:NAMES [a-z0-9_]{1,32}|FOREIGN_KEY_CHECKS = [01]|SQL_MODE = \'NO_AUTO_VALUE_ON_ZERO\');$/', $line ) ) {
			return self::result( 'set' );
		}

		if ( preg_match( '/^DROP TABLE IF EXISTS `([A-Za-z0-9_$]{1,64})`;$/', $line, $match ) ) {
			return self::result( 'drop', $match[1] );
		}

		if ( preg_match( '/^INSERT INTO `([A-Za-z0-9_$]{1,64})` VALUES /', $line, $match ) ) {
			self::scan_tuples( $line, strlen( $match[0] ) );

			return self::result( 'insert', $match[1] );
		}

		if ( preg_match( '/^CREATE TABLE `([A-Za-z0-9_$]{1,64})` \(/', $line, $match ) ) {
			self::scan_definition( $line, strlen( $match[0] ) );

			return self::result( 'create', $match[1] );
		}

		throw new \RuntimeException( 'unexpected statement' );
	}

	/**
	 * @param string $type  Line type.
	 * @param string $table Table the statement is about.
	 * @return array{type: string, table: string}
	 */
	private static function result( $type, $table = '' ) {
		return array(
			'type'  => $type,
			'table' => $table,
		);
	}

	/**
	 * Checks the value lists of an INSERT: `(v,v,...),(v,v,...);` to the end of the line.
	 *
	 * @param string $sql Line.
	 * @param int    $pos Offset of the first `(`.
	 * @return void
	 * @throws \RuntimeException On anything that is not a plain literal.
	 */
	private static function scan_tuples( $sql, $pos ) {
		$length = strlen( $sql );

		while ( true ) {
			if ( $pos >= $length || '(' !== $sql[ $pos ] ) {
				throw new \RuntimeException( 'malformed INSERT' );
			}

			++$pos;

			while ( true ) {
				$char = $pos < $length ? $sql[ $pos ] : '';

				if ( "'" === $char ) {
					$pos = self::skip_quoted( $sql, $pos, $length );
				} elseif ( 'N' === $char && 0 === substr_compare( $sql, 'NULL', $pos, 4 ) ) {
					$pos += 4;
				} elseif ( '0' === $char && $pos + 1 < $length && 'x' === $sql[ $pos + 1 ] ) {
					$pos += 2;
					$pos += strspn( $sql, '0123456789ABCDEFabcdef', $pos );
				} else {
					$digits = strspn( $sql, '0123456789.-+eE', $pos );

					if ( 0 === $digits ) {
						throw new \RuntimeException( 'unexpected value in INSERT' );
					}

					$pos += $digits;
				}

				$char = $pos < $length ? $sql[ $pos ] : '';
				++$pos;

				if ( ',' === $char ) {
					continue;
				}

				if ( ')' === $char ) {
					break;
				}

				throw new \RuntimeException( 'malformed INSERT' );
			}

			$char = $pos < $length ? $sql[ $pos ] : '';

			if ( ',' === $char ) {
				++$pos;
				continue;
			}

			if ( ';' === $char && $pos === $length - 1 ) {
				return;
			}

			throw new \RuntimeException( 'malformed INSERT' );
		}
	}

	/**
	 * Checks a CREATE TABLE: outside quoted text there may be no statement separator before the
	 * final one, and no comment.
	 *
	 * @param string $sql Line.
	 * @param int    $pos Offset just after the opening `(`.
	 * @return void
	 * @throws \RuntimeException When the line could hold more than the one statement.
	 */
	private static function scan_definition( $sql, $pos ) {
		$length = strlen( $sql );

		while ( $pos < $length ) {
			$pos += strcspn( $sql, "'`\";#-/", $pos );

			if ( $pos >= $length ) {
				break;
			}

			$char = $sql[ $pos ];

			if ( "'" === $char || '"' === $char || '`' === $char ) {
				$pos = self::skip_quoted( $sql, $pos, $length );
				continue;
			}

			if ( ';' === $char ) {
				if ( $pos === $length - 1 ) {
					return;
				}

				throw new \RuntimeException( 'more than one statement in CREATE TABLE' );
			}

			$next = $pos + 1 < $length ? $sql[ $pos + 1 ] : '';

			if ( '#' === $char || ( '-' === $char && '-' === $next ) || ( '/' === $char && '*' === $next ) ) {
				throw new \RuntimeException( 'comment in CREATE TABLE' );
			}

			++$pos;
		}

		throw new \RuntimeException( 'unterminated CREATE TABLE' );
	}

	/**
	 * Moves past a quoted string or identifier, honouring backslash escapes and doubled quotes.
	 *
	 * @param string $sql    Line.
	 * @param int    $pos    Offset of the opening quote.
	 * @param int    $length Length of the line.
	 * @return int Offset just after the closing quote.
	 * @throws \RuntimeException When the quote is never closed.
	 */
	private static function skip_quoted( $sql, $pos, $length ) {
		$quote = $sql[ $pos ];
		$stops = '`' === $quote ? '`' : $quote . '\\';

		++$pos;

		while ( true ) {
			$pos += strcspn( $sql, $stops, $pos );

			if ( $pos >= $length ) {
				throw new \RuntimeException( 'unterminated quote' );
			}

			if ( '\\' === $sql[ $pos ] ) {
				$pos += 2;
				continue;
			}

			if ( $pos + 1 < $length && $sql[ $pos + 1 ] === $quote ) {
				$pos += 2;
				continue;
			}

			return $pos + 1;
		}
	}
}
