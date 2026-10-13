<?php
/**
 * AiClient class file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI;

use VuloCart\AI\Exceptions\AIProviderException;

defined( 'ABSPATH' ) || exit;

/**
 * The single entry point every VuloCart AI feature calls -
 * `VuloCart()->ai_client`. Requests go to the VuloCloud AI gateway via
 * VuloCloudConnection and run on the connected Organization's key and
 * credits; callers never see a provider, model or API key. Every call
 * (successful or not) is logged via AiUsageLogUtil.
 *
 * The gateway takes one prompt string, so `$system` and `$user_message`
 * are joined, and `$temperature`/`$max_tokens` (kept so existing callers
 * don't change) are not forwarded. Image generation and embeddings have no
 * gateway endpoint yet and throw.
 *
 * @class       AiClient class
 * @version     2.0.0
 * @author      VuloLabs
 */
class AiClient {

	/**
	 * @var VuloCloudConnection
	 */
	private $connection;

	/**
	 * @var AiUsageLogUtil
	 */
	private $usage_log;

	/**
	 * @param VuloCloudConnection $connection VuloCloud gateway connection.
	 * @param AiUsageLogUtil      $usage_log  Logs every real call attempt.
	 */
	public function __construct( VuloCloudConnection $connection, AiUsageLogUtil $usage_log ) {
		$this->connection = $connection;
		$this->usage_log  = $usage_log;
	}

	/**
	 * Whether this site is connected to VuloCloud.
	 *
	 * @return bool
	 */
	public function is_configured(): bool {
		return $this->connection->is_connected();
	}

	/**
	 * Sends a system + user message and returns the reply text.
	 *
	 * @param string          $feature      Short label for the usage log/credit history.
	 * @param string          $system       System prompt.
	 * @param string          $user_message User message.
	 * @param float|int|null  $temperature  Unused; kept for caller compatibility.
	 * @param int|null        $max_tokens   Unused; kept for caller compatibility.
	 * @return string
	 * @throws AIProviderException When not connected, or VuloCloud rejects/fails the request.
	 */
	public function prompt( string $feature, string $system, string $user_message, $temperature = null, $max_tokens = null ): string { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		$prompt = '' === trim( $system )
			? $user_message
			: "Instructions:\n" . $system . "\n\nRequest:\n" . $user_message;

		$result = $this->connection->execute( $feature, $prompt, wp_generate_uuid4() );

		if ( is_wp_error( $result ) ) {
			$this->log( $feature, false, $result->get_error_message() );

			throw new AIProviderException( $result->get_error_message() );
		}

		$this->log( $feature, true );

		return $result['response'];
	}

	/**
	 * Like prompt(), but expects (and returns) a decoded JSON object.
	 *
	 * @param string $feature      Short label for the usage log.
	 * @param string $system       System prompt.
	 * @param string $user_message User message.
	 * @return array
	 * @throws AIProviderException When the reply isn't valid JSON.
	 */
	public function prompt_json( string $feature, string $system, string $user_message ): array {
		$content = $this->prompt( $feature, $system . "\n\nRespond with ONLY a single valid JSON object, no prose, no markdown code fences.", $user_message );
		$content = trim( $content );
		$content = preg_replace( '/^```(?:json)?|```$/m', '', $content );
		$decoded = json_decode( trim( (string) $content ), true );

		if ( ! is_array( $decoded ) ) {
			throw new AIProviderException( __( 'The AI service did not return valid JSON.', 'vulocart' ) );
		}

		return $decoded;
	}

	/**
	 * @param string $feature Short label for the usage log.
	 * @param string $prompt  Image prompt.
	 * @return string
	 * @throws AIProviderException Always - not available through VuloCloud AI yet.
	 */
	public function generate_image( string $feature, string $prompt ): string { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		$message = __( 'Image generation is not available through VuloCloud AI yet.', 'vulocart' );

		$this->log( $feature, false, $message );

		throw new AIProviderException( $message );
	}

	/**
	 * @param string $feature Short label for the usage log.
	 * @param string $text    Text to embed.
	 * @return array
	 * @throws AIProviderException Always - not available through VuloCloud AI yet.
	 */
	public function embed( string $feature, string $text ): array { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		$message = __( 'Embeddings are not available through VuloCloud AI yet.', 'vulocart' );

		$this->log( $feature, false, $message );

		throw new AIProviderException( $message );
	}

	/**
	 * @param string      $feature Feature label.
	 * @param bool        $success Whether the call succeeded.
	 * @param string|null $error   Error message for a failed call.
	 * @return void
	 */
	private function log( string $feature, bool $success, ?string $error = null ): void {
		$this->usage_log->insert(
			array(
				'provider'      => 'vulocloud',
				'model'         => '',
				'feature'       => $feature,
				'success'       => $success,
				'error_message' => $error,
			)
		);
	}
}
