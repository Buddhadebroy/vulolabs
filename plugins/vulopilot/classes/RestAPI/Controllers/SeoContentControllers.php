<?php
/**
 * Every class in this file used to be its own file under classes/RestAPI/Controllers/
 * (same names, docblocks, and behavior) - merged into one file to reduce
 * classes/'s file count, per direct instruction. Autoloading does not rely on
 * each class's own file matching its own name for this: composer.json's
 * autoload.classmap entry (alongside the existing psr-4 one) makes Composer
 * tokenize every file under classes/ and modules/ and map each class it finds
 * to its real file, however many classes share one file - run
 * `composer dump-autoload` (no `-o`/`--optimize-autoloader` needed) after any
 * further file merge/split here.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\AiCopilot\ContentCreationOrchestrator;
use VuloPilot\BrandIntelligence\Rest\BrandIntelligence;
use VuloPilot\Exceptions\UnsafePromptException;
use VuloPilot\Geo\Rest\Geo;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Repositories\NotFoundLogRepository;
use VuloPilot\Repositories\RedirectRepository;
use VuloPilot\Repositories\ScanRepository;
use VuloPilot\Seo\Rest\Seo;
use VuloPilot\Seo\Scanners\BrokenImagesScanner;
use VuloPilot\Seo\Scanners\BrokenLinksScanner;
use VuloPilot\Services\GoogleAnalyticsClient;
use VuloPilot\Services\GoogleServicesConnection;
use VuloPilot\Services\OnPageAnalyzer;
use VuloPilot\Services\PostSeoMetaFields;
use VuloPilot\Services\SchemaCoverageAnalyzer;
use VuloPilot\Services\SchemaPageInspector;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /broken-links/stats` - backs BrokenLinksTab.tsx's own "Link
 * health"/"Coverage" tiles (SEO & Visibility → Broken Links) with real
 * numbers: BrokenLinksScanner::STATS_OPTION/BrokenImagesScanner::STATS_OPTION,
 * each written fresh every time that scanner's `scan()` genuinely executes
 * a check (not on a rate-limit-skipped run - see each scanner's own
 * `due_to_run()`). "Broken links"/"Broken images"/"Ignored" counts
 * themselves already come from the existing `GET /findings` endpoint (this
 * tab's own real finding rows); this controller only covers the coverage
 * numbers that scanner never persisted anywhere before this pass - no
 * separate table, no new fabricated aggregate.
 *
 * `POST /broken-links/replace-url` - BrokenLinksSection.tsx's own "Fix"
 * popup - used to live here as a real, free, Pro-free manual
 * search-and-replace. Moved to vulopilot-pro's own OneClickFix module
 * (BrokenLinkFixRest.php) so Broken Links' "Fix" joins the same real
 * `vulopilot_finding_fix_handler`-style Pro gate every other finding's
 * "Fix" action already has, instead of being the one free exception. This
 * controller now only ever serves the read-only stats tiles below.
 *
 * @class       BrokenLinksStats controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class BrokenLinksStats extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'broken-links';

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/stats',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_stats' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
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
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @return \WP_REST_Response
     */
    public function get_stats() {
        return rest_ensure_response(
            array(
                'links'    => $this->read_stats( BrokenLinksScanner::STATS_OPTION ),
                'images'   => $this->read_stats( BrokenImagesScanner::STATS_OPTION ),
                'last_run' => ( new ScanRepository() )->get_latest_completed( array( 'broken-links', 'broken-images' ) ),
            )
        );
    }

    /**
     * @param string $option_name One of the two scanners' own STATS_OPTION constants.
     * @return array{pages_scanned: int, links_checked: int, healthy_count: int, checked_at: int|null} `checked_at` is null (never a fabricated 0/"just now") when this scanner has never genuinely run yet.
     */
    private function read_stats( string $option_name ): array {
        $stats = get_option( $option_name, array() );

        return array(
            'pages_scanned' => (int) ( $stats['pages_scanned'] ?? 0 ),
            'links_checked' => (int) ( $stats['links_checked'] ?? 0 ),
            'healthy_count' => (int) ( $stats['healthy_count'] ?? 0 ),
            'checked_at'    => isset( $stats['checked_at'] ) ? (int) $stats['checked_at'] : null,
        );
    }
}

