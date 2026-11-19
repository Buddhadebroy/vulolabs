<?php
/**
 * SubmissionRepository class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Submissions;

use VuloForm\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Database access for submissions. `data` is field key => value; `meta` holds what VuloForm itself
 * recorded (page, IP when enabled, notification and webhook results).
 */
class SubmissionRepository {

	const STATUSES = array( 'unread', 'read', 'spam' );

	/**
	 * @return string
	 */
	private function table() {
		global $wpdb;

		return $wpdb->prefix . Utill::TABLES['submission'];
	}

	/**
	 * @param int    $form_id Form id.
	 * @param array  $data    Field key => value.
	 * @param array  $meta    Extra details.
	 * @param string $status  unread, read or spam.
	 * @return int New submission id, 0 on failure.
	 */
	public function insert( $form_id, array $data, array $meta = array(), $status = 'unread' ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$inserted = $wpdb->insert(
			$this->table(),
			array(
				'form_id'     => (int) $form_id,
				'status'      => in_array( $status, self::STATUSES, true ) ? $status : 'unread',
				'user_id'     => (int) get_current_user_id(),
				'data'        => wp_json_encode( $data ),
				'meta'        => wp_json_encode( $meta ),
				'search_text' => self::search_text( $data ),
				'created_at'  => gmdate( 'Y-m-d H:i:s' ),
			)
		);

		return $inserted ? (int) $wpdb->insert_id : 0;
	}

	/**
	 * @param int $id Submission id.
	 * @return array|null
	 */
	public function get( $id ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM %i WHERE id = %d', $this->table(), (int) $id ), ARRAY_A );

		return $row ? self::hydrate( $row ) : null;
	}

