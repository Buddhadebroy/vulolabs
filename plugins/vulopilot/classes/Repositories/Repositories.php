<?php
/**
 * Every class in this file used to be its own file under classes/Repositories/
 * (same names, docblocks, and behavior) - merged into one file to reduce
 * classes/'s file count, per direct instruction. Autoloading does not rely on
 * each class's own file matching its own name for this: composer.json's
 * autoload.classmap entry (alongside the existing psr-4 one) makes Composer
 * tokenize every file under classes/ and modules/ and map each class it finds
 * to its real file, however many classes share one file - run
 * `composer dump-autoload` (no `-o`/`--optimize-autoloader` needed) after any
 * further file merge/split here.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

use VuloPilot\Contracts\Repository\RepositoryInterface;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Shared $wpdb CRUD implementation for every VuloPilot custom table.
 * Concrete repositories only declare which Utill::TABLES key they own and
 * which columns find_all() may filter on by exact match - the actual
 * prepare()/query boilerplate lives here once instead of being repeated
 * per entity (database.md's "always $wpdb->prepare() for any query with a
 * variable", applied uniformly).
 *
 * Per-id in-request cache follows the same pattern database.md points to
 * (Store.php's static-cache-by-id) rather than introducing a new caching
 * layer.
 *
 * @class       AbstractRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class AbstractRepository implements RepositoryInterface {

    /**
     * @var array<int, array<string, mixed>|null>
     */
    private array $cache = array();

    /**
     * @var string[] Columns find_all() accepts as exact-match filters.
     */
    protected array $filterable_columns = array();

    /**
     * @var string[] Text columns an incoming `search` arg is LIKE-matched against (OR'd together).
     */
    protected array $searchable_columns = array();

    /**
     * @return string Utill::TABLES key this repository owns.
     */
    abstract protected function get_table_key(): string;

    /**
     * @return string Fully-prefixed table name.
     */
    protected function get_table(): string {
        global $wpdb;
        return $wpdb->prefix . Utill::TABLES[ $this->get_table_key() ];
    }

    /**
     * @inheritDoc
     */
    public function find( int $id ): ?array {
        if ( array_key_exists( $id, $this->cache ) ) {
            return $this->cache[ $id ];
        }

        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE id = %d", $id ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ARRAY_A
        );

        $this->cache[ $id ] = $row ?: null;

        return $this->cache[ $id ];
    }

    /**
     * Builds one filterable-column WHERE clause, appending its bound
     * value(s) to $where_values by reference. A plain scalar becomes an
     * exact-match `= %s` (the original, only behavior this had); an array
     * (e.g. a findings table section grouping several scanner_id values
     * together, SEO.tsx) becomes `IN (%s, %s, ...)` instead - additive, so
     * every existing scalar caller's query is unchanged.
     *
     * @param string                  $column       Column name (already restricted to $filterable_columns entries).
     * @param string|int|array<mixed> $value        Raw filter value from $args.
     * @param array<int, string|int>  $where_values Bound values accumulator, appended to by reference.
     * @return string|null WHERE fragment, or null if $value had nothing usable in it.
     */
    private function build_column_where_clause( string $column, $value, array &$where_values ): ?string {
        if ( is_array( $value ) ) {
            $values = array_values( array_filter( array_map( 'strval', $value ), fn( $item ) => '' !== $item ) );

            if ( ! $values ) {
                return null;
            }

            array_push( $where_values, ...$values );

            return "`{$column}` IN (" . implode( ', ', array_fill( 0, count( $values ), '%s' ) ) . ')';
        }

        $where_values[] = (string) $value;

        return "`{$column}` = %s";
    }

    /**
     * @inheritDoc
     */
    public function find_all( array $args = array() ): array {
        global $wpdb;

        $table    = $this->get_table();
        $page     = max( 1, (int) ( $args['page'] ?? 1 ) );
        $per_page = max( 1, min( 100, (int) ( $args['per_page'] ?? 20 ) ) );
        $offset   = ( $page - 1 ) * $per_page;
        $orderby  = preg_replace( '/[^a-zA-Z_]/', '', (string) ( ! empty( $args['orderby'] ) ? $args['orderby'] : 'id' ) );
        $order    = 'asc' === strtolower( (string) ( $args['order'] ?? 'desc' ) ) ? 'ASC' : 'DESC';

        $where_clauses = array();
        $where_values  = array();

        foreach ( $this->filterable_columns as $column ) {
            if ( ! isset( $args[ $column ] ) || '' === $args[ $column ] ) {
                continue;
            }

            $clause = $this->build_column_where_clause( $column, $args[ $column ], $where_values );

            if ( null !== $clause ) {
                $where_clauses[] = $clause;
            }
        }

        if ( ! empty( $args['search'] ) && $this->searchable_columns ) {
            $like              = '%' . $wpdb->esc_like( (string) $args['search'] ) . '%';
            $search_conditions = array();

            foreach ( $this->searchable_columns as $column ) {
                $search_conditions[] = "`{$column}` LIKE %s";
                $where_values[]      = $like;
            }

            $where_clauses[] = '(' . implode( ' OR ', $search_conditions ) . ')';
        }

        $where_sql = $where_clauses ? ( 'WHERE ' . implode( ' AND ', $where_clauses ) ) : '';

        if ( $where_values ) {
            $count_sql = $wpdb->prepare( "SELECT COUNT(*) FROM {$table} {$where_sql}", ...$where_values ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $where_sql's %s count matches $where_values' size at runtime; the sniff can't see that statically.
            $rows_sql  = $wpdb->prepare( // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- same runtime-sized-array case as above.
                "SELECT * FROM {$table} {$where_sql} ORDER BY {$orderby} {$order} LIMIT %d OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ...array_merge( $where_values, array( $per_page, $offset ) )
            );
        } else {
            $count_sql = "SELECT COUNT(*) FROM {$table}"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            $rows_sql  = $wpdb->prepare(
                "SELECT * FROM {$table} ORDER BY {$orderby} {$order} LIMIT %d OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $per_page,
                $offset
            );
        }

        $total = (int) $wpdb->get_var( $count_sql ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $rows  = $wpdb->get_results( $rows_sql, ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return array(
            'data'  => $rows ?: array(),
            'total' => $total,
        );
    }

    /**
     * Row counts grouped by one column, scoped by any other already-declared
     * filterable_columns present in $args (e.g. scoping a findings status
     * breakdown to one category) - never scoped by $column itself (that's
     * what's being counted) or by 'search' (count badges reflect the fixed
     * dataset, not the search box, matching the sibling vulolabs plugin's
     * StoreTable.tsx/Stores.php, which also computes its status counts
     * unconditionally on every list fetch).
     *
     * @param string               $column Column to GROUP BY.
     * @param array<string, mixed> $args   Same shape as find_all()'s $args.
     * @return array<string, int> value => count, only for values with >=1 row.
     */
    public function count_by_column( string $column, array $args = array() ): array {
        global $wpdb;

        $table         = $this->get_table();
        $safe_column   = preg_replace( '/[^a-zA-Z_]/', '', $column );
        $where_clauses = array();
        $where_values  = array();

        foreach ( $this->filterable_columns as $filter_column ) {
            if ( $filter_column === $column ) {
                continue;
            }

            if ( ! isset( $args[ $filter_column ] ) || '' === $args[ $filter_column ] ) {
                continue;
            }

            $clause = $this->build_column_where_clause( $filter_column, $args[ $filter_column ], $where_values );

            if ( null !== $clause ) {
                $where_clauses[] = $clause;
            }
        }

        $where_sql = $where_clauses ? ( 'WHERE ' . implode( ' AND ', $where_clauses ) ) : '';

        if ( $where_values ) {
            $sql = $wpdb->prepare( "SELECT `{$safe_column}` AS bucket, COUNT(*) AS total FROM {$table} {$where_sql} GROUP BY `{$safe_column}`", ...$where_values ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $where_sql's %s count matches $where_values' size at runtime.
        } else {
            $sql = "SELECT `{$safe_column}` AS bucket, COUNT(*) AS total FROM {$table} GROUP BY `{$safe_column}`"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        }

        $rows = $wpdb->get_results( $sql, ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        $counts = array();

        foreach ( (array) $rows as $row ) {
            $counts[ $row['bucket'] ] = (int) $row['total'];
        }

        return $counts;
    }

    /**
     * @inheritDoc
     */
    public function insert( array $data ): int {
        global $wpdb;

        $wpdb->insert( $this->get_table(), $data );

        return (int) $wpdb->insert_id;
    }

    /**
     * @inheritDoc
     */
    public function update( int $id, array $data ): bool {
        global $wpdb;

        unset( $this->cache[ $id ] );

        return false !== $wpdb->update( $this->get_table(), $data, array( 'id' => $id ) );
    }

    /**
     * Applies the same update to a bounded set of rows (e.g. rows checked
     * via a table's bulk-action UI) - loops the existing single-row
     * update() rather than building a fresh bulk SQL statement, since the
     * id list is always small (whatever fits on one page) and this reuses
     * update()'s own cache-invalidation for free.
     *
     * @param int[]                $ids  Row ids to update.
     * @param array<string, mixed> $data Column => value pairs to set on every row.
     * @return int Number of rows actually updated.
     */
    public function bulk_update( array $ids, array $data ): int {
        $updated_count = 0;

        foreach ( $ids as $id ) {
            if ( $this->update( (int) $id, $data ) ) {
                ++$updated_count;
            }
        }

        return $updated_count;
    }

    /**
     * @inheritDoc
     */
    public function delete( int $id ): bool {
        global $wpdb;

        unset( $this->cache[ $id ] );

        return false !== $wpdb->delete( $this->get_table(), array( 'id' => $id ) );
    }
}

/**
 * Persistence for vulopilot_ai_action_runs (see AI-ACTIONS.md) - the
 * record of one AIAction going through propose → approve/reject →
 * execute → rollback. `input`/`output`/`preview`/`snapshot` are stored as
 * JSON; AiCopilot\ActionRunner is the only code that encodes/decodes
 * them, this repository just persists strings.
 *
 * @class       ActionRunRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ActionRunRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'action_id', 'status', 'object_type' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'ai_action_run';
    }

    /**
     * Real content-creation stats for one date range - how many of the
     * given actions actually ran to completion (`status = 'executed'`),
     * and how many real words their own output contained in total.
     *
     * Every content-creation action's real `output` column is
     * `{title, body}` JSON (confirmed against GenerateBlogAction/
     * GenerateLandingPageAction/GenerateProductDescriptionAction's own
     * parse_response()/execute()) - written once at propose() time and
     * never touched again by approve(), so it's the real, final generated
     * text, not a stale draft. Word count uses the exact same
     * wp_strip_all_tags()+str_word_count() pair
     * Seo\Scanners\ThinContentScanner already uses for real content
     * elsewhere in this codebase, not a different heuristic.
     *
     * @param string   $period_start Y-m-d, inclusive.
     * @param string   $period_end   Y-m-d, inclusive.
     * @param string[] $action_ids   Content-creation action ids to scope to.
     * @return array{content_created: int, words_generated: int}
     */
    public function get_content_creation_stats_for_period( string $period_start, string $period_end, array $action_ids ): array {
        global $wpdb;

        if ( ! $action_ids ) {
            return array(
                'content_created' => 0,
                'words_generated' => 0,
            );
        }

        $placeholders = implode( ', ', array_fill( 0, count( $action_ids ), '%s' ) );

        $outputs = $wpdb->get_col(
            $wpdb->prepare( // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- $placeholders' %s count matches $action_ids' size at runtime; the trailing 2 %s are $period_start/$period_end, both passed below via the same spread.
                "SELECT output FROM {$this->get_table()} WHERE status = 'executed' AND action_id IN ({$placeholders}) AND DATE(created_at) BETWEEN %s AND %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $placeholders' %s count matches $action_ids' size at runtime.
                ...array_merge( $action_ids, array( $period_start, $period_end ) )
            )
        );

        $words = 0;

        foreach ( (array) $outputs as $raw_output ) {
            $output = json_decode( (string) $raw_output, true );
            $body   = is_array( $output ) ? (string) ( $output['body'] ?? '' ) : '';
            $words += str_word_count( wp_strip_all_tags( $body ) );
        }

        return array(
            'content_created' => count( (array) $outputs ),
            'words_generated' => $words,
        );
    }
}

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
     * User/system/automation counts, zero-filled - backs the Activity
     * table's status-count pill bar. Activity has no true lifecycle status
     * column, so actor_type is the closest existing categorical dimension
     * (same reasoning as AutomationsRepository::get_status_counts()).
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
     * explicit `event_type` allow-list - what the AI Copilot History tab's
     * timeline reads (Controllers/History.php), which only ever cares
     * about `scan.completed`/`ai_action.*` rows, never the Pro-only
     * snapshot event types (`brand_score_snapshot_built` etc.) this same
     * table also carries. A dedicated method rather than routing through
     * find_all(): `event_type` values like 'ai_action.executed' contain a
     * dot, and find_all()'s own filterable-column path has no `sanitize_key()`-
     * safe way to pass an explicit type allow-list alongside a separate
     * free-text `search` - this needs both at once.
     *
     * @param array{event_types: string[], search?: string, date_from?: string, date_to?: string, page?: int, per_page?: int} $args `event_types` is required and never empty - an empty allow-list would mean "every event type," which no caller here wants.
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
     * Real rows created within a short window starting at `$after` - used
     * only by History's "Related actions" (Controllers/History.php), to
     * find an `ai_action.*` row a content-creation conversation turn
     * caused. Safe as a tight window rather than a same-day heuristic
     * because the causing turn and the resulting action are always written
     * in the same PHP request (Controllers\Copilot.php/ContentAssistant.php
     * call the content-creation orchestrator synchronously right after the
     * AI call that this row's own `ai_history` row logs) - the caller still
     * cross-checks the real requesting user via the joined
     * `vulopilot_ai_action_runs.requested_by` before treating a candidate
     * as related, since this table's own `actor_id` isn't populated by
     * ActionRunner::log() today.
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

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE event_type IN ({$placeholders}) AND created_at BETWEEN %s AND %s ORDER BY created_at ASC LIMIT 10", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- placeholder count matches $event_types' size at runtime.
                ...array_merge( $event_types, array( $after, $before ) )
            ),
            ARRAY_A
        );

        return null !== $rows ? $rows : array();
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

/**
 * Persistence for vulopilot_ai_history (DATABASE.md).
 *
 * @class       AiHistoryRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiHistoryRepository extends AbstractRepository {

    /**
     * The only 2 `surface` values that represent a real chat turn a human
     * had with VuloPilot (Controllers\Copilot.php/ContentAssistant.php) -
     * every other real caller of `ai_request_sender`/`request_sender`
     * (AiCopilot\ActionRunner, GeoAnalysis\GeoAnalyzer,
     * ContentIntelligence\ContentAnalyzer) tags its own rows with its own
     * real feature label instead, so this is the whitelist
     * get_conversations() scopes to - kept in sync with AIRequest's own
     * `$surface` values by hand, the same way ContentCreationOrchestrator's
     * CONTENT_CREATION_ACTIONS is kept in sync with each chat controller's
     * own system prompt.
     */
    private const CHAT_SURFACES = array( 'copilot_chat', 'content_assistant_chat' );

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'provider', 'status', 'surface' );

    /**
     * @var string[]
     */
    protected array $searchable_columns = array( 'model', 'prompt_excerpt', 'response_excerpt' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'ai_history';
    }

    /**
     * Success/failure counts, zero-filled - backs the AI Assistant table's
     * status-count pill bar (same reasoning as
     * AutomationsRepository::get_status_counts()).
     *
     * @return array{success: int, failure: int}
     */
    public function get_status_counts(): array {
        return array_merge(
            array(
                'success' => 0,
                'failure' => 0,
            ),
            $this->count_by_column( 'status' )
        );
    }

    /**
     * Call counts, token totals, and cost for one date range - what
     * Reports\Types\AiUsageReport's headline summary reads.
     *
     * @param string $period_start Y-m-d, inclusive.
     * @param string $period_end   Y-m-d, inclusive.
     * @return array{total_calls: int, successful_calls: int, failed_calls: int, prompt_tokens: int, completion_tokens: int, total_cost: float}
     */
    public function get_stats_for_period( string $period_start, string $period_end ): array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT COUNT(*) AS total_calls,
                        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful_calls,
                        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) AS failed_calls,
                        COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
                        COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
                        COALESCE(SUM(cost_estimate), 0) AS total_cost
                 FROM {$this->get_table()} WHERE DATE(created_at) BETWEEN %s AND %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            ),
            ARRAY_A
        );

        return array(
            'total_calls'       => (int) ( $row['total_calls'] ?? 0 ),
            'successful_calls'  => (int) ( $row['successful_calls'] ?? 0 ),
            'failed_calls'      => (int) ( $row['failed_calls'] ?? 0 ),
            'prompt_tokens'     => (int) ( $row['prompt_tokens'] ?? 0 ),
            'completion_tokens' => (int) ( $row['completion_tokens'] ?? 0 ),
            'total_cost'        => (float) ( $row['total_cost'] ?? 0 ),
        );
    }

    /**
     * Paginated, searchable, date-ranged real chat turns - scoped to
     * CHAT_SURFACES so AI Copilot History's "Conversations" filter
     * (Controllers\History.php) shows real chat, not every other feature
     * that shares this same table. Same shape/pagination contract as
     * ActivityLogRepository::get_timeline() (its own docblock explains why
     * a dedicated method beats routing through find_all(): an explicit
     * allow-list alongside a separate free-text `search` needs both at
     * once, which find_all()'s generic filterable-column path can't do).
     *
     * @param array{search?: string, date_from?: string, date_to?: string, page?: int, per_page?: int} $args
     * @return array{data: array<int, array<string, mixed>>, total: int}
     */
    public function get_conversations( array $args ): array {
        global $wpdb;
        $table = $this->get_table();

        $page     = max( 1, (int) ( $args['page'] ?? 1 ) );
        $per_page = max( 1, min( 100, (int) ( $args['per_page'] ?? 20 ) ) );
        $offset   = ( $page - 1 ) * $per_page;

        $placeholders = implode( ', ', array_fill( 0, count( self::CHAT_SURFACES ), '%s' ) );
        $where        = "WHERE surface IN ({$placeholders})";
        $values       = self::CHAT_SURFACES;

        if ( ! empty( $args['search'] ) ) {
            $where   .= ' AND (prompt_excerpt LIKE %s OR response_excerpt LIKE %s)';
            $like     = '%' . $wpdb->esc_like( (string) $args['search'] ) . '%';
            $values[] = $like;
            $values[] = $like;
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
     * Real conversation count for History's "Conversations" filter pill -
     * same CHAT_SURFACES scope as get_conversations() above.
     *
     * @return int
     */
    public function get_conversation_count(): int {
        global $wpdb;

        $placeholders = implode( ', ', array_fill( 0, count( self::CHAT_SURFACES ), '%s' ) );

        return (int) $wpdb->get_var(
            $wpdb->prepare( "SELECT COUNT(*) FROM {$this->get_table()} WHERE surface IN ({$placeholders})", ...self::CHAT_SURFACES ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- placeholder count matches CHAT_SURFACES' size, a fixed private const.
        );
    }

    /**
     * Distinct providers actually present in the table, with call counts -
     * backs the AI Assistant History table's "Provider" filter dropdown
     * with real values (e.g. 'groq') instead of a fixed guess, the same
     * `count_by_column()` pattern get_status_counts() above already uses.
     * Unlike that method, this has no fixed zero-filled shape - the set of
     * providers is whatever's actually been called, not a known-in-advance
     * enum.
     *
     * @return array<string, int> provider => call count.
     */
    public function get_provider_counts(): array {
        return $this->count_by_column( 'provider' );
    }

    /**
     * Call counts and cost broken down per provider for one date range -
     * what the report's "by provider" section table reads.
     *
     * @param string $period_start Y-m-d, inclusive.
     * @param string $period_end   Y-m-d, inclusive.
     * @return array<int, array{provider: string, calls: int, total_cost: float}>
     */
    public function get_breakdown_by_provider_for_period( string $period_start, string $period_end ): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT provider, COUNT(*) AS calls, COALESCE(SUM(cost_estimate), 0) AS total_cost
                 FROM {$this->get_table()} WHERE DATE(created_at) BETWEEN %s AND %s
                 GROUP BY provider ORDER BY calls DESC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            ),
            ARRAY_A
        );

        return array_map(
            static fn( array $row ): array => array(
                'provider'   => $row['provider'],
                'calls'      => (int) $row['calls'],
                'total_cost' => (float) $row['total_cost'],
            ),
            $rows ?: array()
        );
    }
}

