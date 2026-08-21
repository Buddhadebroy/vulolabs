<?php
/**
 * ReportsOverview controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\PageSpeedRepository;

defined( 'ABSPATH' ) || exit;

/**
 * GET /reports-overview?days=30 — backs Reports' redesigned Overview tab
 * (OverviewTab.tsx). Every number here is real, computed for a bounded
 * "current period" vs an equal-length "previous period" immediately
 * before it, using FindingRepository's own period-scoped queries
 * (get_stats_for_period()/count_resolved_between()/
 * get_severity_breakdown_for_category_as_of() — all pre-existing, this
 * controller is the first caller to combine them into one payload) rather
 * than a stored per-day snapshot history (that only exists for
 * `overall_score`, and only when Pro's AdvancedReports module is active —
 * see WebsiteProgressChart.tsx's own docblock). No arbitrary calendar
 * date-range picker: `days` is one of DAY_OPTIONS, same "few fixed
 * presets, not a full calendar" posture WebsiteProgressChart.tsx already
 * established for this exact page.
 *
 * The reference mockup's own "Search performance" panel (Google
 * impressions/clicks/CTR/average position, top pages gaining/losing
 * visibility) has no real backing anywhere in this codebase — no Search
 * Console (or any search-analytics) integration exists (confirmed via a
 * full-codebase search for "search console"/"impressions"/"gsc"). Rather
 * than fabricate those numbers, `seo_summary` below is a real substitute
 * with the same "how did this category do, what needs review" shape
 * `security_summary`/`content_summary` already use for their own panels.
 *
 * The mockup's "AI Visibility" panel's 5 named checks (AI-friendly
 * answers/Evidence & citations/AI-readable structure/Brand
 * understanding/AI crawler access) map cleanly onto 5 real GEO/AEO
 * scanners (AI_VISIBILITY_CHECKS below) — genuinely real, not a
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
     * geo+brand average — kept in sync with that method by hand, same as
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
     * "content" — a mix of category 'content' (readability) and category
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
     * Allowed `days` values — same 3-preset shape WebsiteProgressChart.tsx
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
     * Site-wide "Fixed / New / Still need attention" — the hero card's own
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

        // "Still need attention" — open findings that were already open
        // before this period started (i.e. every currently-open finding,
        // minus the ones that are both open AND newly created this
        // period, which are already counted under "New" above).
        $current_open      = ( $findings->get_status_counts() )['open'];
        $new_still_open    = $period_stats['by_status']['open'] ?? 0;
        $still_open        = max( 0, $current_open - $new_still_open );
        $compare_new_still_open = $compare_stats['by_status']['open'] ?? 0;
        // The previous period's own "carried over" figure isn't
        // reconstructable without a second open-count "as of" the
        // compare period's end — approximated the same way
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
     * @param string            $period_start MySQL datetime (UTC) — the "as of" boundary each score's delta is measured against.
     * @param string            $compare_start MySQL datetime (UTC) — unused directly, kept for signature symmetry with build_highlights().
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
     * The hero card's own "up to 4" highlight rows — each a real category
     * score delta over the period, worded honestly (no claim beyond "up"/
     * "down"/"stable" plus the real point delta).
     *
     * @param FindingRepository $findings     Repository to read from.
     * @param string            $period_start MySQL datetime (UTC).
     * @param string            $compare_start MySQL datetime (UTC) — unused, kept for a future "vs previous period" wording pass.
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
     * The 5 real GEO/AEO checks AI_VISIBILITY_CHECKS maps out — each
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
     * The mockup's "Website Speed" panel — real page-speed score-band
     * counts + real average desktop/mobile scores
     * (PageSpeedRepository::get_summary(), extended for this — see that
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
     * "Drafts in progress" are real WordPress post-status counts — a
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
     * The mockup's "Store Performance" panel — `available: false` (with
     * every other field null) when WooCommerce isn't active, same
     * "Not applicable" honesty CategoryScoresGrid.tsx already established
     * for this exact case. `sales`/`orders`/`avg_order` come from real
     * `wc_get_orders()` order totals for the period — the same function
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
     * The mockup's "Your next priorities" — the 3 highest-severity
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
     * applied to a *current* severity breakdown — duplicated here rather
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
     * via get_severity_breakdown_for_category_as_of() — what every score
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
