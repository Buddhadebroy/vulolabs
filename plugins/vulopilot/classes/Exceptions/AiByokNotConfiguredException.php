<?php
/**
 * AiByokNotConfiguredException file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Exceptions;

/**
 * Thrown by AIProviders\Providers\VuloCloudProxyProvider::send() when
 * VuloCloud reports `AI_BYOK_NOT_CONFIGURED` — neither this site's
 * Organization nor an allowed Customer backup has a usable AI provider
 * key. A real AIProviderException subclass (so
 * AIProviders\Decorators\ProviderFallbackChain still falls through to the
 * next configured provider, e.g. a local Ollama, exactly like any other
 * provider failure), but also its own distinct type so
 * AIActions\ActionRunner::send_prompt_or_credits() can specifically
 * recognize "no BYOK key at all" and decide whether to fall through to
 * the AI Credits path for an eligible action, rather than treating it
 * like a generic transient provider failure worth retrying.
 *
 * @class       AiByokNotConfiguredException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiByokNotConfiguredException extends AIProviderException {
}
