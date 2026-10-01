<?php
namespace VuloPilot\Performance\Rest;

use VuloPilot\Performance\PageSpeedRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /page-speed` lists per-page speed results, a summary and top issues;
 * `POST /page-speed` starts a background scan.
 *
 * @class       PageSpeed controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class PageSpeed extends \WP_REST_Controller {

	/**
	 * REST base for this controller's routes.
	 *
	 * @var string
	 */
	protected $rest_base = 'page-speed';

	/**
	 * Registers GET/POST /page-speed.
	 *
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
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_item' ),
					'permission_callback' => array( $this, 'create_item_permissions_check' ),
				),
			)
		);
	}

	/**
	 * Requires manage_options.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return bool
	 */
	public function get_items_permissions_check( $request ) {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Requires manage_options.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return bool
	 */
	public function create_item_permissions_check( $request ) {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Lists per-page speed results with a summary.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request ) {
		$repository = new PageSpeedRepository();
		$page       = absint( $request->get_param( 'page' ) );
		$per_page   = absint( $request->get_param( 'per_page' ) );

		$filters = array(
			'page_type' => sanitize_key( (string) $request->get_param( 'page_type' ) ),
			'status'    => sanitize_key( (string) $request->get_param( 'status' ) ),
			'search'    => sanitize_text_field( (string) $request->get_param( 'search' ) ),
		);

		$result = $repository->find_all(
			array_merge(
				$filters,
				array(
					'page'     => $page ? $page : 1,
					'per_page' => $per_page ? $per_page : 100,
					'orderby'  => 'score',
					'order'    => 'asc',
				)
			)
		);

		return rest_ensure_response(
			array(
				'summary'       => $repository->get_summary(),
				'status_counts' => $repository->count_by_column( 'status', $filters ),
				'top_issues'    => $repository->get_top_issues(),
				'data'          => $result['data'],
				'total'         => $result['total'],
				'pending'       => VuloPilot()->page_speed_scanner->get_pending_count(),
			)
		);
	}

	/**
	 * Starts (or restarts) a background scan, processed in batches by WP-Cron.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function create_item( $request ) {
		return rest_ensure_response( VuloPilot()->page_speed_scanner->start_scan() );
	}
}
