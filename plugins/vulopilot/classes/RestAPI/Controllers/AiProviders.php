<?php
/**
 * AiProviders controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\AiProviderConfigRepository;
use VuloPilot\Services\AiByokGatewayClient;
use VuloPilot\Services\AiCreditsConnection;
use VuloPilot\Services\CredentialEncryption;

defined( 'ABSPATH' ) || exit;

/**
 * GET /ai-providers, GET /ai-providers/broker-authorize-url — backs
 * src/components/Settings/Connections/AiProvidersPanel.tsx (Settings →
 * Connections → AI Providers), now just the "Connect to VuloCloud"/
 * "Disconnect" section: every cloud provider (OpenAI, Gemini, Anthropic,
 * OpenRouter, Groq) and the self-hosted Ollama option this controller used
 * to let a site owner individually configure with their own credentials
 * (create_item()/update_item()/delete_item()/test_connection_item(), and
 * `adapters` in get_items()'s own response) are gone by direct
 * instruction — VuloCloud is now the only supported way to get an AI
 * provider key. `configured` stays in get_items()'s response purely for
 * AIAssistant.tsx's own "Online" badge to fall back on for a legacy row
 * surviving from before this change; nothing can create a new one anymore.
 *
 * GET never returns a stored row's decrypted (or even encrypted)
 * `credentials` value — only a `has_credential` boolean — the same
 * "repositories/REST controllers never see a raw key" boundary
 * AI-ARCHITECTURE.md documents for ProviderRegistry::build_provider()
 * being the one deliberate exception.
 *
 * @class       AiProviders controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiProviders extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'ai-providers';

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/broker-authorize-url',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_broker_authorize_url' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );
    }

    /**
     * @inheritDoc
     */
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * `configured` is a legacy field now — a row can no longer be created,
     * edited, or deleted through any UI (AiProvidersPanel.tsx's own
     * docblock), so this only ever has something in it for a site that
     * configured a local provider (most likely Ollama) before that UI was
     * removed. Kept purely so AIAssistant.tsx's own "Online" badge can
     * still honor a surviving row — every fresh site's badge instead
     * depends entirely on `vulocloud_status` below.
     *
     * @inheritDoc
     */
    public function get_items( $request ) {
        $repository = new AiProviderConfigRepository();
        $result     = $repository->find_all( array( 'per_page' => 100 ) );

        // A cheap connection-status check (AiByokGatewayClient::status(),
        // never a key/prompt) — the real, current answer to "does AI work
        // for this site," now that VuloCloud is the only supported way to
        // get a provider key.
        $vulocloud_status = ( new AiByokGatewayClient() )->status();

        return rest_ensure_response(
            array(
                'configured'       => array_map( array( $this, 'prepare_config_for_response' ), $result['data'] ),
                'vulocloud_status' => is_wp_error( $vulocloud_status )
                    ? array( 'connected' => false, 'configured' => false )
                    : $vulocloud_status,
            )
        );
    }

    /**
     * The URL the "Connect to VuloCloud" button itself 302s the browser
     * to — AiCreditsConnection::get_broker_authorize_url()'s own docblock
     * for the full passwordless sequence this kicks off.
     *
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_broker_authorize_url() {
        $url = ( new AiCreditsConnection() )->get_broker_authorize_url();

        if ( ! $url ) {
            return new \WP_Error( 'vulopilot_connect_broker_not_configured', __( 'VuloCloud isn’t configured for this build yet.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        return rest_ensure_response( array( 'url' => $url ) );
    }

    /**
     * Strips the encrypted `credentials` column out of a stored row before
     * it ever reaches a response, replacing it with two booleans — no
     * reason to hand back even the encrypted form over the wire.
     *
     * `credential_ok` is real, not a copy of `has_credential`: it actually
     * runs `CredentialEncryption::decrypt()` (cheap, local, no network
     * call — the same check ProviderRegistry::build_provider() itself
     * makes before ever using a stored credential for a real request).
     * A site that rotates its auth salts/keys after a credential was
     * saved (wp-config.php regenerated, a database copied to a fresh
     * environment, ...) leaves decrypt() returning null forever after —
     * before this field existed, `has_credential`/`is_active` alone told
     * every consumer (this panel, AI Copilot's "Online" badge) a provider
     * was fine right up until an actual AI call tried to use it and
     * failed with "No AI provider is configured," with nothing in
     * between honestly saying why. Now both surfaces can show the real
     * state instead of silently disagreeing with each other.
     *
     * @param array<string, mixed> $config A vulopilot_ai_provider_configs row.
     * @return array<string, mixed>
     */
    private function prepare_config_for_response( array $config ): array {
        $has_credential = ! empty( $config['credentials'] );

        return array(
            'id'             => (int) $config['id'],
            'provider'       => $config['provider'],
            'label'          => $config['label'],
            'default_model'  => $config['default_model'],
            'is_active'      => (bool) $config['is_active'],
            'has_credential' => $has_credential,
            'credential_ok'  => $has_credential
                && null !== CredentialEncryption::decrypt( (string) $config['credentials'] ),
            'created_at'     => $config['created_at'],
        );
    }
}
