<?php
namespace VuloPilot\SeoVisibility\Rest;

use VuloPilot\AiCopilot\ContentCreationOrchestrator;
use VuloPilot\BrandIntelligence\Rest\BrandIntelligence;
use VuloPilot\Utill\VuloPilotException;
use VuloPilot\Geo\Rest\Geo;
use VuloPilot\Utill\FindingRepository;
use VuloPilot\Content\NotFoundLogRepository;
use VuloPilot\Content\RedirectRepository;
use VuloPilot\Utill\ScanRepository;
use VuloPilot\Seo\Rest\Seo;
use VuloPilot\Seo\Scanners\BrokenImagesScanner;
use VuloPilot\Seo\Scanners\BrokenLinksScanner;
use VuloPilot\Settings\GoogleAnalyticsClient;
use VuloPilot\Settings\GoogleServicesConnection;
use VuloPilot\SeoVisibility\OnPageAnalyzer;
use VuloPilot\SeoVisibility\PostSeoMetaFields;
use VuloPilot\SeoVisibility\SchemaCoverageAnalyzer;
use VuloPilot\SeoVisibility\SchemaPageInspector;

defined( 'ABSPATH' ) || exit;

/**
 * `POST /post-seo/{id}/analyze` - the one part of the post-editor metabox
 * that needs a custom endpoint. Every other field (focus keyword,
 * canonical/social overrides, schema JSON-LD) is a postmeta key
 * registered via Services\PostSeoMetaFields's `show_in_rest`, riding
 * WordPress's own `wp/v2/posts|pages/{id}` REST fields. Analysis is
 * different: Services\OnPageAnalyzer::analyze() runs against unsaved
 * editor state, which core's REST post object can't reflect until an
 * actual save - hence POST-with-body rather than GET.
 *
 * Permission is `edit_post` on the specific post, not this codebase's
 * usual blanket `manage_options` - any Author/Editor with rights to
 * their own post uses this screen.
 *
 * @class       PostSeo controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class PostSeo extends \WP_REST_Controller {

    /**
     * REST base shared with vulopilot-pro's PostSeoFixRest (rest-api.md's
     * "share a base, register different sub-routes" pattern).
     *
     * @var string
     */
    protected $rest_base = 'post-seo';

    /**
     * Registers POST /post-seo/{id}/analyze.
     *
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/analyze',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'analyze_item' ),
                    'permission_callback' => array( $this, 'edit_post_permissions_check' ),
                ),
            )
        );
    }

    /**
     * Only the post's own author/editor may use its analysis endpoint.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function edit_post_permissions_check( $request ) {
        return current_user_can( 'edit_post', absint( $request->get_param( 'id' ) ) );
    }

    /**
     * Runs Services\OnPageAnalyzer against the editor's current (possibly
     * unsaved) field values, not the post as stored in the database.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function analyze_item( $request ) {
        $body = $request->get_json_params();
        if ( ! is_array( $body ) ) {
            $body = array();
        }

        $post_id = absint( $request->get_param( 'id' ) );
        $post    = get_post( $post_id );

        $results = ( new OnPageAnalyzer() )->analyze(
            array(
                'title'         => (string) ( $body['title'] ?? ( $post ? $post->post_title : '' ) ),
                'content'       => (string) ( $body['content'] ?? ( $post ? $post->post_content : '' ) ),
                'excerpt'       => (string) ( $body['excerpt'] ?? ( $post ? $post->post_excerpt : '' ) ),
                'slug'          => (string) ( $body['slug'] ?? ( $post ? $post->post_name : '' ) ),
                'focus_keyword' => (string) ( $body['focus_keyword'] ?? get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['focus_keyword'], true ) ),
            )
        );

        return rest_ensure_response( array( 'results' => $results ) );
    }
}
