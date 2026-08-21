<?php
/**
 * Copilot controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\AIActions\ContentCreationOrchestrator;
use VuloPilot\Exceptions\UnsafePromptException;
use VuloPilot\ValueObjects\Severity;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\AutomationsRepository;
use VuloPilot\Repositories\ActionRunRepository;
use VuloPilot\Repositories\AiConversationRepository;

defined( 'ABSPATH' ) || exit;

/**
 * `POST /copilot/chat` — the real conversational backend for "AI Copilot"'s
 * Chat tab (src/pages/AIAssistant/ChatTab.tsx) and SEO & Visibility's own
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
 * Unlike ContentAssistant (a narrow writing helper with no site context),
 * this system prompt is grounded with a real, live snapshot of the site's
 * own findings/automation counts (build_site_context()) so answers like
 * "why is my traffic dropping?" reason from this site's actual open issues
 * rather than generic advice. It also now shares ContentAssistant's own
 * real content-creation capability (ContentCreationOrchestrator) — a
 * message like "write a blog about X" really creates a WordPress draft via
 * the same AIActions\ActionRunner propose()→approve() lifecycle
 * (auto-approved, since the conversation itself IS the approval), not just
 * advice about writing one. Every *other* kind of change (an SEO fix, a
 * security setting, anything mutating something that already exists) is
 * still advice-only — build_messages()'s own prompt says so plainly rather
 * than claiming to have done it, the same honest limitation
 * AiSalesAssistantCard.tsx/AiSpeedAssistantCard.tsx/AiAnalystCard.tsx
 * already document for bulk auto-fix elsewhere in this codebase.
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
     * Shared with ContentAssistant.php — see ContentCreationOrchestrator's
     * own docblock for why this logic lives outside both controllers.
     *
     * @var ContentCreationOrchestrator
     */
    private ContentCreationOrchestrator $orchestrator;

    /**
     * Copilot constructor.
     */
    public function __construct() {
        $this->orchestrator = new ContentCreationOrchestrator();
    }

    /**
     * How many prior turns of client-supplied history to include — bounds
     * the prompt sent to the AI provider on a long-running chat.
     */
    private const MAX_HISTORY_MESSAGES = 20;

    /**
     * Max "Add context" refs (findings/automations) accepted per turn.
     */
    private const MAX_CONTEXT_REFS = 5;

    /**
     * Max "Attach" file refs accepted per turn.
     */
    private const MAX_ATTACHMENTS = 3;

    /**
     * How many bytes of an attached file's own content to read and include
     * — bounds the prompt the same way MAX_HISTORY_MESSAGES bounds history,
     * since this is untrusted-length user content going straight into the
     * AI request.
     */
    private const ATTACHMENT_MAX_BYTES = 200000;

    /**
     * Mime types this plugin will actually read the *content* of for an
     * attached file — deliberately just the two WordPress itself allows
     * uploading by default (includes/functions.php's own
     * get_allowed_mime_types() 'txt'/'csv' entries), so "Attach" works out
     * of the box without asking the site owner to first loosen their
     * upload-type allowlist.
     */
    private const ATTACHMENT_TEXT_MIME_TYPES = array( 'text/plain', 'text/csv' );

    /**
     * Image mime types WordPress allows uploading by default — the ones
     * this controller will send as a *real* inline image (AIRequest::get_image())
     * rather than a text block, but only when supports_vision() confirms the
     * provider that will actually answer this turn reads one
     * (GeminiProvider today — see that adapter's own build_body()).
     */
    private const ATTACHMENT_IMAGE_MIME_TYPES = array( 'image/jpeg', 'image/png', 'image/gif', 'image/webp' );

    /**
     * Raw byte cap for an attached image before it's base64-encoded and
     * sent inline — keeps a single chat turn's request body bounded (base64
     * inflates this by ~33%, well under Gemini's own 20MB inline-data
     * request limit).
     */
    private const ATTACHMENT_MAX_IMAGE_BYTES = 4000000;

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

        // RecentConversationsCard.tsx's own list of this admin's recent,
        // real, reloadable conversation threads — see get_conversations().
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/conversations',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_conversations' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );

        // useCopilotChat.ts's own loadConversation() — one thread's real,
        // full, untruncated turns, read back into the composer.
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/conversations/(?P<id>\d+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_conversation' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses, plus
     * the real AI Copilot module check every AI surface now shares (see
     * modules/AiCopilot/Module.php's own docblock) — this is the
     * server-side half; the client-side half is useAiCopilotEnabled().
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool|\WP_Error
     */
    public function create_item_permissions_check( $request ) {
        if ( ! current_user_can( 'manage_options' ) ) {
            return false;
        }

        if ( ! VuloPilot()->modules->is_active( 'ai-copilot' ) ) {
            return new \WP_Error(
                'vulopilot_ai_copilot_inactive',
                __( 'Enable the AI Copilot module to use AI Chat.', 'vulopilot' ),
                array( 'status' => 403 )
            );
        }

        return true;
    }

    /**
     * Sends one real chat turn through the configured AI provider chain,
     * grounded with a live site snapshot, and acts on its decision — either
     * a real content-creation draft (ContentCreationOrchestrator) or a
     * plain grounded reply.
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

        $conversation_id_param = $request->get_param( 'conversation_id' );
        $conversation_id       = $conversation_id_param ? absint( $conversation_id_param ) : null;

        $raw_attachments = (array) $request->get_param( 'attachments' );

        // Only bother resolving a real image if whichever provider will
        // actually answer this turn is one that reads AIRequest::get_image()
        // — build_fallback_chain()'s own get_id() proxies to the first
        // active provider it would try, the same provider SafeRequestSender
        // will pick below. See ProviderRegistry::supports_vision()'s own
        // docblock for why a provider that ignores an image is worse than
        // one that was never sent it.
        $chain                  = VuloPilot()->ai_provider_registry->build_fallback_chain();
        $image                  = null;
        $consumed_attachment_id = null;

        if ( $chain && VuloPilot()->ai_provider_registry->supports_vision( $chain->get_id() ) ) {
            $resolved = $this->resolve_first_image_attachment( $raw_attachments );

            if ( null !== $resolved ) {
                $image                  = $resolved['payload'];
                $consumed_attachment_id = $resolved['attachment_id'];
            }
        }

        $extra_context = $this->build_extra_context(
            (array) $request->get_param( 'context_refs' ),
            $raw_attachments,
            $consumed_attachment_id
        );

        $message_with_context = '' !== $extra_context ? $message . "\n\n" . $extra_context : $message;

        $messages = $this->build_messages( $message_with_context, (array) $request->get_param( 'history' ) );

        try {
            $response = VuloPilot()->ai_request_sender->send( $messages, $image, 'copilot_chat' );
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

        $decision = $this->orchestrator->parse_response( $response );

        if ( 'ready_action' === $decision['status'] ) {
            $result = $this->orchestrator->create_content_and_respond( $decision );

            if ( $result instanceof \WP_Error ) {
                return $result;
            }

            $conversation_id = $this->persist_conversation(
                $conversation_id,
                $message,
                (array) $request->get_param( 'history' ),
                array(
                    'role'    => 'assistant',
                    'content' => $result['content'] ?? '',
                    'link'    => $result['link'] ?? null,
                    'run_id'  => $result['run_id'] ?? null,
                )
            );

            // provider/model null here, same as ContentAssistant.php's own
            // equivalent response: the AI call that actually generated the
            // saved content happened *inside* the AIAction's own execute()
            // (a separate ai_request_sender call), not this orchestrator
            // decision call — attributing $response's own provider/model to
            // the saved content would be misleading.
            return rest_ensure_response(
                array_merge(
                    $result,
                    array(
                        'provider'        => null,
                        'model'           => null,
                        'conversation_id' => $conversation_id,
                    )
                )
            );
        }

        $conversation_id = $this->persist_conversation(
            $conversation_id,
            $message,
            (array) $request->get_param( 'history' ),
            array(
                'role'    => 'assistant',
                'content' => $decision['message'],
                'link'    => null,
                'run_id'  => null,
            )
        );

        return rest_ensure_response(
            array(
                'content'         => $decision['message'],
                'link'            => null,
                'run_id'          => null,
                'provider'        => $response->get_provider(),
                'model'           => $response->get_model(),
                'conversation_id' => $conversation_id,
            )
        );
    }

    /**
     * Saves this turn to a real, reloadable conversation thread
     * (`vulopilot_ai_conversations`) — separate from, and in addition to,
     * `vulopilot_ai_history`'s own automatic excerpt-only audit-trail write
     * (UsageTrackingProvider, untouched by this). Starts a new conversation
     * when `$conversation_id` is null/0 or no longer owned by this user
     * (e.g. a stale/tampered id), otherwise appends to the existing one.
     *
     * @param int|null             $conversation_id Client-supplied existing conversation id, or null for a new one.
     * @param string               $user_message    This turn's real, full user message — never the context-appended version sent to the AI provider.
     * @param array<int, mixed>    $client_history   The client's own prior turns, as sent on `history` — only really populated for a conversation started before this feature existed, or a same-request edge case; a fresh conversation's `client_history` is normally empty.
     * @param array<string, mixed> $assistant_turn   `{role: 'assistant', content, link, run_id}` for this turn's real reply.
     * @return int The conversation id this turn was saved under.
     */
    private function persist_conversation( ?int $conversation_id, string $user_message, array $client_history, array $assistant_turn ): int {
        $repository = new AiConversationRepository();
        $user_id    = get_current_user_id();

        $new_turns = array(
            array(
                'role'    => 'user',
                'content' => $user_message,
            ),
            $assistant_turn,
        );

        if ( $conversation_id ) {
            $existing = $repository->find_full( $conversation_id, $user_id );

            if ( $existing ) {
                $repository->append_turns( $conversation_id, $user_id, array_merge( $existing['turns'], $new_turns ) );

                return $conversation_id;
            }
        }

        return $repository->create( $user_id, $user_message, array_merge( $this->sanitize_client_turns( $client_history ), $new_turns ) );
    }

    /**
     * Same shape/sanitization build_messages() already applies to client-
     * supplied history turns — reused here so a brand-new conversation that
     * somehow already carries client history (see persist_conversation()'s
     * own docblock) never persists an unsanitized/malformed entry.
     *
     * @param array<int, mixed> $raw_history Client-supplied {role, content} turns.
     * @return array<int, array{role: string, content: string}>
     */
    private function sanitize_client_turns( array $raw_history ): array {
        $turns = array();

        foreach ( $raw_history as $entry ) {
            if ( ! is_array( $entry ) || empty( $entry['role'] ) || empty( $entry['content'] ) ) {
                continue;
            }

            $turns[] = array(
                'role'    => 'user' === $entry['role'] ? 'user' : 'assistant',
                'content' => sanitize_textarea_field( (string) $entry['content'] ),
            );
        }

        return $turns;
    }

    /**
     * `GET /copilot/conversations` — RecentConversationsCard.tsx's own list
     * of this admin's most recent real conversation threads.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_conversations( $request ) {
        $per_page = absint( $request->get_param( 'per_page' ) );

        $result = ( new AiConversationRepository() )->get_recent(
            get_current_user_id(),
            $per_page > 0 ? $per_page : 5
        );

        return rest_ensure_response( $result );
    }

    /**
     * `GET /copilot/conversations/{id}` — one thread's real, full,
     * untruncated turns, read back into the composer by useCopilotChat.ts's
     * own loadConversation().
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function get_conversation( $request ) {
        $conversation = ( new AiConversationRepository() )->find_full(
            absint( $request->get_param( 'id' ) ),
            get_current_user_id()
        );

        if ( null === $conversation ) {
            return new \WP_Error(
                'vulopilot_conversation_not_found',
                __( 'Conversation not found.', 'vulopilot' ),
                array( 'status' => 404 )
            );
        }

        return rest_ensure_response( $conversation );
    }

    /**
     * Builds a real chat-style prompt: a system message describing the
     * copilot's role, its one real execution capability (content creation,
     * via ContentCreationOrchestrator — kept in sync with that class's own
     * CONTENT_CREATION_ACTIONS by hand, the same way ContentAssistant.php's
     * own prompt already had to be), and a live site snapshot, then the
     * client's own recent turns, then the new user message. Instructed to
     * respond with strict JSON only — the same 3-shape contract
     * ContentAssistant.php's own orchestrator prompt uses, extended here
     * with a "respond" case that also covers ordinary grounded Q&A (using
     * the site snapshot), not just "content I can't save."
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
                    'You are VuloPilot, an AI website copilot embedded in the WordPress plugin VuloPilot, helping the owner of the site "%1$s". You help with SEO, performance, security, accessibility, GEO/AI-search visibility, WooCommerce store health, and automations.

You can directly create 3 specific kinds of real WordPress content — everything else you help with is advice only, since no AI action-trigger engine exists for anything beyond these 3. For each, collect the fields in order — a field listed after the first one does NOT mean it\'s skippable; ask about each one, one at a time, unless the user already stated it somewhere in the conversation:
1. "generate-blog" — a blog post or article. Collect, in order: topic (what it\'s about), word_count (target word count), tone (e.g. Professional/Friendly/Informative/Casual).
2. "generate-landing-page" — a landing page. Collect, in order: topic (what the page is promoting/for), tone.
3. "generate-product-description" — a product description. Collect, in order: product_name, key_features (a short list of what makes it worth buying), tone.

Rules for content creation:
- Ask for exactly ONE missing field at a time, as a short natural question, following the collection order above. Never ask about a field already given anywhere earlier in this conversation. Never ask more than 3 questions total for one request.
- If the user changed their mind about something, use their latest answer, not an earlier one.
- A field can be given implicitly inside natural phrasing, not just as an explicit "field: value" statement — e.g. "a casual blog post about X" already gives both topic and tone; "500 words" gives word_count. Recognize these the same as an explicit answer, and don\'t ask about them again.
- If a message already gives multiple fields at once, or a fully-specified first message gives everything needed, only ask about whatever is still actually missing — or proceed straight to ready_action if nothing is missing.

Worked example for "generate-blog" (the same collect-one-at-a-time pattern applies to the other 2 kinds):
User: "Write a blog" → {"status":"question","message":"Sure! What should the blog be about?"}
User: "AI in eCommerce" → {"status":"question","message":"Great — how many words would you like?"}
User: "1500 words" → {"status":"question","message":"What tone would you prefer? For example: Professional, Friendly, Informative, or Casual."}
User: "Professional" → {"status":"ready_action","action_id":"generate-blog","input":{"topic":"AI in eCommerce","word_count":1500,"tone":"Professional"}}

For anything that is NOT one of those 3 content kinds — a general question, SEO/performance/security/accessibility/GEO/WooCommerce/automation advice, editing something that already exists, or any other kind of written content — answer using the real site snapshot below when relevant, and point the user to the specific tab (Issues, Performance, Security, GEO, WooCommerce, Automations) where they can review or fix something themselves. You cannot execute any change on the site yourself beyond the 3 content-creation kinds above — say so plainly if asked to perform some other action, rather than claiming to have done it. Reply in plain text or Markdown, never HTML.

Respond with ONLY raw JSON, no markdown fences, no commentary, in exactly one of these shapes:
{"status":"question","message":"<the single next question, phrased naturally>"}
{"status":"ready_action","action_id":"generate-blog"|"generate-landing-page"|"generate-product-description","input":{...only the fields listed above for that action_id...}}
{"status":"respond","message":"<a direct answer, or other written content the user still has to copy/paste themselves>"}%2$s',
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
     * Resolves the user's "Add context" picks and "Attach" file picks into
     * one real text block, appended to the outgoing user message (not the
     * always-on system-prompt site snapshot build_site_context() already
     * provides) — this is per-turn, user-chosen grounding, not a permanent
     * site-wide fact. Everything is re-resolved from the database/media
     * library here rather than trusting any label, count, or content the
     * client already had cached, same "never trust client-supplied facts"
     * posture the rest of this codebase's AI-grounding code already takes.
     *
     * @param array<int, mixed> $raw_context_refs           Client-supplied {type, scanner_id|id} refs, from the "Add context" picker.
     * @param array<int, mixed> $raw_attachments            Client-supplied {id} WP attachment refs, from the "Attach" file picker.
     * @param int|null          $consumed_image_attachment_id An attachment id already sent as a real inline image (create_item()'s own resolve_first_image_attachment()) — excluded from the text block here since it doesn't need a "can't be read as text" note, the provider is actually seeing it.
     * @return string Empty string if nothing in either list resolved to something real.
     */
    private function build_extra_context( array $raw_context_refs, array $raw_attachments, ?int $consumed_image_attachment_id = null ): string {
        $blocks = array_filter(
            array(
                $this->build_context_refs_block( $raw_context_refs ),
                $this->build_attachments_block( $raw_attachments, $consumed_image_attachment_id ),
            ),
            static fn( $block ) => '' !== $block
        );

        if ( ! $blocks ) {
            return '';
        }

        return "[Context the user attached to this message:]\n" . implode( "\n\n", $blocks );
    }

    /**
     * Resolves "Add context" refs — a user-picked open finding group
     * (grouped by scanner_id, same unit NeedsAttentionCard.tsx's own list
     * already shows) or automation — into real, current one-line summaries.
     *
     * @param array<int, mixed> $raw_refs Client-supplied {type: 'finding_group'|'automations', scanner_id?, id?} entries.
     * @return string Empty string if none resolved.
     */
    private function build_context_refs_block( array $raw_refs ): string {
        $findings    = new FindingRepository();
        $automations = new AutomationsRepository();
        $lines       = array();

        foreach ( array_slice( $raw_refs, 0, self::MAX_CONTEXT_REFS ) as $ref ) {
            if ( ! is_array( $ref ) ) {
                continue;
            }

            $type = sanitize_key( (string) ( $ref['type'] ?? '' ) );

            if ( 'finding_group' === $type ) {
                $scanner_id = sanitize_key( (string) ( $ref['scanner_id'] ?? '' ) );
                $group      = '' !== $scanner_id ? $findings->get_group_by_scanner_id( $scanner_id ) : null;

                if ( null === $group ) {
                    continue;
                }

                $scanner = VuloPilot()->scanner_registry->get_scanner( $scanner_id );
                $label   = $scanner ? $scanner->get_label() : $scanner_id;

                $lines[] = sprintf(
                    /* translators: 1: scanner label, 2: category, 3: open finding count, 4: severity */
                    __( '- Finding group "%1$s" (%2$s): %3$d open, severity %4$s.', 'vulopilot' ),
                    $label,
                    $group['category'],
                    $group['count'],
                    $group['severity']
                );
            } elseif ( 'automations' === $type ) {
                $automation_id = absint( $ref['id'] ?? 0 );
                $automation    = 0 !== $automation_id ? $automations->find( $automation_id ) : null;

                if ( null === $automation ) {
                    continue;
                }

                $lines[] = sprintf(
                    /* translators: 1: automation name, 2: status (enabled/disabled), 3: trigger type */
                    __( '- Automation "%1$s": %2$s, trigger %3$s.', 'vulopilot' ),
                    $automation['name'],
                    $automation['status'],
                    $automation['trigger_type']
                );
            }
        }

        return $lines ? implode( "\n", $lines ) : '';
    }

    /**
     * Resolves "Attach" file refs — real WP Media Library attachment ids
     * (zyra FileInput's wp.media() picker in ChatTab.tsx only ever hands
     * back a real {id, url}, never a client-only blob preview; see that
     * component's own onChange contract) — into real content blocks.
     * ATTACHMENT_TEXT_MIME_TYPES are read as text; an image already
     * resolved as a real inline AIRequest::get_image() payload
     * ($consumed_image_attachment_id, from create_item()'s own
     * resolve_first_image_attachment()) is skipped here entirely — the
     * provider is genuinely seeing it, it doesn't need a text note too.
     * Anything else (an unsupported type, or an image beyond the one this
     * turn could actually send — see resolve_first_image_attachment()'s
     * own "first match only" behavior, or the active provider not
     * supporting vision at all) gets an honest "can't be read" note
     * instead of silently doing nothing with it.
     *
     * @param array<int, mixed> $raw_attachments              Client-supplied {id} entries.
     * @param int|null          $consumed_image_attachment_id Attachment id already sent as a real inline image, skipped here.
     * @return string Empty string if none resolved.
     */
    private function build_attachments_block( array $raw_attachments, ?int $consumed_image_attachment_id = null ): string {
        $blocks = array();

        foreach ( array_slice( $raw_attachments, 0, self::MAX_ATTACHMENTS ) as $attachment ) {
            if ( ! is_array( $attachment ) ) {
                continue;
            }

            $attachment_id = absint( $attachment['id'] ?? 0 );

            if ( 0 === $attachment_id || 'attachment' !== get_post_type( $attachment_id ) ) {
                continue;
            }

            if ( $attachment_id === $consumed_image_attachment_id ) {
                continue;
            }

            $path     = get_attached_file( $attachment_id );
            $filename = $path ? wp_basename( $path ) : sprintf( 'attachment-%d', $attachment_id );
            $mime     = (string) get_post_mime_type( $attachment_id );

            if ( ! in_array( $mime, self::ATTACHMENT_TEXT_MIME_TYPES, true ) ) {
                $blocks[] = sprintf(
                    /* translators: 1: original filename, 2: mime type */
                    __( '- Attached file "%1$s" (%2$s) — its content can\'t be read, only the filename is available.', 'vulopilot' ),
                    $filename,
                    $mime
                );
                continue;
            }

            $contents = ( $path && is_readable( $path ) )
                ? file_get_contents( $path, false, null, 0, self::ATTACHMENT_MAX_BYTES ) // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading a local Media Library file this same admin already uploaded (via wp.media()), not a remote URL or arbitrary user-supplied path; WP_Filesystem's FTP-credential fallback isn't warranted for a bounded local read.
                : false;

            if ( false === $contents ) {
                $blocks[] = sprintf(
                    /* translators: 1: original filename, 2: mime type */
                    __( '- Attached file "%1$s" (%2$s) — could not be read.', 'vulopilot' ),
                    $filename,
                    $mime
                );
                continue;
            }

            $contents  = sanitize_textarea_field( $contents );
            $truncated = strlen( $contents ) >= self::ATTACHMENT_MAX_BYTES ? "\n[...truncated]" : '';

            $blocks[] = sprintf(
                /* translators: 1: original filename, 2: mime type, 3: the file's own text content, 4: truncation note or empty string */
                __( "- Attached file \"%1\$s\" (%2\$s):\n%3\$s%4\$s", 'vulopilot' ),
                $filename,
                $mime,
                $contents,
                $truncated
            );
        }

        return $blocks ? implode( "\n\n", $blocks ) : '';
    }

    /**
     * Finds the first "Attach" ref that's a real, readable
     * ATTACHMENT_IMAGE_MIME_TYPES attachment under ATTACHMENT_MAX_IMAGE_BYTES,
     * and reads its real bytes — only called from create_item() after
     * confirming the provider that will actually answer this turn supports
     * vision (ProviderRegistry::supports_vision()). Only the first match is
     * used: AIRequest carries one image per turn (see its own docblock for
     * why), matching the concrete "attach one picture, ask about it" use
     * case this exists for rather than adding multi-image complexity no
     * caller needs yet.
     *
     * @param array<int, mixed> $raw_attachments Client-supplied {id} entries.
     * @return array{attachment_id: int, payload: array{mime_type: string, data: string}}|null
     */
    private function resolve_first_image_attachment( array $raw_attachments ): ?array {
        foreach ( array_slice( $raw_attachments, 0, self::MAX_ATTACHMENTS ) as $attachment ) {
            if ( ! is_array( $attachment ) ) {
                continue;
            }

            $attachment_id = absint( $attachment['id'] ?? 0 );

            if ( 0 === $attachment_id || 'attachment' !== get_post_type( $attachment_id ) ) {
                continue;
            }

            $mime = (string) get_post_mime_type( $attachment_id );

            if ( ! in_array( $mime, self::ATTACHMENT_IMAGE_MIME_TYPES, true ) ) {
                continue;
            }

            $path = get_attached_file( $attachment_id );

            if ( ! $path || ! is_readable( $path ) || filesize( $path ) > self::ATTACHMENT_MAX_IMAGE_BYTES ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_read_filesize -- checking the size of a local Media Library file this same admin already uploaded, not an arbitrary path.
                continue;
            }

            $contents = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading a local Media Library file this same admin already uploaded (via wp.media()), not a remote URL or arbitrary user-supplied path; WP_Filesystem's FTP-credential fallback isn't warranted for a bounded local read.

            if ( false === $contents ) {
                continue;
            }

            return array(
                'attachment_id' => $attachment_id,
                'payload'       => array(
                    'mime_type' => $mime,
                    'data'      => base64_encode( $contents ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- encoding real binary image bytes for Gemini's own documented inline_data request field (GeminiProvider::build_body()), not obfuscating anything.
                ),
            );
        }

        return null;
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
        $automations = new AutomationsRepository();
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