/**
 * Persistence for vulopilot_automations (DATABASE.md).
 *
 * @class       AutomationsRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AutomationsRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'status', 'category' );

    /**
     * @var string[]
     */
    protected array $searchable_columns = array( 'name' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'automations';
    }

    /**
     * @return int Count of currently enabled automations - what the
     *             dashboard's "active automations" stat card reads.
     */
    public function count_enabled(): int {
        global $wpdb;

        return (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$this->get_table()} WHERE status = 'enabled'" // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        );
    }

    /**
     * Enabled/disabled/draft counts, zero-filled - backs both the
     * "Automation Status" dashboard widget and the Automations table's
     * status-count pill bar ("Active"/"Paused"/"Drafts" - Automations'
     * own filter chips read 'enabled'/'disabled'/'draft' by these exact
     * keys). Delegates the actual grouped query to
     * AbstractRepository::count_by_column() rather than running its own
     * SQL (database.md: prefer one query over several, and don't duplicate
     * query-building logic that already exists).
     *
     * @return array{enabled: int, disabled: int, draft: int}
     */
    public function get_status_counts(): array {
        return array_merge(
            array(
                'enabled'  => 0,
                'disabled' => 0,
                'draft'    => 0,
            ),
            $this->count_by_column( 'status' )
        );
    }

    /**
     * Looks up a system-seeded automation by a stable marker embedded in
     * its own `trigger_config` JSON (`{"system_default": "<marker>"}`)
     * rather than by `name` - added specifically for
     * vulopilot-pro's WebsiteHealthScanScheduler, whose seeding logic must
     * stay idempotent (never insert a second "Website Health - Daily
     * Scan" row) even after an administrator has renamed the automation,
     * which a name-based lookup would miss. A plain LIKE match on the raw
     * JSON column, same pragmatic shape FindingRepository::
     * find_open_duplicate() already uses for its own natural-key lookup
     * that doesn't justify a dedicated indexed column.
     *
     * @param string $marker The exact `system_default` value to look for.
     * @return array<string, mixed>|null
     */
    public function find_by_system_default_marker( string $marker ): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$this->get_table()} WHERE trigger_config LIKE %s ORDER BY id ASC LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                '%"system_default":"' . $wpdb->esc_like( $marker ) . '"%'
            ),
            ARRAY_A
        );

        return $row ?: null;
    }
}

/**
 * Persistence for vulopilot_automations_runs (DATABASE.md) - one row per
 * time AutomationEngine ran (or attempted to run) an automation's actions.
 * `result_log` stores the JSON-encoded array of
 * VuloPilot\ValueObjects\AutomationsRunResult::to_array() entries, one
 * per action executed. `status` is one of 'running'/'completed'/'failed'
 * (AutomationEngine\AutomationEngine::run_automation()) - get_stats_for_period()
 * groups by whatever's actually there, but get_breakdown_by_automation_for_period()'s
 * own SQL below hardcodes those two exact strings, so a new status value
 * introduced without updating both places would silently undercount here.
 *
 * @class       AutomationsRunRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AutomationsRunRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'automation_id', 'status', 'triggered_by' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'automations_run';
    }

    /**
     * Run/success/failure counts for one date range - what
     * Reports\Types\AutomationsReport's headline summary reads.
     *
     * @param string $period_start Y-m-d, inclusive.
     * @param string $period_end   Y-m-d, inclusive.
     * @return array{total: int, by_status: array<string, int>}
     */
    public function get_stats_for_period( string $period_start, string $period_end ): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT status, COUNT(*) AS total FROM {$this->get_table()} WHERE DATE(created_at) BETWEEN %s AND %s GROUP BY status", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            ),
            ARRAY_A
        );

        $by_status = array();

        foreach ( (array) $rows as $row ) {
            $by_status[ $row['status'] ] = (int) $row['total'];
        }

        return array(
            'total'     => array_sum( $by_status ),
            'by_status' => $by_status,
        );
    }

    /**
     * Sum of the already-persisted per-run `actions_executed`/`actions_failed`/
     * `changes_made` counters over one date range - same shape/reasoning as
     * get_stats_for_period() above, backing AutomationDashboardRest.php's
     * `period`-aware response. `changes_made` is always <= `executed` (see
     * AutomationEngine::execute_actions()) - a real, distinct count of how
     * many of those executed actions actually changed something on the
     * site, per ActionInterface::changes_site_state().
     *
     * @param string $period_start Y-m-d, inclusive.
     * @param string $period_end   Y-m-d, inclusive.
     * @return array{executed: int, failed: int, changes_made: int}
     */
    public function get_action_totals_for_period( string $period_start, string $period_end ): array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT COALESCE(SUM(actions_executed), 0) AS executed, COALESCE(SUM(actions_failed), 0) AS failed, COALESCE(SUM(changes_made), 0) AS changes_made FROM {$this->get_table()} WHERE DATE(created_at) BETWEEN %s AND %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            ),
            ARRAY_A
        );

        return array(
            'executed'     => (int) ( $row['executed'] ?? 0 ),
            'failed'       => (int) ( $row['failed'] ?? 0 ),
            'changes_made' => (int) ( $row['changes_made'] ?? 0 ),
        );
    }

    /**
     * Real per-action-type success counts for one date range - "N alerts
     * sent" (`create-notification`) / "N reports delivered" (`send-email`)
     * on the "Automate Work" page's own "This month" card. `result_log`
     * (JSON array of `{success, action_id, message}`, this class's own
     * docblock) has no dedicated column per action type, so this reads and
     * decodes it per matching run rather than a single aggregate SQL query
     * - the same real per-action `action_id` `AutomationLogsPanel.tsx`'s
     * own "View details" expansion already surfaces, just tallied instead
     * of listed. Counts successful entries only - a failed send-email
     * attempt wasn't actually "delivered".
     *
     * @param string $period_start Y-m-d, inclusive.
     * @param string $period_end   Y-m-d, inclusive.
     * @return array<string, int> Real action id => successful-execution count.
     */
    public function get_action_type_totals_for_period( string $period_start, string $period_end ): array {
        global $wpdb;

        $logs = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT result_log FROM {$this->get_table()} WHERE DATE(created_at) BETWEEN %s AND %s AND result_log IS NOT NULL", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            )
        );

        $totals = array();

        foreach ( $logs as $log ) {
            $entries = json_decode( (string) $log, true );

            if ( ! is_array( $entries ) ) {
                continue;
            }

            foreach ( $entries as $entry ) {
                if ( ! is_array( $entry ) || empty( $entry['success'] ) || empty( $entry['action_id'] ) ) {
                    continue;
                }

                $action_id            = (string) $entry['action_id'];
                $totals[ $action_id ] = ( $totals[ $action_id ] ?? 0 ) + 1;
            }
        }

        return $totals;
    }

    /**
     * The single most recent run per automation, for however many of
     * `$automation_ids` actually have one - backs the "Automations" tab's
     * table ("Last run" column: real finished_at + a real
     * succeeded/failed/actions-taken outcome, not a placeholder). One query
     * (a self-join against each automation's own MAX(started_at)) rather
     * than N+1 per-row lookups (performance.md), same shape
     * get_breakdown_by_automation_for_period() above already uses for a
     * batch automation_id lookup.
     *
     * @param int[] $automation_ids Real automation ids to look up; empty returns empty.
     * @return array<int, array{status: string, actions_executed: int, actions_failed: int, changes_made: int, started_at: string, finished_at: string|null}> Keyed by automation_id.
     */
    public function get_latest_by_automation_ids( array $automation_ids ): array {
        global $wpdb;

        $automation_ids = array_values( array_filter( array_map( 'absint', $automation_ids ) ) );

        if ( empty( $automation_ids ) ) {
            return array();
        }

        $placeholders = implode( ',', array_fill( 0, count( $automation_ids ), '%d' ) );

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT r.automation_id, r.status, r.actions_executed, r.actions_failed, r.changes_made, r.started_at, r.finished_at
                 FROM {$this->get_table()} r
                 INNER JOIN (
                     SELECT automation_id, MAX(started_at) AS max_started
                     FROM {$this->get_table()}
                     WHERE automation_id IN ({$placeholders})
                     GROUP BY automation_id
                 ) latest ON latest.automation_id = r.automation_id AND latest.max_started = r.started_at", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
                $automation_ids
            ),
            ARRAY_A
        );

        $by_automation_id = array();

        // A tie on started_at (two runs the same second) would return two
        // rows for one automation_id - keep the first and skip the rest
        // rather than letting the later one silently win, same defensive
        // shape a GROUP BY-then-join pattern always needs.
        foreach ( (array) $rows as $row ) {
            $automation_id = (int) $row['automation_id'];

            if ( isset( $by_automation_id[ $automation_id ] ) ) {
                continue;
            }

            $by_automation_id[ $automation_id ] = array(
                'status'           => (string) $row['status'],
                'actions_executed' => (int) $row['actions_executed'],
                'actions_failed'   => (int) $row['actions_failed'],
                'changes_made'     => (int) $row['changes_made'],
                'started_at'       => (string) $row['started_at'],
                'finished_at'      => $row['finished_at'] ?: null,
            );
        }

        return $by_automation_id;
    }

    /**
     * Real count of automation runs that failed to complete since a given
     * timestamp - backs "Commerce"'s "Store Automation" category card
     * (StoreReadiness.php) and its own "N automatic tasks failed" number.
     * Same single-status-count shape as get_stats_for_period()'s own
     * `by_status['failed']`, just windowed by a timestamp instead of a
     * Y-m-d date range (the caller wants "recently," not a report period).
     *
     * @param string $since_mysql_datetime 'Y-m-d H:i:s', inclusive.
     * @return int
     */
    public function get_failed_count_since( string $since_mysql_datetime ): int {
        global $wpdb;

        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->get_table()} WHERE status = 'failed' AND created_at >= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $since_mysql_datetime
            )
        );
    }

    /**
     * The single most recent real run across every automation - what the
     * "Automate Work" hero card's own real "Last check" stat reads (see
     * AutomationDashboardRest::get_items()'s own `last_check_at`), not a
     * per-automation lookup like get_latest_by_automation_ids().
     *
     * @return string|null 'Y-m-d H:i:s', or null if no automation has ever run.
     */
    public function get_most_recent_finished_at(): ?string {
        global $wpdb;

        $value = $wpdb->get_var(
            "SELECT MAX(finished_at) FROM {$this->get_table()} WHERE finished_at IS NOT NULL" // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        );

        return $value ?: null;
    }

    /**
     * Per-automation run counts for one date range, joined against
     * `vulopilot_automations` for the display name - what the report's
     * "automations" section table reads, one query instead of an N+1 name
     * lookup per row (performance.md).
     *
     * @param string $period_start Y-m-d, inclusive.
     * @param string $period_end   Y-m-d, inclusive.
     * @return array<int, array{automation_id: int, name: string, runs: int, succeeded: int, failed: int}>
     */
    public function get_breakdown_by_automation_for_period( string $period_start, string $period_end ): array {
        global $wpdb;

        $automations_table = $wpdb->prefix . Utill::TABLES['automations'];

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT r.automation_id AS automation_id, a.name AS name,
                        COUNT(*) AS runs,
                        SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) AS succeeded,
                        SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) AS failed
                 FROM {$this->get_table()} r
                 LEFT JOIN {$automations_table} a ON a.id = r.automation_id
                 WHERE DATE(r.created_at) BETWEEN %s AND %s
                 GROUP BY r.automation_id, a.name
                 ORDER BY runs DESC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            ),
            ARRAY_A
        );

        return array_map(
            static fn( array $row ): array => array(
                'automation_id' => (int) $row['automation_id'],
                'name'          => $row['name'] ?? __( 'Deleted automation', 'vulopilot' ),
                'runs'          => (int) $row['runs'],
                'succeeded'     => (int) $row['succeeded'],
                'failed'        => (int) $row['failed'],
            ),
            $rows ?: array()
        );
    }
}

