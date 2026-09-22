<?php
/**
 * Every VuloPilot\Exceptions\* class file, merged into one file per direct
 * instruction (reduce classes/'s file count) - each class here used to be
 * its own file (same name, docblock, and behavior, just relocated).
 * Autoloading no longer relies on a class's own file matching its own
 * name for these: composer.json's autoload.classmap entry for classes/
 * (added alongside the existing psr-4 entry specifically to allow this)
 * makes Composer tokenize every file under classes/ and modules/ and map
 * each class it finds to its real file, however many classes share one
 * file - `composer dump-autoload` (no `-o`/`--optimize-autoloader` flag
 * needed) regenerates that map after any further file merge/split here.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Exceptions;

/**
 * Common parent of every failure of an AI request to VuloCloud
 * (GatewayRequestException, RateLimitExceededException,
 * TransientGatewayException, AiByokNotConfiguredException) - the type REST
 * controllers catch to turn any of them into a 502.
 *
 * @class       AiRequestException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiRequestException extends \Exception {
}

/**
 * Thrown by AI\AiRequestSender when VuloCloud reports
 * `AI_BYOK_NOT_CONFIGURED` - neither this site's Organization nor an allowed
 * Customer backup has a usable AI key. A real AiRequestException subclass, but
 * also its own distinct type so AiCopilot\ActionRunner::send_prompt_or_credits()
 * can specifically recognize "no key at all" and decide whether to fall through
 * to the AI Credits path for an eligible action, rather than treating it like a
 * generic transient failure worth retrying.
 *
 * @class       AiByokNotConfiguredException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiByokNotConfiguredException extends AiRequestException {
}

/**
 * A non-retryable gateway failure (a malformed request, or one VuloCloud
 * rejects outright). Never retried by AI\AiRequestSender; bubbles straight
 * through it.
 *
 * @class       GatewayRequestException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class GatewayRequestException extends AiRequestException {
}

/**
 * Thrown by AI\AiRequestSender when this site's per-minute request budget is
 * exhausted, before the request is ever sent to VuloCloud.
 *
 * @class       RateLimitExceededException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RateLimitExceededException extends AiRequestException {
}

/**
 * A retryable gateway failure - network error, HTTP 5xx, or HTTP 429. Caught by
 * AI\AiRequestSender, which retries with backoff up to its attempt limit before
 * re-throwing.
 *
 * @class       TransientGatewayException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TransientGatewayException extends AiRequestException {
}

/**
 * Thrown by AI\AISafetyValidator::validate_prompt() when a request is too long
 * or appears to contain a credential - blocked before it's ever sent. Not a
 * gateway failure, so this does NOT extend AiRequestException.
 *
 * @class       UnsafePromptException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class UnsafePromptException extends \Exception {
}

/**
 * Thrown by an AIActionInterface implementation's validate_input() when the
 * raw user-supplied input fails validation (e.g. a referenced post/attachment
 * doesn't exist, a required field is empty).
 *
 * @class       InvalidActionInputException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class InvalidActionInputException extends \Exception {
}

/**
 * Thrown by an AIActionInterface implementation's validate_output() when
 * the AI response fails validation (e.g. empty content, missing
 * required fields, malformed JSON-LD) before it's shown to the user as a
 * preview.
 *
 * @class       InvalidActionOutputException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class InvalidActionOutputException extends \Exception {
}

/**
 * Thrown by AiCopilot\ActionRunner::propose() when a credits-metered
 * action's VuloCloud AI Gateway call comes back with
 * `{success:false, error:'insufficient_credits'}` (VuloPilot brief §15) -
 * a real, structured, user-actionable outcome, not a generic provider
 * failure (AiRequestException), so it gets its own catch clause wherever
 * propose() is called (RestAPI\Controllers\AiActionRuns::create_item()) to
 * carry `credits_remaining`/`can_buy_credits`/`can_upgrade` through to the
 * REST response's own `data`, matching the exact shape the React side's
 * exhausted-credits UI needs.
 *
 * @class       InsufficientCreditsException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class InsufficientCreditsException extends \Exception {

    private int $credits_remaining;
    private bool $can_buy_credits;
    private bool $can_upgrade;

    public function __construct( string $message, int $credits_remaining, bool $can_buy_credits, bool $can_upgrade ) {
        parent::__construct( $message );

        $this->credits_remaining = $credits_remaining;
        $this->can_buy_credits   = $can_buy_credits;
        $this->can_upgrade       = $can_upgrade;
    }

    public function get_credits_remaining(): int {
        return $this->credits_remaining;
    }

    public function get_can_buy_credits(): bool {
        return $this->can_buy_credits;
    }

    public function get_can_upgrade(): bool {
        return $this->can_upgrade;
    }
}
