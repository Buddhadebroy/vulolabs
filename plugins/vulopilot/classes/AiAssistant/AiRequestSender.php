<?php
/**
 * AiRequestSender class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\AiAssistant;

use VuloPilot\Utill\VuloPilotException;
use VuloPilot\Utill as UtillHelper;

defined( 'ABSPATH' ) || exit;

/**
 * The one path every real AI call in this plugin goes through: safety-validate
 * the prompt, make sure this site is connected to VuloCloud, spend one request
 * from the per-minute budget, send `{feature, prompt, site_tone}` to the
 * VuloCloud gateway (retrying transient failures), record the attempt in
 * `vulopilot_ai_history`, then sanitize the response.
 *
 * VuloCloud is the only place an AI answer comes from - it holds every key and
 * decides which vendor serves a call - so there is nothing to pick between and
 * no registry/adapter/fallback layer. Request-building, safety-validation,
 * budget, retry, and history are plain private steps/methods on this one
 * class, in the same order: safety-validate, budget check on every
 * attempt, retries inside that budget, and one history row per call
 * (failures included, so the audit trail covers what was tried, not only
 * what worked).
 *
 * AIResponse stays its own class - it's the shared value object
 * AIActionInterface::parse_response() takes as its parameter type, read by
 * every one of this plugin's ~50 AI Action classes (both plugins), and
 * also constructed independently by AiCopilot\ActionRunner's
 * credits-metered gateway call - a real, cross-cutting contract type, not
 * something private to this one sender.
 *
 * The direct VuloCloud AI gateway call itself lives on AiCreditsConnection,
 * not here - it only ever reads that class's own stored credential, so
 * credits_connection doubles as both "is this site connected" and "make
 * the one real gateway call".
 *
 * @class       AiRequestSender class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AiRequestSender {

    /**
     * Requests this site may send per minute (a local, pre-emptive guard
     * against burning through AI credits too fast).
     */
    private const MAX_REQUESTS_PER_MINUTE = 20;

    /**
     * Total attempts including the first; the delay doubles after each failure.
     */
    private const MAX_ATTEMPTS = 3;

    private const BASE_RETRY_DELAY_MS = 500;

    /**
     * `response_excerpt`/`prompt_excerpt` are an audit trail, not a cache -
     * bounds how much of a real prompt or reply gets persisted per call.
     */
    private const EXCERPT_MAX_LENGTH = 300;

    /**
     * Regex patterns matching common API-key shapes - see validate_prompt()'s
     * own docblock for why this is deliberately conservative, not exhaustive.
     *
     * @var string[]
     */
    private const SECRET_PATTERNS = array(
        '/sk-[a-zA-Z0-9]{20,}/',            // OpenAI-style secret key.
        '/AIza[0-9A-Za-z\-_]{35}/',          // Google API key.
        '/-----BEGIN (RSA |EC )?PRIVATE KEY-----/',
    );

    /**
     * Max prompt length validate_prompt() allows through.
     */
    private const MAX_PROMPT_LENGTH = 32000;

    private AiHistoryRepository $history;
    private AiCreditsConnection $credits_connection;

    /**
     * @param AiHistoryRepository|null $history            Defaults to a new instance (injectable for tests).
     * @param AiCreditsConnection|null $credits_connection Defaults to a new instance (injectable for tests) - also the direct VuloCloud AI gateway itself (see AiCreditsConnection's own docblock).
     */
    public function __construct(
        ?AiHistoryRepository $history = null,
        ?AiCreditsConnection $credits_connection = null
    ) {
        $this->credits_connection = $credits_connection ?? new AiCreditsConnection();
        $this->history             = $history ?? new AiHistoryRepository();
    }

    /**
     * @param array<int, array{role: string, content: string}> $messages Chat-style prompt messages.
     * @param array{mime_type: string, data: string}|null      $image    Optional inline image for the current turn. The VuloCloud gateway's wire contract doesn't carry one today, so it is recorded on the request but never sent.
     * @param string|null                                      $surface  Optional real feature label recorded to `vulopilot_ai_history.surface`.
     * @return AIResponse
     *
     * @throws VuloPilotException If the prompt fails safety validation, this minute's request budget is already spent, VuloCloud has no AI key that resolves for this site, or the VuloCloud gateway rejects or fails the request.
     * @throws \RuntimeException  If this site isn't connected to VuloCloud.
     */
    public function send( array $messages, ?array $image = null, ?string $surface = null ): AIResponse {
        $this->validate_prompt( $messages );

        if ( ! $this->credits_connection->is_connected() ) {
            throw new \RuntimeException( esc_html__( 'No AI connection is configured.', 'vulopilot' ) );
        }

        try {
            $response = $this->send_with_retries( $messages, $surface );
            $this->record_success( $messages, $surface, $response );
        } catch ( \Throwable $exception ) {
            $this->record_failure( $messages, $surface );
            throw $exception;
        }

        return $this->sanitize_response( $response );
    }

    /**
     * The prompt-length/secret-pattern gate every request goes through
     * before it's ever sent - deliberately conservative, not exhaustive
     * (catches the shapes of common API keys, not a general-purpose
     * PII/secrets scanner).
     *
     * @param array<int, array{role: string, content: string}> $messages The prompt about to be sent.
     * @return void
     *
     * @throws VuloPilotException If the prompt is too long or appears to contain a secret.
     */
    private function validate_prompt( array $messages ): void {
        $combined = implode( "\n", array_column( $messages, 'content' ) );

        if ( mb_strlen( $combined ) > self::MAX_PROMPT_LENGTH ) {
            throw new VuloPilotException(
                sprintf(
                    /* translators: %d is the maximum allowed prompt length in characters. */
                    esc_html__( 'This request is too long to send to the AI service (limit: %d characters).', 'vulopilot' ),
                    absint( self::MAX_PROMPT_LENGTH )
                ), VuloPilotException::TYPE_UNSAFE_PROMPT );
        }

        foreach ( self::SECRET_PATTERNS as $pattern ) {
            if ( preg_match( $pattern, $combined ) ) {
                throw new VuloPilotException(
                    esc_html__( 'This request appears to contain a credential and was blocked before sending.', 'vulopilot' ), VuloPilotException::TYPE_UNSAFE_PROMPT );
            }
        }
    }

    /**
     * Strips any HTML/script content out of an AI response before it's
     * used anywhere - a plain-text/markdown answer is what every job
     * handler here expects, and an AI response should never be trusted
     * as safe-to-render HTML just because it came back successfully.
     *
     * @param AIResponse $response Response to sanitize.
     * @return AIResponse A copy with sanitized content.
     */
    private function sanitize_response( AIResponse $response ): AIResponse {
        return $response->with_content( wp_kses( $response->get_content(), array() ) );
    }

    /**
     * Only a TYPE_TRANSIENT_GATEWAY failure is retried - a TYPE_GATEWAY_REQUEST
     * (malformed request), TYPE_VULOCLOUD_AI_NOT_CONFIGURED or
     * TYPE_RATE_LIMIT_EXCEEDED failure passes straight through, per those
     * types' own docblocks on VuloPilotException. Every attempt spends from the budget.
     *
     * @param array<int, array{role: string, content: string}> $messages Chat-style prompt messages.
     * @param string|null                                      $surface  Optional real feature label.
     * @return AIResponse
     *
     * @throws VuloPilotException If every attempt is exhausted.
     */
    private function send_with_retries( array $messages, ?string $surface ): AIResponse {
        $attempts_made = 0;

        while ( true ) {
            try {
                $this->enforce_rate_limit();

                return $this->call_gateway( $messages, $surface );
            } catch ( VuloPilotException $exception ) {
                if ( VuloPilotException::TYPE_TRANSIENT_GATEWAY !== $exception->get_type() ) {
                    throw $exception;
                }

                ++$attempts_made;

                if ( $attempts_made >= self::MAX_ATTEMPTS ) {
                    throw $exception;
                }

                usleep( self::BASE_RETRY_DELAY_MS * 1000 * ( 2 ** ( $attempts_made - 1 ) ) );
            }
        }
    }

    /**
     * A WP transient as a lightweight per-minute counter - the existing WP
     * mechanism for "a value that should expire on its own", not a new cache.
     *
     * @return void
     *
     * @throws VuloPilotException If this minute's budget is already spent.
     */
    private function enforce_rate_limit(): void {
        $transient_key = 'vulopilot_ai_rate_vulocloud_' . floor( time() / MINUTE_IN_SECONDS );
        $count         = (int) get_transient( $transient_key );

        if ( $count >= self::MAX_REQUESTS_PER_MINUTE ) {
            throw new VuloPilotException(
                sprintf(
                    /* translators: %d: requests-per-minute limit. */
                    esc_html__( 'AI rate limit reached (%d requests/minute).', 'vulopilot' ),
                    absint( self::MAX_REQUESTS_PER_MINUTE )
                ), VuloPilotException::TYPE_RATE_LIMIT_EXCEEDED );
        }

        set_transient( $transient_key, $count + 1, MINUTE_IN_SECONDS );
    }

    /**
     * Sends `{feature, prompt, site_tone}` to VuloCloud and returns finished
     * text. The prompt is the messages flattened in order - VuloCloud alone
     * turns it back into whatever message shape the serving vendor expects.
     * This gateway's own response carries no credits field, so the returned
     * AIResponse's `credits_used` is honestly `0` here - this is the free,
     * rate-limited direct VuloCloud AI path, genuinely uncredited, not an
     * unfinished calculation. `request_id` carries through VuloCloud's own
     * real `requestId`.
     *
     * @param array<int, array{role: string, content: string}> $messages Chat-style prompt messages.
     * @param string|null                                      $surface  Optional real feature label.
     * @return AIResponse
     *
     * @throws VuloPilotException If VuloCloud has no AI key that resolves for this site, or for any other gateway failure.
     */
    private function call_gateway( array $messages, ?string $surface ): AIResponse {
        // Lives in the flat `vulopilot_settings` option (General tab's own
        // "Site tone" field, autosaved) - see UtillHelper::VULOPILOT_SETTINGS_DEFAULTS.
        $settings = wp_parse_args( (array) get_option( UtillHelper::VULOPILOT_SETTINGS_KEY, array() ), UtillHelper::VULOPILOT_SETTINGS_DEFAULTS );

        $result = $this->credits_connection->execute(
            $surface ?? 'ai_action',
            $this->flatten_messages( $messages ),
            array(),
            (string) $settings['site_tone']
        );

        if ( is_wp_error( $result ) ) {
            if ( 'vulopilot_vulocloud_ai_not_configured' === $result->get_error_code() ) {
                throw new VuloPilotException( esc_html( $result->get_error_message() ), VuloPilotException::TYPE_VULOCLOUD_AI_NOT_CONFIGURED );
            }

            throw new VuloPilotException( esc_html( $result->get_error_message() ), VuloPilotException::TYPE_GATEWAY_REQUEST );
        }

        return new AIResponse( $result['response'], 0, $result['request_id'] ?? null );
    }

    /**
     * @param array<int, array{role: string, content: string}> $messages Chat-style prompt messages.
     * @return string
     */
    private function flatten_messages( array $messages ): string {
        return implode(
            "\n\n",
            array_filter( array_map( static fn( $message ) => (string) ( $message['content'] ?? '' ), $messages ) )
        );
    }

    /**
     * @param array<int, array{role: string, content: string}> $messages Originating request messages.
     * @param string|null                                      $surface  Originating request's own feature label.
     * @param AIResponse                                       $response Completed response.
     * @return void
     */
    private function record_success( array $messages, ?string $surface, AIResponse $response ): void {
        $this->history->insert(
            array(
                'request_id'        => $response->get_request_id(),
                'surface'           => $surface,
                'credits_used'      => $response->get_credits_used(),
                'status'            => 'success',
                'prompt_excerpt'    => $this->build_prompt_excerpt( $messages ),
                'response_excerpt'  => $this->build_excerpt( $response->get_content() ),
                'requested_by'      => get_current_user_id(),
            )
        );
    }

    /**
     * @param array<int, array{role: string, content: string}> $messages Originating request messages.
     * @param string|null                                      $surface  Originating request's own feature label.
     * @return void
     */
    private function record_failure( array $messages, ?string $surface ): void {
        $this->history->insert(
            array(
                'request_id'        => null,
                'surface'           => $surface,
                'credits_used'      => 0,
                'status'            => 'failure',
                'prompt_excerpt'    => $this->build_prompt_excerpt( $messages ),
                'requested_by'      => get_current_user_id(),
            )
        );
    }

    /**
     * Truncates real text down to an audit-trail-sized excerpt. `mb_substr`
     * since real AI replies routinely contain multi-byte characters.
     *
     * @param string $content Full text.
     * @return string
     */
    private function build_excerpt( string $content ): string {
        $trimmed = trim( $content );

        if ( mb_strlen( $trimmed ) <= self::EXCERPT_MAX_LENGTH ) {
            return $trimmed;
        }

        return mb_substr( $trimmed, 0, self::EXCERPT_MAX_LENGTH ) . '…';
    }

    /**
     * The real, human-typed question this call is answering - the last
     * `role: 'user'` message in the request (never the system prompt, which is
     * always message[0] and is orchestration instructions, not anything a
     * human asked). History's detail panel ("You asked") reads this.
     *
     * @param array<int, array{role: string, content: string}> $messages Originating request messages.
     * @return string|null Null if the request genuinely has no user message.
     */
    private function build_prompt_excerpt( array $messages ): ?string {
        $last_user_message = null;

        foreach ( $messages as $message ) {
            if ( 'user' === ( $message['role'] ?? '' ) ) {
                $last_user_message = (string) ( $message['content'] ?? '' );
            }
        }

        return null === $last_user_message ? null : $this->build_excerpt( $last_user_message );
    }
}
