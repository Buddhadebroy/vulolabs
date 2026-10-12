<?php
/**
 * Database Importer class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Database;

defined( 'ABSPATH' ) || exit;

/**
 * Loads a dump into temporary tables, then swaps them into place in one step.
 *
 * Nothing the site is using is touched while the dump loads. Each table of the dump is created
 * under a temporary name and filled; only when the whole dump has loaded, and its own closing line
 * confirms the table and row counts, are the tables switched with a single RENAME TABLE statement,
 * which the database applies to all of them at once or not at all. Until that statement runs, a
 * failed or cancelled restore is undone by dropping the temporary tables.
 *
 * The swap is not a transaction in the usual sense (CREATE and RENAME cannot be rolled back), and
 * this class does not pretend otherwise: after the swap, going back means restoring the safety
 * backup.
 *
 * Every line of the dump is checked by SqlGuard before it is run. See that class for what is
 * accepted.
 */
class Importer {

	/**
	 * Database connection.
	 *
	 * @var \wpdb
	 */
	private $db;

	/**
	 * Whether the next INSERT may repeat one that ran just before an earlier request was cut off.
	 *
	 * @var bool
	 */
	private $resumed = false;

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
	 * @param string $token Short random string unique to this restore, used in temporary table names.
	 * @return array A fresh cursor.
	 */
	public static function cursor( $token ) {
		return array(
			'token'      => preg_replace( '/[^a-z0-9]/', '', strtolower( (string) $token ) ),
			'offset'     => 0,
			'prefix'     => null,
			'charset'    => null,
			'tables'     => array(),
			'foreign'    => array(),
			'rows'       => 0,
			'adjusted'   => array(),
			'done'       => false,
			'swapped'    => false,
			'old_tables' => array(),
		);
	}

	/**
	 * Continues loading the dump into temporary tables.
	 *
	 * @param array    $cursor     Cursor; updated in place.
	 * @param string   $file       The `.sql.gz` dump.
	 * @param float    $deadline   Stop when microtime(true) passes this.
	 * @param callable $checkpoint Called when the cursor is safe to save.
	 * @return bool Whether the whole dump has been loaded.
	 * @throws \RuntimeException When the dump is not acceptable or the database refuses a statement.
	 */
	public function run( array &$cursor, $file, $deadline, callable $checkpoint ) {
		if ( ! empty( $cursor['done'] ) ) {
			return true;
		}

		$handle = gzopen( $file, 'rb' );

		if ( ! $handle || ( $cursor['offset'] > 0 && -1 === gzseek( $handle, (int) $cursor['offset'] ) ) ) {
			throw new \RuntimeException( esc_html__( 'The database dump could not be read.', 'vulobackup' ) );
		}

		// A request that was stopped between running a statement and recording it will run that
		// statement again. The first INSERT after resuming therefore skips rows that are already there.
		$this->resumed = $cursor['offset'] > 0;

		try {
			$this->begin_session( $cursor );

			while ( true ) {
				$line = $this->read_line( $handle );

				if ( null === $line ) {
					break;
				}

				$this->apply( $line, $cursor );

				$cursor['offset'] = gztell( $handle );

				if ( ! empty( $cursor['done'] ) ) {
					break;
				}

				$checkpoint();

				if ( microtime( true ) > $deadline ) {
					return false;
				}
			}
		} finally {
			gzclose( $handle );
			$this->end_session();
		}

		if ( empty( $cursor['done'] ) ) {
			throw new \RuntimeException( esc_html__( 'The database dump ends before its closing line, so it is incomplete. Nothing on your site was changed.', 'vulobackup' ) );
		}

		$checkpoint();

		return true;
	}

