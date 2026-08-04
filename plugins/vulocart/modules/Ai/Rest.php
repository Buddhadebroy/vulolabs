<?php
/**
 * Rest class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Ai;

use VuloCart\AI\ProviderRegistry;
use VuloCart\AI\AiUsageLogUtil;
use VuloCart\AI\AiProviderConfigUtil;
use VuloCart\AI\Services\CredentialEncryption;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Ai module Rest class — BYOK provider settings (list adapters,
 * save/encrypt a key, delete) and the usage log, both `manage_options`-
 * gated. This is the "Frontend/Rest/`src/` pieces slot into this same
 * Module.php" real implementation the module's own original docblock
 * invited.
 *
 * @class       Rest class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Rest {

	/**
	 * @var ProviderRegistry
	 */
	private $registry;

	/**
	 * @var AiProviderConfigUtil
	 */
	private $configs;

	/**
	 * @var AiUsageLogUtil
	 */
	private $usage_log;

	public function __construct( ProviderRegistry $registry, AiProviderConfigUtil $configs, AiUsageLogUtil $usage_log ) {
		$this->registry  = $registry;
		$this->configs   = $configs;
		$this->usage_log = $usage_log;

		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * @return void
	 */
	public function register_routes(): void {
		$namespace = VuloCart()->rest_namespace;

		register_rest_route(
			$namespace,
			'/ai/providers',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_providers' ),
				'permission_callback' => array( $this, 'admin_permissions_check' ),
			)
		);

		register_rest_route(
			$namespace,
			'/ai/providers/(?P<id>[a-z]+)',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'save_provider' ),
					'permission_callback' => array( $this, 'admin_permissions_check' ),
				),
				array(
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'delete_provider' ),
					'permission_callback' => array( $this, 'admin_permissions_check' ),
				),
			)
		);

		register_rest_route(
			$namespace,
			'/ai/usage',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_usage' ),
				'permission_callback' => array( $this, 'admin_permissions_check' ),
			)
		);
	}

	/**
	 * @return bool
	 */
	public function admin_permissions_check() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Lists every registered adapter (available_models, whether it's
	 * configured/active) — credentials never leave the server.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function get_providers( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		$adapters   = $this->registry->get_available_adapters();
		$configured = $this->registry->get_configured_providers();

		$result = array();

		foreach ( $adapters as $id => $adapter ) {
			$result[] = array(
				'id'                => $id,
				'label'             => $adapter['label'],
				'available_models'  => $adapter['available_models'],
				'is_configured'     => isset( $configured[ $id ] ),
				'model'             => $configured[ $id ]['model'] ?? '',
				'is_active'         => $configured[ $id ]['is_active'] ?? false,
			);
		}

		return rest_ensure_response( $result );
	}

	/**
	 * Saves (encrypts) a provider's own API key/model/active state.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function save_provider( $request ) {
		$provider_id = sanitize_key( (string) $request->get_param( 'id' ) );

		if ( ! in_array( $provider_id, $this->registry->get_registered_provider_ids(), true ) ) {
			return new \WP_Error( 'vulocart_unknown_ai_provider', __( 'Unknown AI provider.', 'vulocart' ), array( 'status' => 404 ) );
		}

		$api_key = $request->get_param( 'api_key' ) ? (string) $request->get_param( 'api_key' ) : '';
		$model   = $request->get_param( 'model' ) ? sanitize_text_field( (string) $request->get_param( 'model' ) ) : '';

		if ( '' === $api_key ) {
			$existing = $this->configs->find_by_provider( $provider_id );

			if ( ! $existing ) {
				return new \WP_Error( 'vulocart_missing_ai_api_key', __( 'An API key is required.', 'vulocart' ), array( 'status' => 400 ) );
			}

			$encrypted = $existing['credentials'];
		} else {
			$encrypted = CredentialEncryption::encrypt( $api_key );
		}

		$is_active = null === $request->get_param( 'is_active' ) ? true : (bool) $request->get_param( 'is_active' );

		$row = $this->configs->upsert( $provider_id, $encrypted, $model, $is_active );

		unset( $row['credentials'] );

		return rest_ensure_response( $row );
	}

	/**
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function delete_provider( $request ) {
		$provider_id = sanitize_key( (string) $request->get_param( 'id' ) );

		return rest_ensure_response( array( 'deleted' => $this->configs->delete( $provider_id ) ) );
	}

	/**
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function get_usage( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		return rest_ensure_response(
			array(
				'summary' => $this->usage_log->get_summary(),
				'recent'  => $this->usage_log->list_recent( 50 ),
			)
		);
	}
}
