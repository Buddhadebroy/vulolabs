<?php
/**
 * ActivityLogRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Dashboard;

use VuloPilot\Utill\RepositoryUtil;


defined( 'ABSPATH' ) || exit;

/**
 * Persistence for vulopilot_activity_logs.
 *
 * @class       ActivityLogRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ActivityLogRepository extends RepositoryUtil {

	/**
	 * Most rows get_timeline() will return in one response when seeking to a deep-linked
	 * row (`around_id`).
	 */
	private const MAX_AROUND_ROWS = 1000;

	/**
	 * @var string[]
	 */
	protected array $filterable_columns = array( 'actor_type', 'event_type' );

	/**
	 * @var string[]
	 */
	protected array $searchable_columns = array( 'message', 'event_type' );

	/**
	 * @inheritDoc
	 */
	protected function get_table_key(): string {
		return 'activity_log';
	}

	/**
	 * User/system/automation counts, zero-filled - backs the Activity table's status-count
	 * pill bar.
	 *
	 * @return array{user: int, system: int, automation: int}
	 */
	public function get_actor_type_counts(): array {
		return array_merge(
			array(
				'user'       => 0,
				'system'     => 0,
				'automation' => 0,
			),
			$this->count_by_column( 'actor_type' )
		);
	}

	/**
	 * Newest-first page of the activity timeline.
	 *
	 * @param array{event_types: string[], search?: string, date_from?: string, date_to?: string, page?: int, per_page?: int, around_id?: int} $args `event_types` is required and never empty - an empty allow-list would mean "every event type," which no caller here wants.
	 * @return array{data: array<int, array<string, mixed>>, total: int, pages_loaded: int}
	 */
	public function get_timeline( array $args ): array {
		global $wpdb;
		$table = $this->get_table();

		$event_types = array_values( array_filter( (array) ( $args['event_types'] ?? array() ) ) );

		if ( ! $event_types ) {
			return array(
				'data'  => array(),
				'total' => 0,
			);
		}

		$page     = max( 1, (int) ( $args['page'] ?? 1 ) );
		$per_page = max( 1, min( 100, (int) ( $args['per_page'] ?? 20 ) ) );
		$offset   = ( $page - 1 ) * $per_page;

		$values = $this->timeline_values( $event_types, $args );

		$event_placeholders = implode( ', ', array_fill( 0, count( $event_types ), '%s' ) );

		// Each optional filter is picked, never assembled.
		$where = implode(
			' AND ',
			array(
				"event_type IN ({$event_placeholders})",
				! empty( $args['search'] ) ? 'message LIKE %s' : '1 = 1',
				! empty( $args['date_from'] ) ? 'DATE(created_at) >= %s' : '1 = 1',
				! empty( $args['date_to'] ) ? 'DATE(created_at) <= %s' : '1 = 1',
			)
		);

		$total = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- the query is prepared.
			$wpdb->prepare( "SELECT COUNT(*) FROM %i WHERE {$where}", $table, ...$values ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- the table and optional filters are picked from fixed literals and every value is a bound placeholder; only the placeholder count varies at runtime.
		);

		if ( 0 === $total ) {
			return array(
				'data'         => array(),
				'total'        => 0,
				'pages_loaded' => 1,
			);
		}

		$limit        = $per_page;
		$pages_loaded = $page;
		$around_id    = absint( $args['around_id'] ?? 0 );

		if ( $around_id > 0 ) {
			$pages_to_target = $this->get_pages_down_to( $table, $event_types, $args, $around_id, $per_page );

			if ( $pages_to_target > 0 && $pages_to_target * $per_page <= self::MAX_AROUND_ROWS ) {
				$limit        = $pages_to_target * $per_page;
				$offset       = 0;
				$pages_loaded = $pages_to_target;
			}
		}

		$rows = $wpdb->get_results(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching  -- {$this->get_table()}/$table-style variables here are always this plugin's own hardcoded table name(s), never user input; dynamic placeholder counts (IN (...) lists, optional WHERE fragments) are sized correctly at runtime, just not statically visible to this sniff.
			$wpdb->prepare( "SELECT * FROM %i WHERE {$where} ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d", $table, ...array_merge( $values, array( $limit, $offset ) ) ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- same runtime-sized-array case as above.
			ARRAY_A
		);

		return array(
			'data'         => null !== $rows ? $rows : array(),
			'total'        => $total,
			'pages_loaded' => $pages_loaded,
		);
	}

	/**
	 * Placeholder values for the timeline's WHERE clause, in the order the clause's own
	 * placeholders appear: event types, then the search term.
	 *
	 * @param string[]             $event_types Event types the timeline is limited to.
	 * @param array<string, mixed> $args        Same filters `get_timeline()` takes.
	 * @return array<int, string>
	 */
	private function timeline_values( array $event_types, array $args ): array {
		global $wpdb;

		$values = $event_types;

		if ( ! empty( $args['search'] ) ) {
			$values[] = '%' . $wpdb->esc_like( (string) $args['search'] ) . '%';
		}

		if ( ! empty( $args['date_from'] ) ) {
			$values[] = (string) $args['date_from'];
		}

		if ( ! empty( $args['date_to'] ) ) {
			$values[] = (string) $args['date_to'];
		}

		return $values;
	}

	/**
	 * How many `$per_page`-sized pages, counted from the newest row, it takes to include
	 * row `$id` under the same filters as the timeline query.
	 *
	 * @param string               $table       This plugin's own activity-log table name.
	 * @param string[]             $event_types Event types the timeline is limited to.
	 * @param array<string, mixed> $args        Same filters `get_timeline()` takes.
	 * @param int                  $id          Row to reach.
	 * @param int                  $per_page    Page size.
	 * @return int
	 */
	private function get_pages_down_to( string $table, array $event_types, array $args, int $id, int $per_page ): int {
		global $wpdb;

		$values             = $this->timeline_values( $event_types, $args );
		$event_placeholders = implode( ', ', array_fill( 0, count( $event_types ), '%s' ) );

		// Same filters as get_timeline(), each picked rather than assembled.
		$where = implode(
			' AND ',
			array(
				"event_type IN ({$event_placeholders})",
				! empty( $args['search'] ) ? 'message LIKE %s' : '1 = 1',
				! empty( $args['date_from'] ) ? 'DATE(created_at) >= %s' : '1 = 1',
				! empty( $args['date_to'] ) ? 'DATE(created_at) <= %s' : '1 = 1',
			)
		);

		$target = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- the query is prepared.
			$wpdb->prepare( "SELECT id, created_at FROM %i WHERE {$where} AND id = %d", $table, ...array_merge( $values, array( $id ) ) ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- the table and optional filters are picked from fixed literals and every value is a bound placeholder; only the placeholder count varies at runtime.
			ARRAY_A
		);

		if ( ! $target ) {
			return 0;
		}

		$newer_rows = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- the query is prepared.
			$wpdb->prepare( "SELECT COUNT(*) FROM %i WHERE {$where} AND ( created_at > %s OR ( created_at = %s AND id > %d ) )", $table, ...array_merge( $values, array( $target['created_at'], $target['created_at'], (int) $target['id'] ) ) ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- the table and optional filters are picked from fixed literals and every value is a bound placeholder; only the placeholder count varies at runtime.
		);

		return (int) floor( $newer_rows / $per_page ) + 1;
	}

	/**
	 * Real rows created within a short window starting at `$after`.
	 *
	 * @param string[] $event_types    e.g. History::EVENT_TYPES_BY_CATEGORY['change'].
	 * @param string   $after          Y-m-d H:i:s, inclusive.
	 * @param int      $window_seconds How far past `$after` to look.
	 * @return array<int, array<string, mixed>>
	 */
	public function find_actions_in_window( array $event_types, string $after, int $window_seconds ): array {
		global $wpdb;
		$table = $this->get_table();

		if ( ! $event_types ) {
			return array();
		}

		$before = gmdate( 'Y-m-d H:i:s', strtotime( $after ) + $window_seconds );

		$placeholders = implode( ', ', array_fill( 0, count( $event_types ), '%s' ) );

		$rows = $wpdb->get_results(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching  -- {$this->get_table()}/$table-style variables here are always this plugin's own hardcoded table name(s), never user input; dynamic placeholder counts (IN (...) lists, optional WHERE fragments) are sized correctly at runtime, just not statically visible to this sniff.
			$wpdb->prepare(  // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber  -- {$this->get_table()}/$table-style variables here are always this plugin's own hardcoded table name(s), never user input; dynamic placeholder counts (IN (...) lists, optional WHERE fragments) are sized correctly at runtime, just not statically visible to this sniff.
				"SELECT * FROM %i WHERE event_type IN ({$placeholders}) AND created_at BETWEEN %s AND %s ORDER BY created_at ASC LIMIT 10", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- placeholder count matches $event_types' size at runtime.
				$table,
				...array_merge( $event_types, array( $after, $before ) )
			),
			ARRAY_A
		);

		return null !== $rows ? $rows : array();
	}

	/**
	 * Records one activity log entry.
	 *
	 * @param string      $event_type e.g. 'scan.completed'.
	 * @param string      $message    Human-readable description.
	 * @param string      $severity   One of Severity's constants.
	 * @param string      $actor_type 'user'|'system'|'automation'.
	 * @param string|null $object_type What kind of thing this is about.
	 * @param string|null $object_id   Identifies the specific object.
	 * @return int The new row's id.
	 */
	public function log( string $event_type, string $message, string $severity = 'info', string $actor_type = 'system', ?string $object_type = null, ?string $object_id = null ): int {
		return $this->insert(
			array(
				'event_type'  => $event_type,
				'message'     => $message,
				'severity'    => $severity,
				'actor_type'  => $actor_type,
				'object_type' => $object_type,
				'object_id'   => $object_id,
			)
		);
	}
}