	/**
	 * Replaces the live tables with the loaded ones, all at once.
	 *
	 * @param array    $cursor   Cursor of a finished run().
	 * @param string[] $preserve SQL statements run against the temporary tables just before the
	 *                           swap; `{options}`, `{usermeta}` and `{users}` stand for the
	 *                           temporary tables of those names, when the dump has them.
	 * @return void
	 * @throws \RuntimeException When the database refuses the swap; the live tables are then untouched.
	 */
	public function swap( array &$cursor, array $preserve = array() ) {
		if ( empty( $cursor['done'] ) || ! $cursor['tables'] ) {
			throw new \RuntimeException( esc_html__( 'The database was not fully loaded, so it was not switched.', 'vulobackup' ) );
		}

		$renames = array();
		$old     = array();
		$index   = 0;

		foreach ( $cursor['tables'] as $table ) {
			if ( $this->exists( $table['final'] ) ) {
				$retired   = 'vbo' . $cursor['token'] . '_' . ( ++$index );
				$old[]     = $retired;
				$renames[] = SqlGuard::ident( $table['final'] ) . ' TO ' . SqlGuard::ident( $retired );
			}

			$renames[] = SqlGuard::ident( $table['tmp'] ) . ' TO ' . SqlGuard::ident( $table['final'] );
		}

		foreach ( $preserve as $statement ) {
			$this->query( $statement, __( 'The restored database could not be prepared for this site.', 'vulobackup' ) );
		}

		$cursor['old_tables'] = $old;

		$this->query( 'SET FOREIGN_KEY_CHECKS = 0', '' );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- identifiers quoted by SqlGuard::ident(); every name was validated when the dump was read.
		$this->query( 'RENAME TABLE ' . implode( ', ', $renames ), __( 'The database refused to switch to the restored tables. Your site\'s database was not changed.', 'vulobackup' ) );

		$cursor['swapped'] = true;

		$this->db->query( 'SET FOREIGN_KEY_CHECKS = 1' ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}

	/**
	 * Adds back the foreign keys that were held back while loading. Their names must be unique in
	 * a database, so this can only happen once the replaced tables, which carry the same names,
	 * have been dropped.
	 *
	 * @param array $cursor Cursor of a finished swap().
	 * @return void
	 */
	public function add_foreign_keys( array &$cursor ) {
		$this->db->suppress_errors( true );

		foreach ( $cursor['foreign'] as $foreign ) {
			$added = $this->db->query( 'ALTER TABLE ' . SqlGuard::ident( $foreign['table'] ) . ' ADD ' . $foreign['sql'] ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- the clause was extracted from a CREATE TABLE that SqlGuard accepted.

			if ( false === $added ) {
				$cursor['adjusted'][] = sprintf(
					/* translators: %s: table name. */
					__( 'A foreign key of table %s could not be restored. The data is complete; only the constraint is missing.', 'vulobackup' ),
					$foreign['table']
				);
			}
		}

		$this->db->suppress_errors( false );

		$cursor['foreign'] = array();
	}

	/**
	 * Drops the tables this restore created and no longer needs: the temporary ones before a swap,
	 * the replaced ones after it.
	 *
	 * @param array $cursor Cursor.
	 * @return void
	 */
	public function drop_leftovers( array &$cursor ) {
		$names = empty( $cursor['swapped'] ) ? array_column( $cursor['tables'], 'tmp' ) : (array) $cursor['old_tables'];

		if ( ! $names ) {
			return;
		}

		$this->db->query( 'SET FOREIGN_KEY_CHECKS = 0' ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		foreach ( $names as $name ) {
			// Only ever a name this class made up.
			if ( preg_match( '/^vb[to][a-z0-9]{4,16}_[0-9]+$/', $name ) ) {
				$this->db->query( 'DROP TABLE IF EXISTS ' . SqlGuard::ident( $name ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
			}
		}

		$this->db->query( 'SET FOREIGN_KEY_CHECKS = 1' ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		// Either way nothing of this restore is left in the database now.
		$cursor['tables']     = array();
		$cursor['old_tables'] = array();
	}

	/**
	 * Checks that the database user may do what a restore needs, using a throwaway table.
	 *
	 * @param string $token Restore token.
	 * @return string|null What is missing, or null when all is well.
	 */
	public function privilege_problem( $token ) {
		$first  = SqlGuard::ident( 'vbt' . $token . '_0' );
		$second = SqlGuard::ident( 'vbo' . $token . '_0' );

		$this->db->suppress_errors( true );

		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- fixed statements on a throwaway table whose name this class builds.
		$this->db->query( "DROP TABLE IF EXISTS {$first}, {$second}" );

		$created = false !== $this->db->query( "CREATE TABLE {$first} (id int NOT NULL)" );
		$renamed = $created && false !== $this->db->query( "RENAME TABLE {$first} TO {$second}" );
		$dropped = false !== $this->db->query( "DROP TABLE IF EXISTS {$first}, {$second}" );
		// phpcs:enable

		$this->db->suppress_errors( false );

		if ( $created && $renamed && $dropped ) {
			return null;
		}

		return __( 'The database user of this site may not create, rename or drop tables, which a restore needs. Ask your host to grant those permissions.', 'vulobackup' );
	}

	/**
	 * Handles one line of the dump.
	 *
	 * @param string $line   Line without its line break.
	 * @param array  $cursor Cursor.
	 * @return void
	 * @throws \RuntimeException When the line is refused.
	 */
	private function apply( $line, array &$cursor ) {
		try {
			$kind = SqlGuard::classify( $line );
		} catch ( \RuntimeException $error ) {
			throw new \RuntimeException( esc_html__( 'The database dump contains something a VuloBackup dump never does, so it was refused. Nothing on your site was changed.', 'vulobackup' ) );
		}

		switch ( $kind['type'] ) {
			case 'comment':
				$this->read_comment( $line, $cursor );
				break;

			case 'create':
				$this->create( $line, $kind['table'], $cursor );
				break;

			case 'insert':
				if ( ! isset( $cursor['tables'][ $kind['table'] ] ) ) {
					throw new \RuntimeException( esc_html__( 'The database dump has rows for a table it never defined, so it was refused. Nothing on your site was changed.', 'vulobackup' ) );
				}

				$tmp  = $cursor['tables'][ $kind['table'] ]['tmp'];
				$head = 'INSERT INTO ' . SqlGuard::ident( $kind['table'] ) . ' VALUES ';

				$this->query(
					( $this->resumed ? 'INSERT IGNORE INTO ' : 'INSERT INTO ' ) . SqlGuard::ident( $tmp ) . ' VALUES ' . substr( $line, strlen( $head ), -1 ),
					/* translators: %s: table name. */
					sprintf( __( 'Rows of table %s could not be loaded. Nothing on your site was changed.', 'vulobackup' ), $kind['table'] )
				);

				$this->resumed = false;
				break;

			default:
				// Blank lines, SET lines (this class sets the session itself) and DROP lines (the
				// live tables are replaced by renaming, never dropped up front).
				break;
		}
	}

	/**
	 * Reads the dump's header and closing comments.
	 *
	 * @param string $line   Comment line.
	 * @param array  $cursor Cursor.
	 * @return void
	 * @throws \RuntimeException When the dump cannot be used here.
	 */
	private function read_comment( $line, array &$cursor ) {
		if ( preg_match( '/^-- vulobackup-format: ([0-9]+)$/', $line, $match ) && (int) $match[1] > VULOBACKUP_FORMAT_VERSION ) {
			throw new \RuntimeException( esc_html__( 'This backup was made by a newer version of VuloBackup. Update VuloBackup on this site, then try again.', 'vulobackup' ) );
		}

		if ( preg_match( '/^-- vulobackup-prefix: ([A-Za-z0-9_$]*)$/', $line, $match ) && ! $cursor['tables'] ) {
			$cursor['prefix'] = $match[1];
		}

		if ( preg_match( '/^-- vulobackup-charset: ([a-z0-9_]+)$/', $line, $match ) && ! $cursor['tables'] ) {
			if ( ! in_array( $match[1], SqlGuard::SAFE_CHARSETS, true ) ) {
				throw new \RuntimeException(
					sprintf(
						/* translators: %s: character set name. */
						esc_html__( 'This backup\'s database uses the character set %s, which VuloBackup cannot restore safely. Import database.sql.gz with your host\'s database tool instead.', 'vulobackup' ),
						esc_html( $match[1] )
					)
				);
			}

			$cursor['charset'] = $match[1];

			$this->begin_session( $cursor );
		}

		if ( preg_match( '/^-- vulobackup-complete: tables=([0-9]+) rows=([0-9]+)$/', $line, $match ) ) {
			// Counted in the database itself, not tallied along the way, so it is what was really loaded.
			$cursor['rows'] = 0;

			foreach ( $cursor['tables'] as $source => $table ) {
				$rows = (int) $this->db->get_var( 'SELECT COUNT(*) FROM ' . SqlGuard::ident( $table['tmp'] ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- a name built by this class.

				$cursor['tables'][ $source ]['rows'] = $rows;
				$cursor['rows']                     += $rows;
			}

			if ( count( $cursor['tables'] ) !== (int) $match[1] || (int) $cursor['rows'] !== (int) $match[2] ) {
				throw new \RuntimeException( esc_html__( 'The database dump does not hold the tables and rows its own closing line says it should. It is damaged. Nothing on your site was changed.', 'vulobackup' ) );
			}

			$cursor['done'] = true;
		}
	}

	/**
	 * Creates the temporary table for a table of the dump.
	 *
	 * @param string $line   CREATE TABLE line.
	 * @param string $source Table name in the dump.
	 * @param array  $cursor Cursor.
	 * @return void
	 * @throws \RuntimeException When the table cannot be created.
	 */
	private function create( $line, $source, array &$cursor ) {
		if ( null === $cursor['prefix'] || null === $cursor['charset'] ) {
			throw new \RuntimeException( esc_html__( 'The database dump has no VuloBackup header, so it was refused. Nothing on your site was changed.', 'vulobackup' ) );
		}

		if ( isset( $cursor['tables'][ $source ] ) ) {
			throw new \RuntimeException( esc_html__( 'The database dump defines the same table twice, so it was refused. Nothing on your site was changed.', 'vulobackup' ) );
		}

		$final = $this->final_name( $source, $cursor['prefix'] );
		$tmp   = 'vbt' . $cursor['token'] . '_' . ( count( $cursor['tables'] ) + 1 );
		$head  = 'CREATE TABLE ' . SqlGuard::ident( $source ) . ' (';
		$body  = substr( $line, strlen( $head ), -1 );

		// Constraint names are unique across a database, so a copy of a table cannot carry the same
		// ones while the original exists. They are added back after the swap.
		$body = preg_replace_callback(
			'/,\s*(CONSTRAINT `[A-Za-z0-9_$]{1,64}` FOREIGN KEY \([^()]*\) REFERENCES `([A-Za-z0-9_$]{1,64})` \([^()]*\)(?: ON (?:DELETE|UPDATE) (?:RESTRICT|CASCADE|SET NULL|NO ACTION|SET DEFAULT))*)/',
			function ( $found ) use ( &$cursor, $final ) {
				$cursor['foreign'][] = array(
					'table' => $final,
					'sql'   => str_replace(
						'REFERENCES ' . SqlGuard::ident( $found[2] ),
						'REFERENCES ' . SqlGuard::ident( $this->final_name( $found[2], $cursor['prefix'] ) ),
						$found[1]
					),
				);

				return '';
			},
			$body
		);

		$sql = 'CREATE TABLE ' . SqlGuard::ident( $tmp ) . ' (' . $body;

		$this->db->query( 'DROP TABLE IF EXISTS ' . SqlGuard::ident( $tmp ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- a name built by this class.

		$this->db->suppress_errors( true );

		$created = $this->db->query( $sql ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- accepted by SqlGuard::classify().

		// A dump from MySQL 8 or a recent MariaDB can name a collation the other does not have.
		if ( false === $created && preg_match( '/collation|COLLATE/i', (string) $this->db->last_error ) ) {
			$portable = preg_replace( '/utf8mb4_(?:0900_[a-z0-9_]+|uca1400_[a-z0-9_]+)/', 'utf8mb4_unicode_520_ci', $sql );
			$created  = $this->db->query( $portable ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange

			if ( false !== $created ) {
				$cursor['adjusted'][] = sprintf(
					/* translators: %s: table name. */
					__( 'Table %s used a text sorting rule this database server does not have; a standard one was used instead.', 'vulobackup' ),
					$final
				);
			}
		}

		$error = (string) $this->db->last_error;

		$this->db->suppress_errors( false );

		if ( false === $created ) {
			throw new \RuntimeException(
				sprintf(
					/* translators: 1: table name, 2: database error. */
					esc_html__( 'Table %1$s could not be created. Nothing on your site was changed. %2$s', 'vulobackup' ),
					esc_html( $final ),
					esc_html( $error )
				)
			);
		}

		$cursor['tables'][ $source ] = array(
			'tmp'   => $tmp,
			'final' => $final,
			'rows'  => 0,
		);
	}

	/**
	 * The name a table of the dump gets on this site: the dump's table prefix becomes this site's.
	 *
	 * @param string $source Table name in the dump.
	 * @param string $prefix The dump's table prefix.
	 * @return string
	 * @throws \RuntimeException When the name would be too long.
	 */
	private function final_name( $source, $prefix ) {
		$name = '' !== $prefix && 0 === strpos( $source, $prefix ) ? $this->db->base_prefix . substr( $source, strlen( $prefix ) ) : $source;

		if ( ! SqlGuard::is_table_name( $name ) ) {
			throw new \RuntimeException(
				sprintf(
					/* translators: %s: table name. */
					esc_html__( 'Table %s would have a name that is too long with this site\'s table prefix. Nothing on your site was changed.', 'vulobackup' ),
					esc_html( $source )
				)
			);
		}

		return $name;
	}

	/**
	 * Reads one line of any length.
	 *
	 * @param resource $handle Open dump.
	 * @return string|null The line without its line break, or null at the end.
	 */
	private function read_line( $handle ) {
		$line = '';

		while ( ! gzeof( $handle ) ) {
			$piece = gzgets( $handle, 1048576 );

			if ( false === $piece ) {
				break;
			}

			$line .= $piece;

			if ( "\n" === substr( $piece, -1 ) ) {
				return substr( $line, 0, -1 );
			}
		}

		return '' === $line ? null : $line;
	}

	/**
	 * Puts the connection into the state the dump was written for.
	 *
	 * @param array $cursor Cursor.
	 * @return void
	 */
	private function begin_session( array $cursor ) {
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- fixed session statements; the charset is one of SqlGuard::SAFE_CHARSETS.
		if ( null !== $cursor['charset'] && in_array( $cursor['charset'], SqlGuard::SAFE_CHARSETS, true ) ) {
			$this->db->query( 'SET NAMES ' . $cursor['charset'] );
		}

		// Clears NO_BACKSLASH_ESCAPES and strict modes: the dump uses backslash escapes and holds
		// whatever dates and values the source database held.
		$this->db->query( "SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO'" );
		$this->db->query( 'SET FOREIGN_KEY_CHECKS = 0' );
		// phpcs:enable
	}

	/**
	 * Puts the connection back the way WordPress keeps it.
	 *
	 * @return void
	 */
	private function end_session() {
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$this->db->query( 'SET FOREIGN_KEY_CHECKS = 1' );

		if ( preg_match( '/^[a-z0-9_]{1,32}$/', (string) $this->db->charset ) ) {
			$this->db->query( 'SET NAMES ' . $this->db->charset );
		}
		// phpcs:enable

		if ( method_exists( $this->db, 'set_sql_mode' ) ) {
			$this->db->set_sql_mode();
		}
	}

	/**
	 * Runs a statement and turns a database error into an exception.
	 *
	 * @param string $sql     Statement.
	 * @param string $message What to say when it fails.
	 * @return void
	 * @throws \RuntimeException When the database reports an error.
	 */
	private function query( $sql, $message ) {
		$this->db->suppress_errors( true );

		$result = $this->db->query( $sql ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- callers pass statements that SqlGuard accepted or that this class built from validated names.
		$error  = (string) $this->db->last_error;

		$this->db->suppress_errors( false );

		if ( false === $result && '' !== $message ) {
			throw new \RuntimeException( esc_html( trim( $message . ' ' . $error ) ) );
		}
	}

	/**
	 * Checks whether a table exists.
	 *
	 * @param string $table Table name.
	 * @return bool Whether the table exists.
	 */
	private function exists( $table ) {
		return 0 === strcasecmp( $table, (string) $this->db->get_var( $this->db->prepare( 'SHOW TABLES LIKE %s', $this->db->esc_like( $table ) ) ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}
}
