<?php
/**
 * AIRequest class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AiAssistant;

defined( 'ABSPATH' ) || exit;

/**
 * A request sent from VuloPilot to the VuloCloud AI API - a chat-style
 * prompt plus a couple of optional real hints, and nothing else. VuloCloud
 * alone decides which vendor/model answers a call and how; this site never
 * picks or configures that, so there is no `model`/`temperature`/
 * `max_tokens` here to pick or configure.
 *
 * @class       AIRequest class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class AIRequest {

    /**
     * @var array<int, array{role: string, content: string}>
     */
    private array $messages;

    /**
     * A single inline image for the current turn, `{mime_type, data}`
     * (`data` base64-encoded) - additive and optional so every existing
     * caller building a text-only request is unaffected. The VuloCloud
     * gateway's wire contract carries text only, so nothing reads this today;
     * it stays on the request for when that changes.
     *
     * @var array{mime_type: string, data: string}|null
     */
    private ?array $image;

    /**
     * Which real feature/endpoint triggered this call - e.g. 'copilot_chat',
     * 'content_assistant_chat', 'ai_action', 'geo_analysis',
     * 'content_intelligence'. Purely an audit-trail tag: read only by
     * AI\AiRequestSender, written to `vulopilot_ai_history.surface`, so
     * AI Copilot History's "Conversations" filter (and any future
     * per-feature usage breakdown) can tell a real chat turn apart from
     * every other feature that shares the same sender.
     * Null for any caller that doesn't pass one - no behavior change.
     *
     * @var string|null
     */
    private ?string $surface;

    /**
     * @param array                                        $messages array<int, array{role: string, content: string}>.
     * @param array{mime_type: string, data: string}|null $image   Optional inline image for the current turn.
     * @param string|null                                 $surface Optional real feature label - see get_surface()'s own docblock.
     */
    public function __construct(
        array $messages,
        ?array $image = null,
        ?string $surface = null
    ) {
        $this->messages = $messages;
        $this->image    = $image;
        $this->surface  = $surface;
    }

    /**
     * @return array<int, array{role: string, content: string}>
     */
    public function get_messages(): array {
        return $this->messages;
    }

    /**
     * @return array{mime_type: string, data: string}|null
     */
    public function get_image(): ?array {
        return $this->image;
    }

    /**
     * @return string|null
     */
    public function get_surface(): ?string {
        return $this->surface;
    }
}
