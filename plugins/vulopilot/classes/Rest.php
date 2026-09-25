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
            'ai_history'                  => new AiAssistantRest\AiHistory(),
            'vulocloud_ai_connection'     => new AiAssistantRest\VuloCloudAiConnection(),
            'ai_action_runs'              => new AiCopilotRest\AiActionRuns(),
            'activity_logs'               => new DashboardRest\ActivityLogs(),
            'automations'                 => new AutomationsRest\Automations(),
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
            'content_assistant'           => new ContentRest\ContentAssistant(),
            'copilot'                     => new AiCopilotRest\Copilot(),
            'store_readiness'             => new StoreReadiness(),
            'efficiency_checks'           => new PerformanceRest\EfficiencyChecks(),
            'plugin_overlap'              => new SiteHealthRest\PluginOverlap(),
            'geo_top_pages'               => new GeoRest\GeoAnalysis(),
            'content_score'               => new ContentIntelligenceRest\ContentIntelligence(),
            'brand_score'                 => new BrandIntelligenceRest\BrandIntelligence(),
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
