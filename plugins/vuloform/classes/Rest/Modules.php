<?php
/**
 * Modules REST controller file.
 *
 * @package VuloForm
 */

namespace VuloForm\Rest;

defined( 'ABSPATH' ) || exit;

/**
 * Lists the modules extensions offer and switches them on or off: vuloform/v1/modules.
 */
class Modules extends Controller {

	/**
	 * Registers this controller's routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		$this->route( '/modules', \WP_REST_Server::READABLE, 'get_items' );
		$this->route( '/modules', \WP_REST_Server::CREATABLE, 'update_item' );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- signature required by WP_REST_Controller.
		return rest_ensure_response(
			array(
				'available' => array_keys( VuloForm()->modules->get_all_modules() ),
				'active'    => VuloForm()->modules->get_active_modules(),
			)
		);
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_item( $request ) {
		$input = (array) $request->get_json_params();
		$id    = sanitize_key( (string) ( $input['id'] ?? '' ) );

		if ( ! VuloForm()->modules->set_active( $id, ! empty( $input['active'] ) ) ) {
			return $this->not_found();
		}

		return $this->get_items( $request );
	}
}