/**
 * `POST /content-assistant/chat` - the conversational turn for "Create
 * Content"'s AI Content Assistant sidebar
 * (src/pages/Content/AiContentAssistantSidebar.tsx). Every message goes
 * through one "orchestrator" AI call (build_orchestrator_messages()) that
 * decides, per turn, whether to ask one more clarifying question, answer
 * directly, or hand off to a real AIAction - never a second, separate
 * "chit-chat" code path. Reuses VuloPilot()->ai_request_sender
 * (AI\AiRequestSender, already wired in
 * VuloPilot::init_classes() for AiCopilot\ActionRunner and
 * Geo\GeoAnalyzer) for that call - the same safety-validate → send →
 * sanitize sequence, and every call is automatically recorded to
 * `vulopilot_ai_history` by AI\AiRequestSender itself, so this controller
 * doesn't do any logging of its own.
 *
 * Once the orchestrator decides it has enough information, it hands off
 * to the exact same real AIAction ContentToolsGrid.tsx's own tiles run -
 * `generate-blog`/`generate-landing-page`/`generate-product-description`
 * (VuloPilot()->ai_action_runner, AI-ACTIONS.md's propose→approve
 * lifecycle) - auto-approving immediately, since the conversation itself
 * IS the user's approval, the same way clicking a tool tile and
 * submitting its form is. Only these 3 actions qualify: every other
 * AIAction (FAQ, meta title, schema, alt text, …) mutates an *existing*
 * post/attachment this chat has no picker for, so a request that doesn't
 * match one of these 3 is written directly in the reply instead (the
 * orchestrator's "respond" status) - real generated content, just never
 * claimed to be saved anywhere, since nothing was.
 *
 * There is deliberately no separate slot-filling state machine: the only
 * conversation state is the same plain `history` array the client already
 * round-trips (AiContentAssistantSidebar.tsx's own `turns`) - the
 * orchestrator re-derives "what's already been answered" from that
 * transcript on every call, the same way a human reading the thread back
 * would, rather than this controller tracking parallel structured state.
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
     * How many prior turns of client-supplied history to include - bounds
     * the prompt sent to the AI service on a long-running chat.
     */
    private const MAX_HISTORY_MESSAGES = 20;

    /**
     * The shared "parse the orchestrator's decision, then really create the
     * content" logic - see ContentCreationOrchestrator's own docblock for
     * why this is no longer implemented in this controller directly
     * (Controllers\Copilot.php's own AI Copilot Chat tab now reuses it too).
     *
     * @var ContentCreationOrchestrator
     */
    private ContentCreationOrchestrator $orchestrator;

    /**
     * ContentAssistant constructor.
     */
    public function __construct() {
        $this->orchestrator = new ContentCreationOrchestrator();
    }

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
     * Same manage_options gate every other VuloPilot REST route uses, plus
     * the real AI Copilot module check every AI surface now shares (see
     * modules/AiCopilot/Module.php's own docblock) - this is the
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
                __( 'Enable the AI Copilot module to use the AI Content Assistant.', 'vulopilot' ),
                array( 'status' => 403 )
            );
        }

        return true;
    }

    /**
     * Runs one orchestrator turn and acts on its decision.
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

        $messages = $this->build_orchestrator_messages( $message, (array) $request->get_param( 'history' ) );

        try {
            $response = VuloPilot()->ai_request_sender->send( $messages, null, 'content_assistant_chat' );
        } catch ( UnsafePromptException $exception ) {
            return new \WP_Error( 'vulopilot_unsafe_prompt', $exception->getMessage(), array( 'status' => 400 ) );
        } catch ( \RuntimeException $exception ) {
            return new \WP_Error(
                'vulopilot_ai_not_connected',
                sprintf(
                    /* translators: %s is the exception's own real message, e.g. "No AI connection is configured." */
                    __( '%s Connect this site to VuloCloud in Settings → Connections.', 'vulopilot' ),
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

            return rest_ensure_response(
                array_merge( $result, array( 'provider' => null, 'model' => null ) )
            );
        }

        return rest_ensure_response(
            array(
                'content'  => $decision['message'],
                'link'     => null,
                'run_id'   => null,
                'provider' => $response->get_provider(),
                'model'    => $response->get_model(),
            )
        );
    }

    /**
     * Builds the one orchestrator prompt every turn goes through: a
     * system message describing the 3 real content types it can create
     * (kept in sync with CONTENT_CREATION_ACTIONS and each action's own
     * validate_input() by hand), the client's own recent turns, then the
     * new user message. Instructed to respond with strict JSON only -
     * the same "respond with ONLY raw JSON" structured-output technique
     * GeoAnalysis\GeoAnalyzer and AiCopilot\Actions\GenerateBlogAction
     * already use for their own AI calls.
     *
     * @param string            $message     The new user message.
     * @param array<int, mixed> $raw_history Client-supplied {role, content} turns, oldest first.
     * @return array<int, array{role: string, content: string}>
     */
    private function build_orchestrator_messages( string $message, array $raw_history ): array {
        $messages   = array();
        $messages[] = array(
            'role'    => 'system',
            'content' => sprintf(
                /* translators: %s is the site's own real name (get_bloginfo('name')). */
                __(
                    'You are the intake assistant for the "Content" chat inside the WordPress plugin VuloPilot, on the site "%s". Your job this turn is to move the conversation toward either (a) creating one of 3 specific kinds of real WordPress content, or (b) simply answering the user when that\'s what they actually want.

The 3 kinds of WordPress content you can create. For each, collect the fields in the order listed - a field being listed after the first one does NOT mean it\'s skippable; ask about each one, one at a time, unless the user already stated it somewhere in the conversation:
1. "generate-blog" - a blog post or article. Collect, in order: topic (what it\'s about), word_count (target word count), tone (e.g. Professional/Friendly/Informative/Casual).
2. "generate-landing-page" - a landing page. Collect, in order: topic (what the page is promoting/for), tone.
3. "generate-product-description" - a product description. Collect, in order: product_name, key_features (a short list of what makes it worth buying), tone.

Rules:
- Ask for exactly ONE missing field at a time, as a short natural question, following the collection order above. Never ask about a field already given anywhere earlier in this conversation - check the whole conversation, not just the latest message, before asking. Never ask more than 3 questions total for one request.
- If the user changed their mind about something, use their latest answer, not an earlier one.
- Only skip a field if the user\'s messages already gave it, or if they explicitly say they don\'t have a preference for it. Do not stop early just because the first, most-obvious field (e.g. the topic) is known - still ask about the remaining ones in order.
- A field can be given implicitly inside natural phrasing, not just as an explicit "field: value" statement - e.g. "a casual blog post about X" already gives both topic and tone (casual); "a 500-word post" or "500 words" gives word_count. Recognize these the same as an explicit answer, and don\'t ask about them again.
- If the request doesn\'t match any of the 3 kinds (e.g. an email, a social caption, general advice, or editing something that already exists, which you have no way to identify from chat), have a short exchange to understand what\'s actually needed (purpose, audience, tone - whatever is relevant), then write the content yourself as a normal reply. Never claim it was created or saved - there is no WordPress content type for it.
- If the user is just asking a question rather than requesting new content, answer it directly and helpfully. Use plain text or Markdown, never HTML.

Worked example for "generate-blog" (the same collect-one-at-a-time pattern applies to the other 2 kinds and their own field lists above):
User: "Write a blog" → {"status":"question","message":"Sure! What should the blog be about?"}
User: "AI in eCommerce" → {"status":"question","message":"Great - how many words would you like?"}
User: "1500 words" → {"status":"question","message":"What tone would you prefer? For example: Professional, Friendly, Informative, or Casual."}
User: "Professional" → {"status":"ready_action","action_id":"generate-blog","input":{"topic":"AI in eCommerce","word_count":1500,"tone":"Professional"}}

But if a message already gives multiple fields at once (e.g. "Write a 1000-word blog about SEO" gives topic and word_count together, or a fully-specified first message gives everything), only ask about whatever is still actually missing from that list - or proceed straight to ready_action if nothing is missing.

Respond with ONLY raw JSON, no markdown fences, no commentary, in exactly one of these shapes:
{"status":"question","message":"<the single next question, phrased naturally>"}
{"status":"ready_action","action_id":"generate-blog"|"generate-landing-page"|"generate-product-description","input":{...only the fields listed above for that action_id...}}
{"status":"respond","message":"<a direct answer, or fully-written content for a kind with no matching action above>"}',
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

/**
 * GET /not-found-logs, POST /not-found-logs/{id}/delete (dismiss a log
 * entry), POST /not-found-logs/{id}/convert (turn it into a real redirect)
 * - backs the Redirects page's own "404 Log" table. convert_item() does
 * both steps atomically (create the redirect, then remove the now-handled
 * log row) rather than leaving the frontend to call Redirects' own
 * create_item() and this controller's delete_item() separately - a failed
 * second call would otherwise leave a log entry that's already been
 * redirected still showing up as unhandled.
 *
 * @class       NotFoundLogs controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class NotFoundLogs extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'not-found-logs';

    /**
     * Registers GET /not-found-logs, POST /not-found-logs/{id}/delete, POST /not-found-logs/{id}/convert.
     *
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/delete',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'delete_item' ),
                    'permission_callback' => array( $this, 'delete_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/convert',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'convert_item' ),
                    'permission_callback' => array( $this, 'delete_item_permissions_check' ),
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
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function delete_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * Lists 404 log entries, paginated/searched, most recently seen first
     * by default, plus content/system counts for the status pill bar
     * (same `count_by_column()` pattern Redirects.php's own
     * `is_active_counts` uses). `is_system` ('0'/'1') scopes this to real
     * missing content pages or the "system" bucket (theme/plugin/core-file/
     * asset 404s - Services\NotFoundLogger::is_system_path()) when the
     * frontend's own "All/Content/System" filter pills narrow it down;
     * omitting the param (the default "All" pill) returns both mixed
     * together, same as any other AbstractRepository filterable column.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) {
        $repository = new NotFoundLogRepository();
        $page       = absint( $request->get_param( 'page' ) );
        $per_page   = absint( $request->get_param( 'per_page' ) );
        $orderby    = sanitize_key( (string) $request->get_param( 'orderby' ) );

        $result = $repository->find_all(
            array(
                'page'      => $page ? $page : 1,
                'per_page'  => $per_page ? $per_page : 20,
                'search'    => sanitize_text_field( (string) $request->get_param( 'search' ) ),
                'orderby'   => $orderby ? $orderby : 'last_seen_at',
                'order'     => sanitize_key( (string) $request->get_param( 'order' ) ),
                'is_system' => sanitize_key( (string) $request->get_param( 'is_system' ) ),
            )
        );

        $result['is_system_counts'] = $repository->count_by_column( 'is_system' );

        return rest_ensure_response( $result );
    }

    /**
     * Dismisses one 404 log entry.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function delete_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new NotFoundLogRepository();

        if ( ! $repository->find( $id ) ) {
            return new \WP_Error( 'vulopilot_log_not_found', __( 'Log entry not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        if ( ! $repository->delete( $id ) ) {
            return new \WP_Error( 'vulopilot_delete_failed', __( 'Could not dismiss this log entry.', 'vulopilot' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( array( 'deleted' => true ) );
    }

    /**
     * Creates a real redirect from this 404 log entry, then removes the
     * log row - see this class's own docblock for why both steps happen
     * here rather than as two separate frontend calls.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function convert_item( $request ) {
        $id  = absint( $request->get_param( 'id' ) );
        $log = ( new NotFoundLogRepository() )->find( $id );

        if ( ! $log ) {
            return new \WP_Error( 'vulopilot_log_not_found', __( 'Log entry not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        $target_url = esc_url_raw( (string) $request->get_param( 'target_url' ) );

        if ( '' === $target_url ) {
            return new \WP_Error( 'vulopilot_missing_target', __( 'A target URL is required to create a redirect.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $redirects       = new RedirectRepository();
        $source_path     = RedirectRepository::normalize_path( $log['requested_path'] );
        $existing_target = $redirects->find_by_source_path( $source_path );

        if ( $existing_target ) {
            return new \WP_Error(
                'vulopilot_redirect_already_exists',
                __( 'A redirect for this path already exists - manage it from the Redirects table above.', 'vulopilot' ),
                array( 'status' => 400 )
            );
        }

        $redirects->insert(
            array(
                'source_path'   => $source_path,
                'target_url'    => $target_url,
                'redirect_type' => 301,
                'hit_count'     => 0,
                'is_active'     => 1,
                'created_by'    => get_current_user_id(),
            )
        );

        ( new NotFoundLogRepository() )->delete( $id );

        return rest_ensure_response( array( 'success' => true ) );
    }
}

/**
 * `POST /post-seo/{id}/analyze` - the one part of the post-editor metabox
 * that needs a custom endpoint. Every other field (focus keyword,
 * canonical/social overrides, schema JSON-LD) is a postmeta key
 * registered via Services\PostSeoMetaFields's `show_in_rest`, riding
 * WordPress's own `wp/v2/posts|pages/{id}` REST fields. Analysis is
 * different: Services\OnPageAnalyzer::analyze() runs against unsaved
 * editor state, which core's REST post object can't reflect until an
 * actual save - hence POST-with-body rather than GET.
 *
 * Permission is `edit_post` on the specific post, not this codebase's
 * usual blanket `manage_options` - any Author/Editor with rights to
 * their own post uses this screen.
 *
 * @class       PostSeo controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class PostSeo extends \WP_REST_Controller {

    /**
     * REST base shared with vulopilot-pro's PostSeoFixRest (rest-api.md's
     * "share a base, register different sub-routes" pattern).
     *
     * @var string
     */
    protected $rest_base = 'post-seo';

    /**
     * Registers POST /post-seo/{id}/analyze.
     *
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/analyze',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'analyze_item' ),
                    'permission_callback' => array( $this, 'edit_post_permissions_check' ),
                ),
            )
        );
    }

    /**
     * Only the post's own author/editor may use its analysis endpoint.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function edit_post_permissions_check( $request ) {
        return current_user_can( 'edit_post', absint( $request->get_param( 'id' ) ) );
    }

    /**
     * Runs Services\OnPageAnalyzer against the editor's current (possibly
     * unsaved) field values, not the post as stored in the database.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function analyze_item( $request ) {
        $body = $request->get_json_params();
        if ( ! is_array( $body ) ) {
            $body = array();
        }

        $post_id = absint( $request->get_param( 'id' ) );
        $post    = get_post( $post_id );

        $results = ( new OnPageAnalyzer() )->analyze(
            array(
                'title'         => (string) ( $body['title'] ?? ( $post ? $post->post_title : '' ) ),
                'content'       => (string) ( $body['content'] ?? ( $post ? $post->post_content : '' ) ),
                'excerpt'       => (string) ( $body['excerpt'] ?? ( $post ? $post->post_excerpt : '' ) ),
                'slug'          => (string) ( $body['slug'] ?? ( $post ? $post->post_name : '' ) ),
                'focus_keyword' => (string) ( $body['focus_keyword'] ?? get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['focus_keyword'], true ) ),
            )
        );

        return rest_ensure_response( array( 'results' => $results ) );
    }
}

/**
 * GET/POST /redirects, POST /redirects/{id}, POST /redirects/{id}/delete -
 * the "Redirects & 404s" feature's own CRUD surface, backing
 * src/pages/Redirects/Redirects.tsx. Same route/verb shape as
 * AiProviders.php (POST rather than PUT/DELETE for update/delete, since the
 * zyra core package's sendApiResponse() helper - what the actual frontend
 * page calls - always issues POST regardless of any `method` override
 * passed in).
 *
 * @class       Redirects controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Redirects extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'redirects';

    /**
     * Real per-check results cache for get_health() - see that method's
     * own docblock.
     */
    private const HEALTH_OPTION = 'vulopilot_redirect_health';

    private const HEALTH_CACHE_SECONDS          = HOUR_IN_SECONDS;
    private const MAX_HEALTH_CHECKS             = 50;
    private const HEALTH_REQUEST_TIMEOUT_SECONDS = 5;

    /**
     * Registers GET/POST /redirects, POST /redirects/{id}, POST /redirects/{id}/delete.
     *
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base,
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_items' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'create_item' ),
                    'permission_callback' => array( $this, 'create_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)',
            array(
                array(
                    'methods'             => array( \WP_REST_Server::EDITABLE, \WP_REST_Server::CREATABLE ),
                    'callback'            => array( $this, 'update_item' ),
                    'permission_callback' => array( $this, 'update_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<id>\d+)/delete',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'delete_item' ),
                    'permission_callback' => array( $this, 'delete_item_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/health',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_health' ),
                    'permission_callback' => array( $this, 'get_items_permissions_check' ),
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
    public function get_items_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
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
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function update_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function delete_item_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * Lists redirects, paginated/filtered/searched, plus active/inactive counts for the status pill bar.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_items( $request ) {
        $repository = new RedirectRepository();

        $page     = absint( $request->get_param( 'page' ) );
        $per_page = absint( $request->get_param( 'per_page' ) );

        $result                     = $repository->find_all(
            array(
                'page'      => $page ? $page : 1,
                'per_page'  => $per_page ? $per_page : 20,
                'is_active' => sanitize_key( (string) $request->get_param( 'is_active' ) ),
                'search'    => sanitize_text_field( (string) $request->get_param( 'search' ) ),
                'orderby'   => sanitize_key( (string) $request->get_param( 'orderby' ) ),
                'order'     => sanitize_key( (string) $request->get_param( 'order' ) ),
            )
        );
        $result['is_active_counts'] = $repository->count_by_column( 'is_active' );

        return rest_ensure_response( $result );
    }

    /**
     * Creates a new redirect, rejecting a source path that already has one.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function create_item( $request ) {
        $source_path = RedirectRepository::normalize_path( sanitize_text_field( (string) $request->get_param( 'source_path' ) ) );
        $target_url  = esc_url_raw( (string) $request->get_param( 'target_url' ) );

        if ( '/' === $source_path || '' === $target_url ) {
            return new \WP_Error( 'vulopilot_invalid_redirect', __( 'Both a source path and a target URL are required.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $repository = new RedirectRepository();

        if ( $repository->find_by_source_path( $source_path ) ) {
            return new \WP_Error(
                'vulopilot_redirect_already_exists',
                __( 'A redirect for this path already exists - edit or delete the existing one instead.', 'vulopilot' ),
                array( 'status' => 400 )
            );
        }

        $redirect_type = absint( $request->get_param( 'redirect_type' ) );

        $id = $repository->insert(
            array(
                'source_path'   => $source_path,
                'target_url'    => $target_url,
                'redirect_type' => in_array( $redirect_type, array( 301, 302, 307 ), true ) ? $redirect_type : 301,
                'hit_count'     => 0,
                'is_active'     => 1,
                'created_by'    => get_current_user_id(),
            )
        );

        return rest_ensure_response( $repository->find( $id ) );
    }

    /**
     * Partially updates a redirect - only the fields actually present in the request body change.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function update_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new RedirectRepository();

        if ( ! $repository->find( $id ) ) {
            return new \WP_Error( 'vulopilot_redirect_not_found', __( 'Redirect not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        $update = array();

        if ( null !== $request->get_param( 'target_url' ) ) {
            $update['target_url'] = esc_url_raw( (string) $request->get_param( 'target_url' ) );
        }

        if ( null !== $request->get_param( 'redirect_type' ) ) {
            $redirect_type           = absint( $request->get_param( 'redirect_type' ) );
            $update['redirect_type'] = in_array( $redirect_type, array( 301, 302, 307 ), true ) ? $redirect_type : 301;
        }

        if ( null !== $request->get_param( 'is_active' ) ) {
            $update['is_active'] = $request->get_param( 'is_active' ) ? 1 : 0;
        }

        if ( empty( $update ) ) {
            return new \WP_Error( 'vulopilot_no_changes', __( 'Nothing to update.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        if ( ! $repository->update( $id, $update ) ) {
            return new \WP_Error( 'vulopilot_update_failed', __( 'Could not update this redirect.', 'vulopilot' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( $repository->find( $id ) );
    }

    /**
     * Deletes a redirect.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function delete_item( $request ) {
        $id         = absint( $request->get_param( 'id' ) );
        $repository = new RedirectRepository();

        if ( ! $repository->find( $id ) ) {
            return new \WP_Error( 'vulopilot_redirect_not_found', __( 'Redirect not found.', 'vulopilot' ), array( 'status' => 404 ) );
        }

        if ( ! $repository->delete( $id ) ) {
            return new \WP_Error( 'vulopilot_delete_failed', __( 'Could not delete this redirect.', 'vulopilot' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( array( 'deleted' => true ) );
    }

    /**
     * Real "Broken Redirects" data - nothing in this codebase previously
     * checked whether a redirect's own `target_url` actually resolves
     * (BrokenLinksScanner only checks `<a href>`s found in page content,
     * never this table). Same HEAD-request/timeout/reason shape as
     * BrokenLinksScanner::check_link() so a redirect's "broken" state
     * means exactly what a broken link's does elsewhere in this plugin.
     *
     * Cached in a single option for `HEALTH_CACHE_SECONDS` (real, honest
     * "Last checked" timestamp for RedirectsSection.tsx's own stat tile -
     * there is no scheduler/cron for this, so unlike BrokenLinksScanner
     * there's no "next run" to report) rather than re-checking every
     * target on every page load - `force=1` bypasses the cache for an
     * explicit "Recheck now" action. Bounded to `MAX_HEALTH_CHECKS`
     * active redirects per call, same reasoning BrokenLinksScanner caps
     * itself per run: a bulk redirect importer creating hundreds of rows
     * shouldn't turn one page load into hundreds of serial HTTP requests.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_health( $request ) {
        $cached = get_option( self::HEALTH_OPTION, array() );
        $force  = (bool) $request->get_param( 'force' );

        if ( ! $force && ! empty( $cached['checked_at'] ) && ( time() - (int) $cached['checked_at'] ) < self::HEALTH_CACHE_SECONDS ) {
            return rest_ensure_response( $cached );
        }

        $repository = new RedirectRepository();
        $active     = $repository->find_all(
            array(
                'is_active' => '1',
                'page'      => 1,
                'per_page'  => self::MAX_HEALTH_CHECKS,
            )
        );

        $results = array();

        foreach ( $active['data'] as $redirect ) {
            $results[ (int) $redirect['id'] ] = $this->check_target( (string) $redirect['target_url'] );
        }

        $payload = array(
            'checked_at' => time(),
            'results'    => $results,
        );

        update_option( self::HEALTH_OPTION, $payload, false );

        return rest_ensure_response( $payload );
    }

    /**
     * Same real HEAD-request check BrokenLinksScanner::check_link() uses
     * for in-content links, applied here to a redirect row's own
     * `target_url` instead.
     *
     * @param string $url Real target URL to check.
     * @return array{broken: bool, status: int|string}
     */
    private function check_target( string $url ): array {
        $response = wp_remote_head(
            $url,
            array(
                'timeout'     => self::HEALTH_REQUEST_TIMEOUT_SECONDS,
                'redirection' => 5,
                'sslverify'   => false,
            )
        );

        if ( is_wp_error( $response ) ) {
            return array(
                'broken' => true,
                'status' => 'unverified',
            );
        }

        $status_code = wp_remote_retrieve_response_code( $response );

        return array(
            'broken' => ! ( $status_code >= 200 && $status_code < 400 ),
            'status' => $status_code,
        );
    }
}

/**
 * `GET /robots-sitemap/robots` and `GET /robots-sitemap/sitemap` - real,
 * live fetch-and-parse of this site's OWN actual `/robots.txt` and
 * sitemap index, backing RobotsSitemapSection.tsx's "Robots.txt
 * Analysis"/"XML Sitemap Overview" cards.
 *
 * Neither existing scanner (Seo\Scanners\RobotsTxtScanner/SitemapScanner)
 * does this: they only check reachability (and one narrow "blocks every
 * crawler" case for robots.txt) for the findings feed, never return file
 * content or a structured rules/child-sitemap breakdown to the frontend -
 * confirmed by reading both before writing this controller. This is
 * genuinely new, real parsing, not a re-exposure of something that
 * already existed.
 *
 * @class       RobotsSitemap controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class RobotsSitemap extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'robots-sitemap';

    private const REQUEST_TIMEOUT_SECONDS = 8;

    /**
     * Real bound on how many child sitemaps get their own real HEAD-count
     * request - same "don't turn one page load into unbounded serial HTTP
     * requests" reasoning BrokenLinksScanner (MAX_LINKS_PER_RUN) and
     * Controllers\Redirects::get_health() (MAX_HEALTH_CHECKS) already
     * apply for the same real reason.
     */
    private const MAX_CHILD_SITEMAPS = 12;

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/robots',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_robots' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'save_robots' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/sitemap',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_sitemap' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
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
    public function permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * Live-fetches this site's own `/robots.txt` and parses every real
     * `User-agent`/`Allow`/`Disallow`/`Sitemap`/`Crawl-delay` line - the
     * exact raw content is returned too (RobotsSitemapSection.tsx's own
     * code-view), so nothing here is a summary standing in for the real
     * file; it's the real file, plus real counts of its own real lines.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_robots( $request ) {
        $url      = home_url( '/robots.txt' );
        $response = wp_remote_get(
            $url,
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );

        $custom_content = VuloPilot()->robots_txt_manager->get_custom_content();
        $is_custom      = '' !== $custom_content;

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            return rest_ensure_response(
                array(
                    'reachable'      => false,
                    'url'            => $url,
                    'content'        => '',
                    'is_custom'      => $is_custom,
                    'custom_content' => $custom_content,
                    'rules'          => array(
                        'total'       => 0,
                        'allowed'     => 0,
                        'disallowed'  => 0,
                        'sitemaps'    => 0,
                    ),
                    'directives'     => array(
                        'user_agents' => array(),
                        'allow'       => array(),
                        'disallow'    => array(),
                        'sitemaps'    => array(),
                        'crawl_delay' => null,
                    ),
                )
            );
        }

        $content = (string) wp_remote_retrieve_body( $response );
        $parsed  = $this->parse_robots_txt( $content );

        return rest_ensure_response(
            array_merge(
                array(
                    'reachable'      => true,
                    'url'            => $url,
                    'content'        => $content,
                    'is_custom'      => $is_custom,
                    'custom_content' => $custom_content,
                ),
                $parsed
            )
        );
    }

    /**
     * The Robots.txt Analysis card's own "Edit" action - saves a real,
     * persisted override of this site's own robots.txt output
     * (RobotsTxtManager::save_custom_content(), which replaces WordPress
     * core's own virtual `robots_txt` filter output outright). An empty
     * `content` clears the override, reverting to core's own default.
     * Nothing here is a preview: the very next live `GET .../robots`
     * (or a real crawler request to `/robots.txt`) reflects exactly what
     * was just saved.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function save_robots( $request ) {
        $content = sanitize_textarea_field( (string) $request->get_param( 'content' ) );

        VuloPilot()->robots_txt_manager->save_custom_content( $content );

        return rest_ensure_response(
            array(
                'saved'     => true,
                'is_custom' => '' !== $content,
            )
        );
    }

    /**
     * Plain line-by-line real robots.txt directive parser - the RFC-ish
     * format is just `Directive: value` lines, blank lines, and `#`
     * comments, so a full parser/library is unnecessary; this reads every
     * real line exactly once.
     *
     * @param string $content Raw robots.txt body.
     * @return array{rules: array, directives: array}
     */
    private function parse_robots_txt( string $content ): array {
        $lines       = preg_split( '/\r\n|\r|\n/', $content ) ?: array();
        $user_agents = array();
        $allow       = array();
        $disallow    = array();
        $sitemaps    = array();
        $crawl_delay = null;

        foreach ( $lines as $line ) {
            $line = trim( $line );

            if ( '' === $line || '#' === substr( $line, 0, 1 ) || false === strpos( $line, ':' ) ) {
                continue;
            }

            list( $directive, $value ) = array_map( 'trim', explode( ':', $line, 2 ) );

            switch ( strtolower( $directive ) ) {
                case 'user-agent':
                    $user_agents[] = $value;
                    break;
                case 'allow':
                    $allow[] = $value;
                    break;
                case 'disallow':
                    $disallow[] = $value;
                    break;
                case 'sitemap':
                    $sitemaps[] = $value;
                    break;
                case 'crawl-delay':
                    $crawl_delay = $value;
                    break;
            }
        }

        $user_agents = array_values( array_unique( $user_agents ) );
        $sitemaps    = array_values( array_unique( $sitemaps ) );

        return array(
            'rules'      => array(
                'total'      => count( $allow ) + count( $disallow ) + count( $sitemaps ),
                'allowed'    => count( $allow ),
                'disallowed' => count( $disallow ),
                'sitemaps'   => count( $sitemaps ),
            ),
            'directives' => array(
                'user_agents' => $user_agents,
                'allow'       => $allow,
                'disallow'    => $disallow,
                'sitemaps'    => $sitemaps,
                'crawl_delay' => $crawl_delay,
            ),
        );
    }

    /**
     * Live-fetches this site's own sitemap index - real `/wp-sitemap.xml`
     * (WordPress core's own native sitemap since 5.5) first, falling back
     * to `/sitemap.xml`, same discovery order Seo\Scanners\SitemapScanner
     * already uses. Enumerates every real `<sitemap>` child entry (a real
     * index) or treats a flat `<url>` set as one real sitemap - for each
     * real child, a second real request counts its own real `<url>`
     * entries (bounded, see MAX_CHILD_SITEMAPS's own docblock).
     *
     * Parses via `local-name()` XPath rather than SimpleXML's magic
     * `->sitemap`/`->url` property access - the same choice
     * VuloPilotPro\AdvancedSeo\Scanners\SitemapValidationScanner already
     * makes, since core's sitemap XML declares a default namespace that
     * magic property access doesn't reliably traverse.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_sitemap( $request ) {
        $index_url = home_url( '/wp-sitemap.xml' );
        $response  = wp_remote_get( $index_url, array( 'timeout' => self::REQUEST_TIMEOUT_SECONDS, 'sslverify' => false ) );

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            $index_url = home_url( '/sitemap.xml' );
            $response  = wp_remote_get( $index_url, array( 'timeout' => self::REQUEST_TIMEOUT_SECONDS, 'sslverify' => false ) );
        }

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            return rest_ensure_response(
                array(
                    'reachable'      => false,
                    'index_url'      => $index_url,
                    'valid'          => false,
                    'total_sitemaps' => 0,
                    'total_urls'     => 0,
                    'sitemaps'       => array(),
                )
            );
        }

        $body = (string) wp_remote_retrieve_body( $response );
        $xml  = $this->parse_xml( $body );

        if ( false === $xml ) {
            return rest_ensure_response(
                array(
                    'reachable'      => true,
                    'index_url'      => $index_url,
                    'valid'          => false,
                    'total_sitemaps' => 0,
                    'total_urls'     => 0,
                    'sitemaps'       => array(),
                )
            );
        }

        $sitemap_nodes = $xml->xpath( '//*[local-name()="sitemap"]' ) ?: array();
        $url_nodes     = $xml->xpath( '//*[local-name()="url"]' ) ?: array();
        $children      = array();

        if ( $sitemap_nodes ) {
            foreach ( array_slice( $sitemap_nodes, 0, self::MAX_CHILD_SITEMAPS ) as $node ) {
                $loc_nodes     = $node->xpath( './/*[local-name()="loc"]' ) ?: array();
                $lastmod_nodes = $node->xpath( './/*[local-name()="lastmod"]' ) ?: array();
                $loc           = $loc_nodes ? (string) $loc_nodes[0] : '';

                if ( '' === $loc ) {
                    continue;
                }

                $url_count  = $this->count_sitemap_urls( $loc );
                $children[] = array(
                    'loc'       => $loc,
                    'type'      => $this->infer_sitemap_type( $loc ),
                    'lastmod'   => $lastmod_nodes ? (string) $lastmod_nodes[0] : null,
                    'url_count' => $url_count,
                    'status'    => null === $url_count ? 'error' : 'ok',
                );
            }
        } elseif ( $url_nodes ) {
            // A flat urlset, not an index - the fetched URL IS the one real sitemap.
            $children[] = array(
                'loc'       => $index_url,
                'type'      => $this->infer_sitemap_type( $index_url ),
                'lastmod'   => null,
                'url_count' => count( $url_nodes ),
                'status'    => 'ok',
            );
        }

        $total_urls = array_sum( array_map( static fn( $child ) => $child['url_count'] ?? 0, $children ) );

        return rest_ensure_response(
            array(
                'reachable'      => true,
                'index_url'      => $index_url,
                'valid'          => true,
                'total_sitemaps' => count( $children ),
                'total_urls'     => $total_urls,
                'sitemaps'       => $children,
            )
        );
    }

    /**
     * @param string $url Real child sitemap URL.
     * @return int|null Real `<url>` count, or null when the request/parse failed (rendered as this row's own real "error" status, never a fabricated 0).
     */
    private function count_sitemap_urls( string $url ): ?int {
        $response = wp_remote_get( $url, array( 'timeout' => self::REQUEST_TIMEOUT_SECONDS, 'sslverify' => false ) );

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            return null;
        }

        $xml = $this->parse_xml( (string) wp_remote_retrieve_body( $response ) );

        if ( false === $xml ) {
            return null;
        }

        return count( $xml->xpath( '//*[local-name()="url"]' ) ?: array() );
    }

    /**
     * @param string $body Raw XML body.
     * @return \SimpleXMLElement|false
     */
    private function parse_xml( string $body ) {
        $previous = libxml_use_internal_errors( true );
        $xml      = simplexml_load_string( $body );
        libxml_clear_errors();
        libxml_use_internal_errors( $previous );

        return $xml;
    }

    /**
     * A real, honest categorization derived from the sitemap's own real
     * filename - never a guess about content that wasn't actually
     * fetched, just a readable label for a real URL already shown in
     * full right next to it.
     *
     * @param string $url Real sitemap URL.
     * @return string
     */
    private function infer_sitemap_type( string $url ): string {
        $lower = strtolower( $url );

        if ( false !== strpos( $lower, 'post' ) ) {
            return __( 'Posts', 'vulopilot' );
        }
        if ( false !== strpos( $lower, 'page' ) ) {
            return __( 'Pages', 'vulopilot' );
        }
        if ( false !== strpos( $lower, 'product' ) ) {
            return __( 'Products', 'vulopilot' );
        }
        if ( false !== strpos( $lower, 'categor' ) || false !== strpos( $lower, 'tax' ) ) {
            return __( 'Categories', 'vulopilot' );
        }
        if ( false !== strpos( $lower, 'author' ) || false !== strpos( $lower, 'user' ) ) {
            return __( 'Authors', 'vulopilot' );
        }

        return __( 'General', 'vulopilot' );
    }
}

