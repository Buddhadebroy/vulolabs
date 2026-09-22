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

use VuloPilot\EntityExtraction\EntityExtractor;
use VuloPilot\Repositories\ActionRunRepository;
use VuloPilot\Repositories\ActivityLogRepository;
use VuloPilot\Repositories\AiHistoryRepository;
use VuloPilot\Repositories\AutomationsRepository;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\ReportRepository;
use VuloPilot\Services\RobotsTxtBotAccess;
use VuloPilot\Services\SchemaCoverageAnalyzer;
use VuloPilot\Services\WebmasterToolsManager;
use VuloPilot\Utill;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * GET /activity-logs backs src/pages/Activity/Activity.tsx's table.
 *
 * @class       ActivityLogs controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class ActivityLogs extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'activity-logs';

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
        $repository = new ActivityLogRepository();

        $result                      = $repository->find_all(
            array(
                'page'       => absint( $request->get_param( 'page' ) ) ?: 1,
                'per_page'   => absint( $request->get_param( 'per_page' ) ) ?: 20,
                'actor_type' => sanitize_key( (string) $request->get_param( 'actor_type' ) ),
                'event_type' => $this->parse_comma_separated_event_types( $request->get_param( 'event_type' ) ) ?? '',
                'search'     => sanitize_text_field( (string) $request->get_param( 'search' ) ),
                'orderby'    => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                'order'      => sanitize_key( (string) $request->get_param( 'order' ) ),
            )
        );
        $result['actor_type_counts'] = $repository->get_actor_type_counts();

        return rest_ensure_response( $result );
    }

    /**
     * Same shape as Findings.php's/Scans.php's own `parse_comma_separated_list()`
     * (a caller like RecentActivityCard.tsx can pass several real event
     * types at once, e.g. `scan.completed.security,security.alert`), but
     * `sanitize_text_field()` per item rather than `sanitize_key()` -
     * this table's real `event_type` values contain dots
     * (`scan.completed`, `security.alert`, `ai_action.executed`, …) that
     * `sanitize_key()` silently strips, which would corrupt every
     * multi-segment event type down to something that can never match a
     * real stored row (confirmed live: the single-value `sanitize_key()`
     * this replaced had this exact bug for as long as this route existed).
     *
     * @param mixed $raw_param Raw comma-separated request param.
     * @return string[]|null Sanitized values, or null when the param was empty/absent.
     */
    private function parse_comma_separated_event_types( $raw_param ): ?array {
        if ( empty( $raw_param ) ) {
            return null;
        }

        $event_types = array_filter( array_map( 'sanitize_text_field', explode( ',', (string) $raw_param ) ) );

        return $event_types ? array_values( $event_types ) : null;
    }
}

