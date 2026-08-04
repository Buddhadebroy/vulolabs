<?php
/**
 * AIRequest file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI\ValueObjects;

defined( 'ABSPATH' ) || exit;

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
	private $model;

	/**
	 * @var array<int, array{role: string, content: string}>
	 */
	private $messages;

	/**
	 * @var float|null
	 */
	private $temperature;

	/**
	 * @var int|null
	 */
	private $max_tokens;

	/**
	 * @param string     $model       Model id to use.
	 * @param array      $messages    array<int, array{role: string, content: string}>.
	 * @param float|null $temperature Optional; providers apply their own default when null.
	 * @param int|null   $max_tokens  Optional; providers apply their own default when null.
	 */
	public function __construct( string $model, array $messages, $temperature = null, $max_tokens = null ) {
		$this->model       = $model;
		$this->messages    = $messages;
		$this->temperature = $temperature;
		$this->max_tokens  = $max_tokens;
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
	public function get_temperature() {
		return $this->temperature;
	}

	/**
	 * @return int|null
	 */
	public function get_max_tokens() {
		return $this->max_tokens;
	}
}
