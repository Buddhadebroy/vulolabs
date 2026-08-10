<?php
/**
 * History controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\ActivityLogRepository;
use VuloPilot\Repositories\ScanRepository;
use VuloPilot\Repositories\ActionRunRepository;

defined( 'ABSPATH' ) || exit;

/**
 * GET /history backs the AI Copilot page's History tab (HistoryTab.tsx) —
 * a real, day-groupable activity timeline, distinct from the existing
 * `GET /activity-logs` (ActivityLogs.php, backs Reports > Activity's own
 * flat, unfiltered table): this endpoint scopes to only the two event
 * types AI Copilot's own History is about (`scan.completed`/`ai_action.*`
 * — never the Pro-only GEO/Brand/KG snapshot events `vulopilot_activity_logs`
 * also carries), and enriches each row with real detail joined back to its
 * source table (`vulopilot_scans`/`vulopilot_ai_action_runs`) — a scan
 * run's real per-severity finding counts, or an AI action's real
 * `preview.before`/`preview.after` — since `activity_logs.message` alone
 * is only ever a generic one-line summary, never the full detail the
 * mockup's row/detail-panel needs.
 *
 * "Conversations" and "Automations" are real category filters the client
 * always sends (matching the mockup's own filter pills), but neither has
 * any real backing here: chat isn't wired to any backend yet (no stored
 * prompt/session anywhere), and `vulopilot_automation_runs` has no writer
 * in this codebase at all (Automations.php's own `run_item()` is a hard
 * 501) — both types honestly return zero rows rather than fabricating any.
 *
 * @class       History controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class History extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'history';

    /**
     * The only real event types this table's timeline is ever built from —
     * everything else `vulopilot_activity_logs` carries (Pro's GEO/Brand/KG
     * snapshot events) belongs to those pages' own history, not this one.
     *
     * @var array<string, string[]>
     */
    private const EVENT_TYPES_BY_CATEGORY = array(
        'scan'   => array( 'scan.completed' ),
        'change' => array(
            'ai_action.proposed',
            'ai_action.executed',
            'ai_action.failed',
            'ai_action.rejected',
            'ai_action.rolled_back',
        ),
    );

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        // Zyra's sendApiResponse() (src/services/useApiList.ts and every
        // other AI Copilot delete/apply action this session) always issues
        // a plain POST regardless of semantic intent — same reasoning
        // Findings.php's own class docblock gives for its own sub-routes —
        // so this accepts WP_REST_Server::EDITABLE (POST/PUT/PATCH/DELETE)
        // rather than a stricter DELETABLE-only registration that the real
        // client could never actually reach.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'delete_item' ),
                    'permission_callback' => array( $this, 'delete_item_permissions_check' ),
                ),
            )
        );
    }

    /**
     * @inheritDoc
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function delete_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function get_items( $request ) {
        $repository = new ActivityLogRepository();
        $category   = sanitize_key( (string) $request->get_param( 'type' ) );

        // 'conversation'/'automation' are real filter pills the client
        // always sends, but neither has any real backing (see class
        // docblock) — short-circuit to an honest empty page rather than
        // querying for an event_type allow-list that can never match.
        if ( in_array( $category, array( 'conversation', 'automation' ), true ) ) {
            return rest_ensure_response(
                array(
                    'data'        => array(),
                    'total'       => 0,
                    'type_counts' => $this->get_type_counts( $repository ),
                )
            );
        }

        $event_types = isset( self::EVENT_TYPES_BY_CATEGORY[ $category ] )
            ? self::EVENT_TYPES_BY_CATEGORY[ $category ]
            : array_merge( ...array_values( self::EVENT_TYPES_BY_CATEGORY ) );

        $page     = absint( $request->get_param( 'page' ) );
        $per_page = absint( $request->get_param( 'per_page' ) );

        $result = $repository->get_timeline(
            array(
                'event_types' => $event_types,
                'search'      => sanitize_text_field( (string) $request->get_param( 'search' ) ),
                'date_from'   => sanitize_text_field( (string) $request->get_param( 'date_from' ) ),
                'date_to'     => sanitize_text_field( (string) $request->get_param( 'date_to' ) ),
                'page'        => $page > 0 ? $page : 1,
                'per_page'    => $per_page > 0 ? $per_page : 20,
            )
        );

        $result['data']        = array_map( array( $this, 'enrich_row' ), $result['data'] );
        $result['type_counts'] = $this->get_type_counts( $repository );

        return rest_ensure_response( $result );
    }

    /**
     * @inheritDoc
     */
    public function delete_item( $request ) {
        $repository = new ActivityLogRepository();
        $id         = absint( $request->get_param( 'id' ) );

        if ( ! $repository->delete( $id ) ) {
            return new \WP_Error( 'vulopilot_history_delete_failed', __( 'Could not delete this history entry.', 'vulopilot' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( array( 'success' => true ) );
    }

    /**
     * Bucket-sums count_by_column('event_type')'s raw per-event-type counts
     * into the 2 real category counts the filter pills show, zero-filling
     * 'conversation'/'automation' rather than omitting them — both are
     * real pills the client always renders, just always at 0 today (see
     * class docblock).
     *
     * @param ActivityLogRepository $repository Repository to count from.
     * @return array{scan: int, change: int, conversation: int, automation: int}
     */
    private function get_type_counts( ActivityLogRepository $repository ): array {
        $raw = $repository->count_by_column( 'event_type' );

        $counts = array(
            'scan'         => 0,
            'change'       => 0,
            'conversation' => 0,
            'automation'   => 0,
        );

        foreach ( self::EVENT_TYPES_BY_CATEGORY as $category => $event_types ) {
            foreach ( $event_types as $event_type ) {
                $counts[ $category ] += $raw[ $event_type ] ?? 0;
            }
        }

        return $counts;
    }

    /**
     * Adds a real `scan` or `change` sub-object to one activity_logs row,
     * joined back to its source table by `object_id` — `message` alone is
     * only ever a generic one-line summary (ActionRunner::log()'s own
     * calls are literally `sprintf('%s executed.', ...)`), never the real
     * per-severity finding counts or before/after text the row/detail
     * panel need.
     *
     * @param array<string, mixed> $row One vulopilot_activity_logs row.
     * @return array<string, mixed>
     */
    private function enrich_row( array $row ): array {
        $row['category'] = 0 === strpos( (string) $row['event_type'], 'scan.' ) ? 'scan' : 'change';
        $row['scan']     = null;
        $row['change']   = null;

        if ( 'scan' === $row['category'] && ! empty( $row['object_id'] ) ) {
            $row['scan'] = $this->build_scan_detail( (int) $row['object_id'] );
        } elseif ( 'change' === $row['category'] && ! empty( $row['object_id'] ) ) {
            $row['change'] = $this->build_change_detail( (int) $row['object_id'] );
        }

        return $row;
    }

    /**
     * Real detail for one scan.completed timeline row, joined back to its
     * vulopilot_scans source row.
     *
     * @param int $scan_id vulopilot_scans.id.
     * @return array<string, mixed>|null Null if the source scan row is gone.
     */
    private function build_scan_detail( int $scan_id ): ?array {
        $scan = ( new ScanRepository() )->find( $scan_id );

        if ( ! $scan ) {
            return null;
        }

        $scanner = VuloPilot()->scanner_registry->get_scanner( $scan['scanner_id'] );
        $summary = json_decode( (string) $scan['summary'], true );
        $summary = is_array( $summary ) ? $summary : array();

        return array(
            'id'           => (int) $scan['id'],
            'scanner_id'   => $scan['scanner_id'],
            'label'        => $scanner ? $scanner->get_label() : $scan['scanner_id'],
            'status'       => $scan['status'],
            'trigger_type' => $scan['trigger_type'],
            'duration_ms'  => null !== $scan['duration_ms'] ? (int) $scan['duration_ms'] : null,
            'by_severity'  => $summary['by_severity'] ?? array(),
            'total'        => $summary['total'] ?? 0,
        );
    }

    /**
     * Real detail for one ai_action.* timeline row, joined back to its
     * vulopilot_ai_action_runs source row — the real before/after text
     * comes from `preview` (set once at propose() time), never fabricated.
     *
     * @param int $run_id vulopilot_ai_action_runs.id.
     * @return array<string, mixed>|null Null if the source run row is gone.
     */
    private function build_change_detail( int $run_id ): ?array {
        $run = ( new ActionRunRepository() )->find( $run_id );

        if ( ! $run ) {
            return null;
        }

        $action  = VuloPilot()->ai_action_registry->get_action( $run['action_id'] );
        $preview = json_decode( (string) $run['preview'], true );
        $preview = is_array( $preview ) ? $preview : array();

        return array(
            'id'            => (int) $run['id'],
            'action_id'     => $run['action_id'],
            'label'         => $action ? $action->get_label() : $run['action_id'],
            'status'        => $run['status'],
            'before'        => $preview['before'] ?? null,
            'after'         => $preview['after'] ?? null,
            'format'        => $preview['format'] ?? 'text',
            'error_message' => $run['error_message'],
            'page'          => $this->resolve_page_link( $run['object_type'] ?? null, $run['object_ref'] ?? null ),
        );
    }

    /**
     * Same "post permalink, else site-wide" resolution Findings.php's own
     * add_page_field() uses — object_type/object_ref are only ever set
     * once an action run reaches approve() (ActionRunner::approve()), so
     * this returns null for a still-pending/rejected run rather than
     * guessing a page it was never actually applied to.
     *
     * @param string|null $object_type e.g. 'post'.
     * @param string|null $object_ref  Post id, as a string.
     * @return string|null
     */
    private function resolve_page_link( ?string $object_type, ?string $object_ref ): ?string {
        if ( null === $object_type || null === $object_ref ) {
            return null;
        }

        if ( 'post' === $object_type && is_numeric( $object_ref ) ) {
            $permalink = get_permalink( (int) $object_ref );

            return $permalink ? wp_make_link_relative( $permalink ) : __( 'Site-wide', 'vulopilot' );
        }

        return __( 'Site-wide', 'vulopilot' );
    }
}
