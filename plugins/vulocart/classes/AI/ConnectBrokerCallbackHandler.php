<?php
/**
 * ConnectBrokerCallbackHandler class file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI;

defined( 'ABSPATH' ) || exit;

/**
 * Handles the VuloCloud connect broker's redirect back to this site
 * (`admin-post.php?action=vulocart_connect_broker_callback`,
 * VuloCloudConnection::get_redirect_uri()).
 *
 * @class       ConnectBrokerCallbackHandler class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ConnectBrokerCallbackHandler {

	/**
	 * Registers the admin-post endpoint VuloCloud redirects the browser back to after the site is connected.
	 */
	public function __construct() {
		add_action( 'admin_post_vulocart_connect_broker_callback', array( $this, 'handle_callback' ) );
	}

	/**
	 * Verifies `state`, exchanges `code` for a site credential, then returns to Settings → Integrations.
	 *
	 * @return void
	 */
	public function handle_callback(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'vulocart' ) );
		}

		$redirect_base = admin_url( 'admin.php?page=vulocart#&tab=settings&subtab=integrations' );

		if ( ! wp_verify_nonce( sanitize_text_field( (string) filter_input( INPUT_GET, 'state' ) ), VuloCloudConnection::NONCE_ACTION ) ) {
			wp_safe_redirect( $redirect_base . '&connect_status=error' );
			exit;
		}

		$error = sanitize_text_field( (string) filter_input( INPUT_GET, 'error' ) );
		$code  = sanitize_text_field( (string) filter_input( INPUT_GET, 'code' ) );

		if ( '' !== $error || '' === $code ) {
			wp_safe_redirect( $redirect_base . '&connect_status=error' );
			exit;
		}

		$result = ( new VuloCloudConnection() )->exchange_code( $code );

		wp_safe_redirect( $redirect_base . '&connect_status=' . ( is_wp_error( $result ) ? 'error' : 'connected' ) );
		exit;
	}
}
