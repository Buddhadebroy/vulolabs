<?php
/**
 * AIResponse file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI\ValueObjects;

defined( 'ABSPATH' ) || exit;

/**
 * An AIProviderInterface's response to an AIRequest.
 *
 * @class       AIResponse class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class AIResponse {

	/**
	 * @var string
	 */
	private $content;

	/**
	 * @var string
	 */
	private $provider;

	/**
	 * @var string
	 */
	private $model;

	/**
	 * @var int
	 */
	private $prompt_tokens;

	/**
	 * @var int
	 */
	private $completion_tokens;

	/**
	 * @param string $content           Generated content.
	 * @param string $provider          Provider id that generated this response.
	 * @param string $model             Model id that generated this response.
	 * @param int    $prompt_tokens     Tokens used by the prompt.
	 * @param int    $completion_tokens Tokens used by the completion.
	 */
	public function __construct( string $content, string $provider, string $model, int $prompt_tokens = 0, int $completion_tokens = 0 ) {
		$this->content            = $content;
		$this->provider           = $provider;
		$this->model              = $model;
		$this->prompt_tokens      = $prompt_tokens;
		$this->completion_tokens  = $completion_tokens;
	}

	/**
	 * @return string
	 */
	public function get_content(): string {
		return $this->content;
	}

	/**
	 * @return string
	 */
	public function get_provider(): string {
		return $this->provider;
	}

	/**
	 * @return string
	 */
	public function get_model(): string {
		return $this->model;
	}

	/**
	 * @return int
	 */
	public function get_prompt_tokens(): int {
		return $this->prompt_tokens;
	}

	/**
	 * @return int
	 */
	public function get_completion_tokens(): int {
		return $this->completion_tokens;
	}
}
