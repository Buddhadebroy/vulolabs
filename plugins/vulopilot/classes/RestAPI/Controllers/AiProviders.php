<?php
/**
 * AiProviders controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Repositories\AiProviderConfigRepository;
use VuloPilot\Services\CredentialEncryption;
use VuloPilot\ValueObjects\AIRequest;

defined( 'ABSPATH' ) || exit;

/**
 * GET/POST /ai-providers, POST /ai-providers/{id}, POST
 * /ai-providers/{id}/delete — the settings UI AI-ARCHITECTURE.md's own
 * "What's not here yet" section flagged as missing: "nothing yet writes
 * to vulopilot_ai_provider_configs from the dashboard — AiProviderConfigRepository
 * exists and works, but there's no REST controller or Settings-page section
 * wired to it yet." Backs
 * src/components/Settings/Connections/AiProvidersPanel.tsx (Settings →
 * Connections → AI Providers).
 * update_item()'s route also answers PATCH (WP_REST_Server::EDITABLE) for
 * any other REST-y consumer, but every route here is reachable by POST
 * specifically because @zyra/core's sendApiResponse() (what the actual
 * frontend panel calls) only ever issues POST requests.
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
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)',
            array(
                array(
                    // Also CREATABLE (POST), not just EDITABLE — @zyra/core's
                    // sendApiResponse() (what AiProvidersPanel.tsx actually
                    // calls) always issues a POST regardless of any
                    // `method` override passed in, the same real constraint
                    // that already shapes FindingFixRest's own `.../fix`
                    // sub-route being POST-only rather than a REST-y verb.
                    'methods'             => array( \WP_REST_Server::EDITABLE, \WP_REST_Server::CREATABLE ),
                    'callback'            => array( $this, 'update_item' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/delete',
            array(
                array(
                    // A POST sub-route rather than DELETABLE for the same
                    // sendApiResponse()-is-POST-only reason as update_item()
                    // above — same shape as Automations' `.../run` sub-route.
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'delete_item' ),
                    'permission_callback' => array( $this, 'delete_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/test',
            array(
                array(
                    // Same POST-only reasoning as .../delete above.
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'test_connection_item' ),
                    'permission_callback' => array( $this, 'test_connection_item_permissions_check' ),
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
     * @inheritDoc
     */
    public function create_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function update_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function delete_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @inheritDoc
     */
    public function test_connection_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * Lists every configured provider (credentials stripped) plus metadata
     * for every registered adapter, configured or not, so the frontend can
     * build an "Add provider" form for whichever ones aren't set up yet.
     *
     * @inheritDoc
     */
    public function get_items( $request ) {
        $repository = new AiProviderConfigRepository();
        $result     = $repository->find_all( array( 'per_page' => 100 ) );

        return rest_ensure_response(
            array(
                'configured' => array_map( array( $this, 'prepare_config_for_response' ), $result['data'] ),
                'adapters'   => VuloPilot()->ai_provider_registry->get_available_adapters(),
            )
        );
    }

    /**
     * @inheritDoc
     */
    public function create_item( $request ) {
        $provider = sanitize_key( (string) $request->get_param( 'provider' ) );
        $adapters = VuloPilot()->ai_provider_registry->get_available_adapters();

        if ( ! isset( $adapters[ $provider ] ) ) {
            return new \WP_Error( 'vulopilot_unknown_provider', __( 'Unknown AI provider.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $repository = new AiProviderConfigRepository();

        if ( $repository->find_by_provider( $provider ) ) {
            return new \WP_Error(
                'vulopilot_provider_already_configured',
                __( 'This provider is already configured — edit or delete the existing one instead.', 'vulopilot' ),
                array( 'status' => 400 )
            );
        }

        $credential = (string) $request->get_param( 'credential' );

        if ( '' === trim( $credential ) ) {
            if ( $adapters[ $provider ]['requires_credential'] ) {
                return new \WP_Error( 'vulopilot_missing_credential', __( 'An API key is required for this provider.', 'vulopilot' ), array( 'status' => 400 ) );
            }

            // Ollama only — its adapter's own DEFAULT_BASE_URL, duplicated
            // here since this REST layer never constructs an adapter
            // instance (only ProviderRegistry::build_provider() does).
            $credential = 'http://localhost:11434';
        }

        $label = sanitize_text_field( (string) $request->get_param( 'label' ) );

        $id = $repository->insert(
            array(
                'provider'      => $provider,
                'label'         => '' !== $label ? $label : $adapters[ $provider ]['label'],
                'credentials'   => CredentialEncryption::encrypt( $credential ),
                'default_model' => sanitize_text_field( (string) $request->get_param( 'default_model' ) ) ?: null,
                'is_active'     => 1,
            )
        );

        return rest_ensure_response( $this->prepare_config_for_response( $repository->find( $id ) ) );
    }

    /**
     * @inheritDoc
     */
    public function update_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new AiProviderConfigRepository();
        $config     = $repository->find( $id );

        if ( ! $config ) {
            return new \WP_Error( 'vulopilot_provider_config_not_found', __( 'Provider configuration not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        $update = array();

        if ( null !== $request->get_param( 'label' ) ) {
            $update['label'] = sanitize_text_field( (string) $request->get_param( 'label' ) );
        }

        if ( null !== $request->get_param( 'default_model' ) ) {
            $update['default_model'] = sanitize_text_field( (string) $request->get_param( 'default_model' ) );
        }

        if ( null !== $request->get_param( 'is_active' ) ) {
            $update['is_active'] = $request->get_param( 'is_active' ) ? 1 : 0;
        }

        $credential = $request->get_param( 'credential' );

        if ( null !== $credential && '' !== trim( (string) $credential ) ) {
            $update['credentials'] = CredentialEncryption::encrypt( (string) $credential );
        }

        if ( empty( $update ) ) {
            return new \WP_Error( 'vulopilot_no_changes', __( 'Nothing to update.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        if ( ! $repository->update( $id, $update ) ) {
            return new \WP_Error( 'vulopilot_update_failed', __( 'Could not update this provider.', 'vulopilot' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( $this->prepare_config_for_response( $repository->find( $id ) ) );
    }

    /**
     * @inheritDoc
     */
    public function delete_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new AiProviderConfigRepository();

        if ( ! $repository->find( $id ) ) {
            return new \WP_Error( 'vulopilot_provider_config_not_found', __( 'Provider configuration not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        if ( ! $repository->delete( $id ) ) {
            return new \WP_Error( 'vulopilot_delete_failed', __( 'Could not delete this provider.', 'vulopilot' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( array( 'deleted' => true ) );
    }

    /**
     * A real "Test Connection" — Settings → Connections → AI Providers'
     * own mockup asked for this, and there was previously no way to know a
     * saved key actually worked short of trying "Generate with AI" and
     * seeing whether it silently used a different, still-working provider
     * from the fallback chain instead. Builds this provider's own fully
     * decorated adapter the exact same way a real generation request would
     * (ProviderRegistry::build_provider() — rate-limited, retried, and
     * usage-tracked, not a raw unprotected adapter call that would bypass
     * this site's own configured budget), then sends the smallest real
     * request that still proves the key/model combination actually works.
     *
     * Reuses build_provider()'s own existing, real "not configured" cases
     * (inactive, no credential, undecryptable credential) instead of a
     * fresh set of checks — same honest distinctions
     * prepare_config_for_response()'s `credential_ok` already surfaces
     * elsewhere on this same panel.
     *
     * @param \WP_REST_Request $request Full details about the request.
     * @return \WP_REST_Response|\WP_Error
     */
    public function test_connection_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new AiProviderConfigRepository();
        $config     = $repository->find( $id );

        if ( ! $config ) {
            return new \WP_Error( 'vulopilot_provider_config_not_found', __( 'Provider configuration not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        $provider = VuloPilot()->ai_provider_registry->build_provider( (string) $config['provider'] );

        if ( ! $provider ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => empty( $config['is_active'] )
                        ? __( 'This provider is disabled — enable it first, then test the connection.', 'vulopilot' )
                        : __( 'VuloPilot can no longer read this provider’s saved API key. Enter it again to reconnect, then test the connection.', 'vulopilot' ),
                )
            );
        }

        $model = (string) ( $config['default_model'] ?? '' );

        if ( '' === $model ) {
            $models = $provider->get_available_models();
            $model  = $models[0] ?? '';
        }

        try {
            $provider->send(
                new AIRequest(
                    $model,
                    array(
                        array(
                            'role'    => 'user',
                            'content' => 'Reply with the single word OK.',
                        ),
                    ),
                    null,
                    // A real, minimal request — just enough tokens for a
                    // one-word reply, so a working key is confirmed
                    // without meaningfully touching this site's own usage
                    // budget/rate limit.
                    5,
                    null,
                    'connection_test'
                )
            );
        } catch ( \Throwable $exception ) {
            return rest_ensure_response(
                array(
                    'success' => false,
                    'message' => $exception->getMessage(),
                )
            );
        }

        return rest_ensure_response(
            array(
                'success' => true,
                'message' => __( 'Connected — the API key works.', 'vulopilot' ),
            )
        );
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
