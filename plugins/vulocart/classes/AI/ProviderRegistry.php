<?php
/**
 * ProviderRegistry class file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI;

use VuloCart\AI\Contracts\AIProviderInterface;
use VuloCart\AI\Services\CredentialEncryption;

defined( 'ABSPATH' ) || exit;

/**
 * Discovers registered adapter classes (`vulocart_ai_provider_sources`
 * filter — same third-party-extensible shape every other single-class
 * extension point in the Pro modules already uses, e.g.
 * `vulocart_shipping_carriers`) and turns a stored, encrypted
 * `vulocart_ai_provider_configs` row into a fully usable adapter — the
 * only point in this codebase an AI provider credential is ever decrypted.
 *
 * @class       ProviderRegistry class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProviderRegistry {

	/**
	 * @var array<string, class-string<AIProviderInterface>>
	 */
	private $adapter_classes = array();

	/**
	 * @var AiProviderConfigUtil
	 */
	private $configs;

	public function __construct() {
		$this->configs = new AiProviderConfigUtil();

		add_action( 'init', array( $this, 'register_providers' ), 20 );
	}

	/**
	 * @return void
	 */
	public function register_providers(): void {
		$this->adapter_classes = apply_filters( 'vulocart_ai_provider_sources', $this->get_default_adapter_classes() );
	}

	/**
	 * @return array<string, class-string<AIProviderInterface>>
	 */
	private function get_default_adapter_classes(): array {
		return array(
			'openai'    => Providers\OpenAiProvider::class,
			'anthropic' => Providers\AnthropicProvider::class,
		);
	}

	/**
	 * @return string[]
	 */
	public function get_registered_provider_ids(): array {
		if ( empty( $this->adapter_classes ) ) {
			$this->adapter_classes = $this->get_default_adapter_classes();
		}

		return array_keys( $this->adapter_classes );
	}

	/**
	 * Metadata for every registered adapter, configured or not — what the
	 * AI settings panel reads to build its provider dropdown. Instantiating
	 * with an empty credential is safe: every adapter constructor only
	 * stores the credential, it never makes a network call.
	 *
	 * @return array<string, array{label: string, available_models: string[]}>
	 */
	public function get_available_adapters(): array {
		$adapters = array();

		foreach ( $this->get_registered_provider_ids() as $provider_id ) {
			$class    = $this->adapter_classes[ $provider_id ];
			$instance = new $class( '' );

			$adapters[ $provider_id ] = array(
				'label'             => $instance->get_label(),
				'available_models'  => $instance->get_available_models(),
			);
		}

		return $adapters;
	}

	/**
	 * @return array<string, array<string, mixed>> Every stored config row, keyed by provider id, credentials omitted.
	 */
	public function get_configured_providers(): array {
		$configured = array();

		foreach ( $this->configs->list_all() as $row ) {
			$configured[ $row['provider'] ] = array(
				'model'     => $row['model'],
				'is_active' => (bool) $row['is_active'],
			);
		}

		return $configured;
	}

	/**
	 * Builds one provider id's usable adapter, or null if it isn't
	 * registered, isn't configured, or is configured but disabled.
	 *
	 * @param string $provider_id e.g. 'openai'.
	 * @return AIProviderInterface|null
	 */
	public function build_provider( string $provider_id ) {
		$this->get_registered_provider_ids();

		if ( ! isset( $this->adapter_classes[ $provider_id ] ) ) {
			return null;
		}

		$config = $this->configs->find_by_provider( $provider_id );

		if ( ! $config || empty( $config['is_active'] ) ) {
			return null;
		}

		$class      = $this->adapter_classes[ $provider_id ];
		$credential = CredentialEncryption::decrypt( (string) $config['credentials'] );

		return new $class( $credential ?? '' );
	}

	/**
	 * The site's own single active provider — this codebase supports one
	 * active BYOK provider at a time (no fallback chain), the merchant
	 * picks it explicitly in the AI settings panel.
	 *
	 * @return array{adapter: AIProviderInterface, model: string}|null
	 */
	public function get_active_provider() {
		foreach ( $this->configs->list_all() as $row ) {
			if ( empty( $row['is_active'] ) ) {
				continue;
			}

			$adapter = $this->build_provider( $row['provider'] );

			if ( $adapter ) {
				return array(
					'adapter' => $adapter,
					'model'   => $row['model'],
				);
			}
		}

		return null;
	}
}
