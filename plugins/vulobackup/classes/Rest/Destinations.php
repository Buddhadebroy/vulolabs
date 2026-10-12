<?php
/**
 * Destinations REST controller file.
 *
 * @package VuloBackup
 */

namespace VuloBackup\Rest;

defined( 'ABSPATH' ) || exit;

/**
 * REST route vulobackup/v1/destinations - the remote places backups are copied to. A destination is
 * only saved after a real write, read and delete at the far end has succeeded. Secret values go in
 * but never come back out.
 */
class Destinations extends Controller {

	/**
	 * Registers this controller's routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		$id = '(?P<id>[a-z0-9]{4,20})';

		$this->route( '/destinations', \WP_REST_Server::READABLE, 'get_items' );
		$this->route( '/destinations', \WP_REST_Server::CREATABLE, 'create_item' );
		$this->route( '/destinations/' . $id, \WP_REST_Server::DELETABLE, 'delete_item' );
		$this->route( '/destinations/' . $id . '/test', \WP_REST_Server::CREATABLE, 'test' );
		$this->route( '/destinations/' . $id . '/enabled', \WP_REST_Server::CREATABLE, 'enabled' );
	}

	/**
	 * Lists the destinations and the kinds that can be added.
	 *
	 * @param \WP_REST_Request|null $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request = null ) {
		$destinations = VuloBackup()->destinations;

		return rest_ensure_response(
			array(
				'destinations' => array_values( array_map( array( $destinations, 'for_browser' ), $destinations->all() ) ),
				'providers'    => $destinations->definitions(),
				'max'          => \VuloBackup\Storage\Destinations::MAX,
			)
		);
	}

	/**
	 * Tests and saves a destination (new, or an existing one when `id` is given).
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create_item( $request ) {
		$saved = VuloBackup()->destinations->save( (array) $request->get_json_params() );

		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		VuloBackup()->logger->log(
			'info',
			'destination_saved',
			/* translators: %s: where the destination is. */
			sprintf( __( 'Storage destination saved after a successful test: %s.', 'vulobackup' ), $saved['where'] )
		);

		return rest_ensure_response( $saved );
	}

	/**
	 * Tests a stored destination again.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function test( $request ) {
		return rest_ensure_response( VuloBackup()->destinations->retest( (string) $request['id'] ) );
	}

	/**
	 * Switches a destination on or off.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function enabled( $request ) {
		$input = (array) $request->get_json_params();

		if ( ! VuloBackup()->destinations->set_enabled( (string) $request['id'], ! empty( $input['enabled'] ) ) ) {
			return new \WP_Error( 'vulobackup_not_found', __( 'That destination no longer exists.', 'vulobackup' ), array( 'status' => 404 ) );
		}

		return $this->get_items();
	}

	/**
	 * Forgets a destination. Backups already there are left where they are.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_item( $request ) {
		if ( VuloBackup()->jobs->active() ) {
			return new \WP_Error( 'vulobackup_busy', __( 'A destination cannot be removed while a backup or restore is running.', 'vulobackup' ), array( 'status' => 409 ) );
		}

		if ( ! VuloBackup()->destinations->delete( (string) $request['id'] ) ) {
			return new \WP_Error( 'vulobackup_not_found', __( 'That destination no longer exists.', 'vulobackup' ), array( 'status' => 404 ) );
		}

		VuloBackup()->logger->log( 'info', 'destination_removed', __( 'A storage destination was removed. Backups already stored there were left in place.', 'vulobackup' ) );

		return $this->get_items();
	}
}
