<?php
/**
 * EntityExtraction controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Services\EntityExtractor;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /entities` backs src/pages/KnowledgeGraph/KnowledgeGraph.tsx —
 * Services\EntityExtractor's own docblock has the full extraction design.
 *
 * @class       EntityExtraction controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class EntityExtraction extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'entities';

    /**
     * @var EntityExtractor
     */
    private EntityExtractor $extractor;

    /**
     * @param EntityExtractor|null $extractor Defaults to a new instance (injectable for tests).
     */
    public function __construct( ?EntityExtractor $extractor = null ) {
        $this->extractor = $extractor ?? new EntityExtractor();
    }

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

        // Backs BusinessProfileCard.tsx's own "Business Name Details" side
        // panel — see EntityExtractor::get_business_name_sources()'s own
        // docblock for what this real 4-source cross-check actually is.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/business-name-sources',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_business_name_sources' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                    'args'                => array(
                        'refresh' => array(
                            'type'    => 'boolean',
                            'default' => false,
                        ),
                    ),
                ),
            )
        );

        // Backs BusinessProfileCard.tsx's own "Product Details" side panel
        // — see EntityExtractor::get_product_schema_details()'s own
        // docblock for what these real per-product completeness issues
        // actually are.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/product-details',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_product_schema_details' ),
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
        $data = $this->extractor->extract_all();

        // `edit_url` is a real, per-viewer capability check
        // (`current_user_can( 'edit_user', ... )`) — computed fresh on
        // every request rather than inside EntityExtractor::extract_all()
        // itself, since that method's own result is cached in one
        // site-wide transient shared by every admin who views this tab;
        // baking a single viewer's own edit capability into that shared
        // cache would leak whichever admin happened to trigger the cache
        // fill.
        $data['people'] = array_map(
            function ( array $person ): array {
                $user_id = (int) $person['source_object_ref'];

                $person['meta']['edit_url'] = current_user_can( 'edit_user', $user_id )
                    ? get_edit_user_link( $user_id )
                    : null;

                return $person;
            },
            $data['people']
        );

        // Same real, per-viewer `edit_url` reasoning as `people` above —
        // `current_user_can( 'edit_term', ... )` respects each taxonomy's
        // own real capability mapping (e.g. WooCommerce's own
        // `manage_product_terms` for `product_cat`, not just the default
        // `category` taxonomy's `manage_categories`), so this can't be
        // baked into EntityExtractor::extract_all()'s own shared cache
        // either.
        $data['categories'] = array_map(
            function ( array $category ): array {
                $term_id  = (int) $category['source_object_ref'];
                $taxonomy = is_string( $category['meta']['taxonomy'] ?? null ) ? $category['meta']['taxonomy'] : '';
                $edit_url = current_user_can( 'edit_term', $term_id ) ? get_edit_term_link( $term_id, $taxonomy ) : null;

                $category['meta']['edit_url'] = is_string( $edit_url ) ? $edit_url : null;

                return $category;
            },
            $data['categories']
        );

        return rest_ensure_response( $data );
    }

    /**
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public function get_business_name_sources( $request ) {
        return rest_ensure_response(
            $this->extractor->get_business_name_sources( (bool) $request->get_param( 'refresh' ) )
        );
    }

    /**
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public function get_product_schema_details( $request ) {
        return rest_ensure_response( $this->extractor->get_product_schema_details() );
    }
}