	/**
	 * Paginated, filtered list.
	 *
	 * @param array $args form_id, status, search, after, before (UTC datetimes), page, per_page, order.
	 * @return array{data: array, total: int, status_counts: array<string, int>}
	 */
	public function query( array $args ) {
		global $wpdb;

		$conditions = array();
		$values     = array();

		if ( ! empty( $args['form_id'] ) ) {
			$conditions[] = 'form_id = %d';
			$values[]     = (int) $args['form_id'];
		}

		if ( ! empty( $args['search'] ) ) {
			$conditions[] = 'search_text LIKE %s';
			$values[]     = '%' . $wpdb->esc_like( $args['search'] ) . '%';
		}

		if ( ! empty( $args['after'] ) ) {
			$conditions[] = 'created_at >= %s';
			$values[]     = $args['after'];
		}

		if ( ! empty( $args['before'] ) ) {
			$conditions[] = 'created_at <= %s';
			$values[]     = $args['before'];
		}

		// Counted before the status filter, so each status pill shows its own total.
		$base_where  = $conditions ? ' WHERE ' . implode( ' AND ', $conditions ) : '';
		$base_values = $values;

		$status = $args['status'] ?? '';

		if ( in_array( $status, self::STATUSES, true ) ) {
			$conditions[] = 'status = %s';
			$values[]     = $status;
		} elseif ( 'inbox' === $status ) {
			$conditions[] = "status <> 'spam'";
		}

		$where    = $conditions ? ' WHERE ' . implode( ' AND ', $conditions ) : '';
		$order    = 'asc' === strtolower( (string) ( $args['order'] ?? '' ) ) ? 'ASC' : 'DESC';
		$per_page = min( 500, absint( $args['per_page'] ?? 10 ) ?: 10 );
		$offset   = ( max( 1, absint( $args['page'] ?? 1 ) ) - 1 ) * $per_page;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- the WHERE strings hold only placeholders and $order is ASC or DESC.
		$counts = $wpdb->get_results( $wpdb->prepare( 'SELECT status, COUNT(*) AS total FROM %i' . $base_where . ' GROUP BY status', $this->table(), ...$base_values ), ARRAY_A );
		$total  = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM %i' . $where, $this->table(), ...$values ) );
		$rows   = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM %i' . $where . " ORDER BY created_at {$order}, id {$order} LIMIT %d OFFSET %d",
				...array_merge( array( $this->table() ), $values, array( $per_page, $offset ) )
			),
			ARRAY_A
		);
		// phpcs:enable

		$status_counts = array_fill_keys( self::STATUSES, 0 );

		foreach ( (array) $counts as $count ) {
			$status_counts[ $count['status'] ] = (int) $count['total'];
		}

		return array(
			'data'          => array_map( array( self::class, 'hydrate' ), $rows ? $rows : array() ),
			'total'         => $total,
			'status_counts' => $status_counts,
		);
	}

	/**
	 * @param int[]  $ids    Submission ids.
	 * @param string $status New status.
	 * @return int Rows changed.
	 */
	public function set_status( array $ids, $status ) {
		global $wpdb;

		$ids = array_values( array_filter( array_map( 'absint', $ids ) ) );

		if ( ! $ids || ! in_array( $status, self::STATUSES, true ) ) {
			return 0;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- the IN list holds only placeholders.
		return (int) $wpdb->query( $wpdb->prepare( 'UPDATE %i SET status = %s WHERE id IN (' . implode( ',', array_fill( 0, count( $ids ), '%d' ) ) . ')', $this->table(), $status, ...$ids ) );
	}

	/**
	 * Stores what happened after a submission was saved (notification and webhook outcomes).
	 *
	 * @param int   $id   Submission id.
	 * @param array $meta Full meta to store.
	 * @return void
	 */
	public function update_meta( $id, array $meta ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->update( $this->table(), array( 'meta' => wp_json_encode( $meta ) ), array( 'id' => (int) $id ) );
	}

	/**
	 * Appends one entry to a submission's delivery log (email, webhook, or an extension's own event).
	 *
	 * @param int   $id    Submission id.
	 * @param array $event `type`, `name`, `status`, `detail`, `time`; optionally `label`,
	 *                     `status_label` and `color` for a type the core does not know.
	 * @return void
	 */
	public function add_event( $id, array $event ) {
		$submission = $this->get( $id );

		if ( ! $submission ) {
			return;
		}

		$meta           = $submission['meta'];
		$meta['events'] = array_merge( isset( $meta['events'] ) && is_array( $meta['events'] ) ? $meta['events'] : array(), array( $event ) );

		$this->update_meta( $id, $meta );
	}

	/**
	 * Deletes submissions and their uploaded files.
	 *
	 * @param int[] $ids Submission ids.
	 * @return int Rows deleted.
	 */
	public function delete( array $ids ) {
		global $wpdb;

		$ids = array_values( array_filter( array_map( 'absint', $ids ) ) );

		if ( ! $ids ) {
			return 0;
		}

		foreach ( $ids as $id ) {
			$submission = $this->get( $id );

			if ( $submission ) {
				Uploads::delete_for_submission( $submission );
			}
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- the IN list holds only placeholders.
		return (int) $wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE id IN (' . implode( ',', array_fill( 0, count( $ids ), '%d' ) ) . ')', $this->table(), ...$ids ) );
	}

	/**
	 * Ids matching a condition, oldest first, for batched clean-up.
	 *
	 * @param string $column `form_id`, `user_id` or `created_before`.
	 * @param mixed  $value  Value to match.
	 * @param int    $limit  Batch size.
	 * @return int[]
	 */
	public function ids_where( $column, $value, $limit = 200 ) {
		global $wpdb;

		$conditions = array(
			'created_before' => 'created_at < %s',
			'user_id'        => 'user_id = %d',
			'form_id'        => 'form_id = %d',
		);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- the condition is one of the fixed strings above.
		$ids = $wpdb->get_col( $wpdb->prepare( 'SELECT id FROM %i WHERE ' . ( $conditions[ $column ] ?? $conditions['form_id'] ) . ' ORDER BY id ASC LIMIT %d', $this->table(), $value, (int) $limit ) );

		return array_map( 'intval', $ids );
	}

	/**
	 * Submission totals per form, for the forms list.
	 *
	 * @return array<int, array{total: int, unread: int}> Keyed by form id. Spam is not counted.
	 */
	public function counts_by_form() {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT form_id, status, COUNT(*) AS total FROM %i GROUP BY form_id, status', $this->table() ), ARRAY_A );

		$counts = array();

		foreach ( (array) $rows as $row ) {
			$form_id = (int) $row['form_id'];

			if ( ! isset( $counts[ $form_id ] ) ) {
				$counts[ $form_id ] = array(
					'total'  => 0,
					'unread' => 0,
				);
			}

			if ( 'spam' !== $row['status'] ) {
				$counts[ $form_id ]['total'] += (int) $row['total'];
			}

			if ( 'unread' === $row['status'] ) {
				$counts[ $form_id ]['unread'] += (int) $row['total'];
			}
		}

		return $counts;
	}

	/**
	 * Submissions per UTC day, form and status since a moment, for the Dashboard.
	 *
	 * @param string $since UTC `Y-m-d H:i:s`.
	 * @return array<int, array{day: string, form_id: string, status: string, total: string}>
	 */
	public function daily_counts( $since ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT DATE(created_at) AS day, form_id, status, COUNT(*) AS total FROM %i WHERE created_at >= %s GROUP BY DATE(created_at), form_id, status',
				$this->table(),
				$since
			),
			ARRAY_A
		);

		return $rows ? $rows : array();
	}

	/**
	 * Recent submissions with a notification that is still failing: its last event for that
	 * notification says `failed` (a later `delivered` means a retry got it through).
	 *
	 * @param string $since UTC `Y-m-d H:i:s`.
	 * @param int    $limit Most recent first; how many to look at.
	 * @return array<int, array{id: int, form_id: int, created_at: string, failed: array<int, array{type: string, name: string, detail: string}>}>
	 */
	public function failing_notifications( $since, $limit = 50 ) {
		global $wpdb;

		// Only rows whose meta mentions a failure at all; the exact check is done on the decoded events below.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM %i WHERE created_at >= %s AND meta LIKE %s ORDER BY id DESC LIMIT %d',
				$this->table(),
				$since,
				'%' . $wpdb->esc_like( '"status":"failed"' ) . '%',
				(int) $limit
			),
			ARRAY_A
		);

		$failing = array();

		foreach ( (array) $rows as $row ) {
			$submission = self::hydrate( $row );
			$last       = array();

			foreach ( (array) ( $submission['meta']['events'] ?? array() ) as $event ) {
				if ( is_array( $event ) && isset( $event['type'], $event['status'] ) ) {
					$last[ $event['type'] . '|' . ( $event['name'] ?? '' ) ] = $event;
				}
			}

			$failed = array_values(
				array_filter(
					$last,
					static function ( $event ) {
						return 'failed' === $event['status'];
					}
				)
			);

			if ( $failed ) {
				$failing[] = array(
					'id'         => $submission['id'],
					'form_id'    => $submission['form_id'],
					'created_at' => $submission['created_at'],
					'failed'     => array_map(
						static function ( $event ) {
							return array(
								'type'   => (string) $event['type'],
								'name'   => (string) ( $event['name'] ?? '' ),
								'detail' => (string) ( $event['detail'] ?? '' ),
							);
						},
						$failed
					),
				);
			}
		}

		return $failing;
	}

	/**
	 * @param array $row Database row.
	 * @return array
	 */
	private static function hydrate( array $row ) {
		$data = json_decode( (string) $row['data'], true );
		$meta = json_decode( (string) $row['meta'], true );

		return array(
			'id'         => (int) $row['id'],
			'form_id'    => (int) $row['form_id'],
			'status'     => $row['status'],
			'user_id'    => (int) $row['user_id'],
			'data'       => is_array( $data ) ? $data : array(),
			'meta'       => is_array( $meta ) ? $meta : array(),
			'created_at' => $row['created_at'],
		);
	}

	/**
	 * The text a search matches against: every plain value in the submission.
	 *
	 * @param array $data Field key => value.
	 * @return string
	 */
	private static function search_text( array $data ) {
		$parts = array();

		array_walk_recursive(
			$data,
			static function ( $value, $key ) use ( &$parts ) {
				// File records carry their stored path; only the visible name is searchable.
				if ( is_scalar( $value ) && ! in_array( $key, array( 'path', 'type', 'size' ), true ) ) {
					$parts[] = (string) $value;
				}
			}
		);

		return mb_substr( implode( ' ', $parts ), 0, 5000 );
	}
}
