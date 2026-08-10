<?php
/**
 * ActivityLogRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

defined( 'ABSPATH' ) || exit;

/**
 * Persistence for vulopilot_activity_logs (DATABASE.md).
 *
 * @class       ActivityLogRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ActivityLogRepository extends AbstractRepository {

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
     * User/system/automation counts, zero-filled — backs the Activity
     * table's status-count pill bar. Activity has no true lifecycle status
     * column, so actor_type is the closest existing categorical dimension
     * (same reasoning as AutomationRepository::get_status_counts()).
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
     * Paginated, searchable, date-ranged activity log rows scoped to an
     * explicit `event_type` allow-list — what the AI Copilot History tab's
     * timeline reads (Controllers/History.php), which only ever cares
     * about `scan.completed`/`ai_action.*` rows, never the Pro-only
     * snapshot event types (`brand_score_snapshot_built` etc.) this same
     * table also carries. A dedicated method rather than routing through
     * find_all(): `event_type` values like 'ai_action.executed' contain a
     * dot, and find_all()'s own filterable-column path has no `sanitize_key()`-
     * safe way to pass an explicit type allow-list alongside a separate
     * free-text `search` — this needs both at once.
     *
     * @param array{event_types: string[], search?: string, date_from?: string, date_to?: string, page?: int, per_page?: int} $args `event_types` is required and never empty — an empty allow-list would mean "every event type," which no caller here wants.
     * @return array{data: array<int, array<string, mixed>>, total: int}
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

        $placeholders = implode( ', ', array_fill( 0, count( $event_types ), '%s' ) );
        $where        = "WHERE event_type IN ({$placeholders})";
        $values       = $event_types;

        if ( ! empty( $args['search'] ) ) {
            $where   .= ' AND message LIKE %s';
            $values[] = '%' . $wpdb->esc_like( (string) $args['search'] ) . '%';
        }

        if ( ! empty( $args['date_from'] ) ) {
            $where   .= ' AND DATE(created_at) >= %s';
            $values[] = (string) $args['date_from'];
        }

        if ( ! empty( $args['date_to'] ) ) {
            $where   .= ' AND DATE(created_at) <= %s';
            $values[] = (string) $args['date_to'];
        }

        $total = (int) $wpdb->get_var(
            $wpdb->prepare( "SELECT COUNT(*) FROM {$table} {$where}", ...$values ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $where's %s count matches $values' size at runtime.
        );

        if ( 0 === $total ) {
            return array(
                'data'  => array(),
                'total' => 0,
            );
        }

        $rows = $wpdb->get_results(
            $wpdb->prepare( "SELECT * FROM {$table} {$where} ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d", ...array_merge( $values, array( $per_page, $offset ) ) ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- same runtime-sized-array case as above.
            ARRAY_A
        );

        return array(
            'data'  => null !== $rows ? $rows : array(),
            'total' => $total,
        );
    }

    /**
     * Records one activity log entry. A thin, descriptively-named wrapper
     * around insert() so call sites (ScanPersistenceListener and, later,
     * the Rule/Automation engines) read as "log this event" rather than a
     * bare array literal (naming-quality.md).
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
