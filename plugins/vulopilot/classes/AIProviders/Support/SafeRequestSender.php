<?php
/**
 * SafeRequestSender class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AIProviders\Support;

use VuloPilot\ValueObjects\AIRequest;
use VuloPilot\ValueObjects\AIResponse;
use VuloPilot\AIProviders\ProviderRegistry;
use VuloPilot\AIProviders\Safety\AISafetyValidator;

defined( 'ABSPATH' ) || exit;

/**
 * The "safety-validate → build a fallback chain → send → sanitize the
 * response" sequence every real AI call in this codebase goes through —
 * originally written once, inline, inside AIActions\ActionRunner::propose().
 * GEO-MODULE.md's GeoAnalysis\GeoAnalyzer needed the exact same sequence
 * for a call that isn't an AIAction at all (a read-only score/suggestion
 * request, not a mutation with an approval gate), so this was extracted
 * out from ActionRunner into its own small, reusable class rather than
 * copy-pasting the same six lines into a second consumer.
 *
 * Deliberately narrow: this is not a new "AI request abstraction layer"
 * — it's the one sequence AIProviderInterface::send() always needs
 * wrapped around it, given a shared name so both call sites read as
 * "send this safely" instead of restating the mechanics.
 *
 * @class       SafeRequestSender class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SafeRequestSender {

    private ProviderRegistry $provider_registry;
    private AISafetyValidator $safety_validator;

    /**
     * @param ProviderRegistry  $provider_registry Registry to build an AI provider chain from.
     * @param AISafetyValidator $safety_validator  Validator both the prompt and response pass through.
     */
    public function __construct( ProviderRegistry $provider_registry, AISafetyValidator $safety_validator ) {
        $this->provider_registry = $provider_registry;
        $this->safety_validator  = $safety_validator;
    }

    /**
     * @param array<int, array{role: string, content: string}> $messages Chat-style prompt messages.
     * @param array{mime_type: string, data: string}|null      $image    Optional inline image for the current turn — only meaningful when the provider that ends up handling this request supports vision (ProviderRegistry::supports_vision()); callers should check that first, since a provider that doesn't will simply never look at this.
     * @param string|null                                      $surface  Optional real feature label recorded to `vulopilot_ai_history.surface` — see AIRequest::get_surface()'s own docblock.
     * @return AIResponse
     *
     * @throws \VuloPilot\Exceptions\UnsafePromptException If the prompt fails safety validation.
     * @throws \RuntimeException If no AI provider is configured.
     */
    public function send( array $messages, ?array $image = null, ?string $surface = null ): AIResponse {
        $this->safety_validator->validate_prompt( $messages );

        $provider = $this->provider_registry->build_fallback_chain();

        if ( ! $provider ) {
            throw new \RuntimeException( __( 'No AI provider is configured.', 'vulopilot' ) );
        }

        // $provider here is really a ProviderFallbackChain (or a lone
        // decorated provider) — its own try_each() re-resolves this same
        // real per-provider model again for whichever provider actually
        // ends up handling the request, including this first one, via the
        // exact same ProviderRegistry::resolve_model_for() call. Still
        // resolved here too so the initial AIRequest always carries a real,
        // valid model rather than an empty placeholder — for the ordinary
        // single-provider-succeeds case this is exactly the model that
        // provider ends up using; a fallback past it gets its own real
        // model regardless (see ProviderFallbackChain::try_each()).
        $model    = $this->provider_registry->resolve_model_for( $provider );
        $response = $provider->send( new AIRequest( $model, $messages, null, null, $image, $surface ) );

        return $this->safety_validator->sanitize_response( $response );
    }
}
