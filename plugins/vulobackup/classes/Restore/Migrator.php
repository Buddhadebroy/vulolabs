<?php
/**
 * Migrator class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Restore;

use VuloBackup\Database\SqlGuard;

defined( 'ABSPATH' ) || exit;

/**
 * Adapts a database that came from another site to this one, while it is still in the temporary
 * tables and before anything is switched: the old site address becomes this site's, and names that
 * contain the old table prefix are changed to this site's prefix.
 *
 * Addresses are replaced value by value with SerializedReplacer, never across the dump as text. The
 * `guid` column of posts is left alone, as WordPress asks: it is an identifier, not a link.
 */
class Migrator {

	const BATCH = 200;

	/**
	 * Database connection.
	 *
	 * @var \wpdb
	 */
	private $db;

	/**
	 * Constructor.
	 *
	 * @param \wpdb|null $db Connection; the site's own by default.
	 */
	public function __construct( $db = null ) {
		global $wpdb;

		$this->db = $db ? $db : $wpdb;
	}

	/**
	 * Returns a fresh cursor.
	 *
	 * @return array A fresh cursor.
	 */
	public static function cursor() {
		return array(
			'table'   => 0,
			'last'    => null,
			'offset'  => 0,
			'changed' => 0,
			'skipped' => 0,
			'done'    => false,
		);
	}

	/**
	 * Continues replacing the old address in the loaded tables.
	 *
	 * @param array              $cursor     Cursor; updated in place.
	 * @param array[]            $tables     Each: `tmp` (table to work on) and `final` (its name once live).
	 * @param SerializedReplacer $replacer   Replacer for the old and new addresses.
	 * @param string             $needle     Text every form of the old address contains (its host
	 *                                       name), to find the rows worth reading.
	 * @param float              $deadline   Stop when microtime(true) passes this.
	 * @param callable           $checkpoint Called when the cursor is safe to save.
	 * @return bool Whether every table is done.
	 * @throws \RuntimeException When a table cannot be read or written.
	 */
	public function run( array &$cursor, array $tables, SerializedReplacer $replacer, $needle, $deadline, callable $checkpoint ) {
		$tables = array_values( $tables );
		$count  = count( $tables );
		$like   = '%' . $this->db->esc_like( $needle ) . '%';

		while ( $cursor['table'] < $count && $replacer->is_active() ) {
			$table = $tables[ $cursor['table'] ];
			$meta  = $this->describe( $table['tmp'], $table['final'] );

			while ( $meta['text'] ) {
				$rows = $this->fetch( $table['tmp'], $meta, $like, $cursor );

				if ( ! $rows ) {
					break;
				}

				$updated = 0;

				foreach ( $rows as $row ) {
					$set = array();

					foreach ( $meta['text'] as $column ) {
						$value = $row[ $column ];

						if ( ! is_string( $value ) || false === stripos( $value, $needle ) ) {
							continue;
						}

						$replaced = $replacer->replace( $value );

						if ( $replaced !== $value ) {
							$set[ $column ] = $replaced;
						}
					}

					if ( $set ) {
						$this->update( $table['tmp'], $meta, $row, $set );
						++$updated;
					}

					if ( null !== $meta['key'] ) {
						$cursor['last'] = (string) $row[ $meta['key'] ];
					}
				}

				$cursor['changed'] += $updated;
				// Without a simple key the rows are paged by position, and a changed row no longer
				// matches the search, so only the unchanged ones count towards the position.
				$cursor['offset'] += count( $rows ) - $updated;
				$cursor['skipped'] = $replacer->skipped;

				$checkpoint();

				if ( count( $rows ) < self::BATCH ) {
					break;
				}

				if ( microtime( true ) > $deadline ) {
					return false;
				}
			}

			++$cursor['table'];
			$cursor['last']   = null;
			$cursor['offset'] = 0;

			$checkpoint();

			if ( microtime( true ) > $deadline && $cursor['table'] < $count ) {
				return false;
			}
		}

		$cursor['done'] = true;

		return true;
	}

	/**
	 * Renames the options and user settings whose names contain the table prefix.
	 *
	 * WordPress names a few of them after the prefix (`wp_user_roles`, `wp_capabilities`). With a
	 * different prefix it would not find them, and every user would lose their role.
	 *
	 * @param array[] $tables     Each: `tmp` and `final`.
	 * @param string  $old_prefix The backup's table prefix.
	 * @return void
	 */
	public function fix_prefix( array $tables, $old_prefix ) {
		$new_prefix = (string) $this->db->base_prefix;

		if ( '' === $old_prefix || $old_prefix === $new_prefix ) {
			return;
		}

		foreach ( $tables as $table ) {
			$suffix = substr( $table['final'], strlen( $new_prefix ) );
			$tmp    = SqlGuard::ident( $table['tmp'] );

			// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- the table name is one this restore created; values are placeholders.
			if ( 'usermeta' === $suffix ) {
				$this->db->query(
					$this->db->prepare(
						"UPDATE IGNORE {$tmp} SET meta_key = CONCAT( %s, SUBSTRING( meta_key, %d ) ) WHERE meta_key LIKE %s",
						$new_prefix,
						strlen( $old_prefix ) + 1,
						$this->db->esc_like( $old_prefix ) . '%'
					)
				);
			} elseif ( 'options' === $suffix || preg_match( '/^[0-9]+_options$/', $suffix ) ) {
				$this->db->query(
					$this->db->prepare(
						"UPDATE IGNORE {$tmp} SET option_name = CONCAT( %s, SUBSTRING( option_name, %d ) ) WHERE option_name LIKE %s",
						$new_prefix,
						strlen( $old_prefix ) + 1,
						$this->db->esc_like( $old_prefix ) . '%' . $this->db->esc_like( 'user_roles' )
					)
				);
			}
			// phpcs:enable
		}
	}

