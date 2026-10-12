<?php
/**
 * Database Exporter class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Database;

defined( 'ABSPATH' ) || exit;

/**
 * Writes the site's database to a gzip-compressed SQL dump, a batch of rows at a time.
 *
 * It never holds more than one batch in memory, and it can stop at any batch and carry on in a
 * later request: the cursor records the table, the position in it and how many bytes of the file
 * are known to be good. A request that dies mid-write leaves extra bytes at the end of the file,
 * which the next request cuts off before continuing.
 *
 * Any error from the database stops the export with the table's name. A dump is never finished
 * with a table missing.
 */
class Exporter {

	/**
	 * Aim for batches of about this many bytes of row data.
	 */
	const BATCH_BYTES = 4194304;

	/**
	 * Longest INSERT statement written, before starting another.
	 */
	const STATEMENT_BYTES = 524288;

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
	 * Finds the tables to export.
	 *
	 * @param string $scope `prefix` for this WordPress's tables, `all` for every table in the database.
	 * @return array{tables: string[], skipped: string[]} skipped lists views and tables whose names
	 *                                                    cannot be written to a dump.
	 * @throws \RuntimeException When the table list cannot be read.
	 */
	public function tables( $scope ) {
		$prefix = (string) $this->db->base_prefix;
		$rows   = $this->db->get_results( 'SHOW FULL TABLES', ARRAY_N ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		if ( ! is_array( $rows ) || '' !== (string) $this->db->last_error ) {
			throw new \RuntimeException( esc_html__( 'The list of database tables could not be read.', 'vulobackup' ) );
		}

		$tables  = array();
		$skipped = array();

		foreach ( $rows as $row ) {
			$name = (string) $row[0];

			if ( 'all' !== $scope && ( '' === $prefix || 0 !== strpos( $name, $prefix ) ) ) {
				continue;
			}

			if ( 'BASE TABLE' !== strtoupper( (string) ( $row[1] ?? 'BASE TABLE' ) ) || ! SqlGuard::is_table_name( $name ) ) {
				$skipped[] = $name;
				continue;
			}

			$tables[] = $name;
		}

		sort( $tables );

		return array(
			'tables'  => $tables,
			'skipped' => $skipped,
		);
	}

	/**
	 * A fresh cursor for a dump of the given tables.
	 *
	 * @param string[] $tables Table names.
	 * @return array
	 */
	public static function cursor( array $tables ) {
		return array(
			'tables'  => array_values( $tables ),
			'index'   => 0,
			'opened'  => false,
			'last'    => null,
			'offset'  => 0,
			'rows'    => 0,
			'bytes'   => 0,
			'raw'     => 0,
			'started' => false,
			'done'    => false,
		);
	}

	/**
	 * Continues the dump until it is finished or the deadline passes.
	 *
	 * @param array    $cursor     Cursor from cursor(); updated in place.
	 * @param string   $file       The `.sql.gz` file to write.
	 * @param float    $deadline   Stop when microtime(true) passes this.
	 * @param callable $checkpoint Called after every batch, once the cursor is safe to save.
	 * @return bool Whether the dump is complete.
	 * @throws \RuntimeException When a table cannot be exported or the file cannot be written.
	 */
	public function run( array &$cursor, $file, $deadline, callable $checkpoint ) {
		if ( ! empty( $cursor['done'] ) ) {
			return true;
		}

		$this->truncate( $file, (int) $cursor['bytes'] );

		if ( empty( $cursor['started'] ) ) {
			$this->write( $file, $this->header(), $cursor );
			$cursor['started'] = true;
			$checkpoint();
		}

		$count = count( $cursor['tables'] );

		while ( $cursor['index'] < $count ) {
			$table = $cursor['tables'][ $cursor['index'] ];
			$meta  = $this->describe( $table );

			if ( empty( $cursor['opened'] ) ) {
				$this->write( $file, "\n-- Table: " . $table . "\nDROP TABLE IF EXISTS " . SqlGuard::ident( $table ) . ";\n" . $meta['create'] . ";\n", $cursor );
				$cursor['opened'] = true;
				$cursor['last']   = null;
				$cursor['offset'] = 0;
				$checkpoint();
			}

			while ( true ) {
				$rows = $this->fetch( $table, $meta, $cursor );

				if ( $rows ) {
					$this->write( $file, $this->inserts( $table, $meta, $rows ), $cursor );

					$cursor['rows']   += count( $rows );
					$cursor['offset'] += count( $rows );

					if ( null !== $meta['key'] ) {
						$last           = end( $rows );
						$cursor['last'] = (string) $last[ $meta['key_index'] ];
					}

					$checkpoint();
				}

				if ( count( $rows ) < $meta['batch'] ) {
					break;
				}

				if ( microtime( true ) > $deadline ) {
					return false;
				}
			}

			++$cursor['index'];
			$cursor['opened'] = false;
			$checkpoint();

			if ( microtime( true ) > $deadline && $cursor['index'] < $count ) {
				return false;
			}
		}

		$this->write( $file, "\nSET FOREIGN_KEY_CHECKS = 1;\n-- vulobackup-complete: tables=" . $count . ' rows=' . (int) $cursor['rows'] . "\n", $cursor );
		$cursor['done'] = true;
		$checkpoint();

		return true;
	}

	/**
	 * The first lines of a dump: what it is, and the session settings an importer needs.
	 *
	 * @return string
	 */
	private function header() {
		$charset = (string) $this->db->charset;
		$charset = preg_match( '/^[a-z0-9_]{1,32}$/', $charset ) ? $charset : 'utf8mb4';

		return "-- VuloBackup SQL dump\n"
			. '-- vulobackup-format: ' . VULOBACKUP_FORMAT_VERSION . "\n"
			. '-- vulobackup-prefix: ' . preg_replace( '/[^A-Za-z0-9_$]/', '', (string) $this->db->base_prefix ) . "\n"
			. '-- vulobackup-charset: ' . $charset . "\n"
			. '-- vulobackup-created: ' . gmdate( 'Y-m-d H:i:s' ) . " UTC\n"
			. 'SET NAMES ' . $charset . ";\n"
			. "SET FOREIGN_KEY_CHECKS = 0;\n"
			. "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n";
	}

	/**
	 * Reads what the export needs to know about a table.
	 *
	 * @param string $table Table name.
	 * @return array{create: string, binary: bool[], key: string|null, key_index: int, order: string, batch: int}
	 * @throws \RuntimeException When the table cannot be described.
	 */
	private function describe( $table ) {
		$ident  = SqlGuard::ident( $table );
		$create = $this->db->get_row( "SHOW CREATE TABLE {$ident}", ARRAY_N ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- identifier quoted by SqlGuard::ident(); table names cannot be placeholders.

		if ( ! is_array( $create ) || empty( $create[1] ) || 0 !== strpos( (string) $create[1], 'CREATE TABLE' ) ) {
			throw new \RuntimeException(
				sprintf(
					/* translators: 1: table name, 2: database error. */
					esc_html__( 'The structure of table %1$s could not be read. %2$s', 'vulobackup' ),
					esc_html( $table ),
					esc_html( (string) $this->db->last_error )
				)
			);
		}

		$columns = $this->db->get_results( "SHOW COLUMNS FROM {$ident}", ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- see above.

		if ( ! is_array( $columns ) || ! $columns ) {
			throw new \RuntimeException(
				sprintf(
					/* translators: %s: table name. */
					esc_html__( 'The columns of table %s could not be read.', 'vulobackup' ),
					esc_html( $table )
				)
			);
		}

		$binary  = array();
		$primary = array();

		foreach ( $columns as $index => $column ) {
			$binary[] = 1 === preg_match( '/^(?:(?:tiny|medium|long)?blob|(?:var)?binary|bit|geometry|point|linestring|polygon|multipoint|multilinestring|multipolygon|geometrycollection)\b/i', (string) $column['Type'] );

			if ( 'PRI' === $column['Key'] ) {
				$primary[] = array( $column['Field'], $index, (string) $column['Type'] );
			}
		}

		// Walking a single whole-number key is stable while the table changes and never slows down.
		$keyed = 1 === count( $primary ) && preg_match( '/^(?:tiny|small|medium|big)?int/i', $primary[0][2] );
		$order = $primary ? ' ORDER BY ' . implode( ', ', array_map( array( SqlGuard::class, 'ident' ), array_column( $primary, 0 ) ) ) : '';

		$status = $this->db->get_row( $this->db->prepare( 'SHOW TABLE STATUS LIKE %s', $this->db->esc_like( $table ) ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$width  = is_array( $status ) ? (int) ( $status['Avg_row_length'] ?? 0 ) : 0;

		return array(
			// One statement per line: line breaks in SHOW CREATE TABLE are only layout.
			'create'    => rtrim( preg_replace( '/\s*[\r\n]+\s*/', ' ', (string) $create[1] ), '; ' ),
			'binary'    => $binary,
			'key'       => $keyed ? $primary[0][0] : null,
			'key_index' => $keyed ? $primary[0][1] : 0,
			'order'     => $order,
			'batch'     => max( 25, min( 5000, (int) floor( self::BATCH_BYTES / max( 200, $width ) ) ) ),
		);
	}

	/**
	 * Reads the next batch of rows.
	 *
	 * @param string $table  Table name.
	 * @param array  $meta   From describe().
	 * @param array  $cursor Cursor.
	 * @return array[] Rows as lists of strings and nulls.
	 * @throws \RuntimeException When the rows cannot be read.
	 */
	private function fetch( $table, array $meta, array $cursor ) {
		$ident = SqlGuard::ident( $table );
		$limit = (int) $meta['batch'];

		if ( null !== $meta['key'] ) {
			$key   = SqlGuard::ident( $meta['key'] );
			$after = null !== $cursor['last'] && preg_match( '/^-?[0-9]+$/', (string) $cursor['last'] ) ? " WHERE {$key} > " . $cursor['last'] : '';
			$sql   = "SELECT * FROM {$ident}{$after} ORDER BY {$key} LIMIT {$limit}";
		} else {
			$sql = "SELECT * FROM {$ident}{$meta['order']} LIMIT " . (int) $cursor['offset'] . ", {$limit}";
		}

		$this->db->last_error = '';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- identifiers quoted by SqlGuard::ident(), the key value is checked to be a whole number, the rest are integers.
		$rows = $this->db->get_results( $sql, ARRAY_N );

		if ( '' !== (string) $this->db->last_error || ! is_array( $rows ) ) {
			throw new \RuntimeException(
				sprintf(
					/* translators: 1: table name, 2: database error. */
					esc_html__( 'Table %1$s could not be read. %2$s', 'vulobackup' ),
					esc_html( $table ),
					esc_html( (string) $this->db->last_error )
				)
			);
		}

		$this->db->flush();

		return $rows;
	}

	/**
	 * Turns rows into INSERT statements, one per line.
	 *
	 * @param string  $table Table name.
	 * @param array   $meta  From describe().
	 * @param array[] $rows  Rows.
	 * @return string
	 */
	private function inserts( $table, array $meta, array $rows ) {
		$start = 'INSERT INTO ' . SqlGuard::ident( $table ) . ' VALUES ';
		$sql   = '';
		$line  = '';

		foreach ( $rows as $row ) {
			$values = array();

			foreach ( $row as $index => $value ) {
				$values[] = SqlGuard::literal( $value, ! empty( $meta['binary'][ $index ] ) );
			}

			$tuple = '(' . implode( ',', $values ) . ')';

			if ( '' !== $line && strlen( $line ) + strlen( $tuple ) > self::STATEMENT_BYTES ) {
				$sql .= $line . ";\n";
				$line = '';
			}

			$line .= ( '' === $line ? $start : ',' ) . $tuple;
		}

		return '' === $line ? $sql : $sql . $line . ";\n";
	}

	/**
	 * Appends text to the dump as one more gzip member and records the new known-good size.
	 *
	 * @param string $file   Dump file.
	 * @param string $text   SQL text.
	 * @param array  $cursor Cursor; `bytes` and `raw` are updated.
	 * @return void
	 * @throws \RuntimeException When the file cannot be written.
	 */
	private function write( $file, $text, array &$cursor ) {
		$handle = gzopen( $file, 'ab6' );

		if ( ! $handle || strlen( $text ) !== gzwrite( $handle, $text ) || ! gzclose( $handle ) ) {
			throw new \RuntimeException( esc_html__( 'The database dump could not be written. The disk may be full.', 'vulobackup' ) );
		}

		clearstatcache( true, $file );

		$cursor['bytes'] = (int) filesize( $file );
		$cursor['raw']   = (int) ( $cursor['raw'] ?? 0 ) + strlen( $text );
	}

	/**
	 * Cuts the file back to its last known-good size.
	 *
	 * @param string $file  Dump file.
	 * @param int    $bytes Known-good size.
	 * @return void
	 * @throws \RuntimeException When the file is shorter than it should be.
	 */
	private function truncate( $file, $bytes ) {
		clearstatcache( true, $file );

		$size = file_exists( $file ) ? (int) filesize( $file ) : 0;

		if ( $size < $bytes ) {
			throw new \RuntimeException( esc_html__( 'The database dump is shorter than expected; part of it was lost.', 'vulobackup' ) );
		}

		if ( $size > $bytes ) {
			$handle = fopen( $file, 'r+b' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen

			if ( ! $handle || ! ftruncate( $handle, $bytes ) ) {
				throw new \RuntimeException( esc_html__( 'The database dump could not be written.', 'vulobackup' ) );
			}

			fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		}
	}
}
