<?php
/**
 * Base REST controller file.
 *
 * @package VuloShared
 */

namespace VuloShared\Rest;

defined( 'ABSPATH' ) || exit;

/**
 * Shared permission check for every admin-only route across VuloLabs' standalone plugins. Core's
 * REST cookie authentication verifies the `wp_rest` nonce before this runs, so a logged-in admin's
 * browser can't be tricked into calling these routes cross-site.
 *
 * Each plugin's own `Rest\Controller` extends this one for the shared `check_permission()` flow,
 * supplying its own capability and (translated, plugin-text-domained) forbidden message, and keeps
 * whatever else is specific to it (e.g. VuloForm's `route()`/`not_found()` helpers, VuloMail's
 * `with_causes()`) on itself.
 */
abstract class Controller extends \WP_REST_Controller {

	/**
	 * The capability required to manage this plugin, e.g. `manage_options`.
	 *
	 * @return string
	 */
	abstract protected function capability();

	/**
	 * The "not allowed" error message, with this plugin's own text domain already applied -- e.g.
	 * `__( 'You are not allowed to manage VuloForm.', 'vuloform' )`. A literal `__()` call has to
	 * stay on the plugin's own subclass for `wp i18n make-pot` to find/attribute it correctly;
	 * this base class never translates on a caller's behalf.
	 *
	 * @return string
	 */
	abstract protected function forbidden_message();

	/**
	 * Checks that the current user may manage this plugin.
	 *
	 * @return bool|\WP_Error
	 */
	public function check_permission() {
		if ( ! current_user_can( $this->capability() ) ) {
			return new \WP_Error( 'rest_forbidden', $this->forbidden_message(), array( 'status' => rest_authorization_required_code() ) );
		}

		return true;
	}
}
