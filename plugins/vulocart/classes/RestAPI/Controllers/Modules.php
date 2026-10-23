<?php
/**
 * Modules class file.
 *
 * @package VuloCart
 */

namespace VuloCart\RestAPI\Controllers;

defined( 'ABSPATH' ) || exit;

/**
 * `GET` / `POST /vulocart/v1/modules`: reads and changes which modules are active.
 *
 * `GET` returns a flat array of active module ids. `POST` takes `{ id, action }` where `action` is `activate` or
 * `deactivate`. The list of available modules (names, descriptions, categories) is static frontend config in
 * src/modules-config.ts, so this controller only reports and changes which ids are active.
 *
 * @class       Modules class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Modules extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'modules';

    /**
     * Registers this controller's REST routes.
     *
     * @return void
     */
    public function register_routes() {
        register_rest_route(
            VuloCart()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'set_modules' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );
    }

    /**
     * Checks whether the current user can view/activate/deactivate modules.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function permissions_check( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        return current_user_can( 'manage_options' );
    }

    /**
     * Every currently active module's id - zyra's `initializeModules()`/
     * `useModules()` expect this exact flat-array shape.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        return rest_ensure_response( VuloCart()->modules->get_active_modules() );
    }

    /**
     * Activates or deactivates one module - the request shape zyra's
     * `ModuleGridComponent` actually sends (`{ id, action }`).
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function set_modules( $request ) {
        $module_id = sanitize_key( (string) $request->get_param( 'id' ) );
        $action    = sanitize_key( (string) $request->get_param( 'action' ) );

        if ( '' === $module_id ) {
            return new \WP_Error(
                'vulocart_missing_module_id',
                esc_html__( 'No module id given.', 'vulocart' ),
                array( 'status' => 400 )
            );
        }

        $module_ids = VuloCart()->modules->with_companions( $module_id );

        $result = 'activate' === $action
            ? VuloCart()->modules->activate_modules( $module_ids )
            : VuloCart()->modules->deactivate_modules( $module_ids );

        return rest_ensure_response( $result );
    }
}