/**
 * Persistence for `vulopilot_backups` (DATABASE.md) -
 * Services\BackupManager/BackupScheduler's own real backup-run log, backing
 * "Backups"/"Recovery", `RestAPI\Controllers\Backups`, and
 * Scanners\Basic\BackupHealthScanner's Finding rows.
 *
 * @class       BackupRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BackupRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'status', 'trigger_type' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'backup';
    }

    /**
     * The single most recent backup row of any status -
     * Scanners\Basic\BackupHealthScanner's own "is the latest run healthy"
     * check.
     *
     * @return array<string, mixed>|null
     */
    public function get_latest(): ?array {
        global $wpdb;

        $row = $wpdb->get_row( "SELECT * FROM {$this->get_table()} ORDER BY id DESC LIMIT 1", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $row ?: null;
    }

    /**
     * The single most recent successfully-completed backup row -
     * BackupManager's own "how stale is the last good backup" check and the
     * safety snapshot Recovery always takes before a real restore looks for
     * its own most recent successful predecessor.
     *
     * @return array<string, mixed>|null
     */
    public function get_latest_completed(): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE status = %s ORDER BY id DESC LIMIT 1", 'completed' ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ARRAY_A
        );

        return $row ?: null;
    }

    /**
     * Every completed backup row beyond the newest `$keep_count` -
     * BackupManager's own retention cleanup after each successful run.
     * Ordered oldest-first so the caller can delete file+row together
     * without a second query.
     *
     * @param int $keep_count Real, current `backup_retention_count` setting value.
     * @return array<int, array<string, mixed>>
     */
    public function get_completed_beyond_retention( int $keep_count ): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$this->get_table()} WHERE status = %s ORDER BY id DESC LIMIT 1000 OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                'completed',
                max( 0, $keep_count )
            ),
            ARRAY_A
        );

        return $rows ?: array();
    }
}

/**
 * Persistence for `vulopilot_performance_samples` (type `vital`) - one row per real front-end
 * pageview that reported at least one metric, written by
 * Services\CoreWebVitalsBeacon's public REST endpoint. `get_p75_summary()`
 * computes the 75th percentile in PHP (over a bounded recent sample)
 * rather than relying on MySQL/MariaDB window-function `PERCENTILE_CONT`,
 * which isn't reliably available across this codebase's supported DB
 * range - the same real percentile CrUX/Google's own Core Web Vitals
 * methodology uses. `page_load_ms`/`transfer_bytes` use this exact same
 * p75 method, not a separate average - one consistent "typical real
 * visitor" statistic across every metric this table stores.
 *
 * @class       CoreWebVitalsRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CoreWebVitalsRepository extends AbstractRepository {

    /**
     * This repository's `sample_type` in the shared `vulopilot_performance_samples` table.
     */
    private const SAMPLE_TYPE = 'vital';

    /**
     * How many of the most recent (within the retention window) samples
     * to pull for the p75 computation - bounded so a high-traffic site's
     * PHP-side sort() stays cheap.
     */
    private const MAX_SAMPLES = 1000;

    /**
     * Utill::TABLES key this repository owns.
     *
     * @inheritDoc
     */
    /**
     * @inheritDoc
     */
    public function insert( array $data ): int {
        $data['sample_type'] = self::SAMPLE_TYPE;

        return parent::insert( $data );
    }

    protected function get_table_key(): string {
        return 'performance_sample';
    }

    /**
     * @param int|null $lcp_ms          Milliseconds, or null if the browser never reported one.
     * @param int|null $cls_thousandths CLS ×1000, or null.
     * @param int|null $inp_ms          Milliseconds, or null.
     * @param int|null $page_load_ms    Milliseconds (real Navigation Timing `loadEventEnd`), or null if the `load` event hadn't fired before the beacon sent.
     * @param int|null $transfer_bytes  Real summed Navigation+Resource Timing `transferSize`, or null if unsupported.
     * @return void
     */
    public function record( ?int $lcp_ms, ?int $cls_thousandths, ?int $inp_ms, ?int $page_load_ms = null, ?int $transfer_bytes = null ): void {
        $this->insert(
            array(
                'lcp_ms'          => $lcp_ms,
                'cls_thousandths' => $cls_thousandths,
                'inp_ms'          => $inp_ms,
                'page_load_ms'    => $page_load_ms,
                'transfer_bytes'  => $transfer_bytes,
            )
        );
    }

    /**
     * @return array{lcp_ms: int|null, cls: float|null, inp_ms: int|null, page_load_ms: int|null, transfer_bytes: int|null, sample_count: int}
     */
    public function get_p75_summary(): array {
        global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT lcp_ms, cls_thousandths, inp_ms, page_load_ms, transfer_bytes FROM {$this->get_table()} WHERE sample_type = %s ORDER BY created_at DESC LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::SAMPLE_TYPE,
                self::MAX_SAMPLES
            ),
            ARRAY_A
        );

        $rows = (array) $rows;

        return array(
            'lcp_ms'         => $this->percentile_75( array_column( $rows, 'lcp_ms' ) ),
            'cls'            => $this->percentile_75_cls( array_column( $rows, 'cls_thousandths' ) ),
            'inp_ms'         => $this->percentile_75( array_column( $rows, 'inp_ms' ) ),
            'page_load_ms'   => $this->percentile_75( array_column( $rows, 'page_load_ms' ) ),
            'transfer_bytes' => $this->percentile_75( array_column( $rows, 'transfer_bytes' ) ),
            'sample_count'   => count( $rows ),
        );
    }

    /**
     * @param array<int, string|null> $values Raw column values, possibly containing nulls.
     * @return int|null
     */
    private function percentile_75( array $values ): ?int {
        $numeric = array_values( array_filter( array_map( 'intval', array_filter( $values, 'is_numeric' ) ), fn( $v ) => $v >= 0 ) );

        if ( empty( $numeric ) ) {
            return null;
        }

        sort( $numeric );
        $index = max( 0, (int) ceil( 0.75 * count( $numeric ) ) - 1 );

        return $numeric[ $index ];
    }

    /**
     * Same percentile logic as percentile_75(), converting the stored
     * ×1000 integer back to a real CLS float (e.g. 80 → 0.08).
     *
     * @param array<int, string|null> $values Raw `cls_thousandths` column values.
     * @return float|null
     */
    private function percentile_75_cls( array $values ): ?float {
        $thousandths = $this->percentile_75( $values );

        return null !== $thousandths ? round( $thousandths / 1000, 3 ) : null;
    }

    /**
     * @param int $days Retention window, in days.
     * @return void
     */
    public function delete_older_than( int $days ): void {
        global $wpdb;

        $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "DELETE FROM {$this->get_table()} WHERE sample_type = %s AND created_at < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::SAMPLE_TYPE,
                gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS )
            )
        );
    }
}

/**
 * Persistence for vulopilot_crawler_visits (AI Crawler Traffic Monitoring,
 * readme.txt). `find_all()`/pagination is entirely inherited from
 * AbstractRepository - this only adds the aggregate reads the Crawler
 * Traffic page's summary section needs (bot counts, last-seen timestamps,
 * most-crawled pages, daily volume), the same "repository adds its own
 * query methods beyond the generic CRUD base" pattern
 * SiteHealthSnapshotRepository (vulopilot-pro) already uses.
 *
 * @class       CrawlerVisitRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CrawlerVisitRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'bot_name' );

    /**
     * @var string[]
     */
    protected array $searchable_columns = array( 'requested_url' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'crawler_visit';
    }

    /**
     * Records one detected bot visit - no IP address, user id, or any
     * other visitor-identifying data is ever stored (readme.txt's FAQ:
     * "It does not track human visitors, IP addresses, or personal data.").
     *
     * @param string $bot_name      Display name of the matched bot (CrawlerTrafficLogger::BOT_SIGNATURES value).
     * @param string $user_agent    The raw User-Agent header that matched.
     * @param string $requested_url The requested path.
     * @param bool   $is_404        Whether WordPress resolved this exact request to a 404 (`is_404()` at
     *                              `template_redirect` time, the same hook this is logged from) - AI Crawler
     *                              Alerts' "access limited" check reads this back via get_404_rate_for_bot().
     * @return int Inserted row id.
     */
    public function log( string $bot_name, string $user_agent, string $requested_url, bool $is_404 = false ): int {
        return $this->insert(
            array(
                'bot_name'      => $bot_name,
                'user_agent'    => $user_agent,
                'requested_url' => $requested_url,
                'is_404'        => $is_404 ? 1 : 0,
            )
        );
    }

    /**
     * Visit counts per bot - backs the Crawler Traffic page's filter-pill
     * bar, same "reuse count_by_column()" pattern
     * ActivityLogRepository::get_actor_type_counts() already uses.
     *
     * @return array<string, int>
     */
    public function get_bot_counts(): array {
        return $this->count_by_column( 'bot_name' );
    }

    /**
     * Most recent visit timestamp per bot - readme.txt's "Last-Seen
     * Timestamps." Still backs `GET /crawler-traffic/summary`, and
     * `get_period_comparison()` above also folds this same real value into
     * each of its own `top_crawlers` rows (that table's own "Last seen"
     * column, per direct instruction to merge the two).
     *
     * @return array<int, array{bot_name: string, last_seen_at: string}>
     */
    public function get_bot_last_seen(): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            "SELECT bot_name, MAX(created_at) AS last_seen_at FROM {$this->get_table()} GROUP BY bot_name ORDER BY last_seen_at DESC", // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            ARRAY_A
        );

        return $rows ?: array();
    }

    /**
     * Most-requested URLs across every bot - readme.txt's "Most-Crawled
     * Pages."
     *
     * @param int $limit Max rows to return.
     * @return array<int, array{requested_url: string, total: int}>
     */
    public function get_most_crawled_pages( int $limit = 10 ): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT requested_url, COUNT(*) AS total FROM {$this->get_table()} GROUP BY requested_url ORDER BY total DESC LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                max( 1, $limit )
            ),
            ARRAY_A
        );

        return $rows ?: array();
    }

    /**
     * Visit counts per calendar day over a trailing window, zero-filled for
     * days with no visits - readme.txt's "Crawl Volume Trend Over Time."
     * Zero-filling follows the same care FindingRepository::get_status_counts()
     * already takes, so a trend chart never shows a misleading gap.
     *
     * @param int $days Trailing window size.
     * @return array<int, array{date: string, total: int}> Oldest first.
     */
    public function get_daily_volume( int $days = 30 ): array {
        global $wpdb;

        $days = max( 1, $days );

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT DATE(created_at) AS visit_date, COUNT(*) AS total FROM {$this->get_table()} WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %d DAY) GROUP BY visit_date", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $days
            ),
            ARRAY_A
        );

        $counts_by_date = array();
        foreach ( (array) $rows as $row ) {
            $counts_by_date[ $row['visit_date'] ] = (int) $row['total'];
        }

        $volume = array();
        for ( $offset = $days - 1; $offset >= 0; $offset-- ) {
            $date     = gmdate( 'Y-m-d', strtotime( "-{$offset} days" ) );
            $volume[] = array(
                'date'  => $date,
                'total' => $counts_by_date[ $date ] ?? 0,
            );
        }

        return $volume;
    }

    /**
     * Per-bot visit counts per calendar day over a trailing window, zero-
     * filled the same way get_daily_volume() already is - backs
     * vulopilot-pro's "Historical Crawl Trends" (AI-CRAWLER-ANALYTICS-MODULE.md),
     * which needs a per-bot breakdown get_daily_volume() itself doesn't
     * return. Lives here (Free's own repository) rather than in Pro, same
     * "Free owns the table + its query methods, Pro decides which ones its
     * UI calls" posture FindingRepository::get_severity_breakdown_for_scanner_ids()
     * already established for a method added for a later Pro consumer.
     *
     * @param int $days Trailing window size.
     * @return array<string, array<int, array{date: string, total: int}>> Bot name => daily volume, oldest first.
     */
    public function get_daily_volume_by_bot( int $days = 30 ): array {
        global $wpdb;

        $days = max( 1, $days );

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT bot_name, DATE(created_at) AS visit_date, COUNT(*) AS total FROM {$this->get_table()} WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %d DAY) GROUP BY bot_name, visit_date", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $days
            ),
            ARRAY_A
        );

        $counts_by_bot = array();
        foreach ( (array) $rows as $row ) {
            $counts_by_bot[ $row['bot_name'] ][ $row['visit_date'] ] = (int) $row['total'];
        }

        $volume_by_bot = array();
        foreach ( $counts_by_bot as $bot_name => $counts_by_date ) {
            $volume = array();
            for ( $offset = $days - 1; $offset >= 0; $offset-- ) {
                $date     = gmdate( 'Y-m-d', strtotime( "-{$offset} days" ) );
                $volume[] = array(
                    'date'  => $date,
                    'total' => $counts_by_date[ $date ] ?? 0,
                );
            }
            $volume_by_bot[ $bot_name ] = $volume;
        }

        return $volume_by_bot;
    }

    /**
     * Aggregate stats for a fixed date range - backs vulopilot-pro's "Crawl
     * Reports" (Reports\Types\CrawlReport there), same "generate() only
     * ever reads plain SQL, never calls out to anything" rule
     * AiVisibilityReport's own docblock documents, applied to crawler-visit
     * data instead of findings.
     *
     * @param string $period_start Y-m-d, inclusive.
     * @param string $period_end   Y-m-d, inclusive.
     * @return array{total: int, by_bot: array<string, int>, top_pages: array<int, array{requested_url: string, total: int}>}
     */
    public function get_stats_for_period( string $period_start, string $period_end ): array {
        global $wpdb;

        $total = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->get_table()} WHERE created_at >= %s AND created_at < DATE_ADD(%s, INTERVAL 1 DAY)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            )
        );

        $bot_rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT bot_name, COUNT(*) AS total FROM {$this->get_table()} WHERE created_at >= %s AND created_at < DATE_ADD(%s, INTERVAL 1 DAY) GROUP BY bot_name", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            ),
            ARRAY_A
        );

        $by_bot = array();
        foreach ( (array) $bot_rows as $row ) {
            $by_bot[ $row['bot_name'] ] = (int) $row['total'];
        }

        $top_pages = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT requested_url, COUNT(*) AS total FROM {$this->get_table()} WHERE created_at >= %s AND created_at < DATE_ADD(%s, INTERVAL 1 DAY) GROUP BY requested_url ORDER BY total DESC LIMIT 10", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            ),
            ARRAY_A
        );

        return array(
            'total'     => $total,
            'by_bot'    => $by_bot,
            'top_pages' => $top_pages ?: array(),
        );
    }

    /**
     * Current-vs-previous-period comparison - backs the Crawler Traffic
     * tab's own restyled "at a glance" stat row (total requests, unique
     * crawlers, blocked-pages count lives in the finding table instead -
     * see CrawlerTraffic.php's own `get_analytics()`), "Top Crawlers"
     * table, and "Most-Crawled Pages" table, each with a real %-change
     * figure against the immediately preceding period of equal length -
     * same real-comparison shape `get_stats_for_period()` already provides
     * for one period, computed twice here (current window, then the window
     * immediately before it) so every number on screen is a real count, not
     * a guess.
     *
     * @param int $days Trailing window size (also the length of the "previous" comparison window).
     * @return array{
     *     current_total: int,
     *     previous_total: int,
     *     current_unique_bots: int,
     *     previous_unique_bots: int,
     *     top_crawlers: array<int, array{bot_name: string, total: int, previous_total: int, last_seen_at: string|null}>,
     *     most_crawled_pages: array<int, array{requested_url: string, total: int, previous_total: int}>,
     * }
     */
    public function get_period_comparison( int $days = 30 ): array {
        global $wpdb;

        $days = max( 1, $days );

        $current_start  = gmdate( 'Y-m-d', strtotime( '-' . ( $days - 1 ) . ' days' ) );
        $previous_start = gmdate( 'Y-m-d', strtotime( '-' . ( 2 * $days - 1 ) . ' days' ) );
        $previous_end   = gmdate( 'Y-m-d', strtotime( '-' . $days . ' days' ) );

        $current  = $this->get_stats_for_period( $current_start, gmdate( 'Y-m-d' ) );
        $previous = $this->get_stats_for_period( $previous_start, $previous_end );

        // Same real `MAX(created_at)` per bot get_bot_last_seen() already
        // computes for the summary endpoint's own "Last seen" tiles - reused
        // here (not a second query shape) so Top Crawlers' own "Last seen"
        // column (direct instruction: "merge top crawlers and last seen
        // section add a column in top crawlers last seen") is the exact same
        // real timestamp, not a re-derived one that could disagree.
        $last_seen_by_bot = array();
        foreach ( $this->get_bot_last_seen() as $row ) {
            $last_seen_by_bot[ $row['bot_name'] ] = $row['last_seen_at'];
        }

        $bot_names = array_unique( array_merge( array_keys( $current['by_bot'] ), array_keys( $previous['by_bot'] ) ) );
        $top_crawlers = array();
        foreach ( $bot_names as $bot_name ) {
            $top_crawlers[] = array(
                'bot_name'       => $bot_name,
                'total'          => $current['by_bot'][ $bot_name ] ?? 0,
                'previous_total' => $previous['by_bot'][ $bot_name ] ?? 0,
                'last_seen_at'   => $last_seen_by_bot[ $bot_name ] ?? null,
            );
        }
        usort( $top_crawlers, static fn( $a, $b ) => $b['total'] <=> $a['total'] );

        $page_urls = array_column( $current['top_pages'], 'requested_url' );
        $previous_page_counts = array();
        if ( $page_urls ) {
            $placeholders          = implode( ',', array_fill( 0, count( $page_urls ), '%s' ) );
            $previous_page_rows    = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT requested_url, COUNT(*) AS total FROM {$this->get_table()} WHERE created_at >= %s AND created_at < DATE_ADD(%s, INTERVAL 1 DAY) AND requested_url IN ({$placeholders}) GROUP BY requested_url", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
                    array_merge( array( $previous_start, $previous_end ), $page_urls )
                ),
                ARRAY_A
            );
            foreach ( (array) $previous_page_rows as $row ) {
                $previous_page_counts[ $row['requested_url'] ] = (int) $row['total'];
            }
        }

        $most_crawled_pages = array_map(
            static fn( $page ) => array(
                'requested_url'  => $page['requested_url'],
                'total'          => (int) $page['total'],
                'previous_total' => $previous_page_counts[ $page['requested_url'] ] ?? 0,
            ),
            $current['top_pages']
        );

        return array(
            'current_total'        => $current['total'],
            'previous_total'       => $previous['total'],
            'current_unique_bots'  => count( $current['by_bot'] ),
            'previous_unique_bots' => count( $previous['by_bot'] ),
            'top_crawlers'         => $top_crawlers,
            'most_crawled_pages'   => $most_crawled_pages,
        );
    }

    /**
     * 404 rate for one bot's most recent visits - AI Crawler Alerts'
     * "access limited" check. Scoped to the last $recent_n visits (not a
     * time window) so a bot that visits rarely doesn't get judged on a
     * single stale hit from weeks ago, and returns null (not 0) when there
     * aren't yet $min_sample visits to judge from - same "don't flag on
     * too little data" restraint CrawlerAlertMonitor::calculate_volume_drop_percent()
     * already applies (requires 8 full days before computing a drop %).
     *
     * @param string $bot_name  Display name (CrawlerTrafficLogger::BOT_SIGNATURES value).
     * @param int    $recent_n  How many of the bot's most recent visits to look at.
     * @param int    $min_sample Minimum visits required before a rate is considered meaningful.
     * @return array{rate_percent: int, sample_size: int}|null
     */
    public function get_404_rate_for_bot( string $bot_name, int $recent_n = 20, int $min_sample = 5 ): ?array {
        global $wpdb;

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT is_404 FROM {$this->get_table()} WHERE bot_name = %s ORDER BY created_at DESC LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $bot_name,
                max( 1, $recent_n )
            ),
            ARRAY_A
        );

        $sample_size = count( (array) $rows );

        if ( $sample_size < max( 1, $min_sample ) ) {
            return null;
        }

        $not_found = array_sum( array_column( (array) $rows, 'is_404' ) );

        return array(
            'rate_percent' => (int) round( ( $not_found / $sample_size ) * 100 ),
            'sample_size'  => $sample_size,
        );
    }

    /**
     * Every bot name that has ever logged at least one visit - AI Crawler
     * Alerts' "new crawler detected" check diffs this against a stored
     * "already known" list (CrawlerAlertMonitor::find_newly_detected_bots())
     * rather than a time-windowed query, since a bot's very first visit
     * could have happened at any point in this table's retention window.
     *
     * @return string[]
     */
    public function get_all_bot_names_ever_seen(): array {
        global $wpdb;

        $names = $wpdb->get_col( "SELECT DISTINCT bot_name FROM {$this->get_table()}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $names ?: array();
    }

    /**
     * Deletes rows older than $days - the retention/cleanup half of
     * readme.txt's Pro "Historical Logs" line (Services\CrawlerTrafficLogger's
     * daily cron calls this with `apply_filters('vulopilot_crawler_log_retention_days', 30)`).
     *
     * @param int $days Rows with `created_at` older than this many days are deleted.
     * @return int Number of rows deleted.
     */
    public function delete_older_than( int $days ): int {
        global $wpdb;

        $deleted = $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$this->get_table()} WHERE created_at < DATE_SUB(NOW(), INTERVAL %d DAY)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                max( 1, $days )
            )
        );

        return false !== $deleted ? (int) $deleted : 0;
    }
}

