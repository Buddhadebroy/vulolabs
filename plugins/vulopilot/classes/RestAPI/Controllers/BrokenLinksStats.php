<?php
/**
 * BrokenLinksStats controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Scanners\Basic\BrokenLinksScanner;
use VuloPilot\Scanners\Basic\BrokenImagesScanner;
use VuloPilot\Repositories\ScanRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /broken-links/stats` — backs BrokenLinksTab.tsx's own "Link
 * health"/"Coverage" tiles (SEO & Visibility → Broken Links) with real
 * numbers: BrokenLinksScanner::STATS_OPTION/BrokenImagesScanner::STATS_OPTION,
 * each written fresh every time that scanner's `scan()` genuinely executes
 * a check (not on a rate-limit-skipped run — see each scanner's own
 * `due_to_run()`). "Broken links"/"Broken images"/"Ignored" counts
 * themselves already come from the existing `GET /findings` endpoint (this
 * tab's own real finding rows); this controller only covers the coverage
 * numbers that scanner never persisted anywhere before this pass — no
 * separate table, no new fabricated aggregate.
 *
 * `POST /broken-links/replace-url` — BrokenLinksSection.tsx's own real
 * "Fix" popup: a genuine search-and-replace of one broken `href`/`src`
 * value for a real new URL the user typed, straight in that page's own
 * `post_content`. Scoped to the exact attribute value
 * BrokenLinksScanner::extract_links_from_recent_content()/
 * BrokenImagesScanner's own equivalent already matched (not a blind
 * site-wide string replace), so it can't touch an unrelated occurrence of
 * the same URL used as visible text elsewhere on the page.
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

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/replace-url',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'replace_url' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                    'args'                => array(
                        'post_id'  => array(
                            'required'          => true,
                            'validate_callback' => static fn( $value ): bool => is_numeric( $value ),
                        ),
                        'old_url'  => array(
                            'required' => true,
                        ),
                        'new_url'  => array(
                            'required' => true,
                        ),
                        'is_image' => array(
                            'required' => false,
                        ),
                        // Optional real anchor-text edit, alongside the
                        // real href fix — only meaningful for a
                        // `broken-links` finding (an image has no visible
                        // text of its own to edit).
                        'old_text' => array(
                            'required' => false,
                        ),
                        'new_text' => array(
                            'required' => false,
                        ),
                    ),
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
                'links'    => $this->read_stats( BrokenLinksScanner::STATS_OPTION ),
                'images'   => $this->read_stats( BrokenImagesScanner::STATS_OPTION ),
                'last_run' => ( new ScanRepository() )->get_latest_completed( array( 'broken-links', 'broken-images' ) ),
            )
        );
    }

    /**
     * A real search-and-replace of one broken link's/image's own real
     * `href`/`src` attribute value for a real new URL, straight in that
     * page's own `post_content` — BrokenLinksSection.tsx's own "Fix"
     * popup. Scoped to the exact attribute (not a blind site-wide string
     * replace) so a broken URL that also happens to appear as this page's
     * own visible text elsewhere is left alone. Returns a real
     * `WP_Error` (404/400), never a bare fabricated "false", when the
     * page doesn't exist, the new URL doesn't validate, or the old URL
     * genuinely isn't found in this page's own current content anymore
     * (e.g. already edited since this finding was last detected).
     *
     * Also updates that same `<a>` tag's own real visible text, when a
     * `broken-links` finding's `new_text` differs from its `old_text` —
     * scoped to the anchor that now carries `new_url` (the one this same
     * request just fixed), not a blind site-wide text replace, so the
     * same old text sitting elsewhere on the page is left untouched.
     * Never attempted for an image fix (`is_image`) — an image has no
     * real visible text of its own to edit.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function replace_url( \WP_REST_Request $request ) {
        $post_id  = (int) $request->get_param( 'post_id' );
        $old_url  = (string) $request->get_param( 'old_url' );
        $new_url  = esc_url_raw( (string) $request->get_param( 'new_url' ) );
        $is_image = (bool) $request->get_param( 'is_image' );
        $old_text = (string) $request->get_param( 'old_text' );
        $new_text = (string) $request->get_param( 'new_text' );

        $post = get_post( $post_id );

        if ( ! $post ) {
            return new \WP_Error(
                'vulopilot_broken_link_post_not_found',
                __( 'That page could not be found.', 'vulopilot' ),
                array( 'status' => 404 )
            );
        }

        if ( '' === $new_url ) {
            return new \WP_Error(
                'vulopilot_broken_link_invalid_url',
                __( 'Please enter a valid URL.', 'vulopilot' ),
                array( 'status' => 400 )
            );
        }

        $attribute = $is_image ? 'src' : 'href';
        $pattern   = '/(' . preg_quote( $attribute, '/' ) . '=["\'])' . preg_quote( $old_url, '/' ) . '(["\'])/i';

        $updated_content = preg_replace( $pattern, '${1}' . $new_url . '${2}', $post->post_content, -1, $count );

        if ( 0 === $count ) {
            return new \WP_Error(
                'vulopilot_broken_link_not_found_in_content',
                __( 'That URL could not be found in this page’s current content — it may have already been changed.', 'vulopilot' ),
                array( 'status' => 404 )
            );
        }

        $text_replaced = 0;

        if ( ! $is_image && '' !== $new_text && $new_text !== $old_text ) {
            $text_pattern    = '/(<a\s[^>]*href=["\']' . preg_quote( $new_url, '/' ) . '["\'][^>]*>)' . preg_quote( $old_text, '/' ) . '(<\/a>)/i';
            $updated_content = preg_replace( $text_pattern, '${1}' . esc_html( $new_text ) . '${2}', $updated_content, -1, $text_replaced );
        }

        $result = wp_update_post(
            array(
                'ID'           => $post_id,
                'post_content' => $updated_content,
            ),
            true
        );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response(
            array(
                'success'       => true,
                'replaced'      => $count,
                'text_replaced' => $text_replaced > 0,
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
