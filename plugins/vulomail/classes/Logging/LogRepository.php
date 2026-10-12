<?php
/**
 * LogRepository class file.
 *
 * @package VuloMail
 */

namespace VuloMail\Logging;

use VuloMail\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Database access for the delivery log table.
 */
class LogRepository {

	/**
	 * Columns a list request may sort by.
	 */
	const SORTABLE = array( 'id', 'created_at', 'status', 'provider', 'channel' );

	/**
	 * Get the fully prefixed log table name.
	 *
	 * @return string
	 */
	private function table() {
		global $wpdb;

		return $wpdb->prefix . Utill::TABLES['log'];
	}

	/**
	 * Insert a log row.
	 *
	 * @param array $row Column => value.
	 * @return int Inserted row id, 0 on failure.
	 */
	public function insert( array $row ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$inserted = $wpdb->insert( $this->table(), $row );

		return $inserted ? (int) $wpdb->insert_id : 0;
	}

	/**
	 * Get one log row by id.
	 *
	 * @param int $id Row id.
	 * @return array|null
	 */
	public function get( $id ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM %i WHERE id = %d', $this->table(), $id ), ARRAY_A );

		return $row ? $row : null;
	}

	/**
	 * Paginated, filtered list.
	 *
	 * @param array $args channel, status, search, after, before (UTC datetimes), page, per_page, orderby, order.
	 * @return array{data: array, total: int, status_counts: array<string, int>}
	 */
	public function query( array $args ) {
		global $wpdb;

		$where  = array( '1=1' );
		$params = array();

		if ( ! empty( $args['channel'] ) ) {
			$where[]  = 'channel = %s';
			$params[] = $args['channel'];
		}

		if ( ! empty( $args['search'] ) ) {
			$like     = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$where[]  = '(recipients LIKE %s OR subject LIKE %s)';
			$params[] = $like;
			$params[] = $like;
		}

		if ( ! empty( $args['after'] ) ) {
			$where[]  = 'created_at >= %s';
			$params[] = $args['after'];
		}

		if ( ! empty( $args['before'] ) ) {
			$where[]  = 'created_at <= %s';
			$params[] = $args['before'];
		}

		// Counted before the status filter, so the pill bar shows every status's own total.
		$base_where = implode( ' AND ', $where );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- $base_where/$where_sql hold only the fixed fragments built above; values go through prepare().
		$counts = $wpdb->get_results(
			$wpdb->prepare( "SELECT status, COUNT(*) AS total FROM %i WHERE {$base_where} GROUP BY status", array_merge( array( $this->table() ), $params ) ),
			ARRAY_A
		);

		if ( ! empty( $args['status'] ) ) {
			$where[]  = 'status = %s';
			$params[] = $args['status'];
		}

		$where_sql = implode( ' AND ', $where );
		$orderby   = in_array( $args['orderby'] ?? '', self::SORTABLE, true ) ? $args['orderby'] : 'id';
		$order     = 'asc' === strtolower( (string) ( $args['order'] ?? '' ) ) ? 'ASC' : 'DESC';
		$per_page  = (int) ( $args['per_page'] ?? 0 );
		$per_page  = $per_page > 0 ? min( 100, $per_page ) : 10;
		$offset    = ( max( 1, (int) ( $args['page'] ?? 1 ) ) - 1 ) * $per_page;

		$total = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM %i WHERE {$where_sql}", array_merge( array( $this->table() ), $params ) )
		);

		// The body is left out of list responses: it can be large, and is fetched per row on demand.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, channel, status, provider, used_fallback, recipients, subject, attachments, source, error_message, created_at FROM %i WHERE {$where_sql} ORDER BY {$orderby} {$order}, id DESC LIMIT %d OFFSET %d",
				array_merge( array( $this->table() ), $params, array( $per_page, $offset ) )
			),
			ARRAY_A
		);
		// phpcs:enable

		$status_counts = array(
			'sent'   => 0,
			'failed' => 0,
		);

		foreach ( (array) $counts as $count ) {
			$status_counts[ $count['status'] ] = (int) $count['total'];
		}

		return array(
			'data'          => $rows ? $rows : array(),
			'total'         => $total,
			'status_counts' => $status_counts,
		);
	}

	/**
	 * The newest entries of one channel, for the diagnostics screen.
	 *
	 * @param string $channel Channel.
	 * @param int    $limit   How many rows.
	 * @return array<int, array{status: string, provider: string, error_message: string|null, created_at: string}> Newest first.
	 */
	public function recent( $channel, $limit ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare( 'SELECT status, provider, error_message, created_at FROM %i WHERE channel = %s ORDER BY id DESC LIMIT %d', $this->table(), $channel, $limit ),
			ARRAY_A
		);

		return $rows ? $rows : array();
	}

	/**
	 * Delete specific log rows.
	 *
	 * @param int[] $ids Row ids.
	 * @return int Rows deleted.
	 */
	public function delete( array $ids ) {
		global $wpdb;

		$ids = array_values( array_filter( array_map( 'absint', $ids ) ) );

		if ( ! $ids ) {
			return 0;
		}

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- $placeholders is a generated list of %d.
		return (int) $wpdb->query( $wpdb->prepare( "DELETE FROM %i WHERE id IN ({$placeholders})", array_merge( array( $this->table() ), $ids ) ) );
	}

	/**
	 * Delete every log row.
	 *
	 * @return int Rows deleted.
	 */
	public function delete_all() {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (int) $wpdb->query( $wpdb->prepare( 'DELETE FROM %i', $this->table() ) );
	}

	/**
	 * Delete log rows older than a given timestamp.
	 *
	 * @param string $before UTC `Y-m-d H:i:s`; older rows are removed.
	 * @return int Rows deleted.
	 */
	public function delete_before( $before ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return (int) $wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE created_at < %s', $this->table(), $before ) );
	}

	/**
	 * Sent/failed totals per channel and per day since a date.
	 *
	 * @param string $since UTC `Y-m-d H:i:s`.
	 * @return array<int, array{day: string, channel: string, status: string, total: string}>
	 */
	public function daily_counts( $since ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT DATE(created_at) AS day, channel, status, COUNT(*) AS total FROM %i WHERE created_at >= %s GROUP BY DATE(created_at), channel, status',
				$this->table(),
				$since
			),
			ARRAY_A
		);

		return $rows ? $rows : array();
	}
}
