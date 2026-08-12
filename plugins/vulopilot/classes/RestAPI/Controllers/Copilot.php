<?php
/**
 * Copilot controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Exceptions\UnsafePromptException;
use VuloPilot\ValueObjects\Severity;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\AutomationRepository;
use VuloPilot\Repositories\ActionRunRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `POST /copilot/chat` — the real conversational backend for "AI Copilot"'s
 * Chat tab (src/pages/AIAssistant/ChatTab.tsx) and Grow My Traffic's own
 * "How would you like to grow today?" composer
 * (src/pages/GEO/OverviewTab.tsx) — both previously showed the identical
 * honest "AI chat replies aren't available yet" disabled state since
 * neither routed to any backend.
 *
 * Reuses VuloPilot()->ai_request_sender (AIProviders\Support\SafeRequestSender)
 * exactly like ContentAssistant.php and GeoAnalyzer already do — same
 * safety-validate → provider-fallback-chain → sanitize sequence, and every
 * call is automatically recorded to `vulopilot_ai_history` by
 * ProviderRegistry's own UsageTrackingProvider decorator.
 *
 * Unlike ContentAssistant (a narrow writing helper), this system prompt is
 * grounded with a real, live snapshot of the site's own findings/automation
 * counts (build_site_context()) so answers like "why is my traffic
 * dropping?" reason from this site's actual open issues rather than
 * generic advice — and is told explicitly that it cannot execute changes
 * itself, since no AI action-trigger engine exists yet (the same honest
 * limitation AiSalesAssistantCard.tsx/AiSpeedAssistantCard.tsx/
 * AiAnalystCard.tsx already document for bulk auto-fix).
 *
 * @class       Copilot controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Copilot extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'copilot';

    /**
     * How many prior turns of client-supplied history to include — bounds
     * the prompt sent to the AI provider on a long-running chat.
     */
    private const MAX_HISTORY_MESSAGES = 20;

    /**
     * Registers POST /copilot/chat.
     *
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/chat',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function create_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * Sends one real chat turn through the configured AI provider chain,
     * grounded with a live site snapshot.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function create_item( $request ) {
        $message = sanitize_textarea_field( (string) $request->get_param( 'message' ) );

        if ( '' === trim( $message ) ) {
            return new \WP_Error(
                'vulopilot_empty_message',
                __( 'Message cannot be empty.', 'vulopilot' ),
                array( 'status' => 400 )
            );
        }

        $messages = $this->build_messages( $message, (array) $request->get_param( 'history' ) );

        try {
            $response = VuloPilot()->ai_request_sender->send( $messages );
        } catch ( UnsafePromptException $exception ) {
            return new \WP_Error( 'vulopilot_unsafe_prompt', $exception->getMessage(), array( 'status' => 400 ) );
        } catch ( \RuntimeException $exception ) {
            return new \WP_Error(
                'vulopilot_no_provider',
                sprintf(
                    /* translators: %s is the exception's own real message, e.g. "No AI provider is configured." */
                    __( '%s Add one in Settings → AI Providers.', 'vulopilot' ),
                    $exception->getMessage()
                ),
                array( 'status' => 400 )
            );
        } catch ( \Throwable $exception ) {
            return new \WP_Error( 'vulopilot_ai_request_failed', $exception->getMessage(), array( 'status' => 502 ) );
        }

        return rest_ensure_response(
            array(
                'content'  => $response->get_content(),
                'provider' => $response->get_provider(),
                'model'    => $response->get_model(),
            )
        );
    }

    /**
     * Builds a real chat-style prompt: a system message describing the
     * copilot's role plus a live site snapshot, the client's own recent
     * turns, then the new user message.
     *
     * @param string            $message     The new user message.
     * @param array<int, mixed> $raw_history Client-supplied {role, content} turns, oldest first.
     * @return array<int, array{role: string, content: string}>
     */
    private function build_messages( string $message, array $raw_history ): array {
        $messages   = array();
        $messages[] = array(
            'role'    => 'system',
            'content' => sprintf(
                /* translators: 1: site name, 2: real live site snapshot text. */
                __(
                    'You are VuloPilot, an AI website copilot embedded in the WordPress plugin VuloPilot, helping the owner of the site "%1$s". You help with SEO, performance, security, accessibility, GEO/AI-search visibility, WooCommerce store health, and automations. Answer using the real site snapshot below when relevant, and point the user to the specific tab (Issues, Performance, Security, GEO, WooCommerce, Automation) where they can review or fix something. You cannot execute changes on the site yourself during this conversation — say so plainly if asked to perform an action, rather than claiming to have done it. Reply in plain text or Markdown, never HTML.%2$s',
                    'vulopilot'
                ),
                get_bloginfo( 'name' ),
                $this->build_site_context()
            ),
        );

        foreach ( array_slice( $raw_history, -self::MAX_HISTORY_MESSAGES ) as $entry ) {
            if ( ! is_array( $entry ) || empty( $entry['role'] ) || empty( $entry['content'] ) ) {
                continue;
            }

            $messages[] = array(
                'role'    => 'user' === $entry['role'] ? 'user' : 'assistant',
                'content' => sanitize_textarea_field( (string) $entry['content'] ),
            );
        }

        $messages[] = array(
            'role'    => 'user',
            'content' => $message,
        );

        return $messages;
    }

    /**
     * A real, live snapshot of the site's own open findings and automation
     * state — the same repositories/queries Controllers\Dashboard.php's
     * `/dashboard` payload already reads, condensed into a short text
     * block instead of a JSON payload, so the AI reasons about this site's
     * actual issues instead of generic advice.
     *
     * @return string
     */
    private function build_site_context(): string {
        $findings    = new FindingRepository();
        $automations = new AutomationRepository();
        $action_runs = new ActionRunRepository();

        $categories = array(
            'seo'           => __( 'SEO', 'vulopilot' ),
            'performance'   => __( 'Performance', 'vulopilot' ),
            'security'      => __( 'Security', 'vulopilot' ),
            'accessibility' => __( 'Accessibility', 'vulopilot' ),
            'geo'           => __( 'GEO/AI-search', 'vulopilot' ),
        );

        if ( class_exists( 'WooCommerce' ) ) {
            $categories['woocommerce'] = __( 'WooCommerce', 'vulopilot' );
        }

        $category_lines = array();
        foreach ( $categories as $category => $label ) {
            $category_lines[] = sprintf( '%s: %d', $label, $findings->count_by_category( $category ) );
        }

        $pending_approvals = (int) $action_runs->find_all(
            array(
                'status'   => 'pending_approval',
                'per_page' => 1,
            )
        )['total'];

        return sprintf(
            "\n\nCurrent site snapshot:\n- Open findings by category: %1\$s\n- Critical: %2\$d, High: %3\$d\n- Active automations: %4\$d\n- Action runs pending approval: %5\$d",
            implode( ', ', $category_lines ),
            $findings->count_by_severity( Severity::CRITICAL ),
            $findings->count_by_severity( Severity::HIGH ),
            $automations->count_enabled(),
            $pending_approvals
        );
    }
}
