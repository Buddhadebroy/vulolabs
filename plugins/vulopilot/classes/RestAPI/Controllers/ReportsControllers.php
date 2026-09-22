<?php
/**
 * Every class in this file used to be its own file under classes/RestAPI/Controllers/
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

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\ActionRunRepository;
use VuloPilot\Repositories\ActivityLogRepository;
use VuloPilot\Repositories\AiHistoryRepository;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\PageSpeedRepository;
use VuloPilot\Repositories\ReportRepository;
use VuloPilot\Repositories\ScanRepository;
use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * GET /ai-history backs src/pages/AIAssistant/AIAssistant.tsx's table.
 * Read-only - rows are only ever written by AI\AiRequestSender (one per real
 * AI call), never by this controller.
 *
 * @class       AiHistory controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiHistory extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'ai-history';

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
    public function get_items( $request ) {
        $repository = new AiHistoryRepository();

        $result                  = $repository->find_all(
            array(
                'page'     => absint( $request->get_param( 'page' ) ) ?: 1,
                'per_page' => absint( $request->get_param( 'per_page' ) ) ?: 20,
                'provider' => sanitize_key( (string) $request->get_param( 'provider' ) ),
                'status'   => sanitize_key( (string) $request->get_param( 'status' ) ),
                'search'   => sanitize_text_field( (string) $request->get_param( 'search' ) ),
                'orderby'  => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                'order'    => sanitize_key( (string) $request->get_param( 'order' ) ),
            )
        );
        $result['status_counts']   = $repository->get_status_counts();
        $result['provider_counts'] = $repository->get_provider_counts();

        return rest_ensure_response( $result );
    }
}

/**
 * GET /history backs the AI Copilot page's History tab (HistoryTab.tsx) -
 * a real, day-groupable activity timeline, distinct from the existing
 * `GET /activity-logs` (ActivityLogs.php, backs Reports > Activity's own
 * flat, unfiltered table): this endpoint scopes to only the event types AI
 * Copilot's own History is about (`scan.completed`/`ai_action.*` from
 * `vulopilot_activity_logs` - never the Pro-only GEO/Brand/KG snapshot
 * events that table also carries), and enriches each row with real detail
 * joined back to its source table (`vulopilot_scans`/`vulopilot_ai_action_runs`)
 * - a scan run's real per-severity finding counts, or an AI action's real
 * `preview.before`/`preview.after` - since `activity_logs.message` alone
 * is only ever a generic one-line summary, never the full detail the
 * mockup's row/detail-panel needs.
 *
 * "Conversations" is a real category too, backed by a THIRD source table
 * (`vulopilot_ai_history`, via AiHistoryRepository::get_conversations()) -
 * every real chat turn (Controllers\Copilot.php/ContentAssistant.php)
 * writes there, tagged with a real `surface` column so this can tell a
 * genuine chat turn apart from every other feature that shares the same
 * AI\AiRequestSender path (GEO scoring, schema generation, content
 * intelligence - see AiHistoryRepository::CHAT_SURFACES's own docblock).
 *
 * "Automations" stays a real category filter the client always sends but
 * has no backing: `vulopilot_automations_runs` has no writer in this
 * codebase at all (Automations.php's own `run_item()` is a hard 501) - it
 * honestly returns zero rows rather than fabricating any.
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
     * The only real event types this table's timeline is ever built from -
     * everything else `vulopilot_activity_logs` carries (Pro's GEO/Brand/KG
     * snapshot events) belongs to those pages' own history, not this one.
     *
     * @var array<string, string[]>
     */
    private const EVENT_TYPES_BY_CATEGORY = array(
        'scan'   => array( 'scan.completed', 'scan.completed.security' ),
        'change' => array(
            'ai_action.proposed',
            'ai_action.executed',
            'ai_action.failed',
            'ai_action.rejected',
            'ai_action.rolled_back',
        ),
    );

    /**
     * See ActivityLogRepository::find_actions_in_window()'s own docblock
     * for why this can be tight rather than a same-day heuristic.
     */
    private const RELATED_ACTION_WINDOW_SECONDS = 30;

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
        // a plain POST regardless of semantic intent - same reasoning
        // Findings.php's own class docblock gives for its own sub-routes -
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
        $repository   = new ActivityLogRepository();
        $history_repo = new AiHistoryRepository();
        $category     = sanitize_key( (string) $request->get_param( 'type' ) );
        $page         = absint( $request->get_param( 'page' ) );
        $per_page     = absint( $request->get_param( 'per_page' ) );

        // 'automations' is a real filter pill the client always sends, but
        // has no backing (see class docblock) - short-circuit to an
        // honest empty page rather than querying for an event_type
        // allow-list that can never match.
        if ( 'automations' === $category ) {
            return rest_ensure_response(
                array(
                    'data'        => array(),
                    'total'       => 0,
                    'type_counts' => $this->get_type_counts( $repository, $history_repo ),
                )
            );
        }

        // 'conversation' is a real filter pill too now, but a distinct
        // source table (`vulopilot_ai_history`, not `vulopilot_activity_logs`)
        // - deliberately NOT merged into the 'all'/scan/change timeline
        // below (that would need a real cross-source merge-sort across two
        // differently-shaped paginated queries); it only ever appears when
        // this exact category is requested, same as the client's own
        // filter pills already scope each request to one category.
        if ( 'conversation' === $category ) {
            $result = $history_repo->get_conversations(
                array(
                    'search'    => sanitize_text_field( (string) $request->get_param( 'search' ) ),
                    'date_from' => sanitize_text_field( (string) $request->get_param( 'date_from' ) ),
                    'date_to'   => sanitize_text_field( (string) $request->get_param( 'date_to' ) ),
                    'page'      => $page > 0 ? $page : 1,
                    'per_page'  => $per_page > 0 ? $per_page : 20,
                )
            );

            $result['data']        = array_map( array( $this, 'enrich_conversation_row' ), $result['data'] );
            $result['type_counts'] = $this->get_type_counts( $repository, $history_repo );

            return rest_ensure_response( $result );
        }

        $event_types = isset( self::EVENT_TYPES_BY_CATEGORY[ $category ] )
            ? self::EVENT_TYPES_BY_CATEGORY[ $category ]
            : array_merge( ...array_values( self::EVENT_TYPES_BY_CATEGORY ) );

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
        $result['type_counts'] = $this->get_type_counts( $repository, $history_repo );

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
     * into the 2 activity_logs-backed category counts, adds a real
     * conversation count from the separate ai_history source
     * (AiHistoryRepository::get_conversation_count()), and zero-fills
     * 'automations' - a real pill the client always renders, just always at
     * 0 today (see class docblock). 'all' is the real sum of the four -
     * HistoryTab.tsx's own "All" filter pill reads this same object
     * (typeCounts.all), and without this key it silently fell back to its
     * client-side zero-default, so "All" never showed a count badge next
     * to it the way every other pill already did.
     *
     * @param ActivityLogRepository $repository   Repository to count scan/change from.
     * @param AiHistoryRepository   $history_repo Repository to count conversations from.
     * @return array{all: int, scan: int, change: int, conversation: int, automations: int}
     */
    private function get_type_counts( ActivityLogRepository $repository, AiHistoryRepository $history_repo ): array {
        $raw = $repository->count_by_column( 'event_type' );

        $counts = array(
            'scan'         => 0,
            'change'       => 0,
            'conversation' => $history_repo->get_conversation_count(),
            'automations'  => 0,
        );

        foreach ( self::EVENT_TYPES_BY_CATEGORY as $category => $event_types ) {
            foreach ( $event_types as $event_type ) {
                $counts[ $category ] += $raw[ $event_type ] ?? 0;
            }
        }

        $counts = array( 'all' => array_sum( $counts ) ) + $counts;

        return $counts;
    }

    /**
     * Adds a real `conversation` sub-object to one `vulopilot_ai_history`
     * row - everything the row already has (provider/model/status/full
     * excerpt); the frontend's own humanizeConversationExcerpt()
     * (historyTypes.ts) turns the raw excerpt into a human-readable title,
     * not this controller (same "PHP passes the real data through,
     * TypeScript owns display formatting" split every other row category
     * here already follows - see enrich_row()'s own `message` field, which
     * is likewise the raw activity_logs.message with no server-side
     * rewriting).
     *
     * @param array<string, mixed> $row One vulopilot_ai_history row.
     * @return array<string, mixed>
     */
    private function enrich_conversation_row( array $row ): array {
        return array(
            'id'           => (int) $row['id'],
            'event_type'   => 'success' === $row['status'] ? 'ai_history.success' : 'ai_history.failure',
            'category'     => 'conversation',
            'message'      => (string) ( $row['response_excerpt'] ?? '' ),
            'severity'     => 'success' === $row['status'] ? 'info' : 'high',
            'created_at'   => $row['created_at'],
            'scan'         => null,
            'change'       => null,
            'conversation' => array(
                'id'               => (int) $row['id'],
                'provider'         => $row['provider'],
                'model'            => $row['model'],
                'status'           => $row['status'],
                'excerpt'          => $row['response_excerpt'],
                'prompt_excerpt'   => $row['prompt_excerpt'] ?? null,
                'related_actions'  => $this->build_related_actions( $row ),
            ),
        );
    }

    /**
     * Real `ai_action.*` rows this conversation turn caused, if any - see
     * ActivityLogRepository::find_actions_in_window()'s own docblock for
     * why a tight window plus a same-user cross-check is safe here rather
     * than a fabricated guess. Genuinely empty for the overwhelming
     * majority of turns (a plain question/answer causes no action at all),
     * which the client renders as no "Related actions" section rather than
     * an empty placeholder.
     *
     * @param array<string, mixed> $row One vulopilot_ai_history row.
     * @return array<int, array{id: int, label: string, created_at: string}>
     */
    private function build_related_actions( array $row ): array {
        $requested_by = isset( $row['requested_by'] ) ? (int) $row['requested_by'] : 0;

        if ( $requested_by <= 0 ) {
            return array();
        }

        $candidates = ( new ActivityLogRepository() )->find_actions_in_window(
            self::EVENT_TYPES_BY_CATEGORY['change'],
            (string) $row['created_at'],
            self::RELATED_ACTION_WINDOW_SECONDS
        );

        $related = array();

        foreach ( $candidates as $candidate ) {
            if ( empty( $candidate['object_id'] ) ) {
                continue;
            }

            $run = ( new ActionRunRepository() )->find( (int) $candidate['object_id'] );

            if ( ! $run || $requested_by !== (int) ( $run['requested_by'] ?? 0 ) ) {
                continue;
            }

            $action = VuloPilot()->ai_action_registry->get_action( $run['action_id'] );

            $related[] = array(
                'id'         => (int) $candidate['id'],
                'label'      => $action ? $action->get_label() : $run['action_id'],
                'created_at' => $candidate['created_at'],
            );
        }

        return $related;
    }

    /**
     * Adds a real `scan` or `change` sub-object to one activity_logs row,
     * joined back to its source table by `object_id` - `message` alone is
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
        $total   = $summary['total'] ?? 0;

        return array(
            'id'             => (int) $scan['id'],
            'scanner_id'     => $scan['scanner_id'],
            'label'          => $scanner ? $scanner->get_label() : $scan['scanner_id'],
            'status'         => $scan['status'],
            'trigger_type'   => $scan['trigger_type'],
            'duration_ms'    => null !== $scan['duration_ms'] ? (int) $scan['duration_ms'] : null,
            'by_severity'    => $summary['by_severity'] ?? array(),
            'total'          => $total,
            'affected_pages' => $this->build_affected_pages( $scan_id ),
            // Only ever populated for a clean (0-finding) scan - when a
            // scan DID find something, affected_pages above already shows
            // every page it touched. Real data only: a scan persisted
            // before `scanned_objects` existed (ScanPersistenceListener.php)
            // has nothing here, same null-for-old-rows precedent as
            // ConversationDetail's own prompt_excerpt.
            'scanned_pages'  => 0 === $total ? $this->build_scanned_pages( $scan ) : array(),
        );
    }

    /**
     * Real pages/posts a scan considered but found nothing wrong with -
     * only meaningful (and only ever called) for a 0-finding scan, since a
     * scan that did find issues already has those pages listed, with their
     * real counts, in build_affected_pages() above. Reads the scanner's own
     * `get_scanned_post_ids()` record (ScanResult::get_scanned_post_ids(),
     * written to `vulopilot_scans.scanned_objects` at persistence time) -
     * a real per-post record kept independently of any Finding, since a
     * clean post never produces one. Genuinely empty for a scanner that
     * isn't per-post (Contracts\Scanner\TracksScannedObjectsInterface not
     * implemented) or for any scan row persisted before this column
     * existed - never inferred from the current live post list, which
     * could easily disagree with what a past scan actually considered.
     *
     * @param array<string, mixed> $scan One vulopilot_scans row.
     * @return array<int, array{id: int, title: string, link: string|null, edit_link: string}>
     */
    private function build_scanned_pages( array $scan ): array {
        $post_ids = json_decode( (string) ( $scan['scanned_objects'] ?? '' ), true );

        if ( ! is_array( $post_ids ) || ! $post_ids ) {
            return array();
        }

        $pages = array();

        foreach ( array_unique( array_map( 'absint', $post_ids ) ) as $post_id ) {
            $post = get_post( $post_id );

            if ( ! $post ) {
                continue;
            }

            $permalink = get_permalink( $post );

            $pages[] = array(
                'id'        => $post_id,
                'title'     => get_the_title( $post ) ?: __( '(no title)', 'vulopilot' ),
                'link'      => $permalink ? wp_make_link_relative( $permalink ) : null,
                'edit_link' => admin_url( "post.php?post={$post_id}&action=edit" ),
            );
        }

        usort( $pages, static fn( array $a, array $b ): int => strcasecmp( $a['title'], $b['title'] ) );

        return $pages;
    }

    /**
     * Real pages/posts this scan run found an issue on, one entry per
     * distinct post with its own real finding count - plus one trailing
     * "Site-wide" entry if any of this scan's findings aren't tied to a
     * specific page (a URL-level finding like a broken sitemap, or a
     * scanner that reports on the whole site). Reads every finding's own
     * `object_type`/`object_ref` via the exact `scan_id` FK
     * (FindingRepository::get_object_refs_for_scan()) - same
     * `object_ref` shapes (numeric post id, or a comma-joined list for
     * DuplicateContentScanner) History.php's own resolve_page_link() and
     * Findings.php's add_page_field() already handle, but resolved here to
     * a real post TITLE too (not just a permalink string), since this list
     * is meant to be read at a glance, not clicked one at a time.
     *
     * @param int $scan_id vulopilot_scans.id.
     * @return array<int, array{id: int, title: string, link: string|null, edit_link: string|null, count: int}>
     */
    private function build_affected_pages( int $scan_id ): array {
        $refs = ( new FindingRepository() )->get_object_refs_for_scan( $scan_id );

        $counts_by_post_id = array();
        $site_wide_count   = 0;

        foreach ( $refs as $ref ) {
            $post_ids = $this->extract_post_ids( $ref['object_type'] ?? null, $ref['object_ref'] ?? null );

            if ( ! $post_ids ) {
                ++$site_wide_count;
                continue;
            }

            foreach ( $post_ids as $post_id ) {
                $counts_by_post_id[ $post_id ] = ( $counts_by_post_id[ $post_id ] ?? 0 ) + 1;
            }
        }

        $pages = array();

        foreach ( $counts_by_post_id as $post_id => $count ) {
            $post = get_post( $post_id );

            if ( ! $post ) {
                continue;
            }

            $permalink = get_permalink( $post );

            $pages[] = array(
                'id'        => $post_id,
                'title'     => get_the_title( $post ) ?: __( '(no title)', 'vulopilot' ),
                'link'      => $permalink ? wp_make_link_relative( $permalink ) : null,
                'edit_link' => admin_url( "post.php?post={$post_id}&action=edit" ),
                'count'     => $count,
            );
        }

        usort( $pages, static fn( array $a, array $b ): int => $b['count'] <=> $a['count'] );

        if ( $site_wide_count > 0 ) {
            $pages[] = array(
                'id'        => 0,
                'title'     => __( 'Site-wide', 'vulopilot' ),
                'link'      => null,
                'edit_link' => null,
                'count'     => $site_wide_count,
            );
        }

        return $pages;
    }

    /**
     * Real numeric post ids one finding's `object_type`/`object_ref` points
     * at - empty for anything not page/post-scoped (a URL/site-wide
     * finding). `object_ref` is usually a single post id, but
     * DuplicateContentScanner writes a comma-joined list (one duplicate-
     * title finding spans multiple posts) - same split
     * seoIssuesShared.tsx's own bucketFindingsByPage() already does for the
     * SEO tables, applied here too so a scan's affected-pages list doesn't
     * undercount those.
     *
     * @param string|null $object_type e.g. 'post'.
     * @param string|null $object_ref  A post id, or a comma-joined list of post ids.
     * @return array<int, int>
     */
    private function extract_post_ids( ?string $object_type, ?string $object_ref ): array {
        if ( 'post' !== $object_type || null === $object_ref || '' === $object_ref ) {
            return array();
        }

        $ids = array_filter(
            array_map( 'absint', explode( ',', $object_ref ) )
        );

        return array_values( array_unique( $ids ) );
    }

    /**
     * Real detail for one ai_action.* timeline row, joined back to its
     * vulopilot_ai_action_runs source row - the real before/after text
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
            'id'              => (int) $run['id'],
            'action_id'       => $run['action_id'],
            'label'           => $action ? $action->get_label() : $run['action_id'],
            'status'          => $run['status'],
            'before'          => $preview['before'] ?? null,
            'after'           => $preview['after'] ?? null,
            'format'          => $preview['format'] ?? 'text',
            'error_message'   => $run['error_message'],
            'page'            => $this->resolve_page_link( $run['object_type'] ?? null, $run['object_ref'] ?? null ),
            // 'auto' when Automate Work's Auto-fix mode approved this run
            // itself (ActionRunner::approve()'s own $method param) - real
            // rows created before this column existed fall back to
            // 'manual', the only method that existed then.
            'approval_method' => $run['approval_method'] ?? 'manual',
        );
    }

    /**
     * Same "post permalink, else site-wide" resolution Findings.php's own
     * add_page_field() uses - object_type/object_ref are only ever set
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

/**
 * GET /reports backs src/pages/Reports/Reports.tsx's table; POST /reports
 * backs its "Generate report" action; GET /reports/types lists every
 * registered Reports\ReportTypeRegistry entry (what a "report builder" UI
 * would read to offer choices - see ReportTypeRegistry's own docblock for
 * why 'custom' isn't in that list itself); GET /reports/{id}/download
 * streams the generated file through this permission-checked handler
 * rather than ever exposing `file_path` to the client (DATABASE.md).
 *
 * POST now runs Reports\ReportGenerator::generate() synchronously - every
 * report type reads bounded, already-aggregated SQL (Reports\ReportGenerator's
 * own docblock), so this is a real generation, not the earlier `generating`-
 * status stub with no engine behind it.
 *
 * `vulopilot_report_creation_extra` fires after generation with the
 * request and the just-generated report row - a generic, Pro-agnostic
 * extension point (empty array by default) rather than this controller
 * knowing anything about what a caller might want to happen next.
 * vulopilot-pro's AdvancedReports module is the one real consumer today
 * (Module::maybe_email_created_report()): the Reports → Overview "Create
 * Report" modal is itself gated behind that module (Free has no working
 * "Create Report" UI at all without it - ReportsOverviewHeader.tsx's own
 * docblock), so its "Email this report after generation" checkbox's
 * `email`/`recipients` params only ever reach a real listener when Pro's
 * module is active; every other free entry point that posts here (this
 * page's own header Download action, Report Builder tab) never sends
 * them, so `$extra` is always `array()` for those.
 *
 * @class       Reports controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Reports extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'reports';

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
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/types',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_report_types' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/download',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'download_item' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
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
    public function create_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function get_items( $request ) {
        $repository = new ReportRepository();

        $result = $repository->find_all(
            array(
                'page'     => absint( $request->get_param( 'page' ) ) ?: 1,
                'per_page' => absint( $request->get_param( 'per_page' ) ) ?: 20,
                'status'   => sanitize_key( (string) $request->get_param( 'status' ) ),
                'orderby'  => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                'order'    => sanitize_key( (string) $request->get_param( 'order' ) ),
            )
        );

        // file_path is deliberately never exposed to the client (DATABASE.md) -
        // has_file tells the frontend whether the "Download" action is valid.
        $result['data'] = array_map(
            static function ( array $row ): array {
                $row['has_file'] = ! empty( $row['file_path'] );
                unset( $row['file_path'] );
                return $row;
            },
            $result['data']
        );

        $result['status_counts'] = $repository->get_status_counts();

        return rest_ensure_response( $result );
    }

    /**
     * Lists every registered report type - what a report-builder UI reads
     * to offer choices instead of the hardcoded 'scan_summary' the Reports
     * page used before this pass.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function get_report_types( $request ) {
        $types = array();

        foreach ( VuloPilot()->report_type_registry->get_all() as $report_type ) {
            $types[] = array(
                'id'    => $report_type->get_id(),
                'label' => $report_type->get_label(),
            );
        }

        return rest_ensure_response( $types );
    }

    /**
     * @inheritDoc
     */
    public function create_item( $request ) {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        $report_type      = sanitize_key( (string) $request->get_param( 'report_type' ) ) ?: 'scan_summary';
        $requested_format = sanitize_key( (string) $request->get_param( 'format' ) );
        $format           = $requested_format ?: (string) $settings['default_report_format'];

        // Only the *settings default* falls back silently to 'csv' when its
        // exporter isn't registered (e.g. the default was set to 'pdf' while
        // vulopilot-pro's AdvancedReports module was active, then it was
        // deactivated) - an explicitly requested format that isn't
        // registered still errors below, since silently substituting a
        // format the caller asked for by name would be surprising, not helpful.
        if ( ! $requested_format && ! VuloPilot()->report_exporter_registry->get_exporter( $format ) ) {
            $format = 'csv';
        }

        if ( ! VuloPilot()->report_exporter_registry->get_exporter( $format ) ) {
            return new \WP_Error( 'vulopilot_invalid_format', __( 'Unknown report format.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        if ( 'custom' !== $report_type && ! VuloPilot()->report_type_registry->get_report_type( $report_type ) ) {
            return new \WP_Error( 'vulopilot_invalid_report_type', __( 'Unknown report type.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $period_days  = max( 1, absint( $settings['default_report_period_days'] ) ?: 30 );
        $period_end   = sanitize_text_field( (string) $request->get_param( 'period_end' ) ) ?: current_time( 'Y-m-d' );
        $period_start = sanitize_text_field( (string) $request->get_param( 'period_start' ) ) ?: gmdate( 'Y-m-d', strtotime( '-' . ( $period_days - 1 ) . ' days', strtotime( $period_end ) ) );
        $included     = array_map( 'sanitize_key', (array) $request->get_param( 'included_types' ) );

        $id = VuloPilot()->report_generator->generate(
            $report_type,
            $format,
            $period_start,
            $period_end,
            array( 'included_types' => $included ),
            get_current_user_id()
        );

        $repository = new ReportRepository();
        $report     = $repository->find( $id );

        // Same "never expose file_path to the client" posture get_items()
        // already applies - the modal's own success state only needs
        // has_file to know whether "View"/"Download PDF" are valid yet.
        if ( $report ) {
            $report['has_file'] = ! empty( $report['file_path'] );
            unset( $report['file_path'] );
        }

        /**
         * Fires after a report is generated through this endpoint, filtered
         * through whatever extra response fields a listener wants to
         * contribute - see this class's own docblock for why this exists
         * (vulopilot-pro's AdvancedReports module is the one real consumer,
         * for its Pro-gated "Create Report" modal's optional email step).
         *
         * @param array<string, mixed>      $extra   Extra fields to merge into the response. Empty by default.
         * @param array<string, mixed>|null $report  The just-generated report row (file_path already stripped), or null.
         * @param \WP_REST_Request          $request Full details about the request.
         */
        $extra = apply_filters( 'vulopilot_report_creation_extra', array(), $report, $request );

        return rest_ensure_response(
            array_merge(
                (array) $report,
                array(
                    'success' => 'failed' !== ( $report['status'] ?? 'failed' ),
                    'id'      => $id,
                    'status'  => $report['status'] ?? 'failed',
                ),
                $extra
            )
        );
    }

    /**
     * Streams a generated report file rather than ever returning its
     * filesystem path to the client - same "don't trust the client with a
     * raw path" posture security.md's escaping/sanitizing baseline uses
     * elsewhere.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response|void
     */
    public function download_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new ReportRepository();
        $report     = $repository->find( $id );

        if ( ! $report ) {
            return new \WP_Error( 'vulopilot_report_not_found', __( 'Report not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        if ( 'ready' !== $report['status'] || empty( $report['file_path'] ) ) {
            return new \WP_Error( 'vulopilot_report_not_ready', __( 'This report is not ready to download yet.', 'vulopilot' ), array( 'status' => 409 ) );
        }

        $file_path = VuloPilot()->report_generator->resolve_file_path( basename( (string) $report['file_path'] ) );

        if ( ! file_exists( $file_path ) ) {
            return new \WP_Error( 'vulopilot_report_file_missing', __( 'This report\'s file could not be found on disk.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        $content_types = array(
            'csv'  => 'text/csv',
            'json' => 'application/json',
            'pdf'  => 'application/pdf',
        );

        nocache_headers();
        header( 'Content-Type: ' . ( $content_types[ $report['format'] ] ?? 'application/octet-stream' ) );
        header( 'Content-Disposition: attachment; filename="' . basename( $file_path ) . '"' );
        header( 'Content-Length: ' . filesize( $file_path ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_filesize -- reading the size of VuloPilot's own controlled reports file, not an arbitrary path.

        readfile( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile -- streaming VuloPilot's own controlled reports file to an already permission-checked, already-authenticated request; not arbitrary user input.
        exit;
    }
}

/**
 * GET /reports-overview?days=30 - backs Reports' redesigned Overview tab
 * (OverviewTab.tsx). Every number here is real, computed for a bounded
 * "current period" vs an equal-length "previous period" immediately
 * before it, using FindingRepository's own period-scoped queries
 * (get_stats_for_period()/count_resolved_between()/
 * get_severity_breakdown_for_category_as_of() - all pre-existing, this
 * controller is the first caller to combine them into one payload) rather
 * than a stored per-day snapshot history (that only exists for
 * `overall_score`, and only when Pro's AdvancedReports module is active -
 * see WebsiteProgressChart.tsx's own docblock). No arbitrary calendar
 * date-range picker: `days` is one of DAY_OPTIONS, same "few fixed
 * presets, not a full calendar" posture WebsiteProgressChart.tsx already
 * established for this exact page.
 *
 * The reference mockup's own "Search performance" panel (Google
 * impressions/clicks/CTR/average position, top pages gaining/losing
 * visibility) has no real backing anywhere in this codebase - no Search
 * Console (or any search-analytics) integration exists (confirmed via a
 * full-codebase search for "search console"/"impressions"/"gsc"). Rather
 * than fabricate those numbers, `seo_summary` below is a real substitute
 * with the same "how did this category do, what needs review" shape
 * `security_summary`/`content_summary` already use for their own panels.
 *
 * The mockup's "AI Visibility" panel's 5 named checks (AI-friendly
 * answers/Evidence & citations/AI-readable structure/Brand
 * understanding/AI crawler access) map cleanly onto 5 real GEO/AEO
 * scanners (AI_VISIBILITY_CHECKS below) - genuinely real, not a
 * substitute.
 *
 * @class       ReportsOverview controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class ReportsOverview extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'reports-overview';

    /**
     * Same 7 keys Dashboard::calculate_brand_score() already scores under
     * "brand", reused here for the "AI Visibility" category tile's own
     * geo+brand average - kept in sync with that method by hand, same as
     * every other duplicate copy of this exact list already in this
     * codebase (Dashboard.php's own class docblock explains why: small
     * literal list, several call sites, no shared constant anywhere they
     * could all reach).
     *
     * @var string[]
     */
    private const BRAND_SCANNER_IDS = array(
        'geo-trust-signals',
        'about-page-analysis',
        'geo-eeat-signals',
        'geo-author-info',
        'author-schema',
        'geo-entity-naming-consistency',
        'organization-schema',
    );

    /**
     * Same list Dashboard::calculate_content_score() already scores under
     * "content" - a mix of category 'content' (readability) and category
     * 'seo' (the other 5) scanners, per that method's own docblock.
     *
     * @var string[]
     */
    private const CONTENT_SCANNER_IDS = array(
        'readability',
        'thin-content',
        'duplicate-content',
        'heading-structure',
        'internal-linking',
        'orphan-pages',
    );

    /**
     * The mockup's 5 "AI Visibility" checks, each a real scanner id.
     *
     * @var array<int, array{label: string, scanner_id: string}>
     */
    private const AI_VISIBILITY_CHECKS = array(
        array( 'label' => 'AI-friendly answers', 'scanner_id' => 'aeo-schema' ),
        array( 'label' => 'Evidence & citations', 'scanner_id' => 'geo-eeat-signals' ),
        array( 'label' => 'AI-readable structure', 'scanner_id' => 'geo-semantic-structure' ),
        array( 'label' => 'Brand understanding', 'scanner_id' => 'geo-trust-signals' ),
        array( 'label' => 'AI crawler access', 'scanner_id' => 'ai-crawler-blocked-pages' ),
    );

    /**
     * Allowed `days` values - same 3-preset shape WebsiteProgressChart.tsx
     * already uses for this same page.
     *
     * @var int[]
     */
    private const DAY_OPTIONS = array( 7, 30, 90 );

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
    public function get_items( $request ) {
        $days = (int) $request->get_param( 'days' );
        $days = in_array( $days, self::DAY_OPTIONS, true ) ? $days : 30;

        $now            = current_time( 'timestamp', true );
        $period_end     = gmdate( 'Y-m-d H:i:s', $now );
        $period_start   = gmdate( 'Y-m-d H:i:s', $now - ( $days * DAY_IN_SECONDS ) );
        $compare_end    = $period_start;
        $compare_start  = gmdate( 'Y-m-d H:i:s', $now - ( 2 * $days * DAY_IN_SECONDS ) );

        $findings = new FindingRepository();

        return rest_ensure_response(
            array(
                'period'                => array(
                    'days'          => $days,
                    'start'         => $period_start,
                    'end'           => $period_end,
                    'compare_start' => $compare_start,
                    'compare_end'   => $compare_end,
                ),
                'summary'               => $this->build_summary( $findings, $period_start, $period_end, $compare_start, $compare_end ),
                'categories'            => $this->build_categories( $findings, $period_start, $compare_start ),
                'highlights'            => $this->build_highlights( $findings, $period_start, $compare_start ),
                'seo_summary'           => $this->build_category_panel( $findings, 'seo', $period_start, $period_end, $compare_start, $compare_end ),
                'security_summary'      => $this->build_category_panel( $findings, 'security', $period_start, $period_end, $compare_start, $compare_end ),
                'ai_visibility_summary' => $this->build_ai_visibility_summary( $findings, $period_start, $period_end ),
                'speed_summary'         => $this->build_speed_summary(),
                'content_summary'       => $this->build_content_summary( $findings, $period_start, $period_end ),
                'store_summary'         => $this->build_store_summary( $findings, $period_start, $period_end ),
                'next_priorities'       => $this->build_next_priorities( $findings ),
            )
        );
    }

    /**
     * Site-wide "Fixed / New / Still need attention" - the hero card's own
     * 3 stats, plus each one's real percent change vs the equal-length
     * period immediately before.
     *
     * @param FindingRepository $findings      Repository to read from.
     * @param string            $period_start  MySQL datetime (UTC).
     * @param string            $period_end    MySQL datetime (UTC).
     * @param string            $compare_start MySQL datetime (UTC).
     * @param string            $compare_end   MySQL datetime (UTC).
     * @return array
     */
    private function build_summary( FindingRepository $findings, string $period_start, string $period_end, string $compare_start, string $compare_end ): array {
        $fixed          = $findings->count_resolved_between( $period_start, $period_end );
        $fixed_previous = $findings->count_resolved_between( $compare_start, $compare_end );

        $period_stats   = $findings->get_stats_for_period( substr( $period_start, 0, 10 ), substr( $period_end, 0, 10 ) );
        $compare_stats  = $findings->get_stats_for_period( substr( $compare_start, 0, 10 ), substr( $compare_end, 0, 10 ) );

        $new          = $period_stats['total'];
        $new_previous = $compare_stats['total'];

        // "Still need attention" - open findings that were already open
        // before this period started (i.e. every currently-open finding,
        // minus the ones that are both open AND newly created this
        // period, which are already counted under "New" above).
        $current_open      = ( $findings->get_status_counts() )['open'];
        $new_still_open    = $period_stats['by_status']['open'] ?? 0;
        $still_open        = max( 0, $current_open - $new_still_open );
        $compare_new_still_open = $compare_stats['by_status']['open'] ?? 0;
        // The previous period's own "carried over" figure isn't
        // reconstructable without a second open-count "as of" the
        // compare period's end - approximated the same way
        // Dashboard::build_category_scores_as_of() already reconstructs
        // a past state: current open count, plus what's been resolved
        // since, minus what's been newly opened since (a finding open
        // today that already existed at the compare boundary).
        $resolved_since_compare_end = $findings->count_resolved_between( $compare_end, $period_end );
        $created_since_compare_end  = $findings->count_created_since( $compare_end );
        $open_at_compare_end        = max( 0, $current_open + $resolved_since_compare_end - $created_since_compare_end );
        $still_open_previous        = max( 0, $open_at_compare_end - $compare_new_still_open );

        return array(
            'fixed'                 => $fixed,
            'new'                   => $new,
            'still_open'            => $still_open,
            'fixed_delta_pct'       => $this->percent_change( $fixed, $fixed_previous ),
            'new_delta_pct'         => $this->percent_change( $new, $new_previous ),
            'still_open_delta_pct'  => $this->percent_change( $still_open, $still_open_previous ),
        );
    }

    /**
     * The "How is each part of my website doing?" 7-tile grid.
     *
     * @param FindingRepository $findings     Repository to read from.
     * @param string            $period_start MySQL datetime (UTC) - the "as of" boundary each score's delta is measured against.
     * @param string            $compare_start MySQL datetime (UTC) - unused directly, kept for signature symmetry with build_highlights().
     * @return array
     */
    private function build_categories( FindingRepository $findings, string $period_start, string $compare_start ): array {
        $has_woocommerce = class_exists( 'WooCommerce' );

        $geo_now  = $this->category_score( $findings, 'geo' );
        $geo_then = $this->category_score_as_of( $findings, 'geo', $period_start );
        $brand_now  = $this->scanner_ids_score( $findings, self::BRAND_SCANNER_IDS );
        $brand_then = $this->scanner_ids_score_as_of( $findings, self::BRAND_SCANNER_IDS, $period_start );
        $ai_visibility_now  = (int) round( ( $geo_now + $brand_now ) / 2 );
        $ai_visibility_then = (int) round( ( $geo_then + $brand_then ) / 2 );

        $content_now  = $this->scanner_ids_score( $findings, self::CONTENT_SCANNER_IDS );
        $content_then = $this->scanner_ids_score_as_of( $findings, self::CONTENT_SCANNER_IDS, $period_start );

        $tiles = array(
            array(
                'key'      => 'seo',
                'label'    => __( 'Getting Found', 'vulopilot' ),
                'sublabel' => __( 'SEO', 'vulopilot' ),
                'icon'     => 'search-discovery',
                'score'    => $this->category_score( $findings, 'seo' ),
                'delta'    => $this->category_score( $findings, 'seo' ) - $this->category_score_as_of( $findings, 'seo', $period_start ),
            ),
            array(
                'key'      => 'ai_visibility',
                'label'    => __( 'AI Visibility', 'vulopilot' ),
                'sublabel' => __( 'GEO + AEO', 'vulopilot' ),
                'icon'     => 'ai',
                'score'    => $ai_visibility_now,
                'delta'    => $ai_visibility_now - $ai_visibility_then,
            ),
            array(
                'key'      => 'performance',
                'label'    => __( 'Website Speed', 'vulopilot' ),
                'sublabel' => __( 'Performance', 'vulopilot' ),
                'icon'     => 'analytics',
                'score'    => $this->category_score( $findings, 'performance' ),
                'delta'    => $this->category_score( $findings, 'performance' ) - $this->category_score_as_of( $findings, 'performance', $period_start ),
            ),
            array(
                'key'      => 'security',
                'label'    => __( 'Security', 'vulopilot' ),
                'sublabel' => __( 'Protection', 'vulopilot' ),
                'icon'     => 'security',
                'score'    => $this->category_score( $findings, 'security' ),
                'delta'    => $this->category_score( $findings, 'security' ) - $this->category_score_as_of( $findings, 'security', $period_start ),
            ),
            array(
                'key'      => 'accessibility',
                'label'    => __( 'Accessibility', 'vulopilot' ),
                'sublabel' => __( 'Inclusion', 'vulopilot' ),
                'icon'     => 'accessibility',
                'score'    => $this->category_score( $findings, 'accessibility' ),
                'delta'    => $this->category_score( $findings, 'accessibility' ) - $this->category_score_as_of( $findings, 'accessibility', $period_start ),
            ),
            array(
                'key'      => 'content',
                'label'    => __( 'Content', 'vulopilot' ),
                'sublabel' => __( 'Creation', 'vulopilot' ),
                'icon'     => 'document',
                'score'    => $content_now,
                'delta'    => $content_now - $content_then,
            ),
            array(
                'key'      => 'woocommerce',
                'label'    => __( 'Store', 'vulopilot' ),
                'sublabel' => __( 'WooCommerce', 'vulopilot' ),
                'icon'     => 'woocommerce',
                'score'    => $has_woocommerce ? $this->category_score( $findings, 'woocommerce' ) : null,
                'delta'    => $has_woocommerce ? $this->category_score( $findings, 'woocommerce' ) - $this->category_score_as_of( $findings, 'woocommerce', $period_start ) : null,
            ),
        );

        foreach ( $tiles as &$tile ) {
            $tile['status'] = $this->status_for_tile( $tile['score'], $tile['delta'] );
        }
        unset( $tile );

        return $tiles;
    }

    /**
     * @param int|null $score Current 0-100 score, or null when not applicable.
     * @param int|null $delta Score change since the period started, or null.
     * @return string One of 'Not applicable'/'Improving'/'Needs attention'/'Excellent'/'Good'.
     */
    private function status_for_tile( ?int $score, ?int $delta ): string {
        if ( null === $score ) {
            return __( 'Not applicable', 'vulopilot' );
        }

        if ( $delta > 0 ) {
            return __( 'Improving', 'vulopilot' );
        }

        if ( $delta < 0 ) {
            return __( 'Needs attention', 'vulopilot' );
        }

        if ( $score >= 90 ) {
            return __( 'Excellent', 'vulopilot' );
        }

        if ( $score >= 70 ) {
            return __( 'Good', 'vulopilot' );
        }

        return __( 'Needs attention', 'vulopilot' );
    }

    /**
     * The hero card's own "up to 4" highlight rows - each a real category
     * score delta over the period, worded honestly (no claim beyond "up"/
     * "down"/"stable" plus the real point delta).
     *
     * @param FindingRepository $findings     Repository to read from.
     * @param string            $period_start MySQL datetime (UTC).
     * @param string            $compare_start MySQL datetime (UTC) - unused, kept for a future "vs previous period" wording pass.
     * @return array
     */
    private function build_highlights( FindingRepository $findings, string $period_start, string $compare_start ): array {
        $definitions = array(
            array( 'key' => 'seo', 'category' => 'seo', 'up' => __( 'Search visibility up', 'vulopilot' ), 'down' => __( 'Search visibility down', 'vulopilot' ), 'flat' => __( 'Search visibility remained stable', 'vulopilot' ) ),
            array( 'key' => 'performance', 'category' => 'performance', 'up' => __( 'Website became faster', 'vulopilot' ), 'down' => __( 'Website became slower', 'vulopilot' ), 'flat' => __( 'Website speed remained stable', 'vulopilot' ) ),
            array( 'key' => 'security', 'category' => 'security', 'up' => __( 'Security improved', 'vulopilot' ), 'down' => __( 'Security needs attention', 'vulopilot' ), 'flat' => __( 'Security remained stable', 'vulopilot' ) ),
            array( 'key' => 'geo', 'category' => 'geo', 'up' => __( 'AI visibility improved', 'vulopilot' ), 'down' => __( 'AI visibility needs attention', 'vulopilot' ), 'flat' => __( 'AI visibility remained stable', 'vulopilot' ) ),
        );

        $highlights = array();

        foreach ( $definitions as $definition ) {
            $now   = $this->category_score( $findings, $definition['category'] );
            $then  = $this->category_score_as_of( $findings, $definition['category'], $period_start );
            $delta = $now - $then;

            $direction = $delta > 0 ? 'up' : ( $delta < 0 ? 'down' : 'flat' );

            $highlights[] = array(
                'key'       => $definition['key'],
                'label'     => $definition[ $direction ],
                'direction' => $direction,
                'delta'     => $delta,
            );
        }

        return $highlights;
    }

    /**
     * The shared "N fixed / N new / N still open (+top open findings)"
     * shape both `seo_summary` and `security_summary` use.
     *
     * @param FindingRepository $findings      Repository to read from.
     * @param string            $category      Category string.
     * @param string            $period_start  MySQL datetime (UTC).
     * @param string            $period_end    MySQL datetime (UTC).
     * @param string            $compare_start MySQL datetime (UTC).
     * @param string            $compare_end   MySQL datetime (UTC).
     * @return array
     */
    private function build_category_panel( FindingRepository $findings, string $category, string $period_start, string $period_end, string $compare_start, string $compare_end ): array {
        $fixed        = $findings->count_resolved_between( $period_start, $period_end, $category );
        $period_stats = $findings->get_stats_for_period( substr( $period_start, 0, 10 ), substr( $period_end, 0, 10 ), $category );
        $new          = $period_stats['total'];
        $current_open = ( $findings->get_status_counts( $category ) )['open'];
        $still_open   = max( 0, $current_open - ( $period_stats['by_status']['open'] ?? 0 ) );

        $top_open = array_map(
            static function ( $row ) {
                return array(
                    'id'       => (int) $row['id'],
                    'title'    => $row['title'],
                    'severity' => $row['severity'],
                );
            },
            array_slice( $findings->get_top_findings_for_period( gmdate( 'Y-m-d', strtotime( '-1 year' ) ), gmdate( 'Y-m-d' ), $category, 3 ), 0, 3 )
        );

        return array(
            'fixed'      => $fixed,
            'new'        => $new,
            'still_open' => $still_open,
            'top_open'   => $top_open,
        );
    }

    /**
     * The 5 real GEO/AEO checks AI_VISIBILITY_CHECKS maps out - each
     * check's status is "Improved" when more of its own findings were
     * fixed than newly opened this period, "Needs work" when the reverse,
     * "Stable" (or "Good" with zero open findings) otherwise.
     *
     * @param FindingRepository $findings     Repository to read from.
     * @param string            $period_start MySQL datetime (UTC).
     * @param string            $period_end   MySQL datetime (UTC).
     * @return array
     */
    private function build_ai_visibility_summary( FindingRepository $findings, string $period_start, string $period_end ): array {
        $checks = array();

        foreach ( self::AI_VISIBILITY_CHECKS as $definition ) {
            $scanner_ids = array( $definition['scanner_id'] );
            $fixed       = $findings->count_resolved_between( $period_start, $period_end, null, $scanner_ids );
            $stats       = $findings->get_stats_for_period( substr( $period_start, 0, 10 ), substr( $period_end, 0, 10 ), null, $scanner_ids );
            $open        = ( $findings->get_status_counts( null, $scanner_ids ) )['open'];

            if ( $fixed > $stats['total'] ) {
                $status = __( 'Improved', 'vulopilot' );
            } elseif ( 0 === $open ) {
                $status = __( 'Good', 'vulopilot' );
            } else {
                $status = $stats['total'] > $fixed ? __( 'Needs work', 'vulopilot' ) : __( 'Stable', 'vulopilot' );
            }

            $checks[] = array(
                'label'      => $definition['label'],
                'scanner_id' => $definition['scanner_id'],
                'status'     => $status,
                'open_count' => $open,
            );
        }

        return array( 'checks' => $checks );
    }

    /**
     * The mockup's "Website Speed" panel - real page-speed score-band
     * counts + real average desktop/mobile scores
     * (PageSpeedRepository::get_summary(), extended for this - see that
     * method's own docblock).
     *
     * @return array
     */
    private function build_speed_summary(): array {
        $summary = ( new PageSpeedRepository() )->get_summary();

        return array(
            'score'               => $summary['avg_score'],
            'pages_improved'      => $summary['good'],
            'pages_need_attention' => $summary['slow'] + $summary['needs_improvement'],
            'avg_score'           => $summary['avg_score'],
            'avg_mobile_score'    => $summary['avg_mobile_score'],
            'total_pages'         => $summary['total'],
        );
    }

    /**
     * The mockup's "Content Progress" panel. "Pages improved"/"Older
     * pages to review" are real Findings data (CONTENT_SCANNER_IDS,
     * same shape build_category_panel() uses); "New pieces published"/
     * "Drafts in progress" are real WordPress post-status counts - a
     * genuinely different, equally real, data source, not fabricated.
     *
     * @param FindingRepository $findings     Repository to read from.
     * @param string            $period_start MySQL datetime (UTC).
     * @param string            $period_end   MySQL datetime (UTC).
     * @return array
     */
    private function build_content_summary( FindingRepository $findings, string $period_start, string $period_end ): array {
        $fixed        = $findings->count_resolved_between( $period_start, $period_end, null, self::CONTENT_SCANNER_IDS );
        $period_stats = $findings->get_stats_for_period( substr( $period_start, 0, 10 ), substr( $period_end, 0, 10 ), null, self::CONTENT_SCANNER_IDS );
        $current_open = ( $findings->get_status_counts( null, self::CONTENT_SCANNER_IDS ) )['open'];
        $still_open   = max( 0, $current_open - ( $period_stats['by_status']['open'] ?? 0 ) );

        $new_published = (int) ( new \WP_Query(
            array(
                'post_type'      => 'post',
                'post_status'    => 'publish',
                'date_query'     => array(
                    array(
                        'after'     => $period_start,
                        'inclusive' => true,
                    ),
                ),
                'fields'         => 'ids',
                'posts_per_page' => 1,
                'no_found_rows'  => false,
            )
        ) )->found_posts;

        $drafts = (int) ( new \WP_Query(
            array(
                'post_type'      => 'post',
                'post_status'    => 'draft',
                'fields'         => 'ids',
                'posts_per_page' => 1,
                'no_found_rows'  => false,
            )
        ) )->found_posts;

        return array(
            'pages_improved'      => $fixed,
            'new_published'       => $new_published,
            'older_to_review'     => $still_open,
            'drafts_in_progress'  => $drafts,
        );
    }

    /**
     * The mockup's "Store Performance" panel - `available: false` (with
     * every other field null) when WooCommerce isn't active, same
     * "Not applicable" honesty CategoryScoresGrid.tsx already established
     * for this exact case. `sales`/`orders`/`avg_order` come from real
     * `wc_get_orders()` order totals for the period - the same function
     * Basic\WooCommerceFailedOrdersScanner/WooCommerceStalePendingOrdersScanner
     * already use for their own real order queries.
     *
     * @param FindingRepository $findings     Repository to read from.
     * @param string            $period_start MySQL datetime (UTC).
     * @param string            $period_end   MySQL datetime (UTC).
     * @return array
     */
    private function build_store_summary( FindingRepository $findings, string $period_start, string $period_end ): array {
        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_orders' ) ) {
            return array(
                'available'          => false,
                'blockers_fixed'     => null,
                'new_issues'         => null,
                'products_to_review' => null,
                'sales'              => null,
                'orders'             => null,
                'avg_order'          => null,
                'currency'           => null,
            );
        }

        $fixed        = $findings->count_resolved_between( $period_start, $period_end, 'woocommerce' );
        $period_stats = $findings->get_stats_for_period( substr( $period_start, 0, 10 ), substr( $period_end, 0, 10 ), 'woocommerce' );
        $current_open = ( $findings->get_status_counts( 'woocommerce' ) )['open'];

        $orders = wc_get_orders(
            array(
                'status'       => wc_get_is_paid_statuses(),
                'date_created' => gmdate( 'Y-m-d', strtotime( $period_start ) ) . '...' . gmdate( 'Y-m-d', strtotime( $period_end ) ),
                'limit'        => -1,
                'return'       => 'objects',
            )
        );

        $sales = 0.0;
        foreach ( $orders as $order ) {
            $sales += (float) $order->get_total();
        }
        $order_count = count( $orders );

        return array(
            'available'          => true,
            'blockers_fixed'     => $fixed,
            'new_issues'         => $period_stats['total'],
            'products_to_review' => $current_open,
            'sales'              => round( $sales, 2 ),
            'orders'             => $order_count,
            'avg_order'          => $order_count > 0 ? round( $sales / $order_count, 2 ) : 0,
            'currency'           => get_woocommerce_currency(),
        );
    }

    /**
     * The mockup's "Your next priorities" - the 3 highest-severity
     * currently-open findings, site-wide.
     *
     * @param FindingRepository $findings Repository to read from.
     * @return array
     */
    private function build_next_priorities( FindingRepository $findings ): array {
        return array_map(
            static function ( $row ) {
                return array(
                    'id'          => (int) $row['id'],
                    'title'       => $row['title'],
                    'description' => $row['description'],
                    'severity'    => $row['severity'],
                    'category'    => $row['category'],
                );
            },
            $findings->get_top_open_findings( 3 )
        );
    }

    /**
     * @param int $current  Current value.
     * @param int $previous Previous value.
     * @return float|null Percent change, or null when $previous is 0 (an undefined percent change, not a 0% one).
     */
    private function percent_change( int $current, int $previous ): ?float {
        if ( 0 === $previous ) {
            return null;
        }

        return round( ( ( $current - $previous ) / $previous ) * 100, 1 );
    }

    /**
     * Same weighting formula Dashboard::calculate_category_score() uses,
     * applied to a *current* severity breakdown - duplicated here rather
     * than shared, same posture Dashboard.php's own class docblock
     * documents for this exact formula's other 3 internal copies.
     *
     * @param FindingRepository $findings Repository to read from.
     * @param string            $category Category string.
     * @return int 0-100.
     */
    private function category_score( FindingRepository $findings, string $category ): int {
        return $this->score_from_breakdown( $findings->get_severity_breakdown_for_category( $category ) );
    }

    /**
     * Same formula as category_score(), reconstructed as of a past moment
     * via get_severity_breakdown_for_category_as_of() - what every score
     * delta in this controller is measured against.
     *
     * @param FindingRepository $findings Repository to read from.
     * @param string            $category Category string.
     * @param string            $as_of    MySQL datetime (UTC).
     * @return int 0-100.
     */
    private function category_score_as_of( FindingRepository $findings, string $category, string $as_of ): int {
        return $this->score_from_breakdown( $findings->get_severity_breakdown_for_category_as_of( $category, $as_of ) );
    }

    /**
     * @param FindingRepository $findings    Repository to read from.
     * @param string[]          $scanner_ids Scanner ids to score.
     * @return int 0-100.
     */
    private function scanner_ids_score( FindingRepository $findings, array $scanner_ids ): int {
        return $this->score_from_breakdown( $findings->get_severity_breakdown_for_scanner_ids( $scanner_ids ) );
    }

    /**
     * @param FindingRepository $findings    Repository to read from.
     * @param string[]          $scanner_ids Scanner ids to score.
     * @param string             $as_of       MySQL datetime (UTC).
     * @return int 0-100.
     */
    private function scanner_ids_score_as_of( FindingRepository $findings, array $scanner_ids, string $as_of ): int {
        return $this->score_from_breakdown( $findings->get_severity_breakdown_for_scanner_ids_as_of( $scanner_ids, $as_of ) );
    }

    /**
     * @param array{critical: int, high: int, medium: int, low: int} $breakdown Severity counts to score.
     * @return int 0-100.
     */
    private function score_from_breakdown( array $breakdown ): int {
        $score = 100
            - ( $breakdown['critical'] * 15 )
            - ( $breakdown['high'] * 8 )
            - ( $breakdown['medium'] * 3 )
            - ( $breakdown['low'] * 1 );

        return max( 0, min( 100, $score ) );
    }
}
