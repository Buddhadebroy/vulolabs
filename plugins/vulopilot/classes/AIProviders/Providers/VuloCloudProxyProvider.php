<?php
/**
 * VuloCloudProxyProvider class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AIProviders\Providers;

use VuloPilot\Contracts\AI\AIProviderInterface;
use VuloPilot\Exceptions\AiByokNotConfiguredException;
use VuloPilot\Exceptions\ProviderRequestException;
use VuloPilot\Services\AiByokGatewayClient;
use VuloPilot\ValueObjects\AIRequest;
use VuloPilot\ValueObjects\AIResponse;

defined( 'ABSPATH' ) || exit;

/**
 * The single, generic adapter every cloud provider (OpenAI, Anthropic,
 * Gemini, OpenRouter, Groq) now resolves to in ProviderRegistry — not 5
 * near-identical classes, since none of them hold a local credential or
 * build a vendor-specific request anymore. This site never learns which
 * of those 5 actually answers a given call, or whose key was used (org's
 * own, or an allowed Customer's backup) — it only ever sends
 * `{feature, prompt, site_tone}` to VuloCloud via AiByokGatewayClient and
 * gets back finished text. Ollama is the one adapter that stays real and
 * local (OllamaProvider) — it's the site's own local/self-hosted
 * infrastructure, not a vendor account VuloCloud could reach.
 *
 * `get_id()` returning 'vulocloud' rather than any real vendor name is
 * deliberate — see ProviderRegistry's own updated adapter map, which
 * collapses the 5 cloud provider ids into this one entry, since there is
 * no longer a locally meaningful distinction between them (VuloCloud
 * alone decides which one — if any — actually serves a request).
 *
 * @class       VuloCloudProxyProvider class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloCloudProxyProvider implements AIProviderInterface {

    private AiByokGatewayClient $gateway;

    /**
     * @param string                    $unused_credential Accepted only so ProviderRegistry can construct every adapter the same way (`new $class('')`) — this provider holds no credential at all.
     * @param AiByokGatewayClient|null  $gateway            Defaults to a new instance (injectable for tests).
     */
    public function __construct( string $unused_credential = '', ?AiByokGatewayClient $gateway = null ) {
        $this->gateway = $gateway ?? new AiByokGatewayClient();
    }

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'vulocloud';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'VuloCloud AI', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function supports_streaming(): bool {
        return false;
    }

    /**
     * @inheritDoc
     */
    public function get_available_models(): array {
        // Model choice happens entirely server-side now — nothing here
        // for a settings screen to ever list (see ProviderRegistry's own
        // get_available_adapters(), which no longer surfaces this
        // provider id to that panel at all).
        return array();
    }

    /**
     * @inheritDoc
     */
    public function send( AIRequest $request ): AIResponse {
        $result = $this->gateway->execute(
            $request->get_surface() ?? 'ai_action',
            $this->flatten_messages( $request->get_messages() ),
            array(),
            (string) get_option( 'vulopilot_site_tone', '' )
        );

        if ( is_wp_error( $result ) ) {
            if ( 'vulopilot_ai_byok_not_configured' === $result->get_error_code() ) {
                throw new AiByokNotConfiguredException( $result->get_error_message() );
            }

            throw new ProviderRequestException( $result->get_error_message() );
        }

        // provider/model/token counts are deliberately generic — this site
        // never learns which real vendor/key answered (see this class's
        // own docblock) — parse_response()/validate_output()/build_preview()
        // and every other AIResponse consumer only ever read get_content()
        // regardless of these other fields, same posture the credits
        // gateway's own AIResponse synthesis already established.
        return new AIResponse( $result['response'], $this->get_id(), 'hosted', 0, 0, 'stop' );
    }

    /**
     * @inheritDoc
     */
    public function send_streaming( AIRequest $request, callable $on_chunk ): AIResponse {
        // No streaming support — see supports_streaming(). Callers that
        // check that first never reach here; this exists only to satisfy
        // the interface.
        return $this->send( $request );
    }

    /**
     * Turns the request's own `[{role, content}]` messages into the single
     * flat prompt string the new wire contract sends — VuloCloud alone
     * turns it back into whatever message-array shape a given provider
     * actually expects (see AiByokGatewayService::buildMessages() on the
     * vulocloud side). Order-preserving concatenation is lossless enough
     * for a text prompt; nothing about how each AIActions\Actions\* class
     * builds its own messages array changes.
     *
     * @param array<int, array{role: string, content: string}> $messages Chat-style prompt messages.
     * @return string
     */
    private function flatten_messages( array $messages ): string {
        return implode(
            "\n\n",
            array_filter( array_map( static fn( $message ) => (string) ( $message['content'] ?? '' ), $messages ) )
        );
    }
}
