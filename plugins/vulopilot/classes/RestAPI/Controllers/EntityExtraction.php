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
        return rest_ensure_response( $this->extractor->extract_all() );
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