/**
 * Persistence for vulopilot_scan_findings (DATABASE.md). category/severity/
 * status are exactly the filters the admin UI's FindingsTable component
 * (Health/SEO/GEO/WooCommerce/Dashboard pages) already sends. object_ref
 * was added in GEO-MODULE.md's pass so GeoAnalysis\GeoAnalyzer can read
 * every 'geo'-category finding already known about one specific post
 * without a bespoke query. object_type was added alongside it so
 * AutomationEngine\Actions\ResolveFindingAction can look up the one open
 * finding a Recommendation actually came from (object_ref alone isn't
 * unique across object types - e.g. post id 12 and attachment id 12).
 *
 * @class       FindingRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FindingRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'category', 'severity', 'status', 'object_type', 'object_ref', 'scanner_id' );

    /**
     * @var string[]
     */
    protected array $searchable_columns = array( 'title', 'description' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'scan_finding';
    }

    /**
     * The already-open finding a fresh re-detection of the exact same
     * problem should refresh instead of duplicating - originally added
     * specifically for BrokenLinksScanner/BrokenImagesScanner, now called
     * for every scanner by default (ScanPersistenceListener::NEVER_DEDUPE_ON_RESCAN's
     * own docblock explains why the allowlist approach was abandoned): a
     * problem that's still present on the next run (daily cron, or a
     * manual "Run scan") re-adds the same
     * `scanner_id`/`object_type`/`object_ref`/`title` every time
     * (ScanPersistenceListener's own insert loop had no existence check
     * at all), and any page grouping findings by object then shows one
     * duplicate child row per rescan for the one still-open problem - up
     * to 24 duplicate rows for a single object, confirmed live, before
     * this was generalized. Matches on `title` rather than digging into
     * the JSON `meta` column - every scanner already bakes whatever
     * distinguishes this specific finding into its own title (a URL, a
     * file path, ...), so it's already the natural per-object key without
     * a JSON comparison in SQL. Scoped to `status = 'open'` only - a
     * finding a site owner already resolved/ignored should get a
     * brand-new row if the same problem recurs later, not silently flip a
     * closed one back open.
     *
     * `$object_type`/`$object_ref` are nullable for the purely-sitewide
     * scanners that have no specific object to key on (e.g. `php-warnings`
     * - a PHP notice isn't "about" any one post) - those store SQL `NULL`
     * in both columns (AbstractRepository::insert() passes `null` straight
     * through to `$wpdb->insert()`, which stores a real `NULL`, not the
     * string `''`). A plain `column = %s` comparison is never true against
     * a `NULL` column regardless of what's bound, so matching on `NULL`
     * needs its own `IS NULL` branch rather than reusing the `%s`
     * comparison - confirmed live: without this, `php-warnings` piled up
     * 10 duplicate open rows for the identical warning message before
     * this was added, since every rescan's lookup silently matched
     * nothing and fell through to a fresh insert. `title` alone is still
     * enough of a natural key for most scanners (see this method's own
     * docblock above on why `title` already carries whatever distinguishes
     * one finding from another) - but not all of them: a scanner whose
     * title bakes in a live, scan-to-scan-fluctuating number (a word
     * count, a readability score, a byte size) breaks a plain `title`
     * match the moment that number ticks even slightly, same underlying
     * symptom as the `NULL`-object case above (confirmed live:
     * `ThinContentScanner`'s "Thin content (154 words): Sample Page" vs.
     * "Thin content (155 words): Sample Page" on unrelated later runs of
     * the identical page, two permanently-orphaned open rows for one real
     * problem). `$dedupe_key` is that scanner's opt-in fix: when a Finding
     * supplies one (Finding::get_dedupe_key()), matching uses it INSTEAD
     * of `title` entirely, so the volatile display text can keep changing
     * every run without ever affecting dedup. When a Finding doesn't
     * supply one (the default, `null`, for every scanner not rewritten to
     * need this), matching falls back to the exact legacy `title = %s`
     * behavior, scoped to rows that themselves have no `dedupe_key` either
     * - so a pre-existing title-matched row and a future dedupe_key-keyed
     * row for the same scanner can never cross-match each other by
     * accident.
     *
     * @param string      $scanner_id  Finding::get_category()'s owning scanner's own get_id().
     * @param string|null $object_type Finding::get_object_type().
     * @param string|null $object_ref  Finding::get_object_ref().
     * @param string      $title       Finding::get_title().
     * @param string|null $dedupe_key  Finding::get_dedupe_key().
     * @return array<string, mixed>|null
     */
    public function find_open_duplicate( string $scanner_id, ?string $object_type, ?string $object_ref, string $title, ?string $dedupe_key = null ): ?array {
        global $wpdb;

        $conditions = array( "status = 'open'", 'scanner_id = %s' );
        $params     = array( $scanner_id );

        foreach ( array(
            'object_type' => $object_type,
            'object_ref'  => $object_ref,
        ) as $column => $value ) {
            if ( null === $value || '' === $value ) {
                $conditions[] = "{$column} IS NULL";
            } else {
                $conditions[] = "{$column} = %s";
                $params[]     = $value;
            }
        }

        if ( null !== $dedupe_key ) {
            $conditions[] = 'dedupe_key = %s';
            $params[]     = $dedupe_key;
        } else {
            $conditions[] = 'title = %s';
            $conditions[] = 'dedupe_key IS NULL';
            $params[]     = $title;
        }

        $sql = "SELECT * FROM {$this->get_table()} WHERE " . implode( ' AND ', $conditions ) . ' ORDER BY id DESC LIMIT 1'; // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        $row = $wpdb->get_row( $wpdb->prepare( $sql, $params ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

        return $row ?: null;
    }

    /**
     * Every currently-open row id for one scanner - unpaginated (unlike
     * `find_all()`, which caps at 100 rows), since
     * `ScanPersistenceListener::handle_scan_completed()`'s own real
     * auto-resolve step (see that method's own docblock) needs the
     * complete set to diff against, not a page of it, and a scanner like
     * `broken-links` can legitimately have more than 100 open rows on a
     * large site.
     *
     * @param string $scanner_id Finding::get_category()'s owning scanner's own get_id().
     * @return int[]
     */
    public function get_open_finding_ids_for_scanner( string $scanner_id ): array {
        global $wpdb;

        $ids = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT id FROM {$this->get_table()} WHERE status = 'open' AND scanner_id = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $scanner_id
            )
        );

        return array_map( 'intval', $ids );
    }

    /**
     * Open/resolved/ignored/snoozed counts, zero-filled and optionally
     * scoped to one category and/or one section's scanner_id list - backs
     * the Health/SEO/GEO/WooCommerce findings tables' status-count pill
     * bar, including SEO.tsx's per-section tables (e.g. "Titles & meta"
     * grouping several scanner_id values together, scoped independently of
     * every other SEO section's own pill bar). Delegates to
     * AbstractRepository::count_by_column() rather than hand-rolling
     * another grouped query (same reasoning as AutomationsRepository's
     * get_status_counts()).
     *
     * @param string|null   $category    One of the scanner category strings (SCANNERS.md), or null for every category.
     * @param string[]|null $scanner_ids Scanner ids to scope to (IN-matched), or null for every scanner in $category.
     * @return array{open: int, resolved: int, ignored: int, snoozed: int}
     */
    public function get_status_counts( ?string $category = null, ?array $scanner_ids = null ): array {
        $args = array();

        if ( null !== $category ) {
            $args['category'] = $category;
        }

        if ( null !== $scanner_ids ) {
            $args['scanner_id'] = $scanner_ids;
        }

        return array_merge(
            array(
                'open'     => 0,
                'resolved' => 0,
                'ignored'  => 0,
                'snoozed'  => 0,
            ),
            $this->count_by_column( 'status', $args )
        );
    }

    /**
     * Open findings bucketed into the 3-tier "priority" AI Copilot's
     * "Needs your attention" card shows (mockup: High/Medium/Low pills),
     * collapsed from the real 5-level severity scale rather than a 1:1
     * mapping - critical folds into "high" (nothing is more urgent),
     * info folds into "low" (nothing is less), so no open finding is
     * silently dropped from the total.
     *
     * @return array{high: int, medium: int, low: int}
     */
    public function get_priority_counts(): array {
        $raw = array_merge(
            array(
                'critical' => 0,
                'high'     => 0,
                'medium'   => 0,
                'low'      => 0,
                'info'     => 0,
            ),
            $this->count_by_column( 'severity', array( 'status' => 'open' ) )
        );

        return array(
            'high'   => $raw['critical'] + $raw['high'],
            'medium' => $raw['medium'],
            'low'    => $raw['low'] + $raw['info'],
        );
    }

    /**
     * Same 3-tier Critical+High/Medium/Low collapse as get_priority_counts(),
     * scoped to one scanner_id set instead of the whole site - what a
     * scanner_id-scoped Issues table (the "Schema & Knowledge" tab's own
     * grouped Issues section) needs for its own stat tiles, since
     * get_priority_counts() itself has no scoping parameter (every other
     * caller genuinely wants the sitewide picture regardless of whatever
     * category tab is active - see its own docblock via
     * Controllers/Findings.php's get_finding_groups()).
     *
     * @param string[] $scanner_ids Scanner ids to scope to.
     * @return array{high: int, medium: int, low: int}
     */
    public function get_priority_counts_for_scanner_ids( array $scanner_ids ): array {
        $raw = $this->get_severity_breakdown_for_scanner_ids( $scanner_ids );

        return array(
            'high'   => $raw['critical'] + $raw['high'],
            'medium' => $raw['medium'],
            'low'    => $raw['low'] + $raw['info'],
        );
    }

    /**
     * Groups every currently open finding by its scanner_id and returns
     * the top $limit groups, most-severe-first (ties broken by count) -
     * "Needs your attention"'s list rows read as real per-issue-type
     * counts (e.g. "8 findings: Meta Descriptions") instead of one row
     * per individual per-object finding the way FindingsTable/
     * IssuesList already show elsewhere.
     *
     * Each group's severity/category/object_type come from a sample of
     * open findings (the most recent 100 - find_all()'s own per_page
     * ceiling), not every row: a scanner_id absent from that sample even
     * though count_by_column() knows it has open findings is skipped
     * rather than guessing its severity from nothing, so this can
     * under-report on a site with 100+ distinct open-finding scanner
     * types on the same page - a genuinely rare shape (SCANNERS.md's
     * full catalog is ~65 scanners total, all categories combined).
     *
     * @param int      $limit      Max groups to return.
     * @param string[] $categories Optional real `category` values to scope both the
     *                             per-scanner counts and the representative sample to
     *                             (get_top_finding_group_for_categories() passes this so
     *                             "top 3 sitewide" and "top 1 within this category bucket"
     *                             share one implementation) - empty means sitewide, same as before.
     * @return array<int, array{scanner_id: string, count: int, severity: string, category: string, object_type: ?string}>
     */
    public function get_top_finding_groups( int $limit = 3, array $categories = array() ): array {
        $scope = array( 'status' => 'open' );

        if ( $categories ) {
            $scope['category'] = $categories;
        }

        $counts_by_scanner = $this->count_by_column( 'scanner_id', $scope );

        if ( empty( $counts_by_scanner ) ) {
            return array();
        }

        $sample = $this->find_all(
            array_merge(
                $scope,
                array(
                    'per_page' => 100,
                    'orderby'  => 'id',
                    'order'    => 'desc',
                )
            )
        );

        $severity_rank = array(
            'critical' => 0,
            'high'     => 1,
            'medium'   => 2,
            'low'      => 3,
            'info'     => 4,
        );

        // Worst (most urgent) severity seen per scanner_id in the sample -
        // some scanners (e.g. ProductCompletenessScanner) assign different
        // severities to different findings, so the first row seen isn't
        // reliably representative; the worst one is.
        $representatives = array();

        foreach ( $sample['data'] as $row ) {
            $scanner_id = (string) ( $row['scanner_id'] ?? '' );

            if ( '' === $scanner_id ) {
                continue;
            }

            $existing      = $representatives[ $scanner_id ] ?? null;
            $existing_rank = null !== $existing ? ( $severity_rank[ $existing['severity'] ] ?? 5 ) : 6;
            $row_rank      = $severity_rank[ $row['severity'] ] ?? 5;

            if ( null === $existing || $row_rank < $existing_rank ) {
                $representatives[ $scanner_id ] = $row;
            }
        }

        $groups = array();

        foreach ( $counts_by_scanner as $scanner_id => $count ) {
            $representative = $representatives[ $scanner_id ] ?? null;

            if ( null === $representative ) {
                continue;
            }

            $groups[] = array(
                'scanner_id'  => $scanner_id,
                'count'       => $count,
                'severity'    => $representative['severity'],
                'category'    => $representative['category'],
                'object_type' => $representative['object_type'],
            );
        }

        usort(
            $groups,
            static function ( $a, $b ) use ( $severity_rank ) {
                $rank_a = $severity_rank[ $a['severity'] ] ?? 5;
                $rank_b = $severity_rank[ $b['severity'] ] ?? 5;

                if ( $rank_a !== $rank_b ) {
                    return $rank_a <=> $rank_b;
                }

                return $b['count'] <=> $a['count'];
            }
        );

        return array_slice( $groups, 0, $limit );
    }

    /**
     * The single top open finding-type group within a fixed set of real
     * `category` values - AI Copilot's "Recommended by VuloPilot" card
     * uses this once per bucket (security/performance/ai-visibility) so
     * each bucket gets its own real top issue instead of `get_top_finding_groups()`'s
     * sitewide top 3, which could land two or three cards in the same
     * category and leave another bucket with nothing to show.
     *
     * @param string[] $categories Real category values (e.g. ['security', 'ssl', 'rest-api']).
     * @return array{scanner_id: string, count: int, severity: string, category: string, object_type: ?string}|null
     */
    public function get_top_finding_group_for_categories( array $categories ): ?array {
        $groups = $this->get_top_finding_groups( 1, $categories );

        return $groups[0] ?? null;
    }

    /**
     * Same worst-severity grouping get_finding_groups() computes, scoped to
     * exactly one scanner_id - what AI Copilot chat's "Add context" picker
     * (Controllers\Copilot.php) resolves a user-picked `finding_group`
     * context ref against, so the AI is always grounded with this group's
     * real, current count/severity rather than whatever stale numbers the
     * client had cached when the user picked it.
     *
     * @param string $scanner_id Scanner id to look up.
     * @return array{scanner_id: string, category: string, count: int, severity: string}|null Null if this scanner has no open findings right now.
     */
    public function get_group_by_scanner_id( string $scanner_id ): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT category, COUNT(*) AS count, MIN( CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 WHEN 'info' THEN 4 ELSE 5 END ) AS severity_rank FROM {$this->get_table()} WHERE status = 'open' AND scanner_id = %s GROUP BY category", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $scanner_id
            ),
            ARRAY_A
        );

        if ( ! $row ) {
            return null;
        }

        $severity_by_rank = array(
            0 => 'critical',
            1 => 'high',
            2 => 'medium',
            3 => 'low',
            4 => 'info',
            5 => 'info',
        );

        return array(
            'scanner_id' => $scanner_id,
            'category'   => (string) $row['category'],
            'count'      => (int) $row['count'],
            'severity'   => $severity_by_rank[ (int) $row['severity_rank'] ] ?? 'info',
        );
    }

    /**
     * Open **group** counts per category - i.e. how many distinct
     * (scanner_id, category) rows get_finding_groups() would return for
     * each category, not how many raw findings exist in it. The Issues
     * table renders one row per group, and its `total`/pagination footer
     * are group counts too (get_finding_groups()'s own $total_groups), so
     * the category tab bar must count the same unit its own badge promises
     * - otherwise a tab reading "88" (88 raw findings, e.g. many pages
     * missing the same alt text) can click through to a handful of grouped
     * rows with no pagination, looking broken even though nothing's wrong.
     *
     * @return array<string, int> category => open group count.
     */
    public function get_category_group_counts(): array {
        global $wpdb;
        $table = $this->get_table();

        $rows = $wpdb->get_results( "SELECT category, COUNT(*) AS total FROM ( SELECT scanner_id, category FROM {$table} WHERE status = 'open' GROUP BY scanner_id, category ) grouped GROUP BY category", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared -- $table is code-controlled, no user input in this query.

        $counts = array();

        foreach ( (array) $rows as $row ) {
            $counts[ $row['category'] ] = (int) $row['total'];
        }

        return $counts;
    }

    /**
     * Same grouping as get_top_finding_groups() - every open finding
     * bucketed by scanner_id, worst-severity-first - but paginated and
     * optionally scoped to one category, instead of a fixed top-3 preview.
     * Backs the AI Copilot Issues table (Controllers/Findings.php's
     * `GET /findings/groups`), which needs every group across every page,
     * not just the 3 most urgent.
     *
     * Expressed as one grouped query (MIN() over a severity->rank CASE
     * picks each group's worst severity) rather than get_top_finding_groups()'s
     * own "sample the 100 most recent rows client-side" approach - that
     * approach is fine for a 3-row preview but would under-report on a
     * paginated full list, since a scanner_id's open findings could easily
     * fall entirely outside the most recent 100 rows once pagination goes
     * past the first page.
     *
     * @param array{status?: string, category?: string|string[], scanner_ids?: string[], priority_ranks?: int[], page?: int, per_page?: int} $args Grouping/pagination args - `category` accepts several real category values at once (IN-matched), same reasoning as get_status_counts()'s own `$scanner_ids` param: the Issues table's "SEO & Visibility" tab, for example, folds 4 real category values ('seo'/'images'/'schema'/'links') into one tab. `scanner_ids` (IN-matched, ANDed with `category` when both are given) scopes to an explicit scanner_id set instead - what the "Schema & Knowledge" tab's own grouped Issues section needs, since its 5 real scanners span 3 different categories mixed with many unrelated scanners in those same categories, so `category` alone can't express it. `priority_ranks` filters to groups whose own worst-severity rank (this method's own severity->rank scale, 0=critical..4=info) is one of the given ranks - how the Issues table's High/Medium/Low stat tiles filter the table to match the same priority bucket Controllers/Findings.php maps their click to (same 3-tier collapse get_priority_counts() already uses for the tiles' own counts).
     * @return array{data: array<int, array{scanner_id: string, category: string, count: int, severity: string, object_type: ?string}>, total: int}
     */
    public function get_finding_groups( array $args = array() ): array {
        global $wpdb;
        $table = $this->get_table();

        $status         = ! empty( $args['status'] ) ? (string) $args['status'] : 'open';
        $category       = $args['category'] ?? '';
        $scanner_ids    = ! empty( $args['scanner_ids'] ) ? (array) $args['scanner_ids'] : array();
        $priority_ranks = ! empty( $args['priority_ranks'] ) ? array_map( 'intval', $args['priority_ranks'] ) : array();
        $page           = max( 1, (int) ( $args['page'] ?? 1 ) );
        $per_page       = max( 1, min( 100, (int) ( $args['per_page'] ?? 20 ) ) );
        $offset         = ( $page - 1 ) * $per_page;

        // 'all' is a real, deliberate escape hatch - not a real status
        // value any row ever has - for a caller that wants every real row
        // regardless of status (e.g. a "Show ignored" toggle: real open
        // findings AND real ignored ones together, not one or the other).
        if ( 'all' === $status ) {
            $where  = 'WHERE 1=1';
            $values = array();
        } else {
            $where  = 'WHERE status = %s';
            $values = array( $status );
        }

        if ( is_array( $category ) && $category ) {
            $placeholders = implode( ', ', array_fill( 0, count( $category ), '%s' ) );
            $where       .= " AND category IN ({$placeholders})";
            array_push( $values, ...$category );
        } elseif ( is_string( $category ) && '' !== $category ) {
            $where   .= ' AND category = %s';
            $values[] = $category;
        }

        if ( $scanner_ids ) {
            $scanner_placeholders = implode( ', ', array_fill( 0, count( $scanner_ids ), '%s' ) );
            $where                .= " AND scanner_id IN ({$scanner_placeholders})";
            array_push( $values, ...$scanner_ids );
        }

        // Grouped once, filtered by the group's own worst-severity rank in
        // an outer WHERE against this subquery rather than filtering raw
        // rows by severity before grouping - a scanner_id's `count` must
        // stay every open finding in that group regardless of which
        // priority tile is active, since the mockup's own "22 pages
        // affected" reads as the group's real total, not a subset matching
        // whichever severities happen to satisfy the current filter.
        $group_sql = "SELECT scanner_id, category, COUNT(*) AS count, MAX(object_type) AS object_type, MIN( CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 WHEN 'info' THEN 4 ELSE 5 END ) AS severity_rank FROM {$table} {$where} GROUP BY scanner_id, category"; // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $where's %s count matches $values' size at runtime; this string is only ever passed through $wpdb->prepare() by its two callers below, never queried directly.

        $having = '';

        if ( $priority_ranks ) {
            $rank_placeholders = implode( ', ', array_fill( 0, count( $priority_ranks ), '%d' ) );
            $having            = " WHERE severity_rank IN ({$rank_placeholders})";
        }

        $count_values = array_merge( $values, $priority_ranks );
        $count_sql    = "SELECT COUNT(*) FROM ( {$group_sql} ) grouped{$having}";
        // `$count_values` is genuinely empty only when `$status` is the
        // real 'all' escape hatch above with no category/priority filter
        // either - `$wpdb->prepare()` itself requires at least one real
        // value to bind, so this real no-placeholders-left case runs the
        // query directly instead (every piece of `$count_sql` at that
        // point is code-controlled - `$table`/`$where`/`$having` - not
        // user input, same real precedent this file's own
        // `get_category_group_counts()` already established for a
        // likewise placeholder-free query).
        $total_groups = (int) ( $count_values
            ? $wpdb->get_var( $wpdb->prepare( $count_sql, ...$count_values ) ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $where's/$having's placeholder count matches $values'/$priority_ranks' combined size at runtime.
            : $wpdb->get_var( $count_sql ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.NotPrepared -- no real placeholders left to bind in this branch; see comment above.

        if ( 0 === $total_groups ) {
            return array(
                'data'  => array(),
                'total' => 0,
            );
        }

        $rows = $wpdb->get_results(
            $wpdb->prepare( "SELECT * FROM ( {$group_sql} ) grouped{$having} ORDER BY severity_rank ASC, count DESC LIMIT %d OFFSET %d", ...array_merge( $values, $priority_ranks, array( $per_page, $offset ) ) ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- same runtime-sized-array case as above, plus the trailing LIMIT/OFFSET pair.
            ARRAY_A
        );

        $severity_by_rank = array(
            0 => 'critical',
            1 => 'high',
            2 => 'medium',
            3 => 'low',
            4 => 'info',
            5 => 'info',
        );

        return array(
            'data'  => array_map(
                static function ( array $row ) use ( $severity_by_rank ): array {
                    return array(
                        'scanner_id'  => (string) $row['scanner_id'],
                        'category'    => (string) $row['category'],
                        'count'       => (int) $row['count'],
                        'severity'    => $severity_by_rank[ (int) $row['severity_rank'] ] ?? 'info',
                        'object_type' => '' !== (string) $row['object_type'] ? (string) $row['object_type'] : null,
                    );
                },
                null !== $rows ? $rows : array()
            ),
            'total' => $total_groups,
        );
    }

    /**
     * Counts findings by severity across every scan - what the dashboard's
     * summary cards and site-health scoring read, without pulling every
     * row into PHP to count them (performance.md).
     *
     * @param string $severity One of Severity's constants.
     * @return int
     */
    public function count_by_severity( string $severity ): int {
        global $wpdb;

        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->get_table()} WHERE severity = %s AND status = 'open'", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $severity
            )
        );
    }

    /**
     * Counts open findings in one category - what each domain dashboard
     * widget (SEO/Performance/Security/Accessibility/WooCommerce) reads,
     * same shape as count_by_severity() above.
     *
     * @param string $category One of the scanner category strings (SCANNERS.md).
     * @return int
     */
    public function count_by_category( string $category ): int {
        global $wpdb;

        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->get_table()} WHERE category = %s AND status = 'open'", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $category
            )
        );
    }

    /**
     * Findings first detected on or after $since - the Dashboard's "N new
     * issues this week" badge reads this, counting every finding created
     * in the window regardless of its current status (a finding opened
     * and then immediately resolved this week is still a real "new issue"
     * that appeared this week).
     *
     * @param string $since MySQL datetime (UTC), inclusive.
     * @return int
     */
    public function count_created_since( string $since ): int {
        global $wpdb;

        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->get_table()} WHERE created_at >= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $since
            )
        );
    }

    /**
     * Findings resolved on or after $since - the Dashboard's "N fixed"
     * badge reads this. `resolved_at` is only ever set when a finding's
     * status transitions to 'resolved' (Controllers\Findings::update_item()),
     * so this naturally excludes ignored/snoozed findings.
     *
     * @param string $since MySQL datetime (UTC), inclusive.
     * @return int
     */
    public function count_resolved_since( string $since ): int {
        global $wpdb;

        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->get_table()} WHERE resolved_at >= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $since
            )
        );
    }

    /**
     * Findings resolved within a bounded window, optionally scoped to one
     * category and/or scanner_id list - same "fixed" concept
     * count_resolved_since() already reads for the Dashboard's own badge,
     * but with an upper bound and the same category/scanner_ids scoping
     * get_stats_for_period()/get_top_findings_for_period() already
     * support, for Controllers\ReportsOverview's own period-over-period
     * "Fixed" count.
     *
     * @param string        $period_start MySQL datetime (UTC), inclusive.
     * @param string        $period_end   MySQL datetime (UTC), inclusive.
     * @param string|null   $category     One of the scanner category strings, or null for all.
     * @param string[]|null $scanner_ids  Scanner ids to additionally scope to, or null for every scanner in $category.
     * @return int
     */
    public function count_resolved_between( string $period_start, string $period_end, ?string $category = null, ?array $scanner_ids = null ): int {
        global $wpdb;

        $where  = 'WHERE resolved_at BETWEEN %s AND %s';
        $values = array( $period_start, $period_end );

        if ( null !== $category ) {
            $where   .= ' AND category = %s';
            $values[] = $category;
        }

        if ( null !== $scanner_ids && $scanner_ids ) {
            $where .= ' AND scanner_id IN (' . implode( ', ', array_fill( 0, count( $scanner_ids ), '%s' ) ) . ')';
            array_push( $values, ...$scanner_ids );
        }

        return (int) $wpdb->get_var(
            $wpdb->prepare( "SELECT COUNT(*) FROM {$this->get_table()} {$where}", ...$values ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $where's %s count matches $values' size at runtime.
        );
    }

    /**
     * Open-finding counts by severity within a single category, in one
     * grouped query rather than four count_by_severity()-style calls -
     * this is what Dashboard controller's per-category widget score
     * (SEO/Performance/Security/Accessibility/WooCommerce) is computed
     * from, using the same weighting Overall Health already uses, just
     * scoped down (performance.md: prefer one query over several).
     *
     * @param string $category One of the scanner category strings (SCANNERS.md).
     * @return array{critical: int, high: int, medium: int, low: int}
     */
    public function get_severity_breakdown_for_category( string $category ): array {
        global $wpdb;

        $counts = array_fill_keys( array( 'critical', 'high', 'medium', 'low' ), 0 );

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT severity, COUNT(*) AS total FROM {$this->get_table()} WHERE category = %s AND status = 'open' GROUP BY severity", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $category
            ),
            ARRAY_A
        );

        foreach ( (array) $rows as $row ) {
            if ( array_key_exists( $row['severity'], $counts ) ) {
                $counts[ $row['severity'] ] = (int) $row['total'];
            }
        }

        return $counts;
    }

    /**
     * Same shape as get_severity_breakdown_for_category(), scoped to an
     * explicit scanner_id list instead of one category string - what
     * Content Intelligence's own composite Content Score reads
     * (CONTENT-INTELLIGENCE-MODULE.md), since it spans scanners across two
     * categories (`content`'s own readability scanner plus a subset of
     * `seo`'s existing thin-content/duplicate-content/heading-structure/
     * internal-linking/orphan-pages scanners) - a single category string
     * can't express that, and recategorizing those existing `seo`
     * scanners into `content` would be exactly the kind of breaking
     * redesign this pass avoids (SEO.tsx's own SEO_SECTIONS groups them
     * as `seo` today).
     *
     * @param string[] $scanner_ids Scanner ids to scope to.
     * @return array{critical: int, high: int, medium: int, low: int, info: int}
     */
    public function get_severity_breakdown_for_scanner_ids( array $scanner_ids ): array {
        global $wpdb;

        // Every real Severity value (Severity::all()) - 'info' was missing
        // here until this fix, which silently dropped any info-severity
        // finding among $scanner_ids from every caller's total (this
        // method's own sum, get_priority_counts_for_scanner_ids()'s 'low'
        // bucket, SchemaCoverageAnalyzer's open_problems_total) rather than
        // counting it under 'low' the way get_priority_counts() already
        // does for the sitewide equivalent.
        $counts = array_fill_keys( array( 'critical', 'high', 'medium', 'low', 'info' ), 0 );

        if ( ! $scanner_ids ) {
            return $counts;
        }

        $placeholders = implode( ', ', array_fill( 0, count( $scanner_ids ), '%s' ) );

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT severity, COUNT(*) AS total FROM {$this->get_table()} WHERE scanner_id IN ({$placeholders}) AND status = 'open' GROUP BY severity", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $placeholders' %s count matches $scanner_ids' size at runtime.
                ...$scanner_ids
            ),
            ARRAY_A
        );

        foreach ( (array) $rows as $row ) {
            if ( array_key_exists( $row['severity'], $counts ) ) {
                $counts[ $row['severity'] ] = (int) $row['total'];
            }
        }

        return $counts;
    }

    /**
     * Same shape as get_severity_breakdown_for_category(), but reconstructed
     * as of a past moment instead of counting today's `status = 'open'`
     * rows - what a category score trend needs, since no daily per-category
     * score snapshot exists (only `vulopilot_site_health_snapshots.overall_score`
     * is ever written; see SiteHealthSnapshotRepository in vulopilot-pro).
     * A finding counts as "open as of $as_of" when it already existed
     * (`created_at <= $as_of`) and either is still `status = 'open'` right
     * now, or has a real `resolved_at` timestamp after `$as_of` - NOT a bare
     * `resolved_at IS NULL` check (this method's own original condition,
     * confirmed live to silently over-count: 120 of this table's 192
     * `status = 'resolved'` rows have a `NULL resolved_at` - resolved
     * before `resolved_at` tracking existed/was backfilled, not "still
     * open" - so treating a null timestamp as "not yet resolved" was
     * counting a majority of already-resolved findings as still open in
     * every historical reconstruction). A currently-resolved finding with
     * no real resolved timestamp is instead treated as already resolved by
     * `$as_of` - the honest assumption when the exact moment isn't known,
     * rather than the previous assumption that silently inflated every
     * "as of" score below its real historical value. Currently
     * ignored/snoozed findings stay excluded from both ends (same exclusion
     * get_severity_breakdown_for_category()'s `status = 'open'` filter
     * already applies today) since ignored/snoozed transitions don't carry
     * their own timestamp to reconstruct from.
     *
     * @param string $category One of the scanner category strings (SCANNERS.md).
     * @param string $as_of    MySQL datetime (UTC) to reconstruct the open set as of.
     * @return array{critical: int, high: int, medium: int, low: int}
     */
    public function get_severity_breakdown_for_category_as_of( string $category, string $as_of ): array {
        global $wpdb;

        $counts = array_fill_keys( array( 'critical', 'high', 'medium', 'low' ), 0 );

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT severity, COUNT(*) AS total FROM {$this->get_table()}
                WHERE category = %s AND status != 'ignored' AND status != 'snoozed'
                AND created_at <= %s AND ( status = 'open' OR ( resolved_at IS NOT NULL AND resolved_at > %s ) )
                GROUP BY severity", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $category,
                $as_of,
                $as_of
            ),
            ARRAY_A
        );

        foreach ( (array) $rows as $row ) {
            if ( array_key_exists( $row['severity'], $counts ) ) {
                $counts[ $row['severity'] ] = (int) $row['total'];
            }
        }

        return $counts;
    }

    /**
     * Same "as of a past moment" reconstruction as
     * get_severity_breakdown_for_category_as_of() - including that same
     * method's own fix for `status = 'resolved'` rows with a `NULL
     * resolved_at` (see its docblock) - scoped to an explicit scanner_id
     * list instead - what Content/Brand's composite scores' trend needs,
     * same reasoning as get_severity_breakdown_for_scanner_ids() own
     * docblock for why those two scores can't use a category string.
     *
     * @param string[] $scanner_ids Scanner ids to scope to.
     * @param string   $as_of       MySQL datetime (UTC) to reconstruct the open set as of.
     * @return array{critical: int, high: int, medium: int, low: int}
     */
    public function get_severity_breakdown_for_scanner_ids_as_of( array $scanner_ids, string $as_of ): array {
        global $wpdb;

        $counts = array_fill_keys( array( 'critical', 'high', 'medium', 'low' ), 0 );

        if ( ! $scanner_ids ) {
            return $counts;
        }

        $placeholders = implode( ', ', array_fill( 0, count( $scanner_ids ), '%s' ) );

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT severity, COUNT(*) AS total FROM {$this->get_table()}
                WHERE scanner_id IN ({$placeholders}) AND status != 'ignored' AND status != 'snoozed'
                AND created_at <= %s AND ( status = 'open' OR ( resolved_at IS NOT NULL AND resolved_at > %s ) )
                GROUP BY severity", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $placeholders' %s count matches $scanner_ids' size at runtime.
                ...array_merge( $scanner_ids, array( $as_of, $as_of ) )
            ),
            ARRAY_A
        );

        foreach ( (array) $rows as $row ) {
            if ( array_key_exists( $row['severity'], $counts ) ) {
                $counts[ $row['severity'] ] = (int) $row['total'];
            }
        }

        return $counts;
    }

    /**
     * Every currently-open - or, with `$as_of` set, real
     * historically-reconstructed open-as-of-that-moment (same exact
     * reconstruction `get_severity_breakdown_for_scanner_ids_as_of()`
     * already uses) - finding among `$scanner_ids` that's tied to a real
     * page/post, bucketed by post id. Seo.php's own "Pages that need
     * attention" table needs this to compute a real per-page score/Main
     * Problem/Change without an N+1 query per page.
     * `DuplicateContentScanner`'s own `object_ref` is a comma-joined list of
     * post ids (one finding genuinely spans multiple posts) - split and
     * attached to EACH matching post here, same real handling
     * `seoIssuesShared.tsx`'s own `bucketFindingsByPage()` already does
     * client-side for the current (non-as-of) case.
     *
     * @param string[]    $scanner_ids Scanner ids to scope to.
     * @param string|null $as_of       MySQL datetime (UTC) to reconstruct the open set as of; null for the real current open set.
     * @return array<int, array<int, array{id: int, title: string, severity: string}>> post_id => that post's own open findings.
     */
    public function get_open_findings_for_scanner_ids_by_post( array $scanner_ids, ?string $as_of = null ): array {
        global $wpdb;

        $buckets = array();

        if ( ! $scanner_ids ) {
            return $buckets;
        }

        $placeholders = implode( ', ', array_fill( 0, count( $scanner_ids ), '%s' ) );

        if ( null === $as_of ) {
            $rows = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT id, title, severity, object_ref FROM {$this->get_table()}
                    WHERE scanner_id IN ({$placeholders}) AND status = 'open' AND object_type = 'post'", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $placeholders' %s count matches $scanner_ids' size at runtime.
                    ...$scanner_ids
                ),
                ARRAY_A
            );
        } else {
            $rows = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT id, title, severity, object_ref FROM {$this->get_table()}
                    WHERE scanner_id IN ({$placeholders}) AND object_type = 'post'
                    AND status != 'ignored' AND status != 'snoozed'
                    AND created_at <= %s AND ( status = 'open' OR ( resolved_at IS NOT NULL AND resolved_at > %s ) )", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $placeholders' %s count matches $scanner_ids' size at runtime.
                    ...array_merge( $scanner_ids, array( $as_of, $as_of ) )
                ),
                ARRAY_A
            );
        }

        foreach ( (array) $rows as $row ) {
            $post_ids = array_filter(
                array_map( 'intval', explode( ',', (string) $row['object_ref'] ) ),
                static fn( $id ) => $id > 0
            );

            foreach ( $post_ids as $post_id ) {
                $buckets[ $post_id ][] = array(
                    'id'       => (int) $row['id'],
                    'title'    => $row['title'],
                    'severity' => $row['severity'],
                );
            }
        }

        return $buckets;
    }

    /**
     * Distinct real pages/posts/URLs with at least one currently-open
     * finding among $scanner_ids - the real "N pages affected" count
     * Seo.php's own category cards need alongside
     * get_severity_breakdown_for_scanner_ids()'s own per-severity counts.
     * `object_ref` is that finding's own real target (a `WP_Post::ID` for
     * most scanners, a URL string for the few that are - `canonical-url`'s
     * own object_type is `url`, not `post`); counted together rather than
     * scoped to `object_type = 'post'`, since a category can legitimately
     * mix both and every value is still a real distinct affected target
     * either way.
     *
     * @param string[] $scanner_ids Scanner ids to scope to.
     * @return int
     */
    public function get_affected_object_count_for_scanner_ids( array $scanner_ids ): int {
        global $wpdb;

        if ( ! $scanner_ids ) {
            return 0;
        }

        $placeholders = implode( ', ', array_fill( 0, count( $scanner_ids ), '%s' ) );

        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(DISTINCT object_ref) FROM {$this->get_table()} WHERE scanner_id IN ({$placeholders}) AND status = 'open'", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $placeholders' %s count matches $scanner_ids' size at runtime.
                ...$scanner_ids
            )
        );
    }

    /**
     * Aggregate counts for one date range - what every Reports\Types\*
     * report reads instead of pulling every row in the period into PHP to
     * count them (performance.md). $category narrows to one scanner
     * category (e.g. 'seo', 'security'); null means every category, used
     * by Reports\Types\ScanSummaryReport/HealthReport. $scanner_ids
     * additionally narrows to an explicit scanner id list (Content
     * Intelligence's own report, which spans two categories - see
     * get_severity_breakdown_for_scanner_ids()'s own docblock for why);
     * combinable with $category, though no current caller needs both at
     * once.
     *
     * @param string        $period_start Y-m-d, inclusive.
     * @param string        $period_end   Y-m-d, inclusive.
     * @param string|null   $category     One of the scanner category strings (SCANNERS.md), or null for all.
     * @param string[]|null $scanner_ids  Scanner ids to additionally scope to, or null for every scanner in $category.
     * @return array{total: int, by_severity: array<string, int>, by_category: array<string, int>, by_status: array<string, int>}
     */
    public function get_stats_for_period( string $period_start, string $period_end, ?string $category = null, ?array $scanner_ids = null ): array {
        global $wpdb;

        $where  = 'WHERE DATE(created_at) BETWEEN %s AND %s';
        $values = array( $period_start, $period_end );

        if ( null !== $category ) {
            $where   .= ' AND category = %s';
            $values[] = $category;
        }

        if ( null !== $scanner_ids && $scanner_ids ) {
            $where .= ' AND scanner_id IN (' . implode( ', ', array_fill( 0, count( $scanner_ids ), '%s' ) ) . ')';
            array_push( $values, ...$scanner_ids );
        }

        $by_severity = array_fill_keys( array( 'critical', 'high', 'medium', 'low', 'info' ), 0 );

        $severity_rows = $wpdb->get_results(
            $wpdb->prepare( "SELECT severity, COUNT(*) AS total FROM {$this->get_table()} {$where} GROUP BY severity", ...$values ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $where's %s count matches $values' size at runtime.
            ARRAY_A
        );

        foreach ( (array) $severity_rows as $row ) {
            if ( array_key_exists( $row['severity'], $by_severity ) ) {
                $by_severity[ $row['severity'] ] = (int) $row['total'];
            }
        }

        $by_category = array();

        if ( null === $category ) {
            $category_rows = $wpdb->get_results(
                $wpdb->prepare( "SELECT category, COUNT(*) AS total FROM {$this->get_table()} {$where} GROUP BY category", ...$values ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- same runtime-sized-array case as above.
                ARRAY_A
            );

            foreach ( (array) $category_rows as $row ) {
                $by_category[ $row['category'] ] = (int) $row['total'];
            }
        }

        $status_rows = $wpdb->get_results(
            $wpdb->prepare( "SELECT status, COUNT(*) AS total FROM {$this->get_table()} {$where} GROUP BY status", ...$values ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- same runtime-sized-array case as above.
            ARRAY_A
        );

        $by_status = array();

        foreach ( (array) $status_rows as $row ) {
            $by_status[ $row['status'] ] = (int) $row['total'];
        }

        return array(
            'total'       => array_sum( $by_severity ),
            'by_severity' => $by_severity,
            'by_category' => $by_category,
            'by_status'   => $by_status,
        );
    }

    /**
     * Every object_type/object_ref pair from one scan run - used only to
     * build History's "Pages & posts" list (Controllers/History.php's own
     * build_affected_pages()), which needs every finding a scan produced to
     * count accurately per page, not find_all()'s own 100-row page cap. A
     * real, exact, indexed FK lookup (`idx_scan` on
     * vulopilot_scan_findings.scan_id, set once at insert time by
     * Services\ScanPersistenceListener::handle_scan_completed() in the same
     * request that creates the scan row itself) - not an approximation.
     *
     * @param int $scan_id vulopilot_scans.id.
     * @return array<int, array{object_type: string|null, object_ref: string|null}>
     */
    public function get_object_refs_for_scan( int $scan_id ): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT object_type, object_ref FROM {$this->get_table()} WHERE scan_id = %d LIMIT 2000", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $scan_id
            ),
            ARRAY_A
        );

        return null !== $rows ? $rows : array();
    }

    /**
     * The highest-severity currently-open findings, worst-first - what
     * Controllers\ReportsOverview's own "Your next priorities" list reads.
     * Unlike get_top_findings_for_period() (scoped to a created_at window,
     * any status), this is unbounded by date and scoped to `status = 'open'`
     * only - the point is "what's still outstanding right now", not "what
     * appeared recently".
     *
     * @param int $limit Max rows to return.
     * @return array<int, array<string, mixed>>
     */
    public function get_top_open_findings( int $limit = 10 ): array {
        global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, title, description, severity, category, created_at FROM {$this->get_table()} WHERE status = 'open' ORDER BY FIELD(severity, 'critical', 'high', 'medium', 'low', 'info') ASC, created_at DESC LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                max( 1, $limit )
            ),
            ARRAY_A
        );

        return $rows ?: array();
    }

    /**
     * The highest-severity findings opened in one date range - what a
     * report's "top issues" section reads, ordered worst-first rather than
     * newest-first.
     *
     * @param string        $period_start Y-m-d, inclusive.
     * @param string        $period_end   Y-m-d, inclusive.
     * @param string|null   $category     One of the scanner category strings, or null for all.
     * @param int           $limit        Max rows to return.
     * @param string[]|null $scanner_ids  Scanner ids to additionally scope to - same reasoning as get_stats_for_period()'s own docblock.
     * @return array<int, array<string, mixed>>
     */
    public function get_top_findings_for_period( string $period_start, string $period_end, ?string $category = null, int $limit = 10, ?array $scanner_ids = null ): array {
        global $wpdb;

        $where  = 'WHERE DATE(created_at) BETWEEN %s AND %s';
        $values = array( $period_start, $period_end );

        if ( null !== $category ) {
            $where   .= ' AND category = %s';
            $values[] = $category;
        }

        if ( null !== $scanner_ids && $scanner_ids ) {
            $where .= ' AND scanner_id IN (' . implode( ', ', array_fill( 0, count( $scanner_ids ), '%s' ) ) . ')';
            array_push( $values, ...$scanner_ids );
        }

        $values[] = max( 1, $limit );

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, title, severity, category, status, created_at FROM {$this->get_table()} {$where} ORDER BY FIELD(severity, 'critical', 'high', 'medium', 'low', 'info') ASC, created_at DESC LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $where's %s count matches $values' size at runtime.
                ...$values
            ),
            ARRAY_A
        );

        return $rows ?: array();
    }
}