/**
 * GET /dashboard - the summary object the Dashboard page's widgets read
 * (src/dashboard-widgets/registry.ts's DashboardSummary interface). This
 * is one aggregate payload rather than one REST call per widget
 * (performance.md's "prefer a single query" guidance, applied to the
 * frontend's fetch pattern too) - every number here is a cheap,
 * index-backed COUNT/GROUP BY, not a computed-per-request table scan.
 *
 * List-shaped widgets (Recent Activity, Latest Reports, Pending Approval,
 * Automation Status's row list, Health Timeline) deliberately do NOT live
 * in this payload - they call the existing dedicated list endpoints
 * (`/activity-logs`, `/reports`, `/ai-action-runs`, `/automations`,
 * `/site-health-snapshots`) directly, the same endpoints their full list
 * pages already use, rather than duplicating that data here.
 *
 * @class       Dashboard controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Dashboard extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'dashboard';

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
        $findings        = new FindingRepository();
        $automations     = new AutomationsRepository();
        $action_runs     = new ActionRunRepository();
        $ai_usage        = $this->build_ai_usage_this_month();
        $category_scores = $this->build_category_scores( $findings );

        return rest_ensure_response(
            array(
                'overall_score'            => $this->calculate_overall_score( $category_scores ),
                'open_findings'            => $this->count_open_findings( $findings ),
                'critical_findings'        => $findings->count_by_severity( Severity::CRITICAL ),
                'findings_by_severity'     => $this->build_findings_by_severity( $findings ),
                'active_automations'       => $automations->count_enabled(),
                'ai_jobs_used'             => $ai_usage['ai_jobs_used'],
                'ai_jobs_quota'            => $ai_usage['ai_jobs_quota'],
                'category_scores'          => $category_scores,
                'psi_speed_scores'         => $this->build_psi_speed_scores(),
                'category_scores_7d_ago'   => $this->build_category_scores_as_of( $findings, gmdate( 'Y-m-d H:i:s', strtotime( '-7 days' ) ) ),
                // Dashboard's "Good / N open findings" hero badges - real
                // counts from findings' own created_at/resolved_at, same
                // 7-day window category_scores_7d_ago already reconstructs
                // against.
                'new_findings_this_week'   => $findings->count_created_since( gmdate( 'Y-m-d H:i:s', strtotime( '-7 days' ) ) ),
                'fixed_findings_this_week' => $findings->count_resolved_since( gmdate( 'Y-m-d H:i:s', strtotime( '-7 days' ) ) ),
                'quick_fixes'              => $this->count_quick_fixes( $findings ),
                'pending_approvals'        => (int) $action_runs->find_all(
                    array(
						'status'   => 'pending_approval',
						'per_page' => 1,
					)
                )['total'],
                'automation_status'        => $automations->get_status_counts(),
                'site_snapshot'            => $this->build_site_snapshot(),
            )
        );
    }

    /**
     * "Site snapshot" - real WordPress core counts, every one a plain core
     * function call (`wp_count_posts()`/`wp_count_comments()`/`count_users()`/
     * `get_plugins()`/`phpversion()`/`get_bloginfo('version')`), not derived
     * from scan findings the way every other field on this payload is.
     * Nothing in this codebase exposed these before this method - added
     * specifically to back the Dashboard's own "Site snapshot" widget
     * rather than leave that section fabricated or omitted, since every
     * number here is genuinely free to compute (no query, no scan, just
     * core WP state already loaded on every request).
     *
     * @return array{posts: int, pages: int, comments: int, users: int, plugins_active: int, plugins_total: int, wp_version: string, php_version: string}
     */
    private function build_site_snapshot(): array {
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $post_counts    = wp_count_posts( 'post' );
        $page_counts    = wp_count_posts( 'page' );
        $comment_counts = wp_count_comments();
        $user_counts    = count_users();
        $active_plugins = (array) get_option( 'active_plugins', array() );

        return array(
            'posts'          => (int) ( $post_counts->publish ?? 0 ),
            'pages'          => (int) ( $page_counts->publish ?? 0 ),
            'comments'       => (int) ( $comment_counts->approved ?? 0 ),
            'users'          => (int) ( $user_counts['total_users'] ?? 0 ),
            'plugins_active' => count( $active_plugins ),
            'plugins_total'  => count( get_plugins() ),
            'wp_version'     => get_bloginfo( 'version' ),
            'php_version'    => PHP_VERSION,
        );
    }

    /**
     * Real AI usage for the current calendar month, read from
     * `vulopilot_ai_history` - the ledger `AI\AiRequestSender` writes a
     * row to on every real AI call, already
     * consumed by the AI Usage Report and Recent Conversations. `ai_jobs_used`
     * is real; `ai_jobs_quota` stays honestly 0 (meaning "no cap configured"),
     * since no quota cap exists anywhere yet (AI-ARCHITECTURE.md's "What's not here yet" -
     * quota enforcement). No widget on the Dashboard/AI Copilot pages reads
     * these two fields today (the AI Copilot page's own usage widget was
     * replaced by RecommendedActionsCard - a real-findings summary, not a
     * usage count), but they stay real rather than a hardcoded stub since
     * DashboardSummary's own contract (this class's docblock) is "one
     * aggregate payload, widgets pick the fields they need."
     *
     * @return array{ai_jobs_used: int, ai_jobs_quota: int}
     */
    private function build_ai_usage_this_month(): array {
        $stats = ( new AiHistoryRepository() )->get_stats_for_period( gmdate( 'Y-m-01' ), gmdate( 'Y-m-d' ) );

        return array(
            'ai_jobs_used'  => $stats['total_calls'],
            'ai_jobs_quota' => 0,
        );
    }

    /**
     * Per-domain widget scores (SEO/Performance/Security/Accessibility/
     * WooCommerce). `vulopilot_site_health_snapshots` already has
     * `seo_score`/`performance_score`/`security_score` columns, but
     * nothing in this codebase computes or writes them yet
     * (ScanPersistenceListener::refresh_todays_snapshot() only ever
     * upserts overall_score) - reading those columns here would silently
     * always return null, which is indistinguishable from "not
     * implemented" and would be exactly the kind of fabricated-looking
     * number this controller's docblock already warns against for AI
     * usage. Instead each score is computed live, using the identical
     * weighting calculate_overall_score() uses, just scoped to one
     * category's open findings - a real, honest derived score computable
     * from data that already exists.
     *
     * @param FindingRepository $findings Repository to read category breakdowns from.
     * @return array<string, int|null> Category id => 0-100 score, or null where the category doesn't apply to this site (WooCommerce inactive).
     */
    private function build_category_scores( FindingRepository $findings ): array {
        $categories = array( 'seo', 'performance', 'security', 'accessibility', 'geo' );
        $scores     = array();

        foreach ( $categories as $category ) {
            $scores[ $category ] = $this->calculate_category_score( $findings, $category );
        }

        $scores['woocommerce'] = class_exists( 'WooCommerce' )
            ? $this->calculate_category_score( $findings, 'woocommerce' )
            : null;

        // Content Intelligence's "Content Score" - deliberately NOT one of
        // the single-category loop above: it spans a fixed scanner_id list
        // across two categories (content's own readability scanner plus 4
        // reused seo-category scanners), not one category string
        // (CONTENT-INTELLIGENCE-MODULE.md's audit explains why those seo
        // scanners aren't recategorized). Same weighting, different scope.
        $scores['content'] = $this->calculate_content_score( $findings );

        // Brand Intelligence's overall "Brand Score" - same
        // cross-scanner-id-list scope as 'content' above, spanning 3 new
        // brand-category scanners plus 4 reused geo-category ones
        // (Controllers\BrandIntelligence's own docblock explains the
        // grouping; BRAND-INTELLIGENCE-MODULE.md has the full audit).
        $scores['brand'] = $this->calculate_brand_score( $findings );

        return $scores;
    }

    /**
     * Same 8 keys/same weighting as build_category_scores(), but each
     * score is reconstructed as of a past moment via
     * get_severity_breakdown_for_category_as_of() instead of counting
     * today's open findings - what the Dashboard's score-card trend
     * arrows diff against (this call's result vs. build_category_scores()'s),
     * since no per-category score snapshot history exists to read a real
     * delta from directly.
     *
     * @param FindingRepository $findings Repository to read category breakdowns from.
     * @param string            $as_of    MySQL datetime (UTC) to reconstruct every category's open set as of.
     * @return array<string, int|null> Category id => 0-100 score, or null where the category doesn't apply to this site (WooCommerce inactive).
     */
    private function build_category_scores_as_of( FindingRepository $findings, string $as_of ): array {
        $categories = array( 'seo', 'performance', 'security', 'accessibility', 'geo' );
        $scores     = array();

        foreach ( $categories as $category ) {
            $breakdown           = $findings->get_severity_breakdown_for_category_as_of( $category, $as_of );
            $scores[ $category ] = $this->score_from_breakdown( $breakdown );
        }

        $scores['woocommerce'] = class_exists( 'WooCommerce' )
            ? $this->score_from_breakdown( $findings->get_severity_breakdown_for_category_as_of( 'woocommerce', $as_of ) )
            : null;

        $scores['content'] = $this->score_from_breakdown(
            $findings->get_severity_breakdown_for_scanner_ids_as_of(
                array( 'readability', 'thin-content', 'duplicate-content', 'heading-structure', 'internal-linking', 'orphan-pages' ),
                $as_of
            )
        );

        $scores['brand'] = $this->score_from_breakdown(
            $findings->get_severity_breakdown_for_scanner_ids_as_of(
                array(
                    'geo-trust-signals',
                    'about-page-analysis',
                    'geo-eeat-signals',
                    'geo-author-info',
                    'author-schema',
                    'geo-entity-naming-consistency',
                    'organization-schema',
                ),
                $as_of
            )
        );

        return $scores;
    }

    /**
     * The one weighting formula calculate_overall_score()/
     * calculate_category_score()/calculate_content_score()/
     * calculate_brand_score() each already apply to a current-open-findings
     * breakdown, factored out so build_category_scores_as_of() can apply
     * the identical formula to a reconstructed-as-of-a-past-date breakdown
     * instead - the trend is only meaningful if both ends use the same
     * scoring math.
     *
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

    /**
     * Same weighting as calculate_category_score()/calculate_content_score(),
     * scoped to Brand Intelligence's own combined scanner_id list - see
     * Controllers\BrandIntelligence::get_score() for the same 7 ids split
     * into its own named Trust/Authority/Entity sub-scores.
     *
     * @param FindingRepository $findings Repository to read the breakdown from.
     * @return int 0-100.
     */
    private function calculate_brand_score( FindingRepository $findings ): int {
        $breakdown = $findings->get_severity_breakdown_for_scanner_ids(
            array(
                'geo-trust-signals',
                'about-page-analysis',
                'geo-eeat-signals',
                'geo-author-info',
                'author-schema',
                'geo-entity-naming-consistency',
                'organization-schema',
            )
        );

        $score = 100
            - ( $breakdown['critical'] * 15 )
            - ( $breakdown['high'] * 8 )
            - ( $breakdown['medium'] * 3 )
            - ( $breakdown['low'] * 1 );

        return max( 0, min( 100, $score ) );
    }

    /**
     * Same weighting as calculate_category_score()/calculate_overall_score(),
     * scoped to Content Intelligence's own fixed scanner_id list - see
     * FindingRepository::get_severity_breakdown_for_scanner_ids()'s own
     * docblock for why a scanner-id list, not a category string, is what
     * this composite score needs.
     *
     * @param FindingRepository $findings Repository to read the breakdown from.
     * @return int 0-100.
     */
    private function calculate_content_score( FindingRepository $findings ): int {
        $breakdown = $findings->get_severity_breakdown_for_scanner_ids(
            array( 'readability', 'thin-content', 'duplicate-content', 'heading-structure', 'internal-linking', 'orphan-pages' )
        );

        $score = 100
            - ( $breakdown['critical'] * 15 )
            - ( $breakdown['high'] * 8 )
            - ( $breakdown['medium'] * 3 )
            - ( $breakdown['low'] * 1 );

        return max( 0, min( 100, $score ) );
    }

    /**
     * Same weighting as calculate_overall_score(), scoped to one category.
     *
     * @param FindingRepository $findings Repository to read the breakdown from.
     * @param string            $category One of the scanner category strings (SCANNERS.md).
     * @return int 0-100.
     */
    private function calculate_category_score( FindingRepository $findings, string $category ): int {
        $breakdown = $findings->get_severity_breakdown_for_category( $category );

        $score = 100
            - ( $breakdown['critical'] * 15 )
            - ( $breakdown['high'] * 8 )
            - ( $breakdown['medium'] * 3 )
            - ( $breakdown['low'] * 1 );

        return max( 0, min( 100, $score ) );
    }

    /**
     * Real Google PageSpeed Insights Mobile/Desktop scores, if a
     * `psi_api_key` is configured (Services\PageSpeedInsightsFetcher's own
     * cron/one-off fetch writes these three options; this method never
     * makes the slow external HTTP call itself). Both scores null means
     * PerformanceScoreCard.tsx falls back to the single real unified
     * `category_scores.performance` number instead of a fabricated split.
     *
     * @return array{mobile: int|null, desktop: int|null, checked_at: string|null}
     */
    private function build_psi_speed_scores(): array {
        $mobile     = get_option( 'vulopilot_psi_mobile_score', null );
        $desktop    = get_option( 'vulopilot_psi_desktop_score', null );
        $checked_at = get_option( 'vulopilot_psi_checked_at', null );

        return array(
            'mobile'     => null !== $mobile ? (int) $mobile : null,
            'desktop'    => null !== $desktop ? (int) $desktop : null,
            'checked_at' => '' !== $checked_at ? $checked_at : null,
        );
    }

    /**
     * "Quick Fixes" = open findings in a category that has a matching
     * one-click AIAction already registered, by the same by-convention id
     * match AI-ACTIONS.md's "Recommendations as an input source" section
     * documents (`images` findings ↔ the `generate-alt` action). This
     * isn't a general "all auto-fixable findings" count - there's no
     * formal Recommendation → Action mapping yet (AI-ACTIONS.md's "What's
     * not here yet"), so counting anything beyond the one real pairing
     * that exists today would overstate what VuloPilot can actually do.
     *
     * @param FindingRepository $findings Repository to count from.
     * @return int
     */
    private function count_quick_fixes( FindingRepository $findings ): int {
        if ( ! VuloPilot()->ai_action_registry->get_action( 'generate-alt' ) ) {
            return 0;
        }

        return $findings->count_by_category( 'images' );
    }

    /**
     * @param FindingRepository $findings Repository to sum severities from.
     * @return int
     */
    private function count_open_findings( FindingRepository $findings ): int {
        $total = 0;

        foreach ( Severity::all() as $severity ) {
            $total += $findings->count_by_severity( $severity );
        }

        return $total;
    }

    /**
     * Open finding count per severity - backs the Dashboard's issue
     * distribution chart. `info` is excluded: it's a real severity value
     * the `vulopilot_scan_findings` column accepts, but nothing in
     * calculate_overall_score()'s own weighting treats it as an issue
     * (no point deduction), so surfacing it here would misrepresent it as
     * something needing attention.
     *
     * @param FindingRepository $findings Repository to count from.
     * @return array{critical: int, high: int, medium: int, low: int}
     */
    private function build_findings_by_severity( FindingRepository $findings ): array {
        return array(
            'critical' => $findings->count_by_severity( Severity::CRITICAL ),
            'high'     => $findings->count_by_severity( Severity::HIGH ),
            'medium'   => $findings->count_by_severity( Severity::MEDIUM ),
            'low'      => $findings->count_by_severity( Severity::LOW ),
        );
    }

    /**
     * "Overall Health" - the average of every applicable category's own
     * already-computed, already-displayed 0-100 score (build_category_scores()'s
     * return value), not an independent raw severity-count formula run
     * across every open finding sitewide in one combined total.
     *
     * That combined-total formula is what this method used to do, and on
     * any real, actively-scanned site it saturates almost immediately:
     * confirmed live on this site's own 507 open findings (238 of them
     * `high`, weighted 8 points each - 1904 points of "damage" alone) blew
     * straight through the same 100-point budget calculate_category_score()
     * applies per category, clamping this one stat to 0 while every
     * category tile right below it (SEO 35, Performance 96, Security 0,
     * Content 68) still showed real gradation - reading as "this number
     * isn't syncing" rather than "this site has a lot of open issues," and
     * guaranteed to keep reading that way on this site (or any similarly
     * sized one) regardless of how much real progress is made. Averaging
     * the categories instead keeps this headline inside the same range the
     * tiles beneath it show, and since each category already clamps itself
     * to 0-100 before this average runs, one saturated category (Security,
     * here) can no longer single-handedly floor the whole site's score.
     *
     * @param array<string, int|null> $category_scores build_category_scores()'s own return value - null entries (e.g. `woocommerce` on a non-WooCommerce site) are excluded from the average rather than counted as 0.
     * @return int 0-100.
     */
    private function calculate_overall_score( array $category_scores ): int {
        $applicable = array_filter(
            $category_scores,
            static function ( $score ) {
                return null !== $score;
            }
        );

        if ( ! $applicable ) {
            return 100;
        }

        return (int) round( array_sum( $applicable ) / count( $applicable ) );
    }
}

