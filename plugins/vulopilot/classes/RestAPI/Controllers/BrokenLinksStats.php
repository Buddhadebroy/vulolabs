<?php
/**
 * BrokenLinksStats controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Scanners\Basic\BrokenLinksScanner;
use VuloPilot\Scanners\Basic\BrokenImagesScanner;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /broken-links/stats` — backs BrokenLinksTab.tsx's own "Link
 * health"/"Coverage" tiles (Grow My Traffic → Broken Links) with real
 * numbers: BrokenLinksScanner::STATS_OPTION/BrokenImagesScanner::STATS_OPTION,
 * each written fresh every time that scanner's `scan()` genuinely executes
 * a check (not on a rate-limit-skipped run — see each scanner's own
 * `due_to_run()`). "Broken links"/"Broken images"/"Ignored" counts
 * themselves already come from the existing `GET /findings` endpoint (this
 * tab's own real finding rows); this controller only covers the coverage
 * numbers that scanner never persisted anywhere before this pass — no
 * separate table, no new fabricated aggregate.
 *
 * @class       BrokenLinksStats controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class BrokenLinksStats extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'broken-links';

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/stats',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_stats' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
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
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @return \WP_REST_Response
     */
    public function get_stats() {
        return rest_ensure_response(
            array(
                'links'  => $this->read_stats( BrokenLinksScanner::STATS_OPTION ),
                'images' => $this->read_stats( BrokenImagesScanner::STATS_OPTION ),
            )
        );
    }

    /**
     * @param string $option_name One of the two scanners' own STATS_OPTION constants.
     * @return array{pages_scanned: int, links_checked: int, healthy_count: int, checked_at: int|null} `checked_at` is null (never a fabricated 0/"just now") when this scanner has never genuinely run yet.
     */
    private function read_stats( string $option_name ): array {
        $stats = get_option( $option_name, array() );

        return array(
            'pages_scanned' => (int) ( $stats['pages_scanned'] ?? 0 ),
            'links_checked' => (int) ( $stats['links_checked'] ?? 0 ),
            'healthy_count' => (int) ( $stats['healthy_count'] ?? 0 ),
            'checked_at'    => isset( $stats['checked_at'] ) ? (int) $stats['checked_at'] : null,
        );
    }
}
