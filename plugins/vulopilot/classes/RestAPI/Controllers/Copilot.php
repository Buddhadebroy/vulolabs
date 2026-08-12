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
            $response = VuloPilot()->ai_request_sender->send( $messages, $image );
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
     * @param array<int, mixed> $raw_refs Client-supplied {type: 'finding_group'|'automation', scanner_id?, id?} entries.
     * @return string Empty string if none resolved.
     */
    private function build_context_refs_block( array $raw_refs ): string {
        $findings    = new FindingRepository();
        $automations = new AutomationRepository();
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
            } elseif ( 'automation' === $type ) {
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