/**
 * GET/POST /dashboard-layout backs the Dashboard page's drag-and-drop
 * widget grid (src/dashboard-widgets/DashboardGrid.tsx). Persists to user
 * meta rather than VULOPILOT_SETTINGS_KEY's shared wp_options row - see
 * Utill::DASHBOARD_LAYOUT_META_KEY's docblock for why a widget
 * arrangement is per-user state, not site-wide settings.
 *
 * @class       DashboardLayout controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class DashboardLayout extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'dashboard-layout';

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
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_item' ),
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
     * Returns the current user's saved layout, reconciled against
     * Utill::DASHBOARD_WIDGET_IDS: any widget id that exists but isn't in
     * the saved layout yet (a widget added after this user last saved a
     * custom order) is appended, enabled by default; any saved id that no
     * longer exists (a removed widget) is dropped. This is what makes a
     * stale saved layout additive-safe instead of silently hiding new
     * widgets forever.
     *
     * @inheritDoc
     */
    public function get_items( $request ) {
        return rest_ensure_response( $this->get_reconciled_layout() );
    }

    /**
     * @inheritDoc
     */
    public function update_item( $request ) {
        $submitted = $request->get_param( 'widgets' );

        if ( ! is_array( $submitted ) || empty( $submitted ) ) {
            return new \WP_Error( 'vulopilot_invalid_layout', __( 'A widget layout array is required.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $layout = array();

        foreach ( $submitted as $entry ) {
            $id = sanitize_key( (string) ( is_array( $entry ) ? ( $entry['id'] ?? '' ) : '' ) );

            if ( ! in_array( $id, Utill::DASHBOARD_WIDGET_IDS, true ) ) {
                continue; // Unknown id - never persist a widget id the client invented.
            }

            $layout[] = array(
                'id'      => $id,
                'enabled' => ! empty( $entry['enabled'] ),
            );
        }

        if ( empty( $layout ) ) {
            return new \WP_Error( 'vulopilot_invalid_layout', __( 'No valid widgets in the submitted layout.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        update_user_meta( get_current_user_id(), Utill::DASHBOARD_LAYOUT_META_KEY, $layout );

        return rest_ensure_response( array( 'success' => true ) );
    }

    /**
     * @return array<int, array{id: string, enabled: bool}>
     */
    private function get_reconciled_layout(): array {
        $saved = get_user_meta( get_current_user_id(), Utill::DASHBOARD_LAYOUT_META_KEY, true );
        $saved = is_array( $saved ) ? $saved : array();

        $by_id = array();
        foreach ( $saved as $entry ) {
            $id = is_array( $entry ) ? (string) ( $entry['id'] ?? '' ) : '';
            if ( in_array( $id, Utill::DASHBOARD_WIDGET_IDS, true ) ) {
                $by_id[ $id ] = ! empty( $entry['enabled'] );
            }
        }

        $reconciled = array();

        foreach ( array_keys( $by_id ) as $id ) {
            $reconciled[] = array(
                'id'      => $id,
                'enabled' => $by_id[ $id ],
            );
        }

        foreach ( Utill::DASHBOARD_WIDGET_IDS as $id ) {
            if ( ! array_key_exists( $id, $by_id ) ) {
                $reconciled[] = array(
                    'id'      => $id,
                    'enabled' => true,
                );
            }
        }

        return $reconciled;
    }
}

/**
 * GET/POST /settings backs src/pages/Settings/Settings.tsx, now built on
 * zyra's real settings framework (`InputRenderer`/`NavigatorComponent`,
 * `getAvailableSettings`/`getSettingById` from zyra's core module - see the
 * free vulolabs plugin's own `components/Settings/Settings.tsx` for the
 * pattern this mirrors). `InputRenderer` auto-saves each tab's fields as
 * `{ setting, settingName }` - a SUBSET of the full settings object, not
 * the whole thing - so update_item() merges into the existing stored
 * option rather than replacing it wholesale (the previous version's
 * `update_option()` call replaced the *entire* option with only the 2
 * keys it knew about, which would have silently wiped every other tab's
 * values the moment a second tab existed).
 *
 * Reads/writes a single wp_options row (Utill::VULOPILOT_SETTINGS_KEY),
 * not a custom table - see Utill::VULOPILOT_SETTINGS_DEFAULTS's docblock
 * for why. Also backs the Import/Export/Reset tab (a hand-built panel,
 * not an InputRenderer-driven one - see Settings.tsx's own docblock for
 * why those three actions don't fit the auto-save field pattern).
 *
 * No per-field type/sanitization allowlist here - matches the sibling
 * free plugins' own Settings controllers (vulolabs/catalogx/moowoodle,
 * see their own RestAPI/Controllers/Settings.php), which likewise store
 * whatever `{ setting }` the client sends with no server-side field-type
 * validation. The only thing this class still does beyond that baseline
 * is merge into the existing option rather than replace it outright,
 * which is a consequence of the single-flat-option storage above, not a
 * sanitization layer.
 *
 * @class       Settings controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Settings extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'settings';

    /**
     * @var string
     */
    protected $modules_base = 'modules';

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
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_item' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/reset',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'reset_settings' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // Settings → Developer Tools' "Clear cache" - same
        // `type: 'button'` + `apilink` shape as /reset above, its own
        // dedicated route since it does something conceptually different
        // (clearing transient caches, not touching stored setting values).
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/clear-cache',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'clear_cache' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // "Send test email" button (Settings → Notifications) - same
        // `type: 'button'` + `apilink` shape zyra's ButtonInputFieldComponent
        // already POSTs through for reset_settings above, just its own
        // dedicated route rather than overloading /reset.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/test-email',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'send_test_email' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // "Send Test Alert" (Notifications → AI Crawler Alerts) - same
        // shape as /test-email above. The real check/send logic lives in
        // vulopilot-pro's CrawlerAlertMonitor (that whole feature is
        // Pro-only), so this route only fires the `vulopilot_send_test_crawler_alert`
        // filter and passes its result straight through - see
        // send_test_crawler_alert()'s own docblock.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/test-crawler-alert',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'send_test_crawler_alert' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // "Send Test Report" (Settings → Reports) - same shape as
        // /test-email above, but generates a real report first
        // (VuloPilot()->report_generator, the exact engine
        // Controllers\Reports::create_item() itself uses) using whatever
        // format/period this tab currently has configured, then emails a
        // "your report is ready" notice rather than attaching the file -
        // same real pattern vulopilot-pro's ScheduledReportRunner::maybe_email_report()
        // already uses for scheduled reports. See send_test_report()'s own
        // docblock.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/test-report',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'send_test_report' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // Settings → Connections → PageSpeed Insights: GET returns the
        // real on-load "Connected" pill/usage-bar state without calling
        // Google's API (PageSpeedInsightsFetcher::get_status()); POST
        // ("Test Connection") makes a real, live call
        // (PageSpeedInsightsFetcher::test_connection()).
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/test-pagespeed',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_pagespeed_status' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'send_test_pagespeed' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // "Verify" (Settings → Connections → Site Verification) - a real
        // self-check, not a call to Google/Bing/Pinterest: saves whatever
        // verification code is currently in the request, then fetches this
        // site's OWN homepage and confirms the matching real `<meta>` tag
        // (Services\WebmasterToolsManager, the same class that outputs it
        // on `wp_head`) actually renders there. See
        // verify_webmaster_tool()'s own docblock.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/verify-webmaster',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'verify_webmaster_tool' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        // "Restore Defaults" (Settings → Scanning → AI Visibility) - a
        // real reset scoped to just the `ai_visibility_scans` nested
        // setting (the 5-row scan-category panel), not the sitewide
        // `POST /settings/reset` General.ts's own "Reset all settings"
        // button already uses. See reset_ai_visibility_scans()'s own
        // docblock.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/reset-ai-visibility-scans',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'reset_ai_visibility_scans' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );


        // Enable/disable a module - mirrors the free vulolabs plugin's
        // own Settings controller (module-architecture.md), same GET/POST
        // shape zyra's ModuleGridComponent already expects.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->modules_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'set_modules' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_modules' ),
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
    public function update_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function get_items( $request ) {
        return rest_ensure_response( $this->get_stored_settings() );
    }

    /**
     * Merges one tab's fields into the stored settings - the request
     * shape zyra's `InputRenderer` actually sends (`{ setting, settingName }`,
     * see this class's own docblock), not a flat replace-everything body.
     *
     * @inheritDoc
     */
    public function update_item( $request ) {
        $tab_fields = $request->get_param( 'setting' );

        // Fall back to treating the whole body as the field set when no
        // `setting` wrapper is present (e.g. a direct API call rather than
        // InputRenderer's own auto-save) - still merged, never a wholesale
        // replace either way.
        if ( ! is_array( $tab_fields ) ) {
            $tab_fields = $request->get_json_params();
        }

        if ( ! is_array( $tab_fields ) ) {
            $tab_fields = array();
        }

        $updated = array_merge( $this->get_stored_settings(), $tab_fields );

        // General tab's own "Site tone" field autosaving a real, human-
        // typed value means it's no longer Services\SiteToneLearner's own
        // auto-detected phrase - same "an edited field also needs an
        // immediate side effect on save" shape llms_txt_content/
        // indexnow_api_key below already use, just flipping a sibling flag
        // rather than writing a file. Deliberately keyed on `site_tone`
        // being present at all (even if saved back to '') rather than a
        // non-empty check - clearing the field is itself a deliberate
        // human action that should stick, not fall back to 'auto' and
        // risk SiteToneLearner silently repopulating it on the next
        // relearn.
        if ( array_key_exists( 'site_tone', $tab_fields ) ) {
            $updated['site_tone_source'] = 'manual';
        }

        update_option( Utill::VULOPILOT_SETTINGS_KEY, $updated );

        $response = array(
            'success' => true,
            'message' => __( 'Settings saved.', 'vulopilot' ),
        );

        // Editing llms.txt's content is meant to take effect immediately,
        // not just on the next dynamic /llms.txt request - write the real
        // file straight away so "View live file" reflects this save
        // without the admin needing to trigger anything else. Reported
        // honestly: a locked-down host where ABSPATH isn't writable still
        // saves the setting (the virtual /llms.txt route still serves it),
        // it just can't also write the static file.
        if ( array_key_exists( 'llms_txt_content', $tab_fields ) ) {
            $response['file_saved'] = VuloPilot()->llms_txt_generator->write_file( $updated['llms_txt_content'] );
        }

        // Instant Indexing tab's "Change key" button - same "an edited
        // field also needs an immediate side-effect on save" precedent as
        // llms_txt_content above, keeping /{key}.txt in sync with whatever
        // key was just saved rather than only writing it lazily elsewhere.
        if ( array_key_exists( 'indexnow_api_key', $tab_fields ) && ! empty( $updated['indexnow_api_key'] ) ) {
            VuloPilot()->indexnow_key_file_server->write_key_file( $updated['indexnow_api_key'] );
        }

        return rest_ensure_response( $response );
    }

    /**
     * Deletes the stored option entirely, reverting every setting to
     * Utill::VULOPILOT_SETTINGS_DEFAULTS - the "Reset to defaults" action.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function reset_settings( $request ) {
        delete_option( Utill::VULOPILOT_SETTINGS_KEY );

        return rest_ensure_response(
            array(
                'success' => true,
                'message' => __( 'Settings reset to defaults.', 'vulopilot' ),
            )
        );
    }

    /**
     * Settings → Developer Tools' "Clear cache" - every real, transient-
     * cached piece of *content* this plugin (and vulopilot-pro, if active)
     * computes: Knowledge Graph's own extracted entities, the Schema
     * Coverage snapshot, and the AI-crawler-analytics robots.txt bot-group
     * parse. Deliberately scoped to real content caches only, not every
     * transient this plugin owns - the AI per-minute rate-limit
     * counters (AI\AiRequestSender) and the Core
     * Web Vitals beacon's own rate-limit transient aren't "stale data,"
     * clearing them would just reset a rate limit early, a different
     * (and unwanted here) effect.
     *
     * Pro's own real content cache (`vulopilot_kg_recommendations`,
     * KnowledgeGraph\EntityRecommendationAnalyzer) is cleared via this same
     * action rather than a direct call - Free never imports Pro's
     * namespace, so `vulopilot_clear_all_caches` is the same hook-based
     * cross-boundary contribution `vulopilot_settings_context` (Settings
     * tab registration) already establishes, just an action instead of a
     * filter since nothing needs collecting back. Deliberately does NOT
     * clear Pro's own security-alert-already-sent dedup transient or its
     * license status cache - the same "real content vs. behavioral state"
     * distinction as the rate-limit counters above; each has its own real
     * side effect (resending old alerts, forcing a redundant license
     * re-check) that isn't "refreshing stale data" either.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function clear_cache( $request ) {
        ( new EntityExtractor() )->clear_cache();
        ( new SchemaCoverageAnalyzer() )->clear_cache();
        ( new RobotsTxtBotAccess() )->clear_cache();

        do_action( 'vulopilot_clear_all_caches' );

        return rest_ensure_response(
            array(
                'success' => true,
                'message' => __( 'Cache cleared.', 'vulopilot' ),
            )
        );
    }

    /**
     * "Send test email" (Settings → Notifications) - sends one real email
     * through the exact same recipient/From-header logic every other
     * notification email in this codebase already uses (Services\ScanPersistenceListener,
     * GeoAnalysis\GeoAnalyzer, and their vulopilot-pro counterparts), so a
     * successful test genuinely confirms those settings work rather than
     * exercising a separate code path.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function send_test_email( $request ) {
        $settings  = $this->get_stored_settings();
        $recipient = $settings['notification_email'] ?: get_option( 'admin_email' );

        if ( ! is_email( $recipient ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'The notification email address isn\'t valid.', 'vulopilot' ),
                )
            );
        }

        $headers = array();

        if ( ! empty( $settings['email_from_address'] ) && is_email( $settings['email_from_address'] ) ) {
            $from_name = $settings['email_from_name'] ?: get_bloginfo( 'name' );
            $headers[] = sprintf( 'From: %s <%s>', $from_name, $settings['email_from_address'] );
        }

        $sent = wp_mail(
            $recipient,
            sprintf(
                /* translators: %s is the site name. */
                __( '[%s] VuloPilot test email', 'vulopilot' ),
                get_bloginfo( 'name' )
            ),
            __( "This is a test email from VuloPilot's Notifications settings. If you received this, your notification email is configured correctly.", 'vulopilot' ),
            $headers
        );

        if ( $sent ) {
            // Same real "Last test … sent on …" persistence
            // send_test_report() already keeps (own key, unrelated to
            // that one) - SendTestEmailButton.tsx reads this back on
            // mount so the line survives a page refresh instead of only
            // showing right after a click.
            $updated = array_merge( $this->get_stored_settings(), array( 'email_last_test_sent' => current_time( 'mysql', true ) ) );
            update_option( Utill::VULOPILOT_SETTINGS_KEY, $updated );
        }

        return rest_ensure_response(
            array(
                'success' => $sent,
                'message' => $sent
                    ? sprintf(
                        /* translators: %s is the recipient email address. */
                        __( 'Test email sent to %s.', 'vulopilot' ),
                        $recipient
                    )
                    : __( 'wp_mail() returned false - check your site\'s mail configuration.', 'vulopilot' ),
            )
        );
    }

    /**
     * "Send Test Report" (Settings → Reports) - a real, full generation
     * through the exact same engine Controllers\Reports::create_item()
     * itself uses (`VuloPilot()->report_generator`), using this tab's own
     * currently-configured `default_report_format`/`default_report_period_days`
     * (same fallback-to-csv-when-unregistered posture create_item() already
     * takes for the settings default, so choosing 'pdf' without Pro's
     * AdvancedReports module active here behaves identically to a real
     * report request would). Emails a "ready" notice rather than attaching
     * the file - same real pattern vulopilot-pro's
     * AdvancedReports\ScheduledReportRunner::maybe_email_report() already
     * uses for scheduled reports, not a new delivery mechanism.
     *
     * On success, also persists a real `report_last_test_sent` timestamp -
     * same "survives a page refresh" purpose
     * `crawler_alert_last_test_sent` already serves below.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function send_test_report( $request ) {
        $settings  = $this->get_stored_settings();
        $recipient = $settings['notification_email'] ? $settings['notification_email'] : get_option( 'admin_email' );

        if ( ! is_email( $recipient ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'The notification email address isn\'t valid.', 'vulopilot' ),
                )
            );
        }

        $format = (string) $settings['default_report_format'];

        if ( ! VuloPilot()->report_exporter_registry->get_exporter( $format ) ) {
            $format = 'csv';
        }

        $period_days  = absint( $settings['default_report_period_days'] );
        $period_days  = max( 1, $period_days ? $period_days : 30 );
        $period_end   = current_time( 'Y-m-d' );
        $period_start = gmdate( 'Y-m-d', strtotime( '-' . ( $period_days - 1 ) . ' days', strtotime( $period_end ) ) );

        $report_id = VuloPilot()->report_generator->generate(
            'scan_summary',
            $format,
            $period_start,
            $period_end,
            array(),
            get_current_user_id()
        );

        $report = ( new ReportRepository() )->find( $report_id );

        if ( ! $report || 'ready' !== $report['status'] ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'Could not generate a test report. Please try again.', 'vulopilot' ),
                )
            );
        }

        $headers = array();

        if ( ! empty( $settings['email_from_address'] ) && is_email( $settings['email_from_address'] ) ) {
            $from_name = $settings['email_from_name'] ? $settings['email_from_name'] : get_bloginfo( 'name' );
            $headers[] = sprintf( 'From: %s <%s>', $from_name, $settings['email_from_address'] );
        }

        $sent = wp_mail(
            $recipient,
            sprintf(
                /* translators: %s is the site name. */
                __( '[%s] Your test report is ready', 'vulopilot' ),
                get_bloginfo( 'name' )
            ),
            __( 'This is a test report from VuloPilot\'s Reports settings. Sign in to your dashboard\'s Reports page to view and download it.', 'vulopilot' ),
            $headers
        );

        if ( $sent ) {
            $updated = array_merge( $this->get_stored_settings(), array( 'report_last_test_sent' => current_time( 'mysql', true ) ) );
            update_option( Utill::VULOPILOT_SETTINGS_KEY, $updated );
        }

        return rest_ensure_response(
            array(
                'success' => $sent,
                'message' => $sent
                    ? sprintf(
                        /* translators: %s is the recipient email address. */
                        __( 'Test report generated and emailed to %s.', 'vulopilot' ),
                        $recipient
                    )
                    : __( 'wp_mail() returned false - check your site\'s mail configuration.', 'vulopilot' ),
            )
        );
    }

    /**
     * "Test Connection" (Settings → Connections → PageSpeed Insights) - a
     * real, synchronous call through Services\PageSpeedInsightsFetcher::test_connection(),
     * the same class the daily cron already uses, so this is genuinely
     * "run today's fetch right now" rather than a separate check. That
     * method already covers the missing-key and quota-exhausted cases with
     * their own honest messages, so this callback is a thin passthrough.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function send_test_pagespeed( $request ) {
        return rest_ensure_response( VuloPilot()->psi_fetcher->test_connection() );
    }

    /**
     * The real on-load "Connected" pill/usage-bar state, without calling
     * Google's API - see PageSpeedInsightsFetcher::get_status()'s own
     * docblock.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function get_pagespeed_status( $request ) {
        return rest_ensure_response( VuloPilot()->psi_fetcher->get_status() );
    }

    /**
     * "Verify"/"Verify with Bing"/"Verify with Pinterest" (Settings →
     * Connections → Site Verification) - saves whatever code was
     * submitted (same "Verify always saves first" shape a real click
     * needs, since the code field isn't wired through InputRenderer's own
     * auto-save on this hand-built panel), then does a real, honest
     * self-check: fetches this site's OWN homepage and confirms the exact
     * `<meta>` tag Services\WebmasterToolsManager itself outputs on
     * `wp_head` for this provider actually renders there. This never
     * calls Google/Bing/Pinterest - see `webmaster_google_verified_at`'s
     * own docblock (Utill::VULOPILOT_SETTINGS_DEFAULTS) for why that's an
     * honest, different claim than "your account is verified with them."
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function verify_webmaster_tool( $request ) {
        $provider = sanitize_key( (string) $request->get_param( 'provider' ) );

        if ( ! in_array( $provider, array( 'google', 'bing', 'pinterest' ), true ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'Unknown verification provider.', 'vulopilot' ),
                )
            );
        }

        $setting_key = 'webmaster_' . $provider . '_verification';
        $code        = sanitize_text_field( (string) $request->get_param( 'code' ) );
        $settings    = $this->get_stored_settings();

        $settings[ $setting_key ] = $code;
        update_option( Utill::VULOPILOT_SETTINGS_KEY, $settings );

        if ( '' === $code ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'Enter a verification code first.', 'vulopilot' ),
                )
            );
        }

        $meta_name = WebmasterToolsManager::VERIFICATION_META_NAMES[ $setting_key ] ?? '';
        $attribute = 'webmaster_pinterest_verification' === $setting_key ? 'property' : 'name';

        $response = wp_remote_get( home_url( '/' ), array( 'timeout' => 15 ) );

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'Could not load your homepage to check - please try again.', 'vulopilot' ),
                )
            );
        }

        $body    = wp_remote_retrieve_body( $response );
        $pattern = '/<meta\s+[^>]*' . preg_quote( $attribute, '/' ) . '\s*=\s*["\']' . preg_quote( $meta_name, '/' ) . '["\'][^>]*content\s*=\s*["\']' . preg_quote( $code, '/' ) . '["\'][^>]*\/?>/i';

        if ( ! preg_match( $pattern, $body ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'Verification tag not found on your homepage yet - if you just saved it, clear any caching and try again.', 'vulopilot' ),
                )
            );
        }

        $settings[ 'webmaster_' . $provider . '_verified_at' ] = current_time( 'mysql', true );
        update_option( Utill::VULOPILOT_SETTINGS_KEY, $settings );

        return rest_ensure_response(
            array(
                'success' => true,
                'message' => __( 'Verified - the tag is live on your homepage.', 'vulopilot' ),
            )
        );
    }

    /**
     * "Restore Defaults" (Settings → Scanning → AI Visibility) - resets
     * only `ai_visibility_scans` back to its own defaults
     * (Utill::VULOPILOT_SETTINGS_DEFAULTS), leaving every other stored
     * setting untouched. Returns the restored value directly so
     * AiVisibilityScansHeader.tsx can push it straight into SettingContext
     * without a second round-trip or a page reload.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function reset_ai_visibility_scans( $request ) {
        $settings                        = $this->get_stored_settings();
        $settings['ai_visibility_scans'] = Utill::VULOPILOT_SETTINGS_DEFAULTS['ai_visibility_scans'];
        update_option( Utill::VULOPILOT_SETTINGS_KEY, $settings );

        return rest_ensure_response(
            array(
                'success'             => true,
                'ai_visibility_scans' => $settings['ai_visibility_scans'],
            )
        );
    }

    /**
     * "Send Test Alert" (Notifications → AI Crawler Alerts). The whole AI
     * Crawler Alerts feature (CrawlerAlertMonitor, the 5 real checks it
     * runs daily) lives in vulopilot-pro, and Free never `use`s Pro's
     * namespace (this repo's own CLAUDE.md) - so rather than a direct
     * class reference, this fires the `vulopilot_send_test_crawler_alert`
     * filter and returns whatever comes back. `has_filter()` first means
     * this honestly reports "requires Pro" instead of a generic failure
     * when nothing is listening (Pro inactive, or this specific module
     * toggled off - see Module.php's own registration).
     *
     * On success, also persists a real `crawler_alert_last_test_sent`
     * timestamp into the flat settings option - CrawlerAlertTestPanel.tsx
     * reads it back on load so the "Last test alert sent successfully on
     * ..." line survives a page refresh, not just the moment right after
     * the click.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response
     */
    public function send_test_crawler_alert( $request ) {
        if ( ! has_filter( 'vulopilot_send_test_crawler_alert' ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'AI Crawler Alerts requires VuloPilot Pro, with the AI Crawler Analytics module active.', 'vulopilot' ),
                )
            );
        }

        $result = apply_filters( 'vulopilot_send_test_crawler_alert', null );

        if ( ! is_array( $result ) || ! isset( $result['success'] ) ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => __( 'Could not send a test alert.', 'vulopilot' ),
                )
            );
        }

        if ( $result['success'] ) {
            $updated = array_merge( $this->get_stored_settings(), array( 'crawler_alert_last_test_sent' => current_time( 'mysql' ) ) );
            update_option( Utill::VULOPILOT_SETTINGS_KEY, $updated );
        }

        return rest_ensure_response( $result );
    }

    /**
     * @return array<string, mixed> Stored settings, defaults filled in for anything never saved.
     */
    private function get_stored_settings(): array {
        $saved = get_option( Utill::VULOPILOT_SETTINGS_KEY, array() );

        $settings = wp_parse_args( is_array( $saved ) ? $saved : array(), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        // Sites that saved a checkbox setting before this option's defaults
        // moved to zyra's own wire shape still have a raw PHP boolean
        // sitting in the stored option for that key - normalize it here
        // rather than reintroducing a per-key type allowlist. This is
        // driven by the value's own PHP type, not a field-by-field
        // registry, so it stays consistent with dropping FIELD_TYPES: no
        // setting other than a checkbox has ever stored a real boolean.
        // The wire shape's "on" sentinel is the field's own key (matching
        // every checkbox field's `options: [{ key, value }]` in the *.ts
        // settings configs, e.g. `enable_seo_scanning`'s sole option is
        // `{ key: 'enable_seo_scanning', value: 'enable_seo_scanning' }`),
        // not a shared 'enabled' literal - so `$key` itself is correct here.
        foreach ( $settings as $key => $value ) {
            if ( is_bool( $value ) ) {
                $settings[ $key ] = $value ? array( $key ) : array();
            }
        }

        // 'llms_txt_content' can't live in VULOPILOT_SETTINGS_DEFAULTS as
        // anything but '' (a class const array can't call a method) - so
        // an admin who has never customized it yet sees the real
        // auto-generated content here, not a blank textarea, without that
        // ever being persisted until they actually edit and save it.
        if ( empty( $settings['llms_txt_content'] ) ) {
            $settings['llms_txt_content'] = VuloPilot()->llms_txt_generator->generate();
        }

        // Unlike llms_txt_content above (display-only until an admin
        // explicitly edits/saves), `indexnow_api_key` needs a real,
        // persisted value from the very first read - IndexNowAutoSubmitter
        // and the key file at /{key}.txt both need a stable key to exist
        // before an admin ever visits the Instant Indexing tab, not just
        // whenever they happen to click "Change key" the first time.
        if ( empty( $settings['indexnow_api_key'] ) ) {
            $settings['indexnow_api_key'] = \VuloPilot\Services\IndexNowKeyFileServer::generate_new_key();
            update_option( Utill::VULOPILOT_SETTINGS_KEY, $settings );
            VuloPilot()->indexnow_key_file_server->write_key_file( $settings['indexnow_api_key'] );
        }

        return $settings;
    }

    /**
     * Activates or deactivates one module - the same request shape zyra's
     * `ModuleGridComponent` sends regardless of which plugin it's talking
     * to (`{ id, action, modules? }`), mirrored from the free vulolabs
     * plugin's own `set_modules()`.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response|\WP_Error
     */
    public function set_modules( $request ) {
        $module_id = sanitize_key( (string) $request->get_param( 'id' ) );
        $action    = sanitize_key( (string) $request->get_param( 'action' ) );
        $modules   = array_map( 'sanitize_key', (array) $request->get_param( 'modules' ) );

        if ( '' === $module_id && empty( $modules ) ) {
            return new \WP_Error( 'vulopilot_missing_module_id', __( 'No module id given.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        if ( ! empty( $modules ) ) {
            $result = VuloPilot()->modules->activate_modules( $modules );

            return rest_ensure_response( $result );
        }

        $result = 'activate' === $action
            ? VuloPilot()->modules->activate_modules( array( $module_id ) )
            : VuloPilot()->modules->deactivate_modules( array( $module_id ) );

        return rest_ensure_response( $result );
    }

    /**
     * @return array Every currently active module's id - zyra's
     *               `initializeModules()`/`useModules()` (react-frontend.md)
     *               expect this exact flat-array shape.
     */
    public function get_modules() {
        return VuloPilot()->modules->get_active_modules();
    }
}
