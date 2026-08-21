<?php
/**
 * PluginOverlap controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

defined( 'ABSPATH' ) || exit;

/**
 * GET /plugin-overlap — backs "Protect My Site" → Files & Plugins' own
 * "VuloPilot already covers this" card.
 *
 * Deliberately NOT tied to any vulnerability finding: AdvancedVulnerabilitiesScanner's
 * own feed (LocalSeedVulnerabilityFeed) is illustrative-only sample data
 * matching two fictional plugin slugs — this repo's own documented policy
 * is to never name a real, currently-maintained third-party plugin in
 * relation to a vulnerability claim (see that class's own docblock). This
 * controller makes no such claim either way; it only checks whether a
 * real, currently-*active* plugin's category (SEO, security, accessibility,
 * caching, automation) overlaps with a real VuloPilot feature, the same
 * "known caching plugin" detection `EfficiencyChecks::has_known_caching_plugin()`
 * already does for its own unrelated check, generalized here across a
 * curated list of well-known plugin slugs.
 *
 * @class       PluginOverlap controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class PluginOverlap extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'plugin-overlap';

    /**
     * Curated, well-known WordPress.org plugin main-file paths (the same
     * `folder/file.php` shape `get_option('active_plugins')` stores and
     * `is_plugin_active()` checks against) mapped to the real VuloPilot
     * feature that covers the same ground. `module_id` is a real id from
     * src/components/Modules/index.ts's own catalog when the overlap is a
     * togglable Pro module; `null` for the caching/performance category,
     * which isn't gated behind a module toggle — its destination is the
     * "Improve My Speed" tab instead (`link_tab`).
     *
     * @var array<string, array{plugin_name: string, category: string, vulopilot_feature: string, module_id: string|null, link_tab: string}>
     */
    private const KNOWN_OVERLAPS = array(
        'wordpress-seo/wp-seo.php'                                     => array(
            'plugin_name'       => 'Yoast SEO',
            'category'          => 'seo',
            'vulopilot_feature' => 'SEO Copilot',
            'module_id'         => 'advanced-seo',
            'link_tab'          => 'modules',
        ),
        'seo-by-rank-math/rank-math.php'                               => array(
            'plugin_name'       => 'Rank Math SEO',
            'category'          => 'seo',
            'vulopilot_feature' => 'SEO Copilot',
            'module_id'         => 'advanced-seo',
            'link_tab'          => 'modules',
        ),
        'all-in-one-seo-pack/all_in_one_seo_pack.php'                  => array(
            'plugin_name'       => 'All in One SEO',
            'category'          => 'seo',
            'vulopilot_feature' => 'SEO Copilot',
            'module_id'         => 'advanced-seo',
            'link_tab'          => 'modules',
        ),
        'wordfence/wordfence.php'                                      => array(
            'plugin_name'       => 'Wordfence Security',
            'category'          => 'security',
            'vulopilot_feature' => 'Security Watchtower',
            'module_id'         => 'security-monitoring',
            'link_tab'          => 'modules',
        ),
        'sucuri-scanner/sucuri.php'                                    => array(
            'plugin_name'       => 'Sucuri Security',
            'category'          => 'security',
            'vulopilot_feature' => 'Security Watchtower',
            'module_id'         => 'security-monitoring',
            'link_tab'          => 'modules',
        ),
        'better-wp-security/better-wp-security.php'                    => array(
            'plugin_name'       => 'Solid Security (iThemes Security)',
            'category'          => 'security',
            'vulopilot_feature' => 'Security Watchtower',
            'module_id'         => 'security-monitoring',
            'link_tab'          => 'modules',
        ),
        'all-in-one-wp-security-and-firewall/wp-security.php'          => array(
            'plugin_name'       => 'All In One WP Security & Firewall',
            'category'          => 'security',
            'vulopilot_feature' => 'Security Watchtower',
            'module_id'         => 'security-monitoring',
            'link_tab'          => 'modules',
        ),
        'wp-accessibility/wp-accessibility.php'                        => array(
            'plugin_name'       => 'WP Accessibility',
            'category'          => 'accessibility',
            'vulopilot_feature' => 'Accessibility Guard',
            'module_id'         => 'accessibility-audits',
            'link_tab'          => 'modules',
        ),
        'uncanny-automator/uncanny-automator.php'                      => array(
            'plugin_name'       => 'Uncanny Automator',
            'category'          => 'automation',
            'vulopilot_feature' => 'Workflow Autopilot',
            'module_id'         => 'automations',
            'link_tab'          => 'modules',
        ),
        'wp-rocket/wp-rocket.php'                                      => array(
            'plugin_name'       => 'WP Rocket',
            'category'          => 'caching',
            'vulopilot_feature' => 'Efficiency checks & speed monitoring',
            'module_id'         => null,
            'link_tab'          => 'performance',
        ),
        'w3-total-cache/w3-total-cache.php'                            => array(
            'plugin_name'       => 'W3 Total Cache',
            'category'          => 'caching',
            'vulopilot_feature' => 'Efficiency checks & speed monitoring',
            'module_id'         => null,
            'link_tab'          => 'performance',
        ),
        'wp-super-cache/wp-cache.php'                                  => array(
            'plugin_name'       => 'WP Super Cache',
            'category'          => 'caching',
            'vulopilot_feature' => 'Efficiency checks & speed monitoring',
            'module_id'         => null,
            'link_tab'          => 'performance',
        ),
        'litespeed-cache/litespeed-cache.php'                          => array(
            'plugin_name'       => 'LiteSpeed Cache',
            'category'          => 'caching',
            'vulopilot_feature' => 'Efficiency checks & speed monitoring',
            'module_id'         => null,
            'link_tab'          => 'performance',
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
        if ( ! function_exists( 'is_plugin_active' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $matches = array();

        foreach ( self::KNOWN_OVERLAPS as $plugin_file => $overlap ) {
            if ( is_plugin_active( $plugin_file ) ) {
                $matches[] = array_merge( array( 'plugin_file' => $plugin_file ), $overlap );
            }
        }

        // `data`/`total`, not a bespoke `matches` key — same response
        // shape every other real list endpoint in this codebase uses
        // (useApiList.ts's own `ListResponse<T>` contract), so the
        // frontend can read this the same way as any other list.
        return rest_ensure_response(
            array(
                'data'  => $matches,
                'total' => count( $matches ),
            )
        );
    }
}
