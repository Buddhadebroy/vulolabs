<?php
namespace VuloPilot\AiAssistant;

defined( 'ABSPATH' ) || exit;

/**
 * The stored status of a *person* signing into the VuloCloud platform from
 * this WP admin - a different concept from `appLocalizer.khali_dabba`
 * (vulopilot-pro's own site-wide Product ID/License Key, a different
 * bounded context entirely - see this plugin's own config.php docblock on
 * VULOPILOT_VULOCLOUD_URL).
 *
 * Read-only from this class's own side: `FrontendScripts::localize_scripts()`
 * surfaces `get_status()` as `appLocalizer.vulocloud_connected`/
 * `vulocloud_account_email` (a display-only badge), and
 * AiCreditsConnection::get_status() merges the same fields in as
 * `vulocloud_account_connected`/`_email` - informational only, AiCreditsConnection
 * doesn't depend on this connection to do its own work (see that class's own
 * docblock). Nothing currently writes to the underlying
 * `vulopilot_vulocloud_account` option - the email/password login flow that
 * used to (`connect()`/`register()`) was removed once the real "Connect to
 * VuloCloud" UI (ConnectVuloCloudPopup.tsx) settled on the passwordless
 * broker flow (AiCreditsConnection::get_broker_authorize_url()) exclusively,
 * so both fields above honestly read as "not connected" today rather than
 * stale/dead code pretending otherwise.
 *
 * Storage is one dedicated `vulopilot_vulocloud_account` option, same
 * "never round-trips to the browser, secrets encrypted at rest" posture
 * GoogleServicesConnection.php already established for its own OAuth
 * tokens (CredentialEncryption, same as that class) - `get_status()`
 * below never returns a raw token, only `connected`/`email`/`connected_at`.
 *
 * @class       VuloCloudAccountConnection class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloCloudAccountConnection {

    private const OPTION_KEY = 'vulopilot_vulocloud_account';

    /**
     * @return array<string, mixed>
     */
    private function get_connection(): array {
        return wp_parse_args(
            get_option( self::OPTION_KEY, array() ),
            array(
                'refresh_token_enc' => '',
                'email'             => '',
                'connected_at'      => '',
            )
        );
    }

    /**
     * @return bool
     */
    public function is_connected(): bool {
        return '' !== $this->get_connection()['refresh_token_enc'];
    }

    /**
     * Never a token - see this class's own docblock.
     *
     * @return array{connected: bool, email: string, connected_at: string}
     */
    public function get_status(): array {
        $connection = $this->get_connection();

        return array(
            'connected'    => $this->is_connected(),
            'email'        => $connection['email'],
            'connected_at' => $connection['connected_at'],
        );
    }
}
