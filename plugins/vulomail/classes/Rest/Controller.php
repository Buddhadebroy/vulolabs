<?php
/**
 * Base REST controller file.
 *
 * @package VuloMail
 */

namespace VuloMail\Rest;

use VuloMail\Email\WpMailInterceptor;
use VuloMail\Utill;
use VuloShared\Rest\Controller as SharedController;

defined( 'ABSPATH' ) || exit;

/**
 * VuloMail-specific addition over the shared permission-check base: `with_causes()`, used by
 * delivery-log/diagnostics endpoints to annotate which failed attempt is worth surfacing advice for.
 */
abstract class Controller extends SharedController {

	/**
	 * The capability required to manage VuloMail.
	 *
	 * @return string
	 */
	protected function capability() {
		return Utill::CAPABILITY;
	}

	/**
	 * The "not allowed" error message for VuloMail's own text domain.
	 *
	 * @return string
	 */
	protected function forbidden_message() {
		return __( 'You are not allowed to manage VuloMail.', 'vulomail' );
	}

	/**
	 * Marks each failed attempt worth advice with `is_cause`. A later WordPress-mailer failure just means the server itself can't send; the connection's error is the one to fix.
	 *
	 * @param array $attempts Attempts in order, as Result::to_array() stores them.
	 * @return array
	 */
	protected static function with_causes( array $attempts ) {
		foreach ( $attempts as $index => $attempt ) {
			$attempts[ $index ]['is_cause'] = empty( $attempt['success'] )
				&& ! ( $index > 0 && WpMailInterceptor::DEFAULT_PROVIDER === ( $attempt['provider'] ?? '' ) );
		}

		return $attempts;
	}
}