/**
 * Persistence for `vulopilot_security_events` (type `firewall_block`) (DATABASE.md) -
 * Services\FirewallGuard's own real request-block/log, backing
 * Scanners\Basic\FirewallScanner's Finding rows.
 *
 * @class       FirewallBlockRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FirewallBlockRepository extends AbstractRepository {

    /**
     * This repository's `event_type` in the shared `vulopilot_security_events` table.
     */
    private const EVENT_TYPE = 'firewall_block';

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'ip_address', 'action' );

    /**
     * @inheritDoc
     */
    /**
     * @inheritDoc
     */
    public function insert( array $data ): int {
        $data['event_type'] = self::EVENT_TYPE;

        return parent::insert( $data );
    }

    protected function get_table_key(): string {
        return 'security_event';
    }

    /**
     * Real block/log-row count in the last N days -
     * Scanners\Basic\FirewallScanner's own summary count.
     *
     * @param int $days Real lookback window.
     * @return int
     */
    public function count_recent( int $days ): int {
        global $wpdb;

        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->get_table()} WHERE event_type = %s AND created_at >= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::EVENT_TYPE,
                gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) )
            )
        );
    }

    /**
     * The single IP with the most matched-rule rows in the last N days -
     * Scanners\Basic\FirewallScanner's own "one IP repeatedly hit real
     * exploit-signature rules" severity escalation. Null when there's
     * nothing in the window at all.
     *
     * @param int $days Real lookback window.
     * @return array{ip_address: string, hit_count: int}|null
     */
    public function get_most_active_ip( int $days ): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT ip_address, COUNT(*) AS hit_count FROM {$this->get_table()} WHERE event_type = %s AND created_at >= %s GROUP BY ip_address ORDER BY hit_count DESC LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::EVENT_TYPE,
                gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) )
            ),
            ARRAY_A
        );

        if ( ! $row ) {
            return null;
        }

        return array(
            'ip_address' => (string) $row['ip_address'],
            'hit_count'  => (int) $row['hit_count'],
        );
    }
}

