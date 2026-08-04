<?php
/**
 * AiClient class file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI;

use VuloCart\AI\Exceptions\AIProviderException;
use VuloCart\AI\ValueObjects\AIRequest;

defined( 'ABSPATH' ) || exit;

/**
 * The one entrypoint every AI feature (free or Pro) actually calls —
 * `VuloCart()->ai_client`. Resolves the merchant's own active provider from
 * ProviderRegistry, applies it to every request without each caller
 * re-deriving which provider/model is active, and logs every real attempt
 * (successful or not) via AiUsageLogUtil — same "record failures too, not
 * just successes" reasoning vulopilot's own UsageTrackingProvider docblock
 * documents, since a string of failures is exactly what a merchant needs
 * to see to know their key/quota is broken.
 *
 * @class       AiClient class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiClient {

	/**
	 * @var ProviderRegistry
	 */
	private $registry;

	/**
	 * @var AiUsageLogUtil
	 */
	private $usage_log;

	/**
	 * @param ProviderRegistry $registry  Resolves the active provider/adapter.
	 * @param AiUsageLogUtil   $usage_log Logs every real call attempt.
	 */
	public function __construct( ProviderRegistry $registry, AiUsageLogUtil $usage_log ) {
		$this->registry  = $registry;
		$this->usage_log = $usage_log;
	}

	/**
	 * @return bool Whether a merchant has an active, configured provider at all.
	 */
	public function is_configured(): bool {
		return null !== $this->registry->get_active_provider();
	}

	/**
	 * A simple prompt+system helper over send() — most Catalog/Checkout/
	 * Support AI callers just want "system instructions + one user
	 * message back", not to build an AIRequest by hand.
	 *
	 * @param string      $feature      Short dotted usage tag, e.g. 'catalog.description'.
	 * @param string      $system       System prompt.
	 * @param string      $user_message User message.
	 * @param float|null  $temperature  Optional sampling temperature.
	 * @param int|null    $max_tokens   Optional max tokens.
	 * @return string The assistant's reply content.
	 * @throws AIProviderException When no provider is configured, or the call fails.
	 */
	public function prompt( string $feature, string $system, string $user_message, $temperature = null, $max_tokens = null ): string {
		$active = $this->registry->get_active_provider();

		if ( ! $active ) {
			throw new AIProviderException( __( 'No AI provider is configured. Add an API key under AI > Settings.', 'vulocart' ) );
		}

		$request = new AIRequest(
			$active['model'],
			array(
				array(
					'role'    => 'system',
					'content' => $system,
				),
				array(
					'role'    => 'user',
					'content' => $user_message,
				),
			),
			$temperature,
			$max_tokens
		);

		try {
			$response = $active['adapter']->send( $request );
		} catch ( AIProviderException $e ) {
			$this->usage_log->insert(
				array(
					'provider'      => $active['adapter']->get_id(),
					'model'         => $active['model'],
					'feature'       => $feature,
					'success'       => false,
					'error_message' => $e->getMessage(),
				)
			);

			throw $e;
		}

		$this->usage_log->insert(
			array(
				'provider'           => $response->get_provider(),
				'model'              => $response->get_model(),
				'feature'            => $feature,
				'prompt_tokens'      => $response->get_prompt_tokens(),
				'completion_tokens'  => $response->get_completion_tokens(),
				'success'            => true,
			)
		);

		return $response->get_content();
	}

	/**
	 * Same as prompt(), but asks the model to answer as strict JSON and
	 * decodes it — every Catalog AI "generate ___" action uses this so the
	 * caller gets structured fields back rather than parsing prose.
	 *
	 * @param string $feature      Short dotted usage tag.
	 * @param string $system       System prompt — caller is responsible for instructing the model to answer as JSON matching a described shape.
	 * @param string $user_message User message.
	 * @return array<string, mixed>
	 * @throws AIProviderException When no provider is configured, the call fails, or the response isn't valid JSON.
	 */
	public function prompt_json( string $feature, string $system, string $user_message ): array {
		$content = $this->prompt( $feature, $system . "\n\nRespond with ONLY a single valid JSON object, no prose, no markdown code fences.", $user_message );

		$content = trim( $content );
		$content = preg_replace( '/^```(?:json)?|```$/m', '', $content );
		$decoded = json_decode( trim( (string) $content ), true );

		if ( ! is_array( $decoded ) ) {
			throw new AIProviderException( __( 'The AI provider did not return valid JSON.', 'vulocart' ) );
		}

		return $decoded;
	}

	/**
	 * @param string $feature Short dotted usage tag.
	 * @param string $prompt  Image description.
	 * @return string A fetchable URL for the generated image.
	 * @throws AIProviderException When no provider is configured, it doesn't support images, or the call fails.
	 */
	public function generate_image( string $feature, string $prompt ): string {
		$active = $this->registry->get_active_provider();

		if ( ! $active ) {
			throw new AIProviderException( __( 'No AI provider is configured. Add an API key under AI > Settings.', 'vulocart' ) );
		}

		if ( ! $active['adapter']->supports_images() ) {
			throw new AIProviderException( __( 'The active AI provider does not support image generation.', 'vulocart' ) );
		}

		try {
			$url = $active['adapter']->generate_image( $prompt );
		} catch ( AIProviderException $e ) {
			$this->usage_log->insert(
				array(
					'provider'      => $active['adapter']->get_id(),
					'model'         => 'image',
					'feature'       => $feature,
					'success'       => false,
					'error_message' => $e->getMessage(),
				)
			);

			throw $e;
		}

		$this->usage_log->insert(
			array(
				'provider' => $active['adapter']->get_id(),
				'model'    => 'image',
				'feature'  => $feature,
				'success'  => true,
			)
		);

		return $url;
	}

	/**
	 * @param string $feature Short dotted usage tag.
	 * @param string $text    Text to embed.
	 * @return float[]
	 * @throws AIProviderException When no provider is configured, it doesn't support embeddings, or the call fails.
	 */
	public function embed( string $feature, string $text ): array {
		$active = $this->registry->get_active_provider();

		if ( ! $active ) {
			throw new AIProviderException( __( 'No AI provider is configured. Add an API key under AI > Settings.', 'vulocart' ) );
		}

		if ( ! $active['adapter']->supports_embeddings() ) {
			throw new AIProviderException( __( 'The active AI provider does not support embeddings.', 'vulocart' ) );
		}

		try {
			$vector = $active['adapter']->embed( $text );
		} catch ( AIProviderException $e ) {
			$this->usage_log->insert(
				array(
					'provider'      => $active['adapter']->get_id(),
					'model'         => 'embedding',
					'feature'       => $feature,
					'success'       => false,
					'error_message' => $e->getMessage(),
				)
			);

			throw $e;
		}

		$this->usage_log->insert(
			array(
				'provider' => $active['adapter']->get_id(),
				'model'    => 'embedding',
				'feature'  => $feature,
				'success'  => true,
			)
		);

		return $vector;
	}
}
