<?php
/**
 * ProviderRegistry class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AIProviders;

use VuloPilot\Contracts\AI\AIProviderInterface;
use VuloPilot\Repositories\AiProviderConfigRepository;
use VuloPilot\Services\CredentialEncryption;

defined( 'ABSPATH' ) || exit;

/**
 * Discovers registered adapter classes (same `vulopilot_*_sources`
 * filter-based discovery as Scanners\ScannerRegistry and
 * RuleEngine\RuleRegistry — see either's docblock for why this codebase
 * doesn't use Modules.php's folder-scan mechanism for a single-class
 * extension point) and is the one place that turns a stored, encrypted
 * `vulopilot_ai_provider_configs` row into a fully usable, decorated
 * AIProviderInterface — the only point in this codebase a provider
 * credential is ever decrypted.
 *
 * Every provider built here comes back wrapped
 * RateLimitedProvider → RetryingProvider → UsageTrackingProvider (that
 * order specifically: check the local budget before even trying, retry
 * transient failures within that budget, and record every real attempt —
 * successful or not — for the audit trail; see UsageTrackingProvider's
 * docblock on why failures are recorded too).
 *
 * @class       ProviderRegistry class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProviderRegistry {

    /**
     * @var array<string, class-string<AIProviderInterface>>
     */
    private array $adapter_classes = array();

    private AiProviderConfigRepository $configs;

    /**
     * ProviderRegistry constructor.
     */
    public function __construct() {
        $this->configs = new AiProviderConfigRepository();

        add_action( 'init', array( $this, 'register_providers' ), 20 );
    }

    /**
     * @return void
     */
    public function register_providers(): void {
        $this->adapter_classes = apply_filters( 'vulopilot_ai_provider_sources', $this->get_default_adapter_classes() );
    }

    /**
     * @return array<string, class-string<AIProviderInterface>>
     */
    private function get_default_adapter_classes(): array {
        return array(
            'openai'     => Providers\OpenAiProvider::class,
            'anthropic'  => Providers\AnthropicProvider::class,
            'gemini'     => Providers\GeminiProvider::class,
            'openrouter' => Providers\OpenRouterProvider::class,
            'ollama'     => Providers\OllamaProvider::class,
            'groq'       => Providers\GroqProvider::class,
        );
    }

    /**
     * @return string[]
     */
    public function get_registered_provider_ids(): array {
        return array_keys( $this->adapter_classes );
    }

    /**
     * Metadata for every registered adapter, configured or not — what the
     * AI Providers settings panel (AI-ARCHITECTURE.md's "What's not here
     * yet": "nothing yet writes to vulopilot_ai_provider_configs from the
     * dashboard") reads to build its provider dropdown and per-provider
     * model list, without a REST controller reaching into this class's
     * private $adapter_classes or duplicating each adapter's own
     * get_label()/get_available_models(). Instantiating with an empty
     * credential is safe here specifically because every adapter
     * constructor only stores the credential/base URL, it never makes a
     * network call (see this class's own docblock and each adapter's,
     * cross-referenced in AI-ARCHITECTURE.md's adapter table) — this
     * method must not be used anywhere a real request could actually be
     * sent, only for reading get_id()/get_label()/get_available_models().
     *
     * @return array<string, array{label: string, available_models: string[], requires_credential: bool}>
     */
    public function get_available_adapters(): array {
        $adapters = array();

        foreach ( $this->adapter_classes as $provider_id => $class ) {
            $instance = new $class( '' );

            $adapters[ $provider_id ] = array(
                'label'               => $instance->get_label(),
                'available_models'    => $instance->get_available_models(),
                // Ollama is the one adapter with no API key at all (a base
                // URL instead, defaulted by the adapter itself) — see
                // AI-ARCHITECTURE.md's adapter table's "Auth" column.
                'requires_credential' => 'ollama' !== $provider_id,
            );
        }

        return $adapters;
    }

    /**
     * Builds one provider id's fully decorated adapter, or null if it
     * isn't registered, isn't configured, is configured but disabled, or
     * its stored credential can no longer be decrypted (CredentialEncryption
     * derives its key from `wp_salt('auth')` — see that class's own
     * docblock — so a site that rotates its auth salts/keys after a
     * credential was saved, e.g. wp-config.php regenerated or a database
     * copied to a fresh environment, leaves `decrypt()` returning null
     * forever after). Previously `?? ''` swallowed exactly that case and
     * built a real adapter with a blank credential anyway — every request
     * would then reach the provider's own API and fail with that
     * provider's generic "unauthenticated caller" error, identical on
     * every single call regardless of what was asked, which is
     * indistinguishable from a hang/canned-reply bug from the chat UI's
     * side. Treating an undecryptable credential as "not configured"
     * instead lets build_fallback_chain() correctly skip it (or, if it was
     * the only provider, Copilot.php's existing catch already returns the
     * honest, actionable "No AI provider is configured. Add one in
     * Settings → AI Providers." — re-saving the key there re-encrypts it
     * under the current salt).
     *
     * @param string $provider_id e.g. 'openai'.
     * @return AIProviderInterface|null
     */
    public function build_provider( string $provider_id ): ?AIProviderInterface {
        if ( ! isset( $this->adapter_classes[ $provider_id ] ) ) {
            return null;
        }

        $config = $this->configs->find_by_provider( $provider_id );

        if ( ! $config || empty( $config['is_active'] ) ) {
            return null;
        }

        $credential = CredentialEncryption::decrypt( (string) $config['credentials'] );

        if ( null === $credential ) {
            return null;
        }

        $class   = $this->adapter_classes[ $provider_id ];
        $adapter = new $class( $credential );

        return new Decorators\UsageTrackingProvider(
            new Decorators\RetryingProvider(
                new Decorators\RateLimitedProvider( $adapter )
            )
        );
    }

    /**
     * Builds a fallback chain across every currently active, configured
     * provider — what AIActions\ActionRunner sends every request through by default.
     * Order follows insertion order in `vulopilot_ai_provider_configs`; a
     * future settings screen letting a site owner reorder providers only
     * needs to change that stored order, not this method.
     *
     * @return AIProviderInterface|null Null if no provider is configured at all.
     */
    public function build_fallback_chain(): ?AIProviderInterface {
        $providers = array();

        foreach ( $this->get_registered_provider_ids() as $provider_id ) {
            $provider = $this->build_provider( $provider_id );

            if ( $provider ) {
                $providers[] = $provider;
            }
        }

        return $providers ? new Decorators\ProviderFallbackChain( $providers ) : null;
    }

    /**
     * The site owner's own configured default model for one provider, if
     * they set one — Settings → AI Providers' model dropdown writes this
     * to `vulopilot_ai_provider_configs.default_model`. Callers building a
     * request (SafeRequestSender) should prefer this over blindly picking
     * a provider's get_available_models()[0]: an adapter's static model
     * catalog is a list of models the API *supports*, not a guarantee
     * every one of them is available to every API key (e.g. a free-tier
     * Gemini key rejecting "gemini-2.5-pro" — GeminiProvider's own
     * catalog[0] — with "no longer available to new users," while
     * "gemini-2.5-flash," this site's actual configured default, works).
     *
     * @param string $provider_id e.g. 'gemini'.
     * @return string|null Null if unconfigured or no default was ever chosen.
     */
    public function get_default_model( string $provider_id ): ?string {
        $config = $this->configs->find_by_provider( $provider_id );
        $model  = (string) ( $config['default_model'] ?? '' );

        return '' !== $model ? $model : null;
    }

    /**
     * Whether this provider's adapter actually emits a real inline image
     * part when AIRequest::get_image() is set (GeminiProvider::build_body()
     * today — the only adapter in this codebase built to send one; every
     * other adapter's build_body()/AIRequest usage stays text-only and
     * would silently never look at get_image() at all). Callers building a
     * request with a real image attachment (Copilot.php) must check this
     * against whichever provider will actually answer — build_fallback_chain()
     * ->get_id() proxies to the first active provider in the chain — before
     * attaching one, since a fallback chain can silently land on a
     * different, non-vision provider first if more than one is configured.
     * Sending an image to a provider that ignores it would make that
     * provider guess/hallucinate a description instead of honestly saying
     * it can't see the attachment, which is worse than not attaching it.
     *
     * @param string $provider_id e.g. 'gemini'.
     * @return bool
     */
    public function supports_vision( string $provider_id ): bool {
        return 'gemini' === $provider_id;
    }
}
