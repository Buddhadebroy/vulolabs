<?php
/**
 * Rest class file.
 *
 * @package VuloBackup
 */

namespace VuloBackup;

defined( 'ABSPATH' ) || exit;

/**
 * VuloBackup Rest class.
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
	 * Instantiates every controller (own + filtered-in) and registers its routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		$controllers = array(
			'overview'     => new Rest\Overview(),
			'backups'      => new Rest\Backups(),
			'restores'     => new Rest\Restores(),
			'settings'     => new Rest\Settings(),
			'destinations' => new Rest\Destinations(),
		);

		foreach ( (array) apply_filters( 'vulobackup_rest_controllers', array() ) as $key => $controller ) {
			if ( $controller instanceof \WP_REST_Controller ) {
				$controllers[ $key ] = $controller;
			}
		}

		foreach ( $controllers as $controller ) {
			$controller->register_routes();
		}
	}
}