/**
 * Persistence for the shared activity log (`indexnow.submitted`) (Scanning → Instant Indexing's
 * "History" card - the mockup's own "The last 100 IndexNow API requests"
 * copy). `find_all()`/pagination is entirely inherited from
 * AbstractRepository, same "repository adds its own query methods beyond
 * the generic CRUD base" pattern CrawlerVisitRepository already uses.
 *
 * One row per real submission attempt (manual or auto-submitted), never
 * upserted/deduped - unlike NotFoundLogRepository's own path-keyed upsert,
 * a repeat IndexNow submission of the same URL weeks apart is each a
 * distinct, meaningful API call worth its own row in the history.
 *
 * @class       IndexNowLogRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class IndexNowLogRepository {

    private const EVENT_TYPE = 'indexnow.submitted';

    private const MAX_ROWS = 100;

    /**
     * Records one submission in the shared activity log
     * (`vulopilot_activity_logs`) - the URL as the message, the rest as
     * JSON in `meta`. No table of its own: this is a short, capped,
     * read-newest-first log, which is exactly what the activity log is.
     *
     * @param string   $url             Submitted URL.
     * @param int|null $response_code   HTTP status from the IndexNow endpoint.
     * @param string   $response_status Short machine-readable status.
     * @param string   $trigger_type    'manual' or 'auto'.
     * @return int The new row's id.
     */
    public function log( string $url, ?int $response_code, string $response_status, string $trigger_type = 'manual' ): int {
        $id = ( new ActivityLogRepository() )->insert(
            array(
                'event_type' => self::EVENT_TYPE,
                'message'    => $url,
                'severity'   => 'failed' === $response_status ? 'warning' : 'info',
                'actor_type' => 'auto' === $trigger_type ? 'system' : 'user',
                'meta'       => wp_json_encode(
                    array(
                        'response_code'   => $response_code,
                        'response_status' => $response_status,
                        'trigger_type'    => $trigger_type,
                    )
                ),
            )
        );

        $this->trim_to_max_rows();

        return $id;
    }

    /**
     * Newest first, in the shape the IndexNow tab has always read:
     * `id`, `url`, `response_code`, `response_status`, `trigger_type`, `created_at`.
     *
     * @return array<int, array<string, mixed>>
     */
    public function get_recent(): array {
        $rows = ( new ActivityLogRepository() )->find_all(
            array(
                'event_type' => self::EVENT_TYPE,
                'per_page'   => self::MAX_ROWS,
                'orderby'    => 'id',
                'order'      => 'desc',
            )
        )['data'];

        return array_map(
            static function ( array $row ): array {
                $meta = json_decode( (string) ( $row['meta'] ?? '' ), true );
                $meta = is_array( $meta ) ? $meta : array();

                return array(
                    'id'              => (int) $row['id'],
                    'url'             => $row['message'],
                    'response_code'   => $meta['response_code'] ?? null,
                    'response_status' => $meta['response_status'] ?? '',
                    'trigger_type'    => $meta['trigger_type'] ?? 'manual',
                    'created_at'      => $row['created_at'],
                );
            },
            $rows
        );
    }

    /**
     * Keeps only the newest MAX_ROWS submissions.
     *
     * @return void
     */
    private function trim_to_max_rows(): void {
        global $wpdb;

        $table = $wpdb->prefix . \VuloPilot\Utill::TABLES['activity_log'];

        $wpdb->query( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "DELETE FROM {$table} WHERE event_type = %s AND id NOT IN (SELECT id FROM (SELECT id FROM {$table} WHERE event_type = %s ORDER BY id DESC LIMIT %d) AS keep_ids)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::EVENT_TYPE,
                self::EVENT_TYPE,
                self::MAX_ROWS
            )
        );
    }
}

