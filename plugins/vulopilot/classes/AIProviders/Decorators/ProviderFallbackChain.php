<?php
/**
 * ProviderFallbackChain class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AIProviders\Decorators;

use VuloPilot\AIProviders\ProviderRegistry;
use VuloPilot\Contracts\AI\AIProviderInterface;
use VuloPilot\Exceptions\AIProviderException;
use VuloPilot\ValueObjects\AIRequest;
use VuloPilot\ValueObjects\AIResponse;

defined( 'ABSPATH' ) || exit;

/**
 * Tries an ordered list of providers, moving to the next on any
 * AIProviderException until one succeeds or the list is exhausted. Still
 * implements AIProviderInterface like every other decorator here — this
 * is the "Fallback" requirement, expressed as one more composable piece
 * rather than special-cased orchestration logic living in
 * ProviderRegistry. Each entry in $providers is typically already wrapped
 * in RateLimitedProvider/RetryingProvider/UsageTrackingProvider by
 * ProviderRegistry::build_chain() before it ever reaches here, so a
 * "fallback" is a last resort after each individual provider's own
 * retries are already exhausted, not a substitute for them.
 *
 * @class       ProviderFallbackChain class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProviderFallbackChain implements AIProviderInterface {

    /**
     * @var AIProviderInterface[]
     */
    private array $providers;

    /**
     * @var ProviderRegistry
     */
    private ProviderRegistry $registry;

    /**
     * @param AIProviderInterface[] $providers Tried in array order.
     * @param ProviderRegistry      $registry  Resolves each provider's own real model — see try_each()'s own docblock for why this can't just reuse whichever model the incoming AIRequest already carries.
     *
     * @throws \InvalidArgumentException If $providers is empty.
     */
    public function __construct( array $providers, ProviderRegistry $registry ) {
        if ( ! $providers ) {
            throw new \InvalidArgumentException( 'ProviderFallbackChain needs at least one provider.' );
        }

        $this->providers = array_values( $providers );
        $this->registry  = $registry;
    }

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return $this->providers[0]->get_id();
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return $this->providers[0]->get_label();
    }

    /**
     * @inheritDoc
     */
    public function supports_streaming(): bool {
        return $this->providers[0]->supports_streaming();
    }

    /**
     * @inheritDoc
     */
    public function get_available_models(): array {
        return $this->providers[0]->get_available_models();
    }

    /**
     * @inheritDoc
     */
    public function send( AIRequest $request ): AIResponse {
        return $this->try_each(
            $request,
            static fn( AIProviderInterface $provider, AIRequest $per_provider_request ) => $provider->send( $per_provider_request )
        );
    }

    /**
     * @inheritDoc
     */
    public function send_streaming( AIRequest $request, callable $on_chunk ): AIResponse {
        return $this->try_each(
            $request,
            static fn( AIProviderInterface $provider, AIRequest $per_provider_request ) => $provider->send_streaming( $per_provider_request, $on_chunk )
        );
    }

    /**
     * @param AIRequest $request Incoming request — its own `get_model()` is only ever actually used for the first provider tried (see below), since every provider gets its own freshly resolved, always-correct-for-that-provider model regardless.
     * @param callable  $call    function( AIProviderInterface, AIRequest ): AIResponse
     * @return AIResponse
     *
     * @throws AIProviderException The last provider tried's own exception, if every provider fails.
     */
    private function try_each( AIRequest $request, callable $call ): AIResponse {
        $last_exception = null;

        foreach ( $this->providers as $provider ) {
            // Confirmed live: reusing $request's own incoming model across
            // every provider sent a real OpenAI model id ("gpt-4o")
            // straight to Gemini's own API the moment the first provider
            // failed and this loop fell back to the next one — a
            // guaranteed "model not found" failure for that provider, not
            // a hypothetical. Every attempt — including the first —
            // re-resolves its own model here instead, via the exact same
            // real per-provider resolution ProviderRegistry::resolve_model_for()
            // already provides.
            $per_provider_request = $request->with_model( $this->registry->resolve_model_for( $provider ) );

            try {
                return $call( $provider, $per_provider_request );
            } catch ( AIProviderException $exception ) {
                $last_exception = $exception;
                continue;
            }
        }

        throw $last_exception;
    }
}
