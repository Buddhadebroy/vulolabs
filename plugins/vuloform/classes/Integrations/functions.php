<?php
/**
 * VuloForm public API.
 *
 * These functions and the hooks listed in docs/developer/DEVELOPER-API.md are the supported way for
 * other code to work with VuloForm. Guard calls with `function_exists( 'vuloform_render' )`.
 *
 * @package VuloForm
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'vuloform_render' ) ) {
	/**
	 * Returns a form's HTML and loads its assets, like the `[vuloform]` shortcode.
	 *
	 * @since 1.0.0
	 *
	 * @param int $form_id Form id.
	 * @return string
	 */
	function vuloform_render( $form_id ) {
		return isset( VuloForm()->frontend ) ? VuloForm()->frontend->render( (int) $form_id ) : '';
	}
}

if ( ! function_exists( 'vuloform_get_form' ) ) {
	/**
	 * Returns a form: id, title, status, schema.
	 *
	 * @since 1.0.0
	 *
	 * @param int $form_id Form id.
	 * @return array|null
	 */
	function vuloform_get_form( $form_id ) {
		return VuloForm()->forms->get( (int) $form_id );
	}
}

if ( ! function_exists( 'vuloform_get_submission' ) ) {
	/**
	 * Returns a submission: id, form_id, status, data (field key => value), meta, created_at.
	 * Callers are responsible for checking that the current user may see it.
	 *
	 * @since 1.0.0
	 *
	 * @param int $submission_id Submission id.
	 * @return array|null
	 */
	function vuloform_get_submission( $submission_id ) {
		return VuloForm()->submissions->get( (int) $submission_id );
	}
}
