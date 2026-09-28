<?php
namespace VuloPilot\AiAssistant;

defined( 'ABSPATH' ) || exit;

/**
 * Handles the Connect broker's real redirect back to this site (`admin-
 * post.php?action=vulopilot_connect_broker_callback` -
 * AiCreditsConnection::get_broker_redirect_uri()'s own exact URL).
 *
 * @class       ConnectBrokerCallbackHandler class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ConnectBrokerCallbackHandler {

	public function __construct() {
		add_action( 'admin_post_vulopilot_connect_broker_callback', array( $this, 'handle_callback' ) );
	}

	/**
	 * Verifies the real `state` nonce, exchanges the real `code` for a ConnectedSite
	 * credential (AiCreditsConnection::exchange_broker_code()).
	 *
	 * @return void
	 */
	public function handle_callback(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'vulopilot' ) );
		}

		$redirect_base = admin_url( 'admin.php?page=vulopilot#&tab=settings&subtab=integrations' );
		$connection    = new AiCreditsConnection();

		// `state` is the nonce this flow put on the authorize URL; nothing else in
		// the request is read until it checks out.
		if ( ! wp_verify_nonce( sanitize_text_field( (string) filter_input( INPUT_GET, 'state' ) ), 'vulopilot_connect_broker' ) ) {
			wp_safe_redirect( $redirect_base . '&connect_status=error' );
			exit;
		}

		$error = sanitize_text_field( (string) filter_input( INPUT_GET, 'error' ) );
		$code  = sanitize_text_field( (string) filter_input( INPUT_GET, 'code' ) );

		if ( '' !== $error || '' === $code ) {
			wp_safe_redirect( $redirect_base . '&connect_status=error' );
			exit;
		}

		$result = $connection->exchange_broker_code( $code );

		wp_safe_redirect( $redirect_base . '&connect_status=' . ( is_wp_error( $result ) ? 'error' : 'connected' ) );
		exit;
	}
}