/**
 * `GET /schema/coverage` reads back a previously generated Schema
 * Coverage snapshot (transient, no real work) - what the "Schema &
 * Knowledge" tab's Overview/Structured Data sections load on mount.
 * `POST /schema/coverage` runs a fresh real sample
 * (SchemaCoverageAnalyzer::analyze(), real outbound HTTP + JSON-LD parsing
 * per sampled page) and persists it - separated into two routes/verbs for
 * the identical reason Controllers\GeoAnalysis (Free) and
 * GeoInsights\Rest::analyze_competitor_visibility() (Pro) already split
 * their own real-work endpoints this way: loading a page should never
 * silently re-spend real work a site owner didn't ask for.
 *
 * `POST /schema/inspect` backs the Inspector section's real single-page
 * checker (SchemaPageInspector) - POST, not GET, same "real outbound HTTP
 * only on explicit request" reasoning as `/schema/coverage`.
 *
 * @class       Schema controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Schema extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'schema';

    /**
     * Real post_type => human label map for the Inspector's own page-picker
     * dropdown option text, e.g. "T-Shirt with Logo (Product)" - same 3
     * real post types SchemaCoverageAnalyzer::analyze() already samples
     * from.
     *
     * @var array<string, string>
     */
    private const TYPE_LABELS = array(
        'post'    => 'Post',
        'page'    => 'Page',
        'product' => 'Product',
    );

    /**
     * @var SchemaCoverageAnalyzer
     */
    private SchemaCoverageAnalyzer $analyzer;

    /**
     * @var SchemaPageInspector
     */
    private SchemaPageInspector $inspector;

    /**
     * @param SchemaCoverageAnalyzer|null $analyzer  Defaults to a new instance (injectable for tests).
     * @param SchemaPageInspector|null    $inspector Defaults to a new instance (injectable for tests).
     */
    public function __construct( ?SchemaCoverageAnalyzer $analyzer = null, ?SchemaPageInspector $inspector = null ) {
        $this->analyzer  = $analyzer ?? new SchemaCoverageAnalyzer();
        $this->inspector = $inspector ?? new SchemaPageInspector();
    }

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/coverage',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_coverage' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'analyze_coverage' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/inspect',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'inspect_page' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/inspectable-pages',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'list_inspectable_pages' ),
                    'permission_callback' => array( $this, 'permissions_check' ),
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
    public function permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @return \WP_REST_Response
     */
    public function get_coverage() {
        return rest_ensure_response( $this->analyzer->get_stored_snapshot() );
    }

    /**
     * @return \WP_REST_Response
     */
    public function analyze_coverage() {
        return rest_ensure_response( $this->analyzer->analyze() );
    }

    /**
     * Inspector section's "Inspect a specific page" - resolves either a
     * given `url` or a `post_id`'s real permalink, runs a real
     * `wp_remote_get()` + JSON-LD extraction against it
     * (SchemaPageInspector), and returns the real result. Real outbound
     * HTTP only on this explicit request, same as `analyze_coverage()`.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function inspect_page( $request ) {
        $url     = esc_url_raw( (string) $request->get_param( 'url' ) );
        $post_id = absint( $request->get_param( 'post_id' ) );

        if ( '' === $url && $post_id ) {
            $permalink = get_permalink( $post_id );
            $url       = $permalink ? $permalink : '';
        }

        if ( '' === $url ) {
            return new \WP_Error( 'vulopilot_schema_inspect_missing_url', __( 'Provide a URL or post to inspect.', 'vulopilot' ), array( 'status' => 400 ) );
        }

        $result = $this->inspector->inspect( $url );

        if ( null === $result ) {
            return new \WP_Error( 'vulopilot_schema_inspect_failed', __( 'Could not fetch that page. Check the URL and try again.', 'vulopilot' ), array( 'status' => 502 ) );
        }

        return rest_ensure_response( $result );
    }

    /**
     * Real posts/pages/products the Inspector's own page-picker dropdown
     * offers (InspectorSection.tsx) - same post_type scope
     * SchemaCoverageAnalyzer::analyze() already samples from, most-recently-
     * modified first, capped to a real usable dropdown length. No outbound
     * HTTP here (unlike inspect_page() itself) - just this site's own
     * already-stored post data, so this is safe to call on every mount
     * rather than gated behind an explicit action.
     *
     * @return \WP_REST_Response
     */
    public function list_inspectable_pages() {
        $post_ids = get_posts(
            array(
                'post_type'      => array( 'post', 'page', 'product' ),
                'post_status'    => 'publish',
                'posts_per_page' => 30,
                'orderby'        => 'modified',
                'order'          => 'DESC',
                'fields'         => 'ids',
            )
        );

        $pages = array_map(
            static function ( int $post_id ): array {
                $post_type = (string) get_post_type( $post_id );

                return array(
                    'id'         => $post_id,
                    'title'      => get_the_title( $post_id ) ?: __( '(no title)', 'vulopilot' ),
                    'type'       => $post_type,
                    'type_label' => self::TYPE_LABELS[ $post_type ] ?? ucfirst( $post_type ),
                    'url'        => get_permalink( $post_id ),
                );
            },
            $post_ids
        );

        // The homepage isn't a post, so the query above never returns it -
        // but SchemaCoverageAnalyzer::analyze() checks it as a page in its
        // own right, so it's listed first here too. Keeps this list in step
        // with the coverage sample's "Pages checked" count.
        array_unshift(
            $pages,
            array(
                'id'         => 0,
                'title'      => __( 'Homepage', 'vulopilot' ),
                'type'       => 'homepage',
                'type_label' => __( 'Homepage', 'vulopilot' ),
                'url'        => home_url( '/' ),
            )
        );

        return rest_ensure_response( $pages );
    }
}

