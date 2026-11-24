<?php
/**
 * Base REST controller file.
 *
 * @package VuloForm
 */

namespace VuloForm\Rest;

use VuloForm\Utill;
use VuloShared\Rest\Controller as SharedController;

defined( 'ABSPATH' ) || exit;

/**
 * VuloForm-specific additions over the shared permission-check base: a `route()` helper for
 * registering routes, and a shared `not_found()` error.
 */
abstract class Controller extends SharedController {

	/**
	 * The capability required to manage VuloForm.
	 *
	 * @return string
	 */
	protected function capability() {
		return Utill::CAPABILITY;
	}

	/**
	 * The "not allowed" error message for VuloForm's own text domain.
	 *
	 * @return string
	 */
	protected function forbidden_message() {
		return __( 'You are not allowed to manage VuloForm.', 'vuloform' );
	}

	/**
	 * Registers one route under VuloForm's own namespace.
	 *
	 * @param string $path     Route path under the namespace.
	 * @param string $methods  HTTP methods.
	 * @param string $callback Method name on this controller.
	 * @param bool   $is_open  Whether the route is open to visitors.
	 * @return void
	 */
	protected function route( $path, $methods, $callback, $is_open = false ) {
		register_rest_route(
			VuloForm()->rest_namespace,
			$path,
			array(
				array(
					'methods'             => $methods,
					'callback'            => array( $this, $callback ),
					'permission_callback' => $is_open ? '__return_true' : array( $this, 'check_permission' ),
				),
			)
		);
	}

	/**
	 * A standard "that item no longer exists" error.
	 *
	 * @return \WP_Error
	 */
	protected function not_found() {
		return new \WP_Error( 'vuloform_not_found', __( 'That item no longer exists.', 'vuloform' ), array( 'status' => 404 ) );
	}
}
