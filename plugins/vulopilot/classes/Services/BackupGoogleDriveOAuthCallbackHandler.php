<?php
/**
 * BackupGoogleDriveOAuthCallbackHandler class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Handles Google's real OAuth redirect back to this site
 * (`admin-post.php?action=vulopilot_backup_gdrive_oauth_callback` —
 * BackupGoogleDriveConnection::get_redirect_uri()'s own exact URL). Its own
 * class, registered unconditionally at plugin boot (VuloPilot.php's
 * init_classes()), same reasoning
 * GoogleSearchConsoleOAuthCallbackHandler's own docblock gives: a request
 * to `admin-post.php` never fires `rest_api_init`, so a REST-controller-only
 * registration would silently 404 every real Google redirect.
 *
 * @class       BackupGoogleDriveOAuthCallbackHandler class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BackupGoogleDriveOAuthCallbackHandler {

    public function __construct() {
        add_action( 'admin_post_vulopilot_backup_gdrive_oauth_callback', array( $this, 'handle_callback' ) );
    }

    /**
     * Verifies the real `state` nonce, exchanges the real `code` for
     * tokens, then redirects back to Settings → Backups with a real
     * success/error query flag — same shape
     * GoogleSearchConsoleOAuthCallbackHandler::handle_callback() already
     * establishes, just with one fixed return destination (this
     * connection only ever starts from one place, unlike that shared
     * connection's Settings/Keywords split).
     *
     * @return void
     */
    public function handle_callback(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to do this.', 'vulopilot' ) );
        }

        $redirect_base = admin_url( 'admin.php?page=vulopilot#&tab=settings&subtab=backups' );

        $error = isset( $_GET['error'] ) ? sanitize_text_field( wp_unslash( $_GET['error'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- this is Google's own redirect back to us, not a form submission; the `state` param (verified below) is this flow's real CSRF guard.

        if ( '' !== $error ) {
            wp_safe_redirect( $redirect_base . '&gdrive_status=error' );
            exit;
        }

        $state = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- verified explicitly below via verify_state(), the real CSRF guard for this flow.
        $code  = isset( $_GET['code'] ) ? sanitize_text_field( wp_unslash( $_GET['code'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- this whole request only carries a `code` because it came from a `state`-nonced authorize URL we generated ourselves; verified below via verify_state().

        $connection = new BackupGoogleDriveConnection();

        if ( '' === $code || ! $connection->verify_state( $state ) ) {
            wp_safe_redirect( $redirect_base . '&gdrive_status=error' );
            exit;
        }

        $result = $connection->exchange_code_for_tokens( $code );

        wp_safe_redirect( $redirect_base . '&gdrive_status=' . ( is_wp_error( $result ) ? 'error' : 'connected' ) );
        exit;
    }
}
