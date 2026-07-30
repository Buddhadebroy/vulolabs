<?php
/**
 * GeoAnalysis controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\FindingRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /geo-analysis/top-pages` — the GEO page's "Top Pages" card. This
 * filename previously hosted the per-post AI GEO score read/generate
 * routes too; those moved to vulopilot-pro's GeoInsights module (see that
 * module's `Rest.php`, registered at the same `geo-analysis` base but a
 * `/(?P<post_id>\d+)` sub-route, since generating a score is a real AI
 * call) — this route doesn't collide with that one (a literal `top-pages`
 * never matches a digits-only regex), and stays in Free deliberately: it's
 * a purely deterministic ranking over already-persisted
 * `vulopilot_scan_findings` rows, no AI call, no cost, nothing that needs
 * gating.
 *
 * Ranks by open `geo`-category finding count per post rather than by
 * GeoAnalysis\GeoAnalyzer's own AI-judged score — that score only exists
 * for posts an admin (or Pro's VisibilitySnapshotBuilder sample) has
 * explicitly analyzed, so ranking by it would silently exclude every
 * post nobody has ever run an AI analysis on. Finding count is the one
 * GEO-health signal every scanned post always has.
 *
 * @class       GeoAnalysis controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class GeoAnalysis extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'geo-analysis';

    /**
     * Posts with zero open findings aren't returned by the SQL grouping
     * below (there's no row to group), so they're appended separately,
     * capped to this many, to fill out the "best" list honestly rather
     * than only ever showing posts that have at least one finding.
     */
    private const MAX_ZERO_FINDING_FILL = 20;

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            \VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/top-pages',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_top_pages' ),
                    'permission_callback' => array( $this, 'get_top_pages_permissions_check' ),
                ),
            )
        );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function get_top_pages_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_top_pages( $request ) {
        $requested_limit = absint( $request->get_param( 'limit' ) );
        $limit           = min( 20, max( 1, $requested_limit ? $requested_limit : 5 ) );
        $counts          = ( new FindingRepository() )->count_by_column(
            'object_ref',
            array(
				'category' => 'geo',
				'status'   => 'open',
			)
        );

        $ranked = array();

        foreach ( $counts as $post_id => $open_findings ) {
            $ranked[] = $this->build_row( (int) $post_id, (int) $open_findings );
        }

        $ranked = array_values( array_filter( $ranked ) );

        $zero_finding_posts = $this->get_zero_finding_posts( array_column( $ranked, 'post_id' ) );

        foreach ( $zero_finding_posts as $post_id ) {
            $ranked[] = $this->build_row( $post_id, 0 );
        }

        usort( $ranked, static fn( $a, $b ) => $a['open_findings'] <=> $b['open_findings'] );

        return rest_ensure_response(
            array(
				'top'    => array_slice( $ranked, 0, $limit ),
				'bottom' => array_slice( array_reverse( $ranked ), 0, $limit ),
			)
        );
    }

    /**
     * @param int $post_id       Post to build a row for.
     * @param int $open_findings Its already-known open GEO finding count.
     * @return array{post_id: int, title: string, edit_link: string, permalink: string, open_findings: int}|null Null if the post no longer exists.
     */
    private function build_row( int $post_id, int $open_findings ): ?array {
        $post = get_post( $post_id );

        if ( ! $post || 'publish' !== $post->post_status ) {
            return null;
        }

        return array(
            'post_id'       => $post_id,
            'title'         => get_the_title( $post ),
            'edit_link'     => get_edit_post_link( $post_id, 'raw' ),
            'permalink'     => get_permalink( $post ),
            'open_findings' => $open_findings,
        );
    }

    /**
     * Published posts/pages with no open GEO finding at all, capped to
     * MAX_ZERO_FINDING_FILL — see get_top_pages()'s own docblock for why
     * these need a separate query rather than falling out of the grouped
     * count above.
     *
     * @param int[] $exclude_post_ids Post ids already counted (have at least one open finding), skip these.
     * @return int[]
     */
    private function get_zero_finding_posts( array $exclude_post_ids ): array {
        $query_args = array(
            'post_type'      => array( 'post', 'page' ),
            'post_status'    => 'publish',
            'posts_per_page' => self::MAX_ZERO_FINDING_FILL,
            'orderby'        => 'modified',
            'order'          => 'DESC',
            'fields'         => 'ids',
        );

        if ( $exclude_post_ids ) {
            $query_args['post__not_in'] = $exclude_post_ids;
        }

        return get_posts( $query_args );
    }
}