/**
 * Persistence for `vulopilot_security_events` (type `login_attempt`) (DATABASE.md) -
 * Services\LoginProtectionGuard's own real failed/successful login log,
 * backing both the live brute-force lockout check and
 * Scanners\Basic\LoginProtectionScanner's Finding rows.
 *
 * @class       LoginAttemptRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class LoginAttemptRepository extends AbstractRepository {

    /**
     * This repository's `event_type` in the shared `vulopilot_security_events` table.
     */
    private const EVENT_TYPE = 'login_attempt';

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'ip_address', 'success' );

    /**
     * @inheritDoc
     */
    /**
     * @inheritDoc
     */
    public function insert( array $data ): int {
        $data['event_type'] = self::EVENT_TYPE;

        return parent::insert( $data );
    }

    protected function get_table_key(): string {
        return 'security_event';
    }

    /**
     * Real failed-attempt count for one IP within a rolling time window -
     * LoginProtectionGuard::block_if_locked_out()'s only query.
     *
     * @param string $ip_address   Real client IP.
     * @param int    $minutes      Rolling window size.
     * @return int
     */
    public function count_recent_failures( string $ip_address, int $minutes ): int {
        global $wpdb;

        return (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->get_table()} WHERE event_type = %s AND ip_address = %s AND success = 0 AND created_at >= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::EVENT_TYPE,
                $ip_address,
                gmdate( 'Y-m-d H:i:s', time() - ( $minutes * MINUTE_IN_SECONDS ) )
            )
        );
    }

    /**
     * Every distinct IP that actually tripped the lockout threshold at some
     * point in the last N days, with its own real failure count in that
     * window - Scanners\Basic\LoginProtectionScanner's own data source.
     * Deliberately re-derives "did this IP ever exceed the threshold" from
     * raw attempt rows rather than a separate "lockouts" table - the
     * threshold itself is a live setting (`login_max_attempts`), so a fixed
     * lockout-event table would drift out of sync with it the moment an
     * admin changes the setting.
     *
     * @param int $days       Real lookback window.
     * @param int $threshold  Real, current `login_max_attempts` setting value.
     * @return array<int, array{ip_address: string, failure_count: int}>
     */
    public function get_recent_lockouts( int $days, int $threshold ): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT ip_address, COUNT(*) AS failure_count FROM {$this->get_table()} WHERE event_type = %s AND success = 0 AND created_at >= %s GROUP BY ip_address HAVING failure_count >= %d ORDER BY failure_count DESC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::EVENT_TYPE,
                gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) ),
                $threshold
            ),
            ARRAY_A
        );

        return array_map(
            static fn( array $row ): array => array(
                'ip_address'    => (string) $row['ip_address'],
                'failure_count' => (int) $row['failure_count'],
            ),
            (array) $rows
        );
    }
}

/**
 * Persistence for vulopilot_not_found_logs - one row per unique missing
 * URL visitors actually hit, not one row per visit (Install.php's own
 * schema: `requested_path` is UNIQUE). log_or_increment() is the only way
 * rows are ever written to this table (Services\NotFoundLogger), keeping
 * the upsert-by-unique-key logic in one place rather than duplicated at
 * the call site.
 *
 * @class       NotFoundLogRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class NotFoundLogRepository extends AbstractRepository {

    /**
     * Columns find_all() may filter on - `is_system` is what lets
     * RedirectsTab.tsx's main 404 log fetch real content pages only
     * (`is_system=0`) while its own "System 404s" popup fetches the rest
     * (`is_system=1`), both from this one table.
     *
     * @var string[]
     */
    protected array $filterable_columns = array( 'is_system' );

    /**
     * Columns an incoming `search` arg is matched against.
     *
     * @var string[]
     */
    protected array $searchable_columns = array( 'requested_path' );

    /**
     * Utill::TABLES key this repository owns.
     *
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'not_found_log';
    }

    /**
     * Looks up a 404 log row by its exact requested path.
     *
     * @param string $requested_path Already-normalized path (RedirectRepository::normalize_path()).
     * @return array<string, mixed>|null
     */
    public function find_by_requested_path( string $requested_path ): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE requested_path = %s", $requested_path ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ARRAY_A
        );

        return $row ? $row : null;
    }

    /**
     * Records one 404 visit - inserts a new row for a path seen for the
     * first time, or bumps `hit_count`/`last_seen_at` on an existing one.
     * Deliberately not a raw `INSERT ... ON DUPLICATE KEY UPDATE` - this
     * only ever runs once per real 404 page load (Services\NotFoundLogger's
     * own template_redirect hook), nowhere near the request volume that
     * would make the extra find-then-write round trip a real concern, and
     * it keeps this class consistent with every other repository's
     * plain find()/insert()/update() calls rather than introducing the
     * only raw upsert statement in this codebase.
     *
     * @param string      $requested_path Already-normalized path.
     * @param string|null $referrer       The visit's HTTP referrer, if any.
     * @param bool        $is_system      True for a theme/plugin/core-file or static-asset path (Services\NotFoundLogger::is_noise_path()) - a real 404, just not a missing CONTENT page.
     * @return void
     */
    public function log_or_increment( string $requested_path, ?string $referrer, bool $is_system = false ): void {
        $existing = $this->find_by_requested_path( $requested_path );

        if ( $existing ) {
            $this->update(
                (int) $existing['id'],
                array(
                    'hit_count'    => (int) $existing['hit_count'] + 1,
                    'referrer'     => $referrer,
                    'last_seen_at' => current_time( 'mysql' ),
                    // $is_system is recomputed the same way from the same
                    // path every time, not user/environment-dependent, so
                    // re-asserting it here on a repeat hit is harmless and
                    // self-heals a row that predates this column
                    // (defaulted to 0 by dbDelta's own ADD COLUMN).
                    'is_system'    => $is_system ? 1 : 0,
                )
            );

            return;
        }

        $this->insert(
            array(
                'requested_path' => $requested_path,
                'referrer'       => $referrer,
                'hit_count'      => 1,
                'last_seen_at'   => current_time( 'mysql' ),
                'is_system'      => $is_system ? 1 : 0,
            )
        );
    }
}

/**
 * Persistence for `vulopilot_page_speed` - "Performance" › Slow Pages'
 * per-page table, written by Services\PageSpeedScanner. One row per real
 * WP page/post/WooCommerce page it has checked; `replace_for_url()` deletes
 * any prior row for that URL before inserting the fresh one, so a page not
 * yet rescanned keeps showing its last real result instead of disappearing
 * mid-scan.
 *
 * @class       PageSpeedRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PageSpeedRepository extends AbstractRepository {

    /**
     * Columns find_all() accepts as exact-match filters.
     *
     * @var string[]
     */
    protected array $filterable_columns = array( 'page_type', 'status' );

    /**
     * Columns an incoming `search` arg is LIKE-matched against.
     *
     * @var string[]
     */
    protected array $searchable_columns = array( 'title', 'url' );

    /**
     * Score, inclusive, at/above which a page counts as "Good" -
     * same real band this codebase's own mockup education copy states.
     */
    public const SCORE_GOOD = 80;

    /**
     * Score, inclusive, at/above which a page counts as "Needs Improvement"
     * rather than "Poor".
     */
    public const SCORE_NEEDS_IMPROVEMENT = 50;

    /**
     * Score, exclusive upper bound, below which a "Poor"/'slow' page is
     * real enough of an outlier to also count as "Very Slow" - a real
     * sub-band within the existing 'slow' status (not a 4th backend status
     * value, so every pre-existing status-count consumer keeps working
     * unchanged; see get_summary()'s own docblock).
     */
    public const SCORE_VERY_SLOW = 25;

    /**
     * Utill::TABLES key this repository owns.
     *
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'page_speed';
    }

    /**
     * Replaces any existing row for this URL with a fresh one - a rescan
     * supersedes, it never accumulates history (Slow Pages shows current
     * state, not a trend).
     *
     * @param array<string, mixed> $data Row data, must include 'url'.
     * @return int New row id.
     */
    public function replace_for_url( array $data ): int {
        global $wpdb;

        $wpdb->delete( $this->get_table(), array( 'url' => $data['url'] ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $this->insert( $data );
    }

    /**
     * Deletes rows whose URL isn't in the given (current) real page list -
     * so a page removed from the site (e.g. a deleted product) doesn't
     * linger in Slow Pages forever.
     *
     * @param string[] $current_urls Real URLs the latest scan enumerated.
     * @return void
     */
    public function delete_missing( array $current_urls ): void {
        global $wpdb;

        if ( empty( $current_urls ) ) {
            return;
        }

        $placeholders = implode( ', ', array_fill( 0, count( $current_urls ), '%s' ) );

        $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "DELETE FROM {$this->get_table()} WHERE url NOT IN ({$placeholders})", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
                ...$current_urls
            )
        );
    }

    /**
     * Real counts by score band, plus real average desktop/mobile scores
     * across whichever rows have one - `avg_score` (the table's own
     * `score` column, desktop/lab) added for
     * Controllers\ReportsOverview's own "device experience" bars, which
     * need both sides of the same real comparison `avg_mobile_score`
     * alone can't provide. `very_slow` is a real sub-count *within* `slow`
     * (score < SCORE_VERY_SLOW), not additional to it - `slow` alone still
     * means the same "Poor" band it always has, so summing
     * good+needs_improvement+slow still equals `total`.
     *
     * @return array{total: int, slow: int, very_slow: int, needs_improvement: int, good: int, avg_score: int|null, avg_mobile_score: int|null, avg_load_time_ms: int|null, last_scanned_at: string|null}
     */
    public function get_summary(): array {
        global $wpdb;

        $rows = $wpdb->get_results( "SELECT score, mobile_score, load_time_ms FROM {$this->get_table()}", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        $rows      = (array) $rows;
        $total     = count( $rows );
        $slow      = 0;
        $very_slow = 0;
        $needs     = 0;
        $good      = 0;

        $scores        = array();
        $mobile_scores = array();
        $load_times    = array();

        foreach ( $rows as $row ) {
            $score = null === $row['score'] ? null : (int) $row['score'];

            if ( null !== $score ) {
                if ( $score >= self::SCORE_GOOD ) {
                    ++$good;
                } elseif ( $score >= self::SCORE_NEEDS_IMPROVEMENT ) {
                    ++$needs;
                } else {
                    ++$slow;

                    if ( $score < self::SCORE_VERY_SLOW ) {
                        ++$very_slow;
                    }
                }

                $scores[] = $score;
            }

            if ( null !== $row['mobile_score'] ) {
                $mobile_scores[] = (int) $row['mobile_score'];
            }

            if ( null !== $row['load_time_ms'] ) {
                $load_times[] = (int) $row['load_time_ms'];
            }
        }

        $last_scanned_at = $wpdb->get_var( "SELECT MAX(scanned_at) FROM {$this->get_table()}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return array(
            'total'             => $total,
            'slow'              => $slow,
            'very_slow'         => $very_slow,
            'needs_improvement' => $needs,
            'good'              => $good,
            'avg_score'         => $scores ? (int) round( array_sum( $scores ) / count( $scores ) ) : null,
            'avg_mobile_score'  => $mobile_scores ? (int) round( array_sum( $mobile_scores ) / count( $mobile_scores ) ) : null,
            'avg_load_time_ms'  => $load_times ? (int) round( array_sum( $load_times ) / count( $load_times ) ) : null,
            'last_scanned_at'   => $last_scanned_at ? $last_scanned_at : null,
        );
    }

    /**
     * The real, deduplicated `main_issue` values across every scanned page
     * (each already either a real Google Lighthouse opportunity-audit
     * title or a plain load-time-based label - see
     * Install.php::create_page_speed_table()'s own docblock), grouped and
     * counted - backs the "Performance Opportunities" tab and the "Why
     * these pages are slow?" sidebar. Never a fabricated issue list: a
     * freshly-scanned site with no `main_issue` at all on any row simply
     * returns an empty array, rendered as an honest "nothing to fix"
     * empty state by the caller.
     *
     * @param int $limit Real issues to return, ranked by how many pages they affect.
     * @return array<int, array{issue: string, affected_pages: int}>
     */
    public function get_top_issues( int $limit = 10 ): array {
        global $wpdb;

        $rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT main_issue, COUNT(*) AS affected_pages FROM {$this->get_table()} WHERE main_issue IS NOT NULL AND main_issue != '' GROUP BY main_issue ORDER BY affected_pages DESC LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $limit
            ),
            ARRAY_A
        );

        return array_map(
            static fn( array $row ): array => array(
                'issue'          => (string) $row['main_issue'],
                'affected_pages' => (int) $row['affected_pages'],
            ),
            $rows ?: array()
        );
    }
}

