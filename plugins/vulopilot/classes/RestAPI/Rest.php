<?php
/**
 * Rest class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot Rest class.
 *
 * Plugin-level REST dispatcher — mirrors rest-api.md's documented
 * two-tier pattern exactly: this builds a container of controllers and
 * loops `register_routes()` on `rest_api_init`. All of VuloPilot's own
 * controllers are plugin-level (none are module-scoped yet, since no
 * module has its own REST needs), so they all live here rather than
 * self-hooking individually.
 *
 * `vulopilot_rest_controllers` (Sdk\ExtensionManager, ARCHITECTURE.md's
 * Prompt 15) is the REST extension point for anything that'd rather add
 * itself to this central dispatcher than self-hook `rest_api_init`
 * independently — both are valid, same "module-level controllers can
 * self-hook independently" posture rest-api.md already documents, just
 * with this filter as the second option instead of the only one.
 *
 * @class       Rest class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Rest {

    /**
     * @var array<string, \WP_REST_Controller>
     */
    private array $controllers = array();

    /**
     * Rest constructor.
     */
    public function __construct() {
        add_action( 'rest_api_init', array( $this, 'register_routes' ) );
    }

    /**
     * Instantiates every controller (own + filtered-in) and registers its
     * routes. A filtered-in controller that isn't already an instance, or
     * doesn't extend \WP_REST_Controller, is silently skipped — same
     * defensive posture every other discovery-by-filter registry in this
     * codebase already uses for a broken third-party registration.
     *
     * @return void
     */
    public function register_routes(): void {
        $this->controllers = array(
            'dashboard'        => new Controllers\Dashboard(),
            'dashboard_layout' => new Controllers\DashboardLayout(),
            'scans'            => new Controllers\Scans(),
            'findings'         => new Controllers\Findings(),
            'reports'          => new Controllers\Reports(),
            'ai_history'       => new Controllers\AiHistory(),
            'ai_providers'     => new Controllers\AiProviders(),
            'ai_action_runs'   => new Controllers\AiActionRuns(),
            'activity_logs'    => new Controllers\ActivityLogs(),
            'history'          => new Controllers\History(),
            'automations'      => new Controllers\Automations(),
            'settings'         => new Controllers\Settings(),
            'llms_txt'         => new Controllers\LlmsTxt(),
            'crawler_traffic'  => new Controllers\CrawlerTraffic(),
            'post_seo'         => new Controllers\PostSeo(),
            'redirects'        => new Controllers\Redirects(),
            'not_found_logs'   => new Controllers\NotFoundLogs(),
            'indexnow'         => new Controllers\IndexNow(),
            // Deliberately NOT keyed 'geo_analysis' — vulopilot-pro's
            // GeoInsights module adds its own controller into
            // $extra_controllers below under that exact key (its `Rest.php`
            // hosts the per-post AI score routes at this same 'geo-analysis'
            // REST base), and this controllers array is keyed by array
            // merge, so a matching key here would let Pro's own entry
            // silently overwrite this one before routes are ever
            // registered. Different key, same REST base string is safe —
            // WP_REST_Server registers routes per controller instance, not
            // per unique base.
            'geo_top_pages'    => new Controllers\GeoAnalysis(),
            // Deliberately NOT keyed 'content_analysis' — vulopilot-pro's
            // own ContentIntelligence module adds its per-post AI "Topic
            // Authority" controller into $extra_controllers below under
            // that key (same 'content-intelligence' REST base, a
            // `/(?P<post_id>\d+)/analyze` sub-route) — same key-collision
            // reasoning as 'geo_top_pages' above.
            'content_score'    => new Controllers\ContentIntelligence(),
            // Deliberately NOT keyed 'brand_insights' — vulopilot-pro's own
            // BrandIntelligence module adds its own history/competitor-
            // comparison/knowledge-panel controller into $extra_controllers
            // below under that key (same 'brand-intelligence' REST base) —
            // same key-collision reasoning as 'geo_top_pages'/'content_score'
            // above.
            'brand_score'      => new Controllers\BrandIntelligence(),
            // Deliberately NOT keyed 'knowledge_graph' — vulopilot-pro's own
            // KnowledgeGraph module adds its own relationships/health-
            // history/recommendations controller into $extra_controllers
            // below under that key (a different REST base,
            // 'knowledge-graph', so this one isn't strictly required to
            // differ — kept different anyway for consistency with every
            // other Free/Pro controller pairing above).
            'entities'         => new Controllers\EntityExtraction(),
        );

        $extra_controllers = apply_filters( 'vulopilot_rest_controllers', array() );

        foreach ( $extra_controllers as $key => $controller ) {
            if ( $controller instanceof \WP_REST_Controller ) {
                $this->controllers[ $key ] = $controller;
            }
        }

        foreach ( $this->controllers as $controller ) {
            $controller->register_routes();
        }
    }
}
