<?php
/**
 * AIRequest file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\ValueObjects;

/**
 * A chat-style request sent to an AIProviderInterface.
 *
 * @class       AIRequest class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class AIRequest {

    /**
     * @var string
     */
    private string $model;

    /**
     * @var array<int, array{role: string, content: string}>
     */
    private array $messages;

    /**
     * @var float|null
     */
    private ?float $temperature;

    /**
     * @var int|null
     */
    private ?int $max_tokens;

    /**
     * A single inline image for the current turn, `{mime_type, data}`
     * (`data` base64-encoded) — additive and optional so every existing
     * caller building a text-only request is unaffected. Only
     * GeminiProvider reads this today (see its own build_body() and
     * ProviderRegistry::supports_vision()); every other adapter simply
     * never looks at it, the same way they already ignore
     * get_temperature()/get_max_tokens() when null.
     *
     * @var array{mime_type: string, data: string}|null
     */
    private ?array $image;

    /**
     * @param string                                      $model       Model id to use.
     * @param array                                       $messages    array<int, array{role: string, content: string}>.
     * @param float|null                                  $temperature Optional; providers apply their own default when null.
     * @param int|null                                    $max_tokens  Optional; providers apply their own default when null.
     * @param array{mime_type: string, data: string}|null $image   Optional inline image for the current turn.
     */
    public function __construct(
        string $model,
        array $messages,
        ?float $temperature = null,
        ?int $max_tokens = null,
        ?array $image = null
    ) {
        $this->model       = $model;
        $this->messages    = $messages;
        $this->temperature = $temperature;
        $this->max_tokens  = $max_tokens;
        $this->image       = $image;
    }

    /**
     * @return string
     */
    public function get_model(): string {
        return $this->model;
    }

    /**
     * @return array<int, array{role: string, content: string}>
     */
    public function get_messages(): array {
        return $this->messages;
    }

    /**
     * @return float|null
     */
    public function get_temperature(): ?float {
        return $this->temperature;
    }

    /**
     * @return int|null
     */
    public function get_max_tokens(): ?int {
        return $this->max_tokens;
    }

    /**
     * @return array{mime_type: string, data: string}|null
     */
    public function get_image(): ?array {
        return $this->image;
    }
}
