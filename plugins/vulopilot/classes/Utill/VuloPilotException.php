<?php
/**
 * VuloPilotException class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Single exception class for every VuloPilot-specific failure that used to
 * be its own subclass (AiRequestException, GatewayRequestException,
 * a "VuloCloud has no usable key" subclass, RateLimitExceededException,
 * TransientGatewayException, UnsafePromptException,
 * InvalidActionInputException, InvalidActionOutputException,
 * InsufficientCreditsException) - one class, a `type` constant instead of a
 * class-hierarchy, and an optional `$context` array for whichever extra
 * data that type needs (e.g. INSUFFICIENT_CREDITS' credits_remaining/
 * can_buy_credits/can_upgrade), per direct instruction (too many
 * near-empty one-line subclasses for what a `type` string already
 * distinguishes).
 *
 * Catch sites that used to rely on class hierarchy alone (e.g.
 * `catch ( AiRequestException $e )` catching any of the 4 AI-gateway
 * subtypes) now catch this one class and call `is_ai_request_failure()`
 * (or compare `get_type()` directly) instead.
 *
 * @class       VuloPilotException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class VuloPilotException extends \Exception {

	/**
	 * Common parent of every failure of an AI request to VuloCloud - the
	 * type REST controllers used to catch AiRequestException (the base
	 * class) to turn any of TYPE_VULOCLOUD_AI_NOT_CONFIGURED/
	 * TYPE_GATEWAY_REQUEST/TYPE_RATE_LIMIT_EXCEEDED/
	 * TYPE_TRANSIENT_GATEWAY into a 502 - see is_ai_request_failure().
	 */
	const TYPE_AI_REQUEST = 'ai_request';

	/**
	 * Thrown by AiAssistant\AiRequestSender when VuloCloud reports that no
	 * key resolves for this site - neither this site's Organization nor an
	 * allowed Customer backup has a usable AI key.
	 */
	const TYPE_VULOCLOUD_AI_NOT_CONFIGURED = 'vulocloud_ai_not_configured';

	/**
	 * A non-retryable gateway failure (a malformed request, or one
	 * VuloCloud rejects outright). Never retried by
	 * AiAssistant\AiRequestSender; bubbles straight through it.
	 */
	const TYPE_GATEWAY_REQUEST = 'gateway_request';

	/**
	 * Thrown by AiAssistant\AiRequestSender when this site's per-minute
	 * request budget is exhausted, before the request is ever sent to
	 * VuloCloud.
	 */
	const TYPE_RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded';

	/**
	 * A retryable gateway failure - network error, HTTP 5xx, or HTTP 429.
	 * Caught by AiAssistant\AiRequestSender, which retries with backoff up
	 * to its attempt limit before re-throwing.
	 */
	const TYPE_TRANSIENT_GATEWAY = 'transient_gateway';

	/**
	 * Thrown by AiAssistant\AiRequestSender::validate_prompt() when a
	 * request is too long or appears to contain a credential - blocked
	 * before it's ever sent. Not an AI-request-failure type
	 * (is_ai_request_failure() returns false for this), since it never
	 * reaches the gateway.
	 */
	const TYPE_UNSAFE_PROMPT = 'unsafe_prompt';

	/**
	 * Thrown by an AIActionInterface implementation's validate_input()
	 * when the raw user-supplied input fails validation (e.g. a
	 * referenced post/attachment doesn't exist, a required field is
	 * empty).
	 */
	const TYPE_INVALID_ACTION_INPUT = 'invalid_action_input';

	/**
	 * Thrown by an AIActionInterface implementation's validate_output()
	 * when the AI response fails validation (e.g. empty content, missing
	 * required fields, malformed JSON-LD) before it's shown to the user
	 * as a preview.
	 */
	const TYPE_INVALID_ACTION_OUTPUT = 'invalid_action_output';

	/**
	 * Thrown by AiCopilot\ActionRunner::propose() when a credits-metered
	 * action's VuloCloud AI Gateway call comes back with
	 * `{success:false, error:'insufficient_credits'}` - carries
	 * `credits_remaining`/`can_buy_credits`/`can_upgrade` in `$context` so
	 * RestAPI\Controllers\AiActionRuns::create_item() can pass them
	 * through to the REST response's own `data`, matching the exact shape
	 * the React side's exhausted-credits UI needs.
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
	 * Extra, type-specific data - e.g. TYPE_INSUFFICIENT_CREDITS's
	 * `credits_remaining` (int), `can_buy_credits` (bool), `can_upgrade`
	 * (bool).
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
	 * @return string One of the TYPE_* constants above.
	 */
	public function get_type(): string {
		return $this->type;
	}

	/**
	 * Replaces the old `instanceof AiRequestException` check - true for
	 * this exception's own TYPE_AI_REQUEST plus every AI-gateway subtype
	 * (TYPE_VULOCLOUD_AI_NOT_CONFIGURED/TYPE_GATEWAY_REQUEST/
	 * TYPE_RATE_LIMIT_EXCEEDED/TYPE_TRANSIENT_GATEWAY).
	 *
	 * @return bool
	 */
	public function is_ai_request_failure(): bool {
		return in_array( $this->type, self::AI_REQUEST_FAILURE_TYPES, true );
	}

	/**
	 * @param string $key     A context key, e.g. 'credits_remaining'.
	 * @param mixed  $default Returned when $key isn't set.
	 * @return mixed
	 */
	public function get_context_value( string $key, $default = null ) {
		return $this->context[ $key ] ?? $default;
	}

	/**
	 * @return array<string, mixed>
	 */
	public function get_context(): array {
		return $this->context;
	}

	/**
	 * TYPE_INSUFFICIENT_CREDITS convenience getter - see that constant's
	 * own docblock.
	 *
	 * @return int
	 */
	public function get_credits_remaining(): int {
		return (int) $this->get_context_value( 'credits_remaining', 0 );
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
