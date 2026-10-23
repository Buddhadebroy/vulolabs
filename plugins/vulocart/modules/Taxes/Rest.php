<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Taxes;

use VuloCart\Taxes\Application\Presets;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Taxes module Rest class.
 *
 * `GET /taxes/rate` is public (the checkout labels its tax line from it); everything that edits tax classes and
 * rates needs `manage_options`. The amount charged always comes from the server-side calculation on the order, never
 * from this controller.
 *
 * @class       Rest class
 * @version     2.0.0
 * @author      VuloLabs
 */
class Rest extends \WP_REST_Controller {

    /**
     * The route base.
     *
     * @var string
     */
    protected $rest_base = 'taxes';

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
        $ns    = VuloCart()->rest_namespace;
        $admin = array( $this, 'can_manage' );

        register_rest_route(
            $ns,
            '/taxes/rate',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_rate' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            $ns,
            '/taxes/classes',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'list_classes' ),
                    'permission_callback' => $admin,
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_class' ),
                    'permission_callback' => $admin,
                ),
            )
        );

        register_rest_route(
            $ns,
            '/taxes/classes/(?P<slug>[a-z0-9-]+)',
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( $this, 'delete_class' ),
                'permission_callback' => $admin,
            )
        );

        register_rest_route(
            $ns,
            '/taxes/rates',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'list_rates' ),
                    'permission_callback' => $admin,
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_rate' ),
                    'permission_callback' => $admin,
                ),
            )
        );

        register_rest_route(
            $ns,
            '/taxes/rates/(?P<id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_rate' ),
                    'permission_callback' => $admin,
                ),
                array(
                    'methods'             => \WP_REST_Server::DELETABLE,
                    'callback'            => array( $this, 'delete_rate' ),
                    'permission_callback' => $admin,
                ),
            )
        );

        register_rest_route(
            $ns,
            '/taxes/presets',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'list_presets' ),
                    'permission_callback' => $admin,
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'apply_preset' ),
                    'permission_callback' => $admin,
                ),
            )
        );
    }

    /**
     * Whether the current user can manage tax settings.
     *
     * @return bool
     */
    public function can_manage(): bool {
        return current_user_can( 'manage_options' );
    }

    /**
     * Returns the currently configured tax summary.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_rate( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        $tax_service = VuloCart()->tax_service;

        return rest_ensure_response(
            array(
                'enabled'            => $tax_service->is_enabled(),
                'rate_percent'       => $tax_service->get_rate_percent(),
                'prices_include_tax' => $tax_service->prices_include_tax(),
                'rates_defined'      => $tax_service->rates()->count(),
            )
        );
    }

    /**
     * Lists tax classes.
     *
     * @return \WP_REST_Response
     */
    public function list_classes() {
        $out = array();

        foreach ( VuloCart()->tax_service->rates()->classes() as $slug => $name ) {
            $out[] = array(
                'slug' => $slug,
                'name' => $name,
            );
        }

        return rest_ensure_response( $out );
    }

    /**
     * Adds a tax class.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function create_class( $request ) {
        $slug = VuloCart()->tax_service->rates()->add_class( (string) $request->get_param( 'name' ) );

        if ( ! $slug ) {
            return new \WP_Error( 'vulocart_invalid_tax_class', esc_html__( 'Give the class a new name.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $response = rest_ensure_response(
            array(
                'slug' => $slug,
                'name' => VuloCart()->tax_service->rates()->classes()[ $slug ],
            )
        );
        $response->set_status( 201 );

        return $response;
    }

    /**
     * Removes a tax class.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function delete_class( $request ) {
        if ( ! VuloCart()->tax_service->rates()->delete_class( sanitize_key( (string) $request->get_param( 'slug' ) ) ) ) {
            return new \WP_Error( 'vulocart_tax_class_locked', esc_html__( 'The standard class cannot be removed.', 'vulocart' ), array( 'status' => 409 ) );
        }

        return rest_ensure_response( array( 'deleted' => true ) );
    }

    /**
     * Lists rates, optionally for one class.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function list_rates( $request ) {
        return rest_ensure_response( VuloCart()->tax_service->rates()->all( sanitize_key( (string) $request->get_param( 'tax_class' ) ) ) );
    }

    /**
     * Adds a rate.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function create_rate( $request ) {
        $response = rest_ensure_response( VuloCart()->tax_service->rates()->insert( (array) $request->get_json_params() ) );
        $response->set_status( 201 );

        return $response;
    }

    /**
     * Edits a rate.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function update_rate( $request ) {
        $row = VuloCart()->tax_service->rates()->update( absint( $request->get_param( 'id' ) ), (array) $request->get_json_params() );

        if ( ! $row ) {
            return new \WP_Error( 'vulocart_tax_rate_not_found', esc_html__( 'No tax rate exists with this id.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $row );
    }

    /**
     * Deletes a rate.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function delete_rate( $request ) {
        if ( ! VuloCart()->tax_service->rates()->delete( absint( $request->get_param( 'id' ) ) ) ) {
            return new \WP_Error( 'vulocart_tax_rate_not_found', esc_html__( 'No tax rate exists with this id.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( array( 'deleted' => true ) );
    }

    /**
     * The ready-made rate sets.
     *
     * @return \WP_REST_Response
     */
    public function list_presets() {
        return rest_ensure_response( ( new Presets() )->available() );
    }

    /**
     * Applies a preset: replaces the standard-class rates with the preset's.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function apply_preset( $request ) {
        $rows = ( new Presets() )->rows(
            sanitize_key( (string) $request->get_param( 'preset' ) ),
            sanitize_text_field( (string) $request->get_param( 'state' ) ),
            $request->get_param( 'slab' ) ? (float) $request->get_param( 'slab' ) : 18.0
        );

        if ( null === $rows ) {
            return new \WP_Error( 'vulocart_unknown_tax_preset', esc_html__( 'Unknown preset.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $repo = VuloCart()->tax_service->rates();

        $repo->delete_class_rates( 'standard' );

        foreach ( $rows as $row ) {
            $repo->insert( $row );
        }

        return rest_ensure_response( array( 'applied' => count( $rows ) ) );
    }
}
