<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Customer module Rest class.
 *
 * `GET /customer/me` stays public (unchanged — checkout prefill, class
 * docblock predating this pass still holds). Admin CRUD/list/notes routes
 * are `manage_options`-gated, same as every other admin-listing
 * controller. The `/customer/me/*` self-service routes are the one
 * genuinely new access-control shape in this codebase: gated on
 * `is_user_logged_in()` rather than an opaque per-resource token — the
 * established "token is the access control" pattern (`Order::
 * $access_token`, `Passport`'s own) doesn't fit an address BOOK a buyer
 * manages over many separate visits; a real login is what "my account"
 * has always meant everywhere else, and this app already has one
 * (WordPress's own).
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
            '/customer/me',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_current_customer' ),
                'permission_callback' => '__return_true',
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/customer/me/addresses',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_my_addresses' ),
                    'permission_callback' => array( $this, 'logged_in_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'add_my_address' ),
                    'permission_callback' => array( $this, 'logged_in_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/customer/me/addresses/(?P<address_id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_my_address' ),
                    'permission_callback' => array( $this, 'logged_in_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::DELETABLE,
                    'callback'            => array( $this, 'delete_my_address' ),
                    'permission_callback' => array( $this, 'logged_in_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/customers',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_items' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/customers/(?P<id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_item' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_item' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/customers/(?P<id>\d+)/orders',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_orders' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/customers/(?P<id>\d+)/addresses',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_addresses' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'add_address' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/customers/(?P<id>\d+)/addresses/(?P<address_id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::EDITABLE,
                    'callback'            => array( $this, 'update_address' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::DELETABLE,
                    'callback'            => array( $this, 'delete_address' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/customers/(?P<id>\d+)/notes',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_notes' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'add_note' ),
                    'permission_callback' => array( $this, 'admin_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloCart()->rest_namespace,
            '/customers/(?P<id>\d+)/notes/(?P<note_id>\d+)',
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( $this, 'delete_note' ),
                'permission_callback' => array( $this, 'admin_permissions_check' ),
            )
        );
    }

    /**
     * Checks whether the current user can manage customers.
     *
     * @return bool
     */
    public function admin_permissions_check() {
        return current_user_can( 'manage_options' );
    }

    /**
     * Checks whether the current request has a real WordPress session —
     * see class docblock for why the self-service routes lean on this
     * instead of an opaque token.
     *
     * @return bool
     */
    public function logged_in_permissions_check() {
        return is_user_logged_in();
    }

    /**
     * Returns the checkout wizard's Customer step prefill values.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_current_customer( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        return rest_ensure_response( VuloCart()->customer_service->resolve_current() );
    }

    /**
     * Finds-or-creates the logged-in requester's own customer record —
     * every `/customer/me/*` self-service route resolves through this.
     *
     * @return \VuloCart\Customer\Domain\Customer
     */
    private function resolve_my_customer() {
        $user = wp_get_current_user();

        return VuloCart()->customer_service->find_or_create_by_email( (string) $user->user_email, (string) $user->display_name, null, (int) $user->ID );
    }

    /**
     * Lists the logged-in requester's own saved addresses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_my_addresses( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
        return rest_ensure_response( VuloCart()->customer_service->list_addresses( $this->resolve_my_customer()->id ) );
    }

    /**
     * Sanitizes a raw posted address bag — shared by every address write
     * route, admin and self-service alike.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return array<string, mixed>
     */
    private function sanitize_address_params( $request ): array {
        $data = array();

        foreach ( array( 'label', 'full_name', 'phone', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country' ) as $field ) {
            if ( null !== $request->get_param( $field ) ) {
                $data[ $field ] = sanitize_text_field( (string) $request->get_param( $field ) );
            }
		}

        if ( null !== $request->get_param( 'is_default_billing' ) ) {
            $data['is_default_billing'] = $request->get_param( 'is_default_billing' ) ? 1 : 0;
        }

        if ( null !== $request->get_param( 'is_default_shipping' ) ) {
            $data['is_default_shipping'] = $request->get_param( 'is_default_shipping' ) ? 1 : 0;
        }

        return $data;
    }

    /**
     * Adds a saved address for the logged-in requester.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function add_my_address( $request ) {
        $address = VuloCart()->customer_service->add_address( $this->resolve_my_customer()->id, $this->sanitize_address_params( $request ) );

        $response = rest_ensure_response( $address );
        $response->set_status( 201 );

        return $response;
    }

    /**
     * Updates one of the logged-in requester's own saved addresses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function update_my_address( $request ) {
        $address = VuloCart()->customer_service->update_address(
            absint( $request->get_param( 'address_id' ) ),
            $this->resolve_my_customer()->id,
            $this->sanitize_address_params( $request )
        );

        if ( ! $address ) {
            return new \WP_Error( 'vulocart_address_not_found', __( 'Address not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $address );
    }

    /**
     * Deletes one of the logged-in requester's own saved addresses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function delete_my_address( $request ) {
        $deleted = VuloCart()->customer_service->delete_address( absint( $request->get_param( 'address_id' ) ), $this->resolve_my_customer()->id );

        return rest_ensure_response( array( 'deleted' => $deleted ) );
    }

    /**
     * Converts a domain Customer into the REST response shape, with its
     * own lifetime analytics merged in.
     *
     * @param \VuloCart\Customer\Domain\Customer $customer A customer entity.
     * @return array<string, mixed>
     */
    private function prepare_for_response( $customer ): array {
        return array(
            'id'            => $customer->id,
            'email'         => $customer->email,
            'wp_user_id'    => $customer->wp_user_id,
            'name'          => $customer->name,
            'phone'         => $customer->phone,
            'total_orders'  => $customer->total_orders,
            'total_spent'   => $customer->total_spent,
            'last_order_at' => $customer->last_order_at,
            'created_at'    => $customer->created_at,
            'analytics'     => VuloCart()->customer_service->get_analytics( $customer ),
        );
    }

    /**
     * Lists customers, searchable — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) {
        $page     = absint( $request->get_param( 'page' ) ? $request->get_param( 'page' ) : 1 );
        $per_page = absint( $request->get_param( 'per_page' ) ? $request->get_param( 'per_page' ) : 20 );
        $search   = $request->get_param( 'search' ) ? sanitize_text_field( (string) $request->get_param( 'search' ) ) : null;

        $result = VuloCart()->customer_service->list_customers( array( 'page' => $page, 'per_page' => $per_page, 'search' => $search ) );

        $response = rest_ensure_response( array_map( array( $this, 'prepare_for_response' ), $result['data'] ) );
        $response->header( 'X-WP-Total', (string) $result['total'] );
        $response->header( 'X-WP-TotalPages', (string) ceil( $result['total'] / max( 1, $per_page ) ) );

        return $response;
    }

    /**
     * Fetches one customer — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_item( $request ) {
        $customer = VuloCart()->customer_service->get( absint( $request->get_param( 'id' ) ) );

        if ( ! $customer ) {
            return new \WP_Error( 'vulocart_customer_not_found', __( 'Customer not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $this->prepare_for_response( $customer ) );
    }

    /**
     * Updates a customer's own profile fields — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function update_item( $request ) {
        $data = array();

        if ( null !== $request->get_param( 'name' ) ) {
            $data['name'] = sanitize_text_field( (string) $request->get_param( 'name' ) );
        }

        if ( null !== $request->get_param( 'phone' ) ) {
            $data['phone'] = sanitize_text_field( (string) $request->get_param( 'phone' ) );
        }

        $customer = VuloCart()->customer_service->update_profile( absint( $request->get_param( 'id' ) ), $data );

        if ( ! $customer ) {
            return new \WP_Error( 'vulocart_customer_not_found', __( 'Customer not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $this->prepare_for_response( $customer ) );
    }

    /**
     * A customer's own order history — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_orders( $request ) {
        $customer = VuloCart()->customer_service->get( absint( $request->get_param( 'id' ) ) );

        if ( ! $customer ) {
            return new \WP_Error( 'vulocart_customer_not_found', __( 'Customer not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        $page     = absint( $request->get_param( 'page' ) ? $request->get_param( 'page' ) : 1 );
        $per_page = absint( $request->get_param( 'per_page' ) ? $request->get_param( 'per_page' ) : 20 );

        $result = VuloCart()->customer_service->get_order_history( $customer->email, $page, $per_page );

        return rest_ensure_response( $result['data'] );
    }

    /**
     * Lists a customer's own addresses — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_addresses( $request ) {
        return rest_ensure_response( VuloCart()->customer_service->list_addresses( absint( $request->get_param( 'id' ) ) ) );
    }

    /**
     * Adds an address to a customer's own address book — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function add_address( $request ) {
        $address = VuloCart()->customer_service->add_address( absint( $request->get_param( 'id' ) ), $this->sanitize_address_params( $request ) );

        $response = rest_ensure_response( $address );
        $response->set_status( 201 );

        return $response;
    }

    /**
     * Updates an address in a customer's own address book — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function update_address( $request ) {
        $address = VuloCart()->customer_service->update_address(
            absint( $request->get_param( 'address_id' ) ),
            absint( $request->get_param( 'id' ) ),
            $this->sanitize_address_params( $request )
        );

        if ( ! $address ) {
            return new \WP_Error( 'vulocart_address_not_found', __( 'Address not found.', 'vulocart' ), array( 'status' => 404 ) );
        }

        return rest_ensure_response( $address );
    }

    /**
     * Deletes an address from a customer's own address book — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function delete_address( $request ) {
        $deleted = VuloCart()->customer_service->delete_address( absint( $request->get_param( 'address_id' ) ), absint( $request->get_param( 'id' ) ) );

        return rest_ensure_response( array( 'deleted' => $deleted ) );
    }

    /**
     * Lists a customer's own internal notes — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_notes( $request ) {
        return rest_ensure_response( VuloCart()->customer_service->list_notes( absint( $request->get_param( 'id' ) ) ) );
    }

    /**
     * Adds an internal note about a customer — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function add_note( $request ) {
        $note = $request->get_param( 'note' ) ? sanitize_textarea_field( (string) $request->get_param( 'note' ) ) : '';

        if ( '' === $note ) {
            return new \WP_Error( 'vulocart_missing_note', __( 'Note text is required.', 'vulocart' ), array( 'status' => 400 ) );
        }

        $response = rest_ensure_response(
            VuloCart()->customer_service->add_note( absint( $request->get_param( 'id' ) ), get_current_user_id(), $note )
        );
        $response->set_status( 201 );

        return $response;
    }

    /**
     * Deletes a note — admin only.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function delete_note( $request ) {
        $deleted = VuloCart()->customer_service->delete_note( absint( $request->get_param( 'note_id' ) ), absint( $request->get_param( 'id' ) ) );

        return rest_ensure_response( array( 'deleted' => $deleted ) );
    }
}
