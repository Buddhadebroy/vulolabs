<?php
/**
 * Findings controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\ValueObjects\Severity;
use VuloPilot\Repositories\FindingRepository;

defined( 'ABSPATH' ) || exit;

/**
 * GET /findings backs the shared FindingsTable component (Health/SEO/GEO/
 * WooCommerce/Dashboard pages — src/components/FindingsTable.tsx).
 * POST /findings/{id} backs its "Mark resolved" row action.
 *
 * Zyra's sendApiResponse() (src/services/useApiList.ts and
 * FindingsTable.tsx's handleResolve) always issues a plain POST
 * regardless of semantic intent, so the sub-route accepts
 * WP_REST_Server::EDITABLE (POST/PUT/PATCH) rather than a stricter
 * single-verb registration — matching the client, not an idealized REST
 * verb choice it doesn't actually use.
 *
 * @class       Findings controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Findings extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'findings';

    /**
     * GET /findings/groups' own `priority` param (one of the Issues table's
     * High/Medium/Low stat tiles) mapped to FindingRepository::get_finding_groups()'s
     * severity->rank scale — same 3-tier collapse get_priority_counts()
     * already applies for those tiles' own counts (critical folds into
     * "high", info folds into "low"), kept here rather than in the
     * repository since it's a request-param translation, not persistence.
     *
     * @var array<string, int[]>
     */
    private const PRIORITY_SEVERITY_RANKS = array(
        'high'   => array( 0, 1 ),
        'medium' => array( 2 ),
        'low'    => array( 3, 4 ),
    );

    /**
     * GET /findings' own `priority` param (the "Schema & Knowledge" tab's
     * Issues section — its Critical/Important/Minor pill bar) mapped to a
     * real `severity` IN(...) filter — same 3-tier collapse
     * PRIORITY_SEVERITY_RANKS above already applies for `get_finding_groups()`,
     * expressed here as real severity values (not ranks) since get_items()
     * filters through FindingRepository::find_all()'s own `severity`
     * filterable column, which AbstractRepository::build_column_where_clause()
     * already turns into a real `IN (...)` clause when given an array.
     *
     * @var array<string, string[]>
     */
    private const PRIORITY_SEVERITY_LABELS = array(
        'high'   => array( 'critical', 'high' ),
        'medium' => array( 'medium' ),
        'low'    => array( 'low', 'info' ),
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

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_item' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/bulk',
            array(
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'bulk_update_items' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // AI Copilot's "Needs your attention" card (NeedsAttentionCard.tsx)
        // — a dedicated summary shape (priority-bucketed counts + top
        // issue-type groups) rather than overloading this controller's own
        // GET /findings row-list contract, which FindingsTable/every
        // category page already depends on unchanged.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/attention-summary',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_attention_summary' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        // AI Copilot's Issues table (IssuesList.tsx) — every
        // open finding grouped by issue type (scanner_id), paginated,
        // instead of GET /findings' own one-row-per-individual-finding
        // shape. Its own route, not a `group_by` param on GET /findings
        // itself, since the response shape is fundamentally different
        // (grouped counts + a representative sample, not a row list) and
        // every existing GET /findings consumer (FindingsTable.tsx et al.)
        // depends on the row-list shape unchanged.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/groups',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_finding_groups' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        // "Manual Actions Only" (readme.txt) — runs one registered
        // Automation\ActionRegistry action against this specific finding,
        // right now, via Automation\ManualActionRunner. No trigger, rule,
        // or `vulopilot_automations` row involved — see that class's own
        // docblock for how this differs from vulopilot-pro's Automation
        // module.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/actions/(?P<action_id>[a-z0-9-]+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'run_manual_action' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
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
    public function update_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function get_items( $request ) {
        $repository = new FindingRepository();

        $category    = sanitize_key( (string) $request->get_param( 'category' ) );
        $severity    = sanitize_key( (string) $request->get_param( 'severity' ) );
        $status      = sanitize_key( (string) $request->get_param( 'status' ) );
        $search      = sanitize_text_field( (string) $request->get_param( 'search' ) );
        $scanner_ids = $this->parse_comma_separated_list( $request->get_param( 'scanner_id' ) );
        $priority    = sanitize_key( (string) $request->get_param( 'priority' ) );

        if ( '' !== $severity && ! Severity::is_valid( $severity ) ) {
            return new \WP_Error( 'vulopilot_invalid_severity', __( 'Invalid severity filter.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        // `priority` (the "Schema & Knowledge" tab's Issues section —
        // Critical/Important/Minor pills) is a display-only relabeling of
        // the same real severity values — never both at once in practice,
        // but `severity` wins if a caller somehow sends both, same
        // "explicit single value beats a derived one" precedence every
        // other param on this endpoint already has.
        $severity_filter = $severity;
        if ( '' === $severity_filter && '' !== $priority && isset( self::PRIORITY_SEVERITY_LABELS[ $priority ] ) ) {
            $severity_filter = self::PRIORITY_SEVERITY_LABELS[ $priority ];
        }

        $result                  = $repository->find_all(
            array(
                'page'       => absint( $request->get_param( 'page' ) ) ?: 1,
                'per_page'   => absint( $request->get_param( 'per_page' ) ) ?: 20,
                'category'   => $category,
                'severity'   => $severity_filter,
                'status'     => $status,
                'search'     => $search,
                'scanner_id' => $scanner_ids ?? '',
                'orderby'    => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                'order'      => sanitize_key( (string) $request->get_param( 'order' ) ),
            )
        );
        $result['status_counts'] = $repository->get_status_counts( '' !== $category ? $category : null, $scanner_ids );
        $result['data']          = array_map( array( $this, 'add_page_field' ), $result['data'] );

        // Real Critical/Important/Minor pill counts, scoped to this
        // request's own scanner_id set — reuses
        // get_severity_breakdown_for_scanner_ids(), the same method
        // SchemaCoverageAnalyzer already calls for its own "open problems"
        // total. Only populated when scanner_id was given: this method's
        // sitewide `priority_counts` already exists via `get_priority_counts()`
        // elsewhere, so a scanner-agnostic caller has no use for a second,
        // differently-scoped copy of the same shape.
        if ( $scanner_ids ) {
            $breakdown                 = $repository->get_severity_breakdown_for_scanner_ids( $scanner_ids );
            $result['priority_counts'] = array(
                'high'   => ( $breakdown['critical'] ?? 0 ) + ( $breakdown['high'] ?? 0 ),
                'medium' => $breakdown['medium'] ?? 0,
                'low'    => $breakdown['low'] ?? 0,
            );
        }

        return rest_ensure_response(
            // Lets a Pro module (vulopilot-pro's OneClickFix) annotate each
            // row with a `fix_action_id` without Free knowing anything
            // about AI-action-to-scanner mapping — same "register a
            // source, don't modify the host" pattern as
            // vulopilot_reports_advanced_panel/vulopilot_pro_dashboard_component.
            apply_filters( 'vulopilot_finding_list_response', $result )
        );
    }

    /**
     * GET /findings/attention-summary — real open-findings counts bucketed
     * into 3 priority tiers, plus the top 3 issue types (grouped by
     * scanner_id, most severe first), each annotated with its scanner's
     * human `get_label()` so the client never has to hardcode a
     * scanner_id → label map. See FindingRepository::get_priority_counts()/
     * get_top_finding_groups() for how each half is computed.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function get_attention_summary( $request ) {
        $repository      = new FindingRepository();
        $priority_counts = $repository->get_priority_counts();
        $groups          = $repository->get_top_finding_groups( 3 );

        $groups = array_map(
            static function ( array $group ): array {
                $scanner        = VuloPilot()->scanner_registry->get_scanner( $group['scanner_id'] );
                $group['label'] = $scanner ? $scanner->get_label() : $group['scanner_id'];

                return $group;
            },
            $groups
        );

        return rest_ensure_response(
            array(
                'total'           => array_sum( $priority_counts ),
                'priority_counts' => $priority_counts,
                'groups'          => $groups,
            )
        );
    }

    /**
     * GET /findings/groups — AI Copilot's Issues table (IssuesList.tsx):
     * every open finding grouped by issue type, paginated and optionally
     * scoped to one category and/or one priority tier, each group
     * annotated with its scanner's real `get_label()` and one real
     * representative finding (`sample`) so the client's row/detail-panel
     * copy is never fabricated — see FindingRepository::get_finding_groups()
     * for how the grouping itself is computed.
     *
     * Also backs the "Schema & Knowledge" tab's own grouped Issues section
     * (IssuesSection.tsx) via this same route's `scanner_id` param (comma-
     * separated, same `parse_comma_separated_list()` GET /findings' own
     * `scanner_id` already uses) — when given, `priority_counts` is scoped
     * to exactly that scanner_id set too
     * (get_priority_counts_for_scanner_ids()) rather than the sitewide
     * figure every category-tab caller wants, since a scanner_id-scoped
     * caller has no category tabs of its own to fall back on for context.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function get_finding_groups( $request ) {
        $repository  = new FindingRepository();
        $categories  = $this->parse_comma_separated_list( $request->get_param( 'category' ) );
        $scanner_ids = $this->parse_comma_separated_list( $request->get_param( 'scanner_id' ) );
        $priority    = sanitize_key( (string) $request->get_param( 'priority' ) );

        $page     = absint( $request->get_param( 'page' ) );
        $per_page = absint( $request->get_param( 'per_page' ) );

        $result = $repository->get_finding_groups(
            array(
                'status'         => 'open',
                'category'       => $categories ?? '',
                'scanner_ids'    => $scanner_ids ?? array(),
                'priority_ranks' => self::PRIORITY_SEVERITY_RANKS[ $priority ] ?? array(),
                'page'           => $page > 0 ? $page : 1,
                'per_page'       => $per_page > 0 ? $per_page : 20,
            )
        );

        $result['data'] = array_map(
            function ( array $group ) use ( $repository ): array {
                $scanner        = VuloPilot()->scanner_registry->get_scanner( $group['scanner_id'] );
                $group['label'] = $scanner ? $scanner->get_label() : $group['scanner_id'];

                $sample = $repository->find_all(
                    array(
                        'scanner_id' => $group['scanner_id'],
                        'status'     => 'open',
                        'per_page'   => 1,
                        'orderby'    => 'id',
                        'order'      => 'desc',
                    )
                );

                $group['sample'] = $sample['data'][0] ?? null;

                if ( $group['sample'] ) {
                    $group['sample'] = $this->add_page_field( $group['sample'] );
                }

                return $group;
            },
            $result['data']
        );

        $result['priority_counts'] = $scanner_ids
            ? $repository->get_priority_counts_for_scanner_ids( $scanner_ids )
            : $repository->get_priority_counts();
        $result['category_counts'] = $repository->get_category_group_counts();

        return rest_ensure_response( $result );
    }

    /**
     * Resolves each row's raw `object_type`/`object_ref` DB columns into a
     * human-readable `page` field the client can display directly (GEO.tsx's
     * compact FindingsTable layout — "$page · Detected $date", the same
     * meta line the dashboard mockup's own FindingRow shows) rather than a
     * bare post ID or the `home_url('/')` placeholder ref sitewide scanners
     * write (see GeoAnalysis\GeoAnalyzer::calculate_deterministic_score()'s
     * own docblock on that placeholder).
     *
     * @param array<string, mixed> $row One row from FindingRepository::find_all()'s `data`.
     * @return array<string, mixed> Same row, with a `page` key added.
     */
    private function add_page_field( array $row ): array {
        $object_type = $row['object_type'] ?? null;
        $object_ref  = $row['object_ref'] ?? null;

        if ( 'post' === $object_type && is_numeric( $object_ref ) ) {
            $permalink   = get_permalink( (int) $object_ref );
            $row['page'] = $permalink ? wp_make_link_relative( $permalink ) : __( 'Site-wide', 'vulopilot' );

            return $row;
        }

        if ( is_string( $object_ref ) && untrailingslashit( $object_ref ) === untrailingslashit( home_url( '/' ) ) ) {
            $row['page'] = __( 'Site-wide', 'vulopilot' );

            return $row;
        }

        if ( is_string( $object_ref ) && filter_var( $object_ref, FILTER_VALIDATE_URL ) ) {
            $row['page'] = wp_make_link_relative( $object_ref );

            return $row;
        }

        $row['page'] = __( 'Site-wide', 'vulopilot' );

        return $row;
    }

    /**
     * SEO.tsx's per-section tables (e.g. "Titles & meta") pass a
     * comma-separated `scanner_id` param covering every scanner id that
     * section groups together, since FindingRepository::find_all()'s
     * filterable_columns only exact-matches a single scalar per column
     * value unless given an array (AbstractRepository::build_column_where_clause()).
     * A single value (no comma) still round-trips correctly as a
     * one-element array. Also backs `get_finding_groups()`'s own `category`
     * param — the Issues table's "SEO & Visibility" tab, for example, folds
     * 4 real category values into one tab (see IssuesFilterTabs in the
     * frontend's issuesTypes.ts) — same shape, same reasoning.
     *
     * @param mixed $raw_param Raw comma-separated request param.
     * @return string[]|null Sanitized values, or null when the param was empty/absent.
     */
    private function parse_comma_separated_list( $raw_param ): ?array {
        if ( empty( $raw_param ) ) {
            return null;
        }

        $scanner_ids = array_filter( array_map( 'sanitize_key', explode( ',', (string) $raw_param ) ) );

        return $scanner_ids ? array_values( $scanner_ids ) : null;
    }

    /**
     * @inheritDoc
     */
    public function update_item( $request ) {
        $id     = absint( $request->get_param( 'id' ) );
        $status = sanitize_key( (string) $request->get_param( 'status' ) );

        $allowed_statuses = array( 'open', 'resolved', 'ignored', 'snoozed' );

        if ( ! in_array( $status, $allowed_statuses, true ) ) {
            return new \WP_Error( 'vulopilot_invalid_status', __( 'Invalid finding status.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $repository = new FindingRepository();

        if ( ! $repository->find( $id ) ) {
            return new \WP_Error( 'vulopilot_finding_not_found', __( 'Finding not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        $updated = $repository->update(
            $id,
            array(
                'status'      => $status,
                'resolved_at' => 'resolved' === $status ? current_time( 'mysql', true ) : null,
            )
        );

        if ( ! $updated ) {
            return new \WP_Error( 'vulopilot_update_failed', __( 'Could not update this finding.', 'vulopilot' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response(
            array(
				'success' => true,
				'id'      => $id,
            )
        );
    }

    /**
     * Backs FindingsTable.tsx's bulk Resolve/Ignore action — applies the
     * same status update update_item() does, to every id in one request,
     * via AbstractRepository::bulk_update()'s single-row-update loop.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function bulk_update_items( $request ) {
        $ids    = array_map( 'absint', (array) $request->get_param( 'ids' ) );
        $status = sanitize_key( (string) $request->get_param( 'status' ) );

        if ( ! in_array( $status, array( 'resolved', 'ignored' ), true ) ) {
            return new \WP_Error( 'vulopilot_invalid_status', __( 'Invalid bulk finding status.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        if ( empty( $ids ) ) {
            return new \WP_Error( 'vulopilot_no_ids', __( 'No findings selected.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $repository    = new FindingRepository();
        $updated_count = $repository->bulk_update(
            $ids,
            array(
                'status'      => $status,
                'resolved_at' => 'resolved' === $status ? current_time( 'mysql', true ) : null,
            )
        );

        return rest_ensure_response(
            array(
                'success' => true,
                'updated' => $updated_count,
            )
        );
    }

    /**
     * Backs FindingsTable.tsx's "Snooze" row action (and any other
     * registered manual action) via Automation\ManualActionRunner.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function run_manual_action( $request ) {
        $finding_id = absint( $request->get_param( 'id' ) );
        $action_id  = sanitize_key( (string) $request->get_param( 'action_id' ) );

        try {
            $result = VuloPilot()->manual_action_runner->run( $finding_id, $action_id );
        } catch ( \InvalidArgumentException $exception ) {
            return new \WP_Error( 'vulopilot_manual_action_invalid', $exception->getMessage(), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $result->to_array() );
    }
}