	/**
	 * Works out which columns of a table to read and how to address its rows.
	 *
	 * @param string $tmp  Table to work on.
	 * @param string $live Its name once live.
	 * @return array{text: string[], keys: string[], key: string|null}
	 * @throws \RuntimeException When the table cannot be described.
	 */
	private function describe( $tmp, $live ) {
		$columns = $this->db->get_results( 'SHOW COLUMNS FROM ' . SqlGuard::ident( $tmp ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		if ( ! is_array( $columns ) ) {
			/* translators: %s: table name. */
			throw new \RuntimeException( sprintf( esc_html__( 'Table %s could not be read while replacing the site address.', 'vulobackup' ), esc_html( $live ) ) );
		}

		$text = array();
		$keys = array();
		$int  = false;

		foreach ( $columns as $column ) {
			if ( 'PRI' === $column['Key'] ) {
				$keys[] = $column['Field'];
				$int    = (bool) preg_match( '/^(?:tiny|small|medium|big)?int/i', (string) $column['Type'] );
			}

			if ( ! preg_match( '/^(?:char|varchar|tinytext|text|mediumtext|longtext|json)\b/i', (string) $column['Type'] ) ) {
				continue;
			}

			if ( 'guid' === $column['Field'] && preg_match( '/posts$/', $live ) ) {
				continue;
			}

			$text[] = $column['Field'];
		}

		return array(
			'text' => $text,
			'keys' => $keys,
			'key'  => 1 === count( $keys ) && $int ? $keys[0] : null,
		);
	}

	/**
	 * Reads the next batch of rows that mention the old address.
	 *
	 * @param string $tmp    Table.
	 * @param array  $meta   From describe().
	 * @param string $like   LIKE pattern.
	 * @param array  $cursor Cursor.
	 * @return array[]
	 * @throws \RuntimeException When the rows cannot be read.
	 */
	private function fetch( $tmp, array $meta, $like, array $cursor ) {
		$columns = array_unique( array_merge( $meta['keys'], $meta['text'] ) );
		$select  = implode( ', ', array_map( array( SqlGuard::class, 'ident' ), $columns ) );
		$where   = array();
		$values  = array();

		foreach ( $meta['text'] as $column ) {
			$where[]  = SqlGuard::ident( $column ) . ' LIKE %s';
			$values[] = $like;
		}

		$sql = "SELECT {$select} FROM " . SqlGuard::ident( $tmp ) . ' WHERE ( ' . implode( ' OR ', $where ) . ' )';

		if ( null !== $meta['key'] ) {
			$key = SqlGuard::ident( $meta['key'] );

			if ( null !== $cursor['last'] && preg_match( '/^-?[0-9]+$/', (string) $cursor['last'] ) ) {
				$sql .= " AND {$key} > " . $cursor['last'];
			}

			$sql .= " ORDER BY {$key} LIMIT " . self::BATCH;
		} else {
			$order = $meta['keys'] ? ' ORDER BY ' . implode( ', ', array_map( array( SqlGuard::class, 'ident' ), $meta['keys'] ) ) : '';
			$sql  .= $order . ' LIMIT ' . (int) $cursor['offset'] . ', ' . self::BATCH;
		}

		$this->db->last_error = '';

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- identifiers quoted by SqlGuard::ident(); the LIKE values are placeholders; the key value is checked to be a whole number.
		$rows = $this->db->get_results( $this->db->prepare( $sql, $values ), ARRAY_A );

		if ( ! is_array( $rows ) || '' !== (string) $this->db->last_error ) {
			throw new \RuntimeException( esc_html__( 'A table could not be read while replacing the site address. Nothing on your site was changed.', 'vulobackup' ) );
		}

		return $rows;
	}

	/**
	 * Writes changed values back to a row.
	 *
	 * @param string $tmp  Table.
	 * @param array  $meta From describe().
	 * @param array  $row  The row as read.
	 * @param array  $set  Column => new value.
	 * @return void
	 * @throws \RuntimeException When the row cannot be written.
	 */
	private function update( $tmp, array $meta, array $row, array $set ) {
		$where = array();

		// With no key at all, the row is found by the old values of the columns being changed.
		foreach ( $meta['keys'] ? $meta['keys'] : array_keys( $set ) as $column ) {
			$where[ $column ] = $row[ $column ];
		}

		if ( false === $this->db->update( $tmp, $set, $where ) ) { // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			throw new \RuntimeException( esc_html__( 'A row could not be written while replacing the site address. Nothing on your site was changed.', 'vulobackup' ) );
		}
	}
}
