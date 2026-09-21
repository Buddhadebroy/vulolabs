<?php
/**
 * AiProviders controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

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
        // A cheap connection-status check (AiByokGatewayClient::status(),
        // never a key/prompt) — the real, current answer to "does AI work
        // for this site," now that VuloCloud is the only supported way to
        // get a provider key.
        $vulocloud_status = ( new AiByokGatewayClient() )->status();

        return rest_ensure_response(
            array(
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
}
