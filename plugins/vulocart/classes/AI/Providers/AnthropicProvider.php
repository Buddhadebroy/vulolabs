<?php
/**
 * AnthropicProvider class file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI\Providers;

use VuloCart\AI\Contracts\AIProviderInterface;
use VuloCart\AI\Exceptions\AIProviderException;
use VuloCart\AI\ValueObjects\AIRequest;
use VuloCart\AI\ValueObjects\AIResponse;

defined( 'ABSPATH' ) || exit;

/**
 * Anthropic's Messages API (api.anthropic.com). Anthropic has no public
 * image-generation or embeddings endpoint — generate_image()/embed() throw,
 * same "unsupported capability" contract AIProviderInterface's own
 * docblock documents; ProviderRegistry::build_provider() for a capability
 * this provider lacks is a caller error, not something to silently no-op.
 *
 * @class       AnthropicProvider class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AnthropicProvider implements AIProviderInterface {

	const BASE_URL = 'https://api.anthropic.com/v1';

	const API_VERSION = '2023-06-01';

	/**
	 * @var string
	 */
	private $api_key;

	/**
	 * @param string $api_key Decrypted API key.
	 */
	public function __construct( string $api_key ) {
		$this->api_key = $api_key;
	}

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'anthropic';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Anthropic', 'vulocart' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_available_models(): array {
		return array( 'claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5' );
	}

	/**
	 * @inheritDoc
	 */
	public function send( AIRequest $request ): AIResponse {
		if ( '' === $this->api_key ) {
			throw new AIProviderException( __( 'No Anthropic API key configured.', 'vulocart' ) );
		}

		$system_messages = array();
		$chat_messages   = array();

		foreach ( $request->get_messages() as $message ) {
			if ( 'system' === $message['role'] ) {
				$system_messages[] = $message['content'];
			} else {
				$chat_messages[] = $message;
			}
		}

		$response = wp_remote_post(
			self::BASE_URL . '/messages',
			array(
				'timeout' => 60,
				'headers' => array(
					'x-api-key'         => $this->api_key,
					'anthropic-version' => self::API_VERSION,
					'Content-Type'      => 'application/json',
				),
				'body'    => wp_json_encode(
					array_filter(
						array(
							'model'      => $request->get_model(),
							'messages'   => $chat_messages,
							'system'     => $system_messages ? implode( "\n\n", $system_messages ) : null,
							'max_tokens' => $request->get_max_tokens() ?? 1500,
						)
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			throw new AIProviderException( $response->get_error_message() );
		}

		$code    = wp_remote_retrieve_response_code( $response );
		$decoded = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code < 200 || $code >= 300 ) {
			$message = is_array( $decoded ) && ! empty( $decoded['error']['message'] ) ? $decoded['error']['message'] : 'Anthropic request failed (' . $code . ').';
			throw new AIProviderException( (string) $message );
		}

		$content = isset( $decoded['content'][0]['text'] ) ? (string) $decoded['content'][0]['text'] : '';

		return new AIResponse(
			$content,
			$this->get_id(),
			$request->get_model(),
			(int) ( $decoded['usage']['input_tokens'] ?? 0 ),
			(int) ( $decoded['usage']['output_tokens'] ?? 0 )
		);
	}

	/**
	 * @inheritDoc
	 */
	public function supports_images(): bool {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public function generate_image( string $prompt, string $size = '1024x1024' ): string { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		throw new AIProviderException( __( 'Anthropic does not support image generation.', 'vulocart' ) );
	}

	/**
	 * @inheritDoc
	 */
	public function supports_embeddings(): bool {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public function embed( string $text ): array { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		throw new AIProviderException( __( 'Anthropic does not support embeddings.', 'vulocart' ) );
	}
}
