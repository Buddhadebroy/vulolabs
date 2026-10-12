<?php
/**
 * Rest class file.
 *
 * @package VuloForm
 */

namespace VuloForm;

defined( 'ABSPATH' ) || exit;

/**
 * VuloForm Rest class - registers every controller.
 */
class Rest {

	/**
	 * Rest constructor.
	 */
	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * @return void
	 */
	public function register_routes() {
		$controllers = array(
			'forms'       => new Rest\Forms(),
			'submissions' => new Rest\Submissions(),
			'settings'    => new Rest\Settings(),
			'modules'     => new Rest\Modules(),
			'public'      => new Rest\PublicForms(),
		);

		foreach ( (array) apply_filters( 'vuloform_rest_controllers', array() ) as $key => $controller ) {
			if ( $controller instanceof \WP_REST_Controller ) {
				$controllers[ $key ] = $controller;
			}
		}

		foreach ( $controllers as $controller ) {
			$controller->register_routes();
		}
	}
}
