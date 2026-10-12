<?php
namespace VuloPilot\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Handles Google's real OAuth redirect back to this site (`admin-
 * post.php?action=vulopilot_gsc_oauth_callback` -
 * GoogleServicesConnection::get_redirect_uri()'s own exact URL).
 *
 * @class       GoogleSearchConsoleOAuthCallbackHandler class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GoogleSearchConsoleOAuthCallbackHandler {

	public function __construct() {
		add_action( 'admin_post_vulopilot_gsc_oauth_callback', array( $this, 'handle_callback' ) );
	}

	/**
	 * Verifies the `state` nonce, exchanges the `code` for tokens, then redirects back to
	 * the tab that started the connection with a success or error flag.
	 *
	 * @return void
	 */
	public function handle_callback(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'vulopilot' ) );
		}

		$connection = new GoogleServicesConnection();

		// `state` carries the nonce this flow put on the authorize URL; nothing else
		// in the request is read until it checks out.
		$state          = sanitize_text_field( (string) filter_input( INPUT_GET, 'state' ) );
		$state_is_valid = wp_verify_nonce( $connection->get_state_nonce( $state ), 'vulopilot_gsc_oauth' );
		$redirect_base  = 'keywords' === $connection->get_return_to_from_state( $state )
			? admin_url( 'admin.php?page=vulopilot#&tab=seo-visibility&subtab=keywords' )
			: admin_url( 'admin.php?page=vulopilot#&tab=settings&subtab=google-services' );

		if ( ! $state_is_valid ) {
			wp_safe_redirect( $redirect_base . '&gsc_status=error' );
			exit;
		}

		$error = sanitize_text_field( (string) filter_input( INPUT_GET, 'error' ) );
		$code  = sanitize_text_field( (string) filter_input( INPUT_GET, 'code' ) );

		if ( '' !== $error || '' === $code ) {
			wp_safe_redirect( $redirect_base . '&gsc_status=error' );
			exit;
		}

		$result = $connection->exchange_broker_code_for_tokens( $code );

		wp_safe_redirect( $redirect_base . '&gsc_status=' . ( is_wp_error( $result ) ? 'error' : 'connected' ) );
		exit;
	}
}
