<?php
/**
 * Rest class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot;

use VuloPilot\AiCopilot\Rest as AiCopilotRest;
use VuloPilot\BrandVisibility\Rest as BrandIntelligenceRest;
use VuloPilot\ContentOptimization\Rest as ContentIntelligenceRest;
use VuloPilot\KnowledgeGraph\Rest as EntityExtractionRest;
use VuloPilot\GeoAnalysis\Rest as GeoRest;
use VuloPilot\TechnicalSeo\Rest as SeoRest;
use VuloPilot\Dashboard\Rest as DashboardRest;
use VuloPilot\Utill\Scans as UtillRestScans;
use VuloPilot\Utill\Findings as UtillRestFindings;
use VuloPilot\AiAssistant\Rest as AiAssistantRest;
use VuloPilot\Automations\Rest as AutomationsRest;
use VuloPilot\Settings\Rest as SettingsRest;
use VuloPilot\SeoVisibility\Rest as SeoVisibilityRest;
use VuloPilot\Content\Rest as ContentRest;
use VuloPilot\Performance\Rest as PerformanceRest;
use VuloPilot\Reports\Rest as ReportsRest;
use VuloPilot\Security\Rest as SecurityRest;
use VuloPilot\SiteHealth\Rest as SiteHealthRest;
use VuloPilot\Utill\StoreReadiness;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot Rest class.
 *
 * Plugin-level REST dispatcher - mirrors rest-api.md's documented
 * two-tier pattern exactly: this builds a container of controllers and
 * loops `register_routes()` on `rest_api_init`. All of VuloPilot's own
 * controllers are plugin-level (none are module-scoped yet, since no
 * module has its own REST needs), so they all live here rather than
 * self-hooking individually.
 *
 * `vulopilot_rest_controllers` (Sdk\ExtensionManager, ARCHITECTURE.md's
 * Prompt 15) is the REST extension point for anything that'd rather add
 * itself to this central dispatcher than self-hook `rest_api_init`
 * independently - both are valid, same "module-level controllers can
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
     * doesn't extend \WP_REST_Controller, is silently skipped - same
     * defensive posture every other discovery-by-filter registry in this
     * codebase already uses for a broken third-party registration.
     *
     * @return void
     */
    public function register_routes(): void {
        $this->controllers = array(
            'dashboard'                   => new DashboardRest\Dashboard(),
            'dashboard_layout'            => new DashboardRest\DashboardLayout(),
            'scans'                       => new UtillRestScans(),
            'findings'                    => new UtillRestFindings(),
            'history'                     => new ReportsRest\History(),
            // 'reports'/'reports_overview' are deliberately NOT keyed here -
            // one-off report generation lives in vulopilot-pro's
            // AdvancedReports module (Pro-gated); its Core\Rest\{Reports,
            // ReportsOverview} controllers add themselves via $extra_controllers
            // below, same "Free deliberately doesn't keep a fallback" posture
            // 'automation_dashboard' below already established.
            'ai_history'                  => new AiAssistantRest\AiHistory(),
            'vulocloud_ai_connection'     => new AiAssistantRest\VuloCloudAiConnection(),
            'ai_action_runs'              => new AiCopilotRest\AiActionRuns(),
            'activity_logs'               => new DashboardRest\ActivityLogs(),
            'automations'                 => new AutomationsRest\Automations(),
            // Deliberately NOT keyed 'automation_runs' - that data only ever
            // backed AutomationsActivityCard.tsx's own "Recent automation
            // activity" feed, which moved to vulopilot-pro's own
            // Automations module wholesale per direct instruction (Free now
            // shows AutomationsActivityDummy.tsx in its place). Registering
            // a Free-side fallback here would let that feed keep working
            // even without a licensed Pro Automations module, undermining
            // the gate - vulopilot-pro's own AutomationsRunsRest.php (same
            // `automation_runs` key) is this route's only real owner.
            'automation_dashboard'        => new AutomationsRest\AutomationDashboardStats(),
            'settings'                    => new SettingsRest\Settings(),
            'llms_txt'                    => new GeoRest\LlmsTxt(),
            'crawler_traffic'             => new SeoVisibilityRest\CrawlerTraffic(),
            'post_seo'                    => new SeoVisibilityRest\PostSeo(),
            'redirects'                   => new ContentRest\Redirects(),
            'not_found_logs'              => new ContentRest\NotFoundLogs(),
            'broken_links_stats'          => new ContentRest\BrokenLinksStats(),
            'robots_sitemap'              => new SeoVisibilityRest\RobotsSitemap(),
            'indexnow'                    => new SeoVisibilityRest\IndexNow(),
            'performance_actions'         => new PerformanceRest\PerformanceActions(),
            'performance_score_snapshots' => new PerformanceRest\PerformanceScoreSnapshots(),
            'security_score_snapshots'    => new SecurityRest\SecurityScoreSnapshots(),
            'performance_realtime'        => new PerformanceRest\PerformanceRealtime(),
            'core_web_vitals'             => new PerformanceRest\CoreWebVitals(),
            'core_web_vitals_beacon'      => new PerformanceRest\CoreWebVitalsBeaconRest(),
            'page_speed'                  => new PerformanceRest\PageSpeed(),
            'backups'                     => new SiteHealthRest\Backups(),
            // 'backup_storage' (Amazon S3/Google Drive credentials) moved
            // to vulopilot-pro's own BackupCloudStorage module - registered
            // via the `vulopilot_rest_controllers` filter below instead,
            // same as every other Pro-only REST controller.
            'content_assistant'           => new ContentRest\ContentAssistant(),
            // "Chat with VuloPilot" (/copilot/chat + /copilot/conversations)
            // - briefly a Pro-only feature (vulopilot-pro's own CopilotChat
            // module); moved back here, genuinely free again, gated the
            // same way as every other AI surface (Controllers\Copilot's
            // own create_item_permissions_check()) rather than a license.
            'copilot'                     => new AiCopilotRest\Copilot(),
            'store_readiness'             => new StoreReadiness(),
            'efficiency_checks'           => new PerformanceRest\EfficiencyChecks(),
            'plugin_overlap'              => new SiteHealthRest\PluginOverlap(),
            // Deliberately NOT keyed 'geo_analysis' - vulopilot-pro's
            // GeoInsights module adds its own controller into
            // $extra_controllers below under that exact key (its `Rest.php`
            // hosts the per-post AI score routes at this same 'geo-analysis'
            // REST base), and this controllers array is keyed by array
            // merge, so a matching key here would let Pro's own entry
            // silently overwrite this one before routes are ever
            // registered. Different key, same REST base string is safe -
            // WP_REST_Server registers routes per controller instance, not
            // per unique base.
            'geo_top_pages'               => new GeoRest\GeoAnalysis(),
            // Deliberately NOT keyed 'content_analysis' - vulopilot-pro's
            // own ContentIntelligence module adds its per-post AI "Topic
            // Authority" controller into $extra_controllers below under
            // that key (same 'content-intelligence' REST base, a
            // `/(?P<post_id>\d+)/analyze` sub-route) - same key-collision
            // reasoning as 'geo_top_pages' above.
            'content_score'               => new ContentIntelligenceRest\ContentIntelligence(),
            // Deliberately NOT keyed 'brand_insights' - vulopilot-pro's own
            // BrandIntelligence module adds its own history/competitor-
            // comparison/knowledge-panel controller into $extra_controllers
            // below under that key (same 'brand-intelligence' REST base) -
            // same key-collision reasoning as 'geo_top_pages'/'content_score'
            // above.
            'brand_score'                 => new BrandIntelligenceRest\BrandIntelligence(),
            // Deliberately NOT keyed 'knowledge_graph' - vulopilot-pro's own
            // KnowledgeGraph module adds its own relationships/health-
            // history/recommendations controller into $extra_controllers
            // below under that key (a different REST base,
            // 'knowledge-graph', so this one isn't strictly required to
            // differ - kept different anyway for consistency with every
            // other Free/Pro controller pairing above).
            'entities'                    => new EntityExtractionRest\EntityExtraction(),
            'seo_score'                   => new SeoRest\Seo(),
            'geo_score'                   => new GeoRest\Geo(),
            'visibility_score'            => new SeoVisibilityRest\Visibility(),
            'schema_coverage'             => new SeoVisibilityRest\Schema(),
            'google_services'             => new SettingsRest\GoogleServices(),
            'ai_credits'                  => new AiAssistantRest\AiCredits(),
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
