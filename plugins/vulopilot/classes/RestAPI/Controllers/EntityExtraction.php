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
}
