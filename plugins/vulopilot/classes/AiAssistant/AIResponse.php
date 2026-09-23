<?php
/**
 * AIResponse class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AiAssistant;

defined( 'ABSPATH' ) || exit;

/**
 * The response returned by the VuloCloud AI API, including the credits
 * consumed by the request. Immutable - sanitizing the content
 * (AISafetyValidator::sanitize_response()) produces a new instance via
 * with_content() rather than mutating this one.
 *
 * @class       AIResponse class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class AIResponse {

    /**
     * @var string
     */
    private string $content;

    /**
     * Real AI credits this call spent, as reported by VuloCloud. `0` is a
     * genuine, honest value here, not a placeholder: it means the specific
     * gateway path that produced this response is uncredited (the direct
     * VuloCloud AI path's own response has no credits field at all), not
     * that credit accounting is unfinished. A credits-metered path (e.g.
     * AiCreditGatewayClient's `/plugin/ai/execute`) reports the real spent
     * amount here instead.
     *
     * @var int
     */
    private int $credits_used;

    /**
     * VuloCloud's own request id for this call, when the gateway that
     * produced this response returns one - null when it doesn't (never
     * fabricated).
     *
     * @var string|null
     */
    private ?string $request_id;

    /**
     * @param string      $content      Generated content.
     * @param int         $credits_used Real AI credits this call spent - see get_credits_used()'s own docblock for why `0` is a real, honest value from some gateways.
     * @param string|null $request_id   VuloCloud's own request id for this call, if the gateway returned one.
     */
    public function __construct(
        string $content,
        int $credits_used,
        ?string $request_id = null
    ) {
        $this->content      = $content;
        $this->credits_used = $credits_used;
        $this->request_id   = $request_id;
    }

    /**
     * @return string
     */
    public function get_content(): string {
        return $this->content;
    }

    /**
     * @return int
     */
    public function get_credits_used(): int {
        return $this->credits_used;
    }

    /**
     * @return string|null
     */
    public function get_request_id(): ?string {
        return $this->request_id;
    }

    /**
     * Returns a copy of this response with different content - used to
     * apply sanitization without mutating the original.
     *
     * @param string $new_content Replacement content.
     * @return self
     */
    public function with_content( string $new_content ): self {
        return new self(
            $new_content,
            $this->credits_used,
            $this->request_id
        );
    }
}
