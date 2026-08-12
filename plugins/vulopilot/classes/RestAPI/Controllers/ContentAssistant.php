<?php
/**
 * ContentAssistant controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Exceptions\UnsafePromptException;

defined( 'ABSPATH' ) || exit;

/**
 * `POST /content-assistant/chat` — a real freeform chat turn for "Create
 * Content"'s AI Content Assistant sidebar
 * (src/pages/Content/AiContentAssistantSidebar.tsx). Reuses
 * VuloPilot()->ai_request_sender (AIProviders\Support\SafeRequestSender,
 * already wired in VuloPilot::init_classes() for AIActions\ActionRunner
 * and GeoAnalysis\GeoAnalyzer) rather than a new AI-calling path — the
 * same safety-validate → provider-fallback-chain → sanitize sequence,
 * and every call is automatically recorded to `vulopilot_ai_history` by
 * ProviderRegistry's own UsageTrackingProvider decorator, so this
 * controller doesn't do any logging of its own.
 *
 * Deliberately stateless server-side: the client sends its own running
 * `history` array back on every call rather than this controller
 * persisting a conversation entity — there's no "conversation" table
 * anywhere in this codebase to hang one off, and a content-assistant chat
 * is short-lived by nature.
 *
 * @class       ContentAssistant controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class ContentAssistant extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'content-assistant';

    /**
     * How many prior turns of client-supplied history to include — bounds
     * the prompt sent to the AI provider on a long-running chat.
     */
    private const MAX_HISTORY_MESSAGES = 20;

    /**
     * Registers POST /content-assistant/chat.
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
     * Sends one real chat turn through the configured AI provider chain.
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
     * assistant's role, the client's own recent turns, then the new user
     * message.
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
                /* translators: %s is the site's own real name (get_bloginfo('name')). */
                __(
                    'You are the AI Content Assistant inside the WordPress plugin VuloPilot, helping the owner of the site "%s" write content: blog posts, product descriptions, FAQs, meta titles, and calls-to-action. Keep replies practical and ready to paste into the editor. Reply in plain text or Markdown, never HTML.',
                    'vulopilot'
                ),
                get_bloginfo( 'name' )
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
}
