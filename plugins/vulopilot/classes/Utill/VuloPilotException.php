<?php
/**
 * VuloPilotException class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Single exception class for VuloPilot failures, distinguished by a `type` constant, with
 * an optional `$context` array.
 *
 * @class       VuloPilotException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloPilotException extends \Exception {

	/**
	 * Common parent of every failure of an AI request to the server.
	 */
	const TYPE_AI_REQUEST = 'ai_request';

	/**
	 * Thrown by AiAssistant\AiRequestSender when the server reports that no
	 * AI key is configured for this site's Organization yet.
	 */
	const TYPE_VULOCLOUD_AI_NOT_CONFIGURED = 'vulocloud_ai_not_configured';

	/**
	 * A non-retryable gateway failure (a malformed request, or one the server rejects
	 * outright).
	 */
	const TYPE_GATEWAY_REQUEST = 'gateway_request';

	/**
	 * Thrown by AiAssistant\AiRequestSender when this site's per-minute request budget is
	 * exhausted, before the request is ever sent to the server.
	 */
	const TYPE_RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded';

	/**
	 * A retryable gateway failure - network error, HTTP 5xx, or HTTP 429.
	 */
	const TYPE_TRANSIENT_GATEWAY = 'transient_gateway';

	/**
	 * Thrown by AiAssistant\AiRequestSender::validate_prompt() when a request is too long
	 * or appears to contain a credential.
	 */
	const TYPE_UNSAFE_PROMPT = 'unsafe_prompt';

	/**
	 * Thrown by an AIActionInterface implementation's validate_input() when the raw user-
	 * supplied input fails validation (e.g. a referenced post/attachment doesn't exist, a
	 * required field is empty).
	 */
	const TYPE_INVALID_ACTION_INPUT = 'invalid_action_input';

	/**
	 * Thrown by an AIActionInterface implementation's validate_output() when the AI
	 * response fails validation (e.g. empty content, missing required fields, malformed
	 * JSON-LD) before it's shown to the user as a preview.
	 */
	const TYPE_INVALID_ACTION_OUTPUT = 'invalid_action_output';

	/**
	 * Thrown when the server refuses a request because the AI credit balance cannot cover
	 * it.
	 */
	const TYPE_INSUFFICIENT_CREDITS = 'insufficient_credits';

	/**
	 * The AI-request-failure types `is_ai_request_failure()` treats as
	 * equivalent to the old `instanceof AiRequestException` check.
	 *
	 * @var string[]
	 */
	const AI_REQUEST_FAILURE_TYPES = array(
		self::TYPE_AI_REQUEST,
		self::TYPE_VULOCLOUD_AI_NOT_CONFIGURED,
		self::TYPE_GATEWAY_REQUEST,
		self::TYPE_RATE_LIMIT_EXCEEDED,
		self::TYPE_TRANSIENT_GATEWAY,
	);

	/**
	 * One of the TYPE_* constants above.
	 *
	 * @var string
	 */
	private string $type;

	/**
	 * Extra, type-specific data - e.g. TYPE_INSUFFICIENT_CREDITS's `credits_remaining`
	 * (int), `can_buy_credits` (bool), `can_upgrade` (bool).
	 *
	 * @var array<string, mixed>
	 */
	private array $context;

	/**
	 * @param string               $message Exception message.
	 * @param string               $type    One of the TYPE_* constants above.
	 * @param array<string, mixed> $context Extra, type-specific data - see each TYPE_*'s own docblock.
	 */
	public function __construct( string $message, string $type = self::TYPE_AI_REQUEST, array $context = array() ) {
		parent::__construct( $message );

		$this->type    = $type;
		$this->context = $context;
	}

	/**
	 * Throws an exception with an already-escaped message.
	 *
	 * @param string               $message Escaped exception message.
	 * @param string               $type    One of the TYPE_* constants above.
	 * @param array<string, mixed> $context Extra, type-specific data - see each TYPE_*'s own docblock.
	 * @return void
	 * @throws self Always.
	 */
	public static function raise( string $message, string $type = self::TYPE_AI_REQUEST, array $context = array() ): void {
		$exception = new self( $message, $type, $context );

		throw $exception;
	}

	/**
	 * @return string One of the TYPE_* constants above.
	 */
	public function get_type(): string {
		return $this->type;
	}

	/**
	 * Replaces the old `instanceof AiRequestException` check.
	 *
	 * @return bool
	 */
	public function is_ai_request_failure(): bool {
		return in_array( $this->type, self::AI_REQUEST_FAILURE_TYPES, true );
	}

	/**
	 * @param string $key     A context key, e.g. 'credits_remaining'.
	 * @param mixed  $fallback Returned when $key isn't set.
	 * @return mixed
	 */
	public function get_context_value( string $key, $fallback = null ) {
		return $this->context[ $key ] ?? $fallback;
	}

	/**
	 * TYPE_INSUFFICIENT_CREDITS convenience getter - see that constant's
	 * own docblock. Credits are fractional.
	 *
	 * @return float
	 */
	public function get_credits_remaining(): float {
		return (float) $this->get_context_value( 'credits_remaining', 0 );
	}

	/**
	 * TYPE_INSUFFICIENT_CREDITS convenience getter - where the site owner can buy more
	 * credits (the server's own AI Credits page), or '' if the server didn't say.
	 *
	 * @return string
	 */
	public function get_buy_credits_url(): string {
		return (string) $this->get_context_value( 'buy_credits_url', '' );
	}

	/**
	 * The one REST shape every controller returns for TYPE_INSUFFICIENT_CREDITS.
	 *
	 * @return \WP_Error
	 */
	public function to_insufficient_credits_error(): \WP_Error {
		return new \WP_Error(
			'vulopilot_insufficient_credits',
			__( 'You don’t have enough credits to complete this request.', 'vulopilot' ),
			array(
				'status'            => 402,
				'credits_remaining' => $this->get_credits_remaining(),
				'can_buy_credits'   => $this->get_can_buy_credits(),
				'buy_credits_url'   => $this->get_buy_credits_url(),
			)
		);
	}

	/**
	 * TYPE_INSUFFICIENT_CREDITS convenience getter.
	 *
	 * @return bool
	 */
	public function get_can_buy_credits(): bool {
		return (bool) $this->get_context_value( 'can_buy_credits', false );
	}

	/**
	 * TYPE_INSUFFICIENT_CREDITS convenience getter.
	 *
	 * @return bool
	 */
	public function get_can_upgrade(): bool {
		return (bool) $this->get_context_value( 'can_upgrade', false );
	}
}
