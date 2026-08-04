<?php
/**
 * AIProviderInterface file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI\Contracts;

use VuloCart\AI\Exceptions\AIProviderException;
use VuloCart\AI\ValueObjects\AIRequest;
use VuloCart\AI\ValueObjects\AIResponse;

defined( 'ABSPATH' ) || exit;

/**
 * Every AI provider adapter (Providers\OpenAiProvider, Providers\AnthropicProvider,
 * or a third-party one registered via `vulocart_ai_provider_sources`)
 * implements this so `AI\AiClient`/`AI\ProviderRegistry` never depend on a
 * concrete SDK — same shape as vulopilot's own `Contracts\AI\AIProviderInterface`
 * (this codebase's own AI provider engine, kept in this free plugin rather
 * than vulocart-pro since AI-ARCHITECTURE.md's equivalent split there is
 * "the engine is free infrastructure, Pro modules are what's built on it").
 *
 * @class       AIProviderInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface AIProviderInterface {

	/**
	 * @return string Unique, stable provider id (e.g. 'openai', 'anthropic').
	 */
	public function get_id(): string;

	/**
	 * @return string Human-readable label.
	 */
	public function get_label(): string;

	/**
	 * @return string[] Chat/completion model ids this provider offers.
	 */
	public function get_available_models(): array;

	/**
	 * @param AIRequest $request Request to send.
	 * @return AIResponse
	 * @throws AIProviderException When the provider call fails.
	 */
	public function send( AIRequest $request ): AIResponse;

	/**
	 * @return bool Whether generate_image() is actually supported by this provider.
	 */
	public function supports_images(): bool;

	/**
	 * @param string $prompt Image description.
	 * @param string $size   e.g. '1024x1024'.
	 * @return string A fetchable URL for the generated image.
	 * @throws AIProviderException When unsupported, or the provider call fails.
	 */
	public function generate_image( string $prompt, string $size = '1024x1024' ): string;

	/**
	 * @return bool Whether embed() is actually supported by this provider.
	 */
	public function supports_embeddings(): bool;

	/**
	 * @param string $text Text to embed.
	 * @return float[] The embedding vector.
	 * @throws AIProviderException When unsupported, or the provider call fails.
	 */
	public function embed( string $text ): array;
}
