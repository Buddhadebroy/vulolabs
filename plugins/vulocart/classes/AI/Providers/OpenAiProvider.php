<?php
/**
 * OpenAiProvider class file.
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
 * OpenAI's Chat Completions/Images/Embeddings APIs (api.openai.com), via
 * `wp_remote_post` — no HTTP SDK dependency, same posture as every other
 * outbound integration in this codebase (Shipping's carrier clients, the
 * license client).
 *
 * @class       OpenAiProvider class
 * @version     1.0.0
 * @author      VuloLabs
 */
class OpenAiProvider implements AIProviderInterface {

	const BASE_URL = 'https://api.openai.com/v1';

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
		return 'openai';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'OpenAI', 'vulocart' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_available_models(): array {
		return array( 'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini' );
	}

	/**
	 * @param array<string, mixed> $body    Request body.
	 * @param string               $path    API path, e.g. '/chat/completions'.
	 * @return array<string, mixed> Decoded JSON response body.
	 * @throws AIProviderException When the request fails or the API returns an error.
	 */
	private function request( array $body, string $path ): array {
		if ( '' === $this->api_key ) {
			throw new AIProviderException( __( 'No OpenAI API key configured.', 'vulocart' ) );
		}

		$response = wp_remote_post(
			self::BASE_URL . $path,
			array(
				'timeout' => 60,
				'headers' => array(
					'Authorization' => 'Bearer ' . $this->api_key,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			throw new AIProviderException( $response->get_error_message() );
		}

		$code    = wp_remote_retrieve_response_code( $response );
		$decoded = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code < 200 || $code >= 300 ) {
			$message = is_array( $decoded ) && ! empty( $decoded['error']['message'] ) ? $decoded['error']['message'] : 'OpenAI request failed (' . $code . ').';
			throw new AIProviderException( (string) $message );
		}

		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * @inheritDoc
	 */
	public function send( AIRequest $request ): AIResponse {
		$decoded = $this->request(
			array(
				'model'       => $request->get_model(),
				'messages'    => $request->get_messages(),
				'temperature' => $request->get_temperature() ?? 0.7,
				'max_tokens'  => $request->get_max_tokens() ?? 1500,
			),
			'/chat/completions'
		);

		$content = isset( $decoded['choices'][0]['message']['content'] ) ? (string) $decoded['choices'][0]['message']['content'] : '';

		return new AIResponse(
			$content,
			$this->get_id(),
			$request->get_model(),
			(int) ( $decoded['usage']['prompt_tokens'] ?? 0 ),
			(int) ( $decoded['usage']['completion_tokens'] ?? 0 )
		);
	}

	/**
	 * @inheritDoc
	 */
	public function supports_images(): bool {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function generate_image( string $prompt, string $size = '1024x1024' ): string {
		$decoded = $this->request(
			array(
				'model'  => 'dall-e-3',
				'prompt' => $prompt,
				'n'      => 1,
				'size'   => $size,
			),
			'/images/generations'
		);

		if ( empty( $decoded['data'][0]['url'] ) ) {
			throw new AIProviderException( __( 'OpenAI returned no image.', 'vulocart' ) );
		}

		return (string) $decoded['data'][0]['url'];
	}

	/**
	 * @inheritDoc
	 */
	public function supports_embeddings(): bool {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function embed( string $text ): array {
		$decoded = $this->request(
			array(
				'model' => 'text-embedding-3-small',
				'input' => $text,
			),
			'/embeddings'
		);

		if ( empty( $decoded['data'][0]['embedding'] ) || ! is_array( $decoded['data'][0]['embedding'] ) ) {
			throw new AIProviderException( __( 'OpenAI returned no embedding.', 'vulocart' ) );
		}

		return array_map( 'floatval', $decoded['data'][0]['embedding'] );
	}
}