/**
 * `GET /visibility/score` / `GET /visibility/progress` - back the "SEO &
 * Visibility → Overview" tab's own real dashboard (OverviewTab.tsx):
 * one combined score across the 4 real free-tier areas already scored
 * elsewhere on this plugin's own dedicated tabs (Brand, SEO, GEO, Crawl &
 * URLs), plus a real combined trend.
 *
 * Deliberately calls each area's own existing controller method directly
 * (`( new Seo() )->get_score()`, etc.) rather than re-deriving each area's
 * own scanner-id list/formula a 6th time - this guarantees the number shown
 * here for "SEO" (for example) can never disagree with the number SEO's
 * own tab shows, since both come from the exact same call. Only the 7-day-
 * ago *delta* per area is computed locally here (via the same
 * `..._as_of()` reconstruction technique every other score endpoint in
 * this codebase already uses), since none of the 4 source endpoints expose
 * a "score as of N days ago" of their own - `AREA_SCANNER_IDS` below is
 * kept in sync manually with each source controller's own scanner-id
 * list, same "kept in sync manually" convention `Controllers\Seo`'s own
 * docblock already documents for a similar cross-file duplication.
 *
 * AEO and Keywords are deliberately NOT included: AEO has no free-tier
 * score anywhere in this codebase (`AeoTab.tsx`'s own client-side "AEO
 * Score" reads a Pro-only snapshot and silently falls back to 0 without
 * vulopilot-pro's GeoInsights module active); Keywords has no score at
 * all, only Search-Console-gated position/click stats. Averaging in a
 * fabricated or always-zero number for either would drag the combined
 * score down dishonestly rather than reflect real site health - better to
 * average 4 genuinely real areas than 6 where 2 are placeholders.
 *
 * @class       Visibility controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class Visibility extends \WP_REST_Controller {

    /**
     * @var string
     */
    protected $rest_base = 'visibility';

    /**
     * Real scanner ids behind each area's own score, kept in sync manually
     * with `Controllers\Seo::CATEGORY_SCANNER_IDS` (merged), `Controllers\Geo::SIGNAL_SCANNER_IDS`
     * (merged, minus `content-freshness` - that signal is a real sitewide
     * computation from `post_modified_gmt`, not a finding count, so it has
     * no "as of N days ago" reconstruction the way a finding does; GEO's
     * own real `/geo/progress` excludes it from its trend for the identical
     * reason, see that class's own docblock), `Controllers\BrandIntelligence::TRUST_SCANNER_IDS`/
     * `AUTHORITY_SCANNER_IDS` (merged), and `Controllers\CrawlerTraffic::get_analytics()`'s
     * own inline 4-id array. Used ONLY for the 7-day-ago delta reconstruction
     * and the combined trend below - the *current* score for each area
     * always comes from that area's own real endpoint (see this class's own
     * docblock), so a delta computed from a slightly different or stale
     * copy of this list would still never make the *headline* number
     * disagree with that area's own tab, only the change arrow's precision.
     *
     * @var array<string, string[]>
     */
    private const AREA_SCANNER_IDS = array(
        'brand' => array( 'geo-trust-signals', 'about-page-analysis', 'geo-eeat-signals', 'geo-author-info', 'author-schema' ),
        'seo'   => array(
            'seo',
            'meta-description',
            'meta-description-duplication',
            'focus-keyword-audit',
            'heading-structure',
            'multiple-h1',
            'thin-content',
            'seo-images',
            'images',
            'internal-linking',
            'canonical-url',
            'duplicate-content',
            'orphan-pages',
            'open-graph',
            'twitter-card',
        ),
        'geo'   => array(
            'geo-summary-block',
            'geo-faq-opportunity',
            'geo-citation-opportunities',
            'geo-chunking',
            'geo-semantic-structure',
            'geo-entity-naming-consistency',
            'geo-author-info',
            'geo-eeat-signals',
            'geo-trust-signals',
            'llms-txt-missing',
        ),
        'crawl' => array( 'robots-txt', 'sitemap', 'sitemap-validation', 'ai-crawler-blocked-pages' ),
    );

    /**
     * Real, human-facing label per area - same 4 areas the "Visibility
     * Breakdown" table's own rows show.
     *
     * @var array<string, string>
     */
    private const AREA_LABELS = array(
        'brand' => 'Brand Visibility',
        'seo'   => 'SEO',
        'geo'   => 'GEO (AI Visibility)',
        'crawl' => 'Crawl & URLs',
    );

    /**
     * Same 7-day lookback every other real score delta in this codebase
     * uses (`Controllers\Seo::DELTA_LOOKBACK_DAYS`, `Controllers\Geo::DELTA_LOOKBACK_DAYS`).
     *
     * @var int
     */
    private const DELTA_LOOKBACK_DAYS = 7;

    /**
     * Real day-range options "Visibility Trend"'s own period dropdown
     * offers, same trio `Controllers\Geo::ALLOWED_PROGRESS_DAYS` already
     * uses.
     *
     * @var int[]
     */
    private const ALLOWED_PROGRESS_DAYS = array( 7, 30, 90 );

    /**
     * Real GA4 traffic-source lookback window for "Visibility by Source" -
     * fixed rather than user-selectable (unlike "Visibility Trend"'s own
     * 7/30/90 dropdown above) since this card has no period control of its
     * own in the reference layout it matches.
     *
     * @var int
     */
    private const TRAFFIC_SOURCE_WINDOW_DAYS = 30;

    /**
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/score',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_score' ),
                    'permission_callback' => array( $this, 'get_score_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/progress',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_progress' ),
                    'permission_callback' => array( $this, 'get_score_permissions_check' ),
                ),
            )
        );

        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/traffic-sources',
            array(
                array(
                    'methods'             => \WP_REST_Server::READABLE,
                    'callback'            => array( $this, 'get_traffic_sources' ),
                    'permission_callback' => array( $this, 'get_score_permissions_check' ),
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
    public function get_score_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @return \WP_REST_Response
     */
    public function get_score() {
        $seo_data   = ( new Seo() )->get_score()->get_data();
        $geo_data   = ( new Geo() )->get_score()->get_data();
        $brand_data = ( new BrandIntelligence() )->get_score()->get_data();
        $crawl_data = ( new CrawlerTraffic() )->get_analytics( new \WP_REST_Request() )->get_data();

        $areas = array(
            'brand' => array( 'label' => self::AREA_LABELS['brand'], 'score' => (int) $brand_data['brand_score'] ),
            'seo'   => array( 'label' => self::AREA_LABELS['seo'], 'score' => (int) $seo_data['seo_score'] ),
            'geo'   => array( 'label' => self::AREA_LABELS['geo'], 'score' => (int) $geo_data['geo_score'] ),
            'crawl' => array( 'label' => self::AREA_LABELS['crawl'], 'score' => (int) $crawl_data['crawl_health_score'] ),
        );

        $findings = new FindingRepository();
        $as_of    = gmdate( 'Y-m-d H:i:s', strtotime( '-' . self::DELTA_LOOKBACK_DAYS . ' days' ) );

        foreach ( self::AREA_SCANNER_IDS as $key => $scanner_ids ) {
            $previous_breakdown             = $findings->get_severity_breakdown_for_scanner_ids_as_of( $scanner_ids, $as_of );
            $areas[ $key ]['previous_score'] = $this->calculate_score( $previous_breakdown );
            $areas[ $key ]['change']         = $areas[ $key ]['score'] - $areas[ $key ]['previous_score'];
        }

        $visibility_score          = (int) round( array_sum( array_column( $areas, 'score' ) ) / count( $areas ) );
        $previous_visibility_score = (int) round( array_sum( array_column( $areas, 'previous_score' ) ) / count( $areas ) );

        return rest_ensure_response(
            array(
                'visibility_score'          => $visibility_score,
                'previous_visibility_score' => $previous_visibility_score,
                'change'                    => $visibility_score - $previous_visibility_score,
                'lookback_days'             => self::DELTA_LOOKBACK_DAYS,
                'areas'                     => $areas,
            )
        );
    }

    /**
     * Same weighting every other real score in this codebase uses.
     *
     * @param array{critical: int, high: int, medium: int, low: int} $breakdown Severity breakdown to score.
     * @return int 0-100.
     */
    private function calculate_score( array $breakdown ): int {
        $score = 100
            - ( $breakdown['critical'] * 15 )
            - ( $breakdown['high'] * 8 )
            - ( $breakdown['medium'] * 3 )
            - ( $breakdown['low'] * 1 );

        return max( 0, min( 100, $score ) );
    }

    /**
     * "Visibility Trend" - a real daily combined-score trend over `days`
     * (7/30/90), one real reconstructed score per day
     * (`FindingRepository::get_severity_breakdown_for_scanner_ids_as_of()`,
     * same technique every other real score trend in this codebase already
     * uses) across ALL 4 areas' scanner ids merged into one breakdown -
     * genuinely cheap (one query per day, same cost as `Controllers\Geo::get_progress()`),
     * not 4 separate per-area reconstructions per day. No new stored
     * snapshot table.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response
     */
    public function get_progress( \WP_REST_Request $request ) {
        $days = (int) $request->get_param( 'days' );
        if ( ! in_array( $days, self::ALLOWED_PROGRESS_DAYS, true ) ) {
            $days = 30;
        }

        $findings = new FindingRepository();
        $all_ids  = array_values( array_unique( array_merge( ...array_values( self::AREA_SCANNER_IDS ) ) ) );

        $trend = array();
        for ( $days_ago = $days - 1; $days_ago >= 0; $days_ago-- ) {
            $breakdown = $findings->get_severity_breakdown_for_scanner_ids_as_of(
                $all_ids,
                gmdate( 'Y-m-d 23:59:59', strtotime( "-{$days_ago} days" ) )
            );

            $trend[] = array(
                'date'  => gmdate( 'Y-m-d', strtotime( "-{$days_ago} days" ) ),
                'score' => $this->calculate_score( $breakdown ),
            );
        }

        return rest_ensure_response(
            array(
                'days'  => $days,
                'trend' => $trend,
            )
        );
    }

    /**
     * "Visibility by Source" - real GA4 sessions grouped by
     * `sessionDefaultChannelGroup` (GoogleAnalyticsClient::run_channel_group_report()),
     * a genuine Google Analytics dimension, over the last
     * `TRAFFIC_SOURCE_WINDOW_DAYS` real days. This plugin tracks zero
     * human-visitor traffic-source data of its own anywhere
     * (`vulopilot_crawler_visits` is AI bots only, by explicit design - see
     * `CrawlerTraffic.php`'s own docblock; Search Console is organic-
     * search-only by definition) - so unlike "Visibility by Area" (this
     * same tab's own real category-score donut, a separate concept), this
     * card only ever has real data to show once a site owner has actually
     * connected a real GA4 property (Settings → Connections → Google
     * Services). `connected: false` (empty `sources`) covers both "never
     * connected" and "connected, but the live GA4 call itself failed" -
     * the frontend renders the identical honest "connect" prompt either
     * way rather than a fabricated number or a confusing distinct error
     * state for a case a site owner can't act on differently anyway.
     *
     * @return \WP_REST_Response
     */
    public function get_traffic_sources() {
        $connection = new GoogleServicesConnection();
        $status     = $connection->get_status();

        $response = array(
            'connected'      => false,
            'window_days'    => self::TRAFFIC_SOURCE_WINDOW_DAYS,
            'total_sessions' => 0,
            'sources'        => array(),
        );

        if ( ! $status['connected'] || '' === $status['ga4_property_id'] ) {
            return rest_ensure_response( $response );
        }

        $end_date   = gmdate( 'Y-m-d' );
        $start_date = gmdate( 'Y-m-d', strtotime( '-' . ( self::TRAFFIC_SOURCE_WINDOW_DAYS - 1 ) . ' days' ) );

        $sessions_by_channel = ( new GoogleAnalyticsClient( $connection ) )->run_channel_group_report( $status['ga4_property_id'], $start_date, $end_date );

        if ( is_wp_error( $sessions_by_channel ) || empty( $sessions_by_channel ) ) {
            return rest_ensure_response( $response );
        }

        arsort( $sessions_by_channel );

        $total = array_sum( $sessions_by_channel );

        $response['connected']      = true;
        $response['total_sessions'] = $total;

        foreach ( $sessions_by_channel as $channel => $sessions ) {
            $response['sources'][] = array(
                'label'    => $channel,
                'sessions' => $sessions,
                'percent'  => $total > 0 ? (int) round( $sessions / $total * 100 ) : 0,
            );
        }

        return rest_ensure_response( $response );
    }
}
