<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Address;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Address module Rest class.
 *
 * Module-level REST controller, public — same reasoning as Cart\Rest's own
 * docblock (a guest checking out has no WordPress session). This route is
 * validate-only; the address that's actually persisted goes through
 * Order\Rest::create_item()'s own call to the same AddressService, at
 * order-creation time. `POST /address/validate` exists so the checkout
 * wizard's Address step can tell the buyer about a missing field *before*
 * they reach Review, not just fail at the very last step.
 *
 * @class       Rest class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Rest {

    /**
     * Rest constructor.
     */
    public function __construct() {
        add_action( 'rest_api_init', array( $this, 'register_routes' ) );
    }

    /**
     * Registers this module's REST routes.
     *
     * @return void
     */
    public function register_routes(): void {
        register_rest_route(
            VuloCart()->rest_namespace,
            '/address/validate',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'validate_address' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    /**
     * Sanitizes and validates a posted address bag.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function validate_address( $request ) {
        $params  = $request->get_json_params();
        $address = VuloCart()->address_service->sanitize( is_array( $params ) ? $params : array() );
        $valid   = VuloCart()->address_service->validate( $address );

        $missing = array();

        if ( ! $valid ) {
            foreach ( \VuloCart\Address\Application\AddressService::REQUIRED_FIELDS as $field ) {
                if ( empty( $address[ $field ] ) ) {
                    $missing[] = $field;
                }
            }
        }

        return rest_ensure_response(
            array(
                'valid'          => $valid,
                'missing_fields' => $missing,
                'address'        => $address,
            )
        );
    }
}