/**
 * Persistence for `vulopilot_performance_samples` (type `request`) - one row per sampled
 * real front-end request, written by Services\PerformanceRequestLogger.
 * Read-only from this repository's own perspective (no insert helper here
 * - the logger writes directly via the inherited insert()); the one real
 * method is the aggregate "Real-time Monitoring" card needs.
 *
 * @class       PerformanceRequestRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceRequestRepository extends AbstractRepository {

    /**
     * This repository's `sample_type` in the shared `vulopilot_performance_samples` table.
     */
    private const SAMPLE_TYPE = 'request';

    /**
     * Utill::TABLES key this repository owns.
     *
     * @inheritDoc
     */
    /**
     * @inheritDoc
     */
    public function insert( array $data ): int {
        $data['sample_type'] = self::SAMPLE_TYPE;

        return parent::insert( $data );
    }

    protected function get_table_key(): string {
        return 'performance_sample';
    }

    /**
     * @return array{avg_response_time_ms: int|null, page_views_last_5_min: int, samples_last_hour: int}
     */
    public function get_realtime_stats(): array {
        global $wpdb;

        $table = $this->get_table();

        $avg_response_time_ms = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT AVG(response_time_ms) FROM {$table} WHERE sample_type = %s AND created_at >= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::SAMPLE_TYPE,
                gmdate( 'Y-m-d H:i:s', time() - HOUR_IN_SECONDS )
            )
        );

        $page_views_last_5_min = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE sample_type = %s AND created_at >= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::SAMPLE_TYPE,
                gmdate( 'Y-m-d H:i:s', time() - 5 * MINUTE_IN_SECONDS )
            )
        );

        $samples_last_hour = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE sample_type = %s AND created_at >= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::SAMPLE_TYPE,
                gmdate( 'Y-m-d H:i:s', time() - HOUR_IN_SECONDS )
            )
        );

        return array(
            'avg_response_time_ms'  => null !== $avg_response_time_ms ? (int) round( (float) $avg_response_time_ms ) : null,
            'page_views_last_5_min' => $page_views_last_5_min,
            'samples_last_hour'     => $samples_last_hour,
        );
    }

    /**
     * Deletes rows older than the given retention window - called by
     * Services\PerformanceRequestLogger's own daily cleanup cron.
     *
     * @param int $days Retention window, in days.
     * @return void
     */
    public function delete_older_than( int $days ): void {
        global $wpdb;

        $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "DELETE FROM {$this->get_table()} WHERE sample_type = %s AND created_at < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::SAMPLE_TYPE,
                gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS )
            )
        );
    }
}

/**
 * Persistence for vulopilot_redirects - the "Redirects & 404s" feature's
 * user-managed 301/302 redirect table. `source_path` is unique (Install.php's
 * own schema), so find_by_source_path() below is the one real hot-path
 * lookup: Services\RedirectManager calls it on every single front-end
 * request while the redirect manager setting is on, so it's a direct
 * indexed query rather than routing through find_all()'s paginated
 * count-then-select shape.
 *
 * @class       RedirectRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RedirectRepository extends AbstractRepository {

    /**
     * Columns find_all() may filter on.
     *
     * @var string[]
     */
    protected array $filterable_columns = array( 'is_active', 'source_path' );

    /**
     * Columns an incoming `search` arg is matched against.
     *
     * @var string[]
     */
    protected array $searchable_columns = array( 'source_path', 'target_url' );

    /**
     * Utill::TABLES key this repository owns.
     *
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'redirect';
    }

    /**
     * Looks up a redirect row by its exact source path.
     *
     * @param string $source_path Already-normalized path (see normalize_path()).
     * @return array<string, mixed>|null
     */
    public function find_by_source_path( string $source_path ): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE source_path = %s", $source_path ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ARRAY_A
        );

        return $row ? $row : null;
    }

    /**
     * Bumps a redirect's own hit counter and records the moment - called by
     * Services\RedirectManager every time it actually redirects a real
     * visitor through this row, so the Redirects page can show both which
     * rules are actually being hit and when one was last used.
     * `current_time( 'mysql' )` matches NotFoundLogRepository::log_or_increment()'s
     * own `last_seen_at` write, this table's equivalent field.
     *
     * @param int $id Redirect row id.
     * @return void
     */
    public function increment_hit_count( int $id ): void {
        global $wpdb;

        $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "UPDATE {$this->get_table()} SET hit_count = hit_count + 1, last_accessed_at = %s WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                current_time( 'mysql' ),
                $id
            )
        );
    }

    /**
     * Normalizes a raw request path into the exact comparable form both
     * `source_path` (this table) and `requested_path`
     * (NotFoundLogRepository) are stored/matched in - a single shared
     * definition of "what counts as the same path" is what makes "convert
     * this 404 log entry into a redirect" (the Redirects page's own
     * feature) actually produce a redirect that will match the same
     * request again: strips the site's own subdirectory-install prefix (if
     * any), forces a leading slash, and drops any trailing slash except
     * for the root itself.
     *
     * @param string $raw_path A raw REQUEST_URI path component (no query string) or a user-typed path.
     * @return string
     */
    public static function normalize_path( string $raw_path ): string {
        $home_path = (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH );

        if ( $home_path && '/' !== $home_path && 0 === strpos( $raw_path, $home_path ) ) {
            $raw_path = substr( $raw_path, strlen( $home_path ) );
        }

        $path = '/' . ltrim( $raw_path, '/' );

        return '/' !== $path ? untrailingslashit( $path ) : $path;
    }
}

/**
 * Persistence for vulopilot_reports (DATABASE.md).
 *
 * @class       ReportRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ReportRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'status', 'report_type' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'report';
    }

    /**
     * Generating/ready/failed counts, zero-filled - backs the Reports
     * table's status-count pill bar (same reasoning as
     * AutomationsRepository::get_status_counts()).
     *
     * @return array{generating: int, ready: int, failed: int}
     */
    public function get_status_counts(): array {
        return array_merge(
            array(
                'generating' => 0,
                'ready'      => 0,
                'failed'     => 0,
            ),
            $this->count_by_column( 'status' )
        );
    }
}

/**
 * Persistence for vulopilot_scans (DATABASE.md).
 *
 * @class       ScanRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ScanRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'status', 'scanner_id' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'scan';
    }

    /**
     * Scan-run counts by status for one date range - what
     * Reports\Types\ScanSummaryReport's headline summary reads.
     *
     * @param string $period_start Y-m-d, inclusive.
     * @param string $period_end   Y-m-d, inclusive.
     * @return array{total: int, by_status: array<string, int>}
     */
    public function get_stats_for_period( string $period_start, string $period_end ): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT status, COUNT(*) AS total FROM {$this->get_table()} WHERE DATE(created_at) BETWEEN %s AND %s GROUP BY status", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            ),
            ARRAY_A
        );

        $by_status = array();

        foreach ( (array) $rows as $row ) {
            $by_status[ $row['status'] ] = (int) $row['total'];
        }

        return array(
            'total'     => array_sum( $by_status ),
            'by_status' => $by_status,
        );
    }

    /**
     * Most recent successfully-finished `vulopilot_scans` row for any of
     * the given scanner ids - what BrokenLinksStats::get_stats() reads to
     * back a real "last scan took Xs" figure. `finished_at`/`duration_ms`
     * only exist for a run ScanRunner actually completed (ScanResult::
     * STATUS_COMPLETED), so a failed or still-running scan is deliberately
     * excluded rather than showing a stale/zero duration.
     *
     * @param string[] $scanner_ids e.g. array( 'broken-links', 'broken-images' ).
     * @return array{duration_ms: int, finished_at: int}|null Null when neither scanner has ever completed a run.
     */
    public function get_latest_completed( array $scanner_ids ): ?array {
        if ( ! $scanner_ids ) {
            return null;
        }

        global $wpdb;

        $placeholders = implode( ', ', array_fill( 0, count( $scanner_ids ), '%s' ) );

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT duration_ms, finished_at FROM {$this->get_table()} WHERE status = %s AND scanner_id IN ({$placeholders}) AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                'completed',
                ...$scanner_ids
            ),
            ARRAY_A
        );

        if ( ! $row ) {
            return null;
        }

        return array(
            'duration_ms' => (int) $row['duration_ms'],
            'finished_at' => (int) strtotime( $row['finished_at'] . ' UTC' ),
        );
    }
}

/**
 * Daily-snapshot storage shared by every "score history" feature - one row
 * per (`snapshot_type`, `snapshot_date`) in `vulopilot_snapshots`, with the
 * day's values kept together as JSON in `data`. Replaces what used to be
 * eight near-identical per-feature tables (performance/security score,
 * accessibility, site health, store trends, brand score, GEO visibility,
 * Knowledge Graph health): each was "a date plus a handful of numbers",
 * always read back as a time series, never filtered or sorted by a value.
 *
 * Each feature keeps its own thin repository (its own type and its own
 * `upsert_today()` signature) so callers and REST response shapes are
 * unchanged - rows still come back flat: `id`, `snapshot_date`,
 * `created_at`, plus every stored value as its own key.
 *
 * @class       SnapshotRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SnapshotRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'snapshot_type', 'snapshot_date' );

    /**
     * @var string
     */
    protected string $snapshot_type;

    /**
     * @param string $snapshot_type Which feature's snapshots this repository reads/writes.
     */
    public function __construct( string $snapshot_type ) {
        $this->snapshot_type = sanitize_key( $snapshot_type );
    }

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'snapshot';
    }

    /**
     * Inserts or replaces one day's values.
     *
     * @param string               $date   `Y-m-d`.
     * @param array<string, mixed> $values Everything to store for that day.
     * @return void
     */
    protected function store( string $date, array $values ): void {
        global $wpdb;

        $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "INSERT INTO {$this->get_table()} (snapshot_type, snapshot_date, data) VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE data = VALUES(data)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $this->snapshot_type,
                $date,
                wp_json_encode( $values )
            )
        );
    }

    /**
     * Stores today's values (site-local date).
     *
     * @param array<string, mixed> $values Everything to store for today.
     * @return void
     */
    protected function store_today( array $values ): void {
        $this->store( current_time( 'Y-m-d' ), $values );
    }

    /**
     * Oldest-first rows for the last `$days` days.
     *
     * @param int $days Look-back window.
     * @return array<int, array<string, mixed>>
     */
    public function get_recent( int $days = 30 ): array {
        return $this->query_rows(
            'snapshot_date >= %s ORDER BY snapshot_date ASC',
            array( gmdate( 'Y-m-d', strtotime( "-{$days} days" ) ) )
        );
    }

    /**
     * Oldest-first rows between two dates (inclusive).
     *
     * @param string $period_start `Y-m-d`.
     * @param string $period_end   `Y-m-d`.
     * @return array<int, array<string, mixed>>
     */
    public function get_between( string $period_start, string $period_end ): array {
        return $this->query_rows(
            'snapshot_date BETWEEN %s AND %s ORDER BY snapshot_date ASC',
            array( $period_start, $period_end )
        );
    }

    /**
     * @return array<string, mixed>|null Newest row, or null.
     */
    public function get_latest(): ?array {
        return $this->query_rows( '1=1 ORDER BY snapshot_date DESC LIMIT 1', array() )[0] ?? null;
    }

    /**
     * @return array<string, mixed>|null The row before the newest, or null.
     */
    public function get_previous(): ?array {
        return $this->query_rows( '1=1 ORDER BY snapshot_date DESC LIMIT 1 OFFSET 1', array() )[0] ?? null;
    }

    /**
     * Runs a `WHERE snapshot_type = %s AND {$clause}` query and flattens each row.
     *
     * @param string            $clause Remaining WHERE/ORDER BY SQL (with placeholders).
     * @param array<int, mixed> $args   Values for the clause's placeholders.
     * @return array<int, array<string, mixed>>
     */
    private function query_rows( string $clause, array $args ): array {
        global $wpdb;

        $rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT id, snapshot_date, data, created_at FROM {$this->get_table()} WHERE snapshot_type = %s AND {$clause}", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ...array_merge( array( $this->snapshot_type ), $args )
            ),
            ARRAY_A
        );

        return array_map( array( $this, 'flatten' ), $rows ? $rows : array() );
    }

    /**
     * `{id, snapshot_date, data, created_at}` → one flat row.
     *
     * @param array<string, mixed> $row Raw table row.
     * @return array<string, mixed>
     */
    protected function flatten( array $row ): array {
        $values = json_decode( (string) $row['data'], true );

        return array_merge(
            array(
                'id'            => (int) $row['id'],
                'snapshot_date' => $row['snapshot_date'],
            ),
            is_array( $values ) ? $values : array(),
            array( 'created_at' => $row['created_at'] )
        );
    }
}

/**
 * The free tier's daily category score history behind the Performance
 * "Speed History" and Security "Security Trend" cards - a
 * `performance`/`security` slice of `vulopilot_snapshots`. Rows come back
 * as `[ snapshot_date, {category}_score ]` (`performance_score` /
 * `security_score`), the shape the front-end charts read.
 *
 * @class       ScoreSnapshotRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ScoreSnapshotRepository extends SnapshotRepository {

    /**
     * Inserts today's score for this category, or updates it if today's row exists.
     *
     * @param int $score 0-100.
     * @return void
     */
    public function upsert_today( int $score ): void {
        $this->store_today( array( $this->snapshot_type . '_score' => $score ) );
    }

    /**
     * @inheritDoc
     */
    protected function flatten( array $row ): array {
        $flat = parent::flatten( $row );

        return array(
            'snapshot_date'                  => $flat['snapshot_date'],
            $this->snapshot_type . '_score' => $flat[ $this->snapshot_type . '_score' ] ?? 0,
        );
    }
}
