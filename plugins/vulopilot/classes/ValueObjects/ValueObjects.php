<?php
/**
 * Every class in this file used to be its own file under classes/ValueObjects/
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

namespace VuloPilot\ValueObjects;

defined( 'ABSPATH' ) || exit;

/**
 * A chat-style request sent to VuloCloud through AI\AiRequestSender.
 *
 * @class       AIRequest class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class AIRequest {

    /**
     * @var string
     */
    private string $model;

    /**
     * @var array<int, array{role: string, content: string}>
     */
    private array $messages;

    /**
     * @var float|null
     */
    private ?float $temperature;

    /**
     * @var int|null
     */
    private ?int $max_tokens;

    /**
     * A single inline image for the current turn, `{mime_type, data}`
     * (`data` base64-encoded) - additive and optional so every existing
     * caller building a text-only request is unaffected. The VuloCloud
     * gateway's wire contract carries text only, so nothing reads this today;
     * it stays on the request for when that changes.
     *
     * @var array{mime_type: string, data: string}|null
     */
    private ?array $image;

    /**
     * Which real feature/endpoint triggered this call - e.g. 'copilot_chat',
     * 'content_assistant_chat', 'ai_action', 'geo_analysis',
     * 'content_intelligence'. Purely an audit-trail tag: read only by
     * AI\AiRequestSender, written to `vulopilot_ai_history.surface`, so
     * AI Copilot History's "Conversations" filter (and any future
     * per-feature usage breakdown) can tell a real chat turn apart from
     * every other feature that shares the same sender.
     * Null for any caller that doesn't pass one - no behavior change.
     *
     * @var string|null
     */
    private ?string $surface;

    /**
     * @param string                                      $model       Model id to use.
     * @param array                                       $messages    array<int, array{role: string, content: string}>.
     * @param float|null                                  $temperature Optional; the gateway applies its own default when null.
     * @param int|null                                    $max_tokens  Optional; the gateway applies its own default when null.
     * @param array{mime_type: string, data: string}|null $image   Optional inline image for the current turn.
     * @param string|null                                 $surface Optional real feature label - see get_surface()'s own docblock.
     */
    public function __construct(
        string $model,
        array $messages,
        ?float $temperature = null,
        ?int $max_tokens = null,
        ?array $image = null,
        ?string $surface = null
    ) {
        $this->model       = $model;
        $this->messages    = $messages;
        $this->temperature = $temperature;
        $this->max_tokens  = $max_tokens;
        $this->image       = $image;
        $this->surface     = $surface;
    }

    /**
     * @return string
     */
    public function get_model(): string {
        return $this->model;
    }

    /**
     * @return array<int, array{role: string, content: string}>
     */
    public function get_messages(): array {
        return $this->messages;
    }

    /**
     * @return float|null
     */
    public function get_temperature(): ?float {
        return $this->temperature;
    }

    /**
     * @return int|null
     */
    public function get_max_tokens(): ?int {
        return $this->max_tokens;
    }

    /**
     * @return array{mime_type: string, data: string}|null
     */
    public function get_image(): ?array {
        return $this->image;
    }

    /**
     * @return string|null
     */
    public function get_surface(): ?string {
        return $this->surface;
    }
}

/**
 * The response to an AIRequest. Immutable - sanitizing
 * the content (AISafetyValidator::sanitize_response()) produces a new
 * instance via with_content() rather than mutating this one.
 *
 * @class       AIResponse class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class AIResponse {

    /**
     * @var string
     */
    private string $content;

    /**
     * @var string
     */
    private string $provider;

    /**
     * @var string
     */
    private string $model;

    /**
     * @var int
     */
    private int $prompt_tokens;

    /**
     * @var int
     */
    private int $completion_tokens;

    /**
     * @var string
     */
    private string $finish_reason;

    /**
     * @param string $content            Generated content.
     * @param string $provider           Provider id that generated this response.
     * @param string $model              Model id that generated this response.
     * @param int    $prompt_tokens      Tokens used by the prompt.
     * @param int    $completion_tokens  Tokens used by the completion.
     * @param string $finish_reason      Why generation stopped (e.g. 'stop', 'incomplete').
     */
    public function __construct(
        string $content,
        string $provider,
        string $model,
        int $prompt_tokens,
        int $completion_tokens,
        string $finish_reason
    ) {
        $this->content           = $content;
        $this->provider          = $provider;
        $this->model             = $model;
        $this->prompt_tokens     = $prompt_tokens;
        $this->completion_tokens = $completion_tokens;
        $this->finish_reason     = $finish_reason;
    }

    /**
     * @return string
     */
    public function get_content(): string {
        return $this->content;
    }

    /**
     * @return string
     */
    public function get_provider(): string {
        return $this->provider;
    }

    /**
     * @return string
     */
    public function get_model(): string {
        return $this->model;
    }

    /**
     * @return int
     */
    public function get_prompt_tokens(): int {
        return $this->prompt_tokens;
    }

    /**
     * @return int
     */
    public function get_completion_tokens(): int {
        return $this->completion_tokens;
    }

    /**
     * @return string
     */
    public function get_finish_reason(): string {
        return $this->finish_reason;
    }

    /**
     * Returns a copy of this response with different content - used to
     * apply sanitization without mutating the original.
     *
     * @param string $new_content Replacement content.
     * @return self
     */
    public function with_content( string $new_content ): self {
        return new self(
            $new_content,
            $this->provider,
            $this->model,
            $this->prompt_tokens,
            $this->completion_tokens,
            $this->finish_reason
        );
    }
}

/**
 * The outcome of an AIActionInterface::execute() call. Carries the
 * rollback snapshot ActionRunner::rollback() later replays through
 * AIActionInterface::rollback().
 *
 * @class       ActionExecutionResult class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class ActionExecutionResult {

    /**
     * @var bool
     */
    private bool $success;

    /**
     * @var string|null e.g. 'post', 'attachment'.
     */
    private ?string $object_type;

    /**
     * @var string|null
     */
    private ?string $object_ref;

    /**
     * @var array<string, mixed>
     */
    private array $snapshot;

    /**
     * @var string|null Error message on failure.
     */
    private ?string $message;

    /**
     * @param bool        $success     Whether execution succeeded.
     * @param string|null $object_type What kind of thing was mutated, if any.
     * @param string|null $object_ref  Reference to the specific object mutated, if any.
     * @param array       $snapshot    Data needed to roll this execution back.
     * @param string|null $message     Error message on failure.
     */
    public function __construct(
        bool $success,
        ?string $object_type,
        ?string $object_ref,
        array $snapshot = array(),
        ?string $message = null
    ) {
        $this->success     = $success;
        $this->object_type = $object_type;
        $this->object_ref  = $object_ref;
        $this->snapshot    = $snapshot;
        $this->message     = $message;
    }

    /**
     * @return bool
     */
    public function is_success(): bool {
        return $this->success;
    }

    /**
     * @return string|null
     */
    public function get_object_type(): ?string {
        return $this->object_type;
    }

    /**
     * @return string|null
     */
    public function get_object_ref(): ?string {
        return $this->object_ref;
    }

    /**
     * @return array<string, mixed>
     */
    public function get_snapshot(): array {
        return $this->snapshot;
    }

    /**
     * @return string|null
     */
    public function get_message(): ?string {
        return $this->message;
    }

    /**
     * @return array<string, mixed>
     */
    public function to_array(): array {
        return array(
            'success'     => $this->success,
            'object_type' => $this->object_type,
            'object_ref'  => $this->object_ref,
            'snapshot'    => $this->snapshot,
            'message'     => $this->message,
        );
    }
}

/**
 * The human-facing preview an AIActionInterface::build_preview() returns,
 * shown to the user before they approve an ActionRunner::propose() call.
 *
 * @class       ActionPreview class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class ActionPreview {

    /**
     * @var string
     */
    private string $title;

    /**
     * @var string|null Null when there's nothing to diff against (new content).
     */
    private ?string $before;

    /**
     * @var string
     */
    private string $after;

    /**
     * @var string One of 'text', 'html', 'json'.
     */
    private string $format;

    /**
     * @param string      $title  Short summary of what will change.
     * @param string|null $before Previous value, or null for new content.
     * @param string      $after  New/generated value.
     * @param string      $format One of 'text', 'html', 'json'.
     */
    public function __construct( string $title, ?string $before, string $after, string $format ) {
        $this->title  = $title;
        $this->before = $before;
        $this->after  = $after;
        $this->format = $format;
    }

    /**
     * @return string
     */
    public function get_title(): string {
        return $this->title;
    }

    /**
     * @return string|null
     */
    public function get_before(): ?string {
        return $this->before;
    }

    /**
     * @return string
     */
    public function get_after(): string {
        return $this->after;
    }

    /**
     * @return string
     */
    public function get_format(): string {
        return $this->format;
    }

    /**
     * @return string This preview's title, shown in activity-log messages.
     */
    public function get_summary(): string {
        return $this->title;
    }

    /**
     * @return array<string, mixed>
     */
    public function to_array(): array {
        return array(
            'title'  => $this->title,
            'before' => $this->before,
            'after'  => $this->after,
            'format' => $this->format,
        );
    }
}

/**
 * The outcome of a single Contracts\Automations\ActionInterface::execute()
 * call - AutomationEngine\AutomationEngine aggregates one or more of these
 * (an automation can run several actions in sequence) into the
 * `vulopilot_automations_runs` row's `actions_executed`/`actions_failed`
 * counts and `result_log`.
 *
 * @class       AutomationsRunResult class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class AutomationsRunResult {

    /**
     * @var bool
     */
    private bool $success;

    /**
     * @var string
     */
    private string $action_id;

    /**
     * @var string
     */
    private string $message;

    /**
     * @param bool   $success   Whether the action succeeded.
     * @param string $action_id The action's own get_id().
     * @param string $message   Human-readable outcome, success or failure.
     */
    public function __construct( bool $success, string $action_id, string $message ) {
        $this->success   = $success;
        $this->action_id = $action_id;
        $this->message   = $message;
    }

    /**
     * @return bool
     */
    public function is_success(): bool {
        return $this->success;
    }

    /**
     * @return string
     */
    public function get_action_id(): string {
        return $this->action_id;
    }

    /**
     * @return string
     */
    public function get_message(): string {
        return $this->message;
    }

    /**
     * @return array<string, mixed>
     */
    public function to_array(): array {
        return array(
            'success'   => $this->success,
            'action_id' => $this->action_id,
            'message'   => $this->message,
        );
    }
}

/**
 * A single issue surfaced by a Scanner. Immutable - every field is set at
 * construction time by the scanner that produced it.
 *
 * @class       Finding class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class Finding {

    /**
     * @var string
     */
    private string $title;

    /**
     * @var string One of Severity's constants.
     */
    private string $severity;

    /**
     * @var string
     */
    private string $category;

    /**
     * @var string
     */
    private string $description;

    /**
     * @var string|null e.g. 'post', 'attachment', 'user', 'url', 'plugin', 'table', 'core'.
     */
    private ?string $object_type;

    /**
     * @var string|null e.g. a post id, a URL, a table name.
     */
    private ?string $object_ref;

    /**
     * @var array<string, mixed>
     */
    private array $meta;

    /**
     * @var string|null A stable identity for this finding, independent of
     *                  `$title`'s exact text, used for dedupe matching.
     */
    private ?string $dedupe_key;

    /**
     * @param string      $title       Human-readable summary.
     * @param string      $severity    One of Severity's constants.
     * @param string      $category    Category this finding belongs to.
     * @param string      $description Longer explanation.
     * @param string|null $object_type What kind of thing this finding is about, if any.
     * @param string|null $object_ref  Reference to the specific object, if any.
     * @param array       $meta        Arbitrary scanner-specific extra data.
     * @param string|null $dedupe_key  A stable per-scanner identity for this
     *                                 finding to match on across rescans,
     *                                 for a scanner whose `$title` bakes in
     *                                 a live, scan-to-scan-fluctuating value
     *                                 (a word count, a score, a byte size, a
     *                                 count) that would otherwise defeat
     *                                 FindingRepository::find_open_duplicate()'s
     *                                 exact-`title`-match fallback - see
     *                                 that method's own docblock. Left
     *                                 `null` (the default) for every scanner
     *                                 whose title is already a stable
     *                                 identifying value on its own (a URL, a
     *                                 file path, a fixed name) or that can
     *                                 legitimately emit more than one
     *                                 Finding for the same `object_type`/
     *                                 `object_ref` in a single `scan()` call
     *                                 (dedupe then still falls back to
     *                                 matching the full `title`, exactly as
     *                                 before this param existed).
     */
    public function __construct(
        string $title,
        string $severity,
        string $category,
        string $description,
        ?string $object_type = null,
        ?string $object_ref = null,
        array $meta = array(),
        ?string $dedupe_key = null
    ) {
        $this->title       = $title;
        $this->severity    = $severity;
        $this->category    = $category;
        $this->description = $description;
        $this->object_type = $object_type;
        $this->object_ref  = $object_ref;
        $this->meta        = $meta;
        $this->dedupe_key  = $dedupe_key;
    }

    /**
     * @return string
     */
    public function get_title(): string {
        return $this->title;
    }

    /**
     * @return string
     */
    public function get_severity(): string {
        return $this->severity;
    }

    /**
     * @return string
     */
    public function get_category(): string {
        return $this->category;
    }

    /**
     * @return string|null
     */
    public function get_description(): ?string {
        return $this->description;
    }

    /**
     * @return string|null
     */
    public function get_object_type(): ?string {
        return $this->object_type;
    }

    /**
     * @return string|null
     */
    public function get_object_ref(): ?string {
        return $this->object_ref;
    }

    /**
     * @return array<string, mixed>
     */
    public function get_meta(): array {
        return $this->meta;
    }

    /**
     * @return string|null
     */
    public function get_dedupe_key(): ?string {
        return $this->dedupe_key;
    }
}

/**
 * A rule's estimated impact if its recommendation is resolved. Also reused,
 * unchanged, as the general LOW/MEDIUM/HIGH scale for an AI action's own
 * approval risk (AIActionInterface::get_risk_level(), Settings → Automation
 * → Approval Settings' `ai_change_approval_mode`) - the same "rank the
 * enum, compare ranks" idiom Automations\Actions\RunAiActionAction's own
 * IMPACT_RANK already applies to a Recommendation's impact, generalized
 * rather than introducing a second, near-identical LOW/MEDIUM/HIGH enum.
 *
 * @class       Impact class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class Impact {

    const HIGH   = 'high';
    const MEDIUM = 'medium';
    const LOW    = 'low';
}

/**
 * What RuleEngine\RuleEngine turns a Finding into, via a matching
 * RuleInterface::get_recommendation(). Fired in bulk as
 * `do_action('vulopilot_recommendations_generated', $recommendations, $findings)`.
 *
 * @class       Recommendation class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class Recommendation {

    /**
     * @var string
     */
    private string $rule_id;

    /**
     * @var string
     */
    private string $title;

    /**
     * @var string
     */
    private string $description;

    /**
     * @var string One of RuleType's constants.
     */
    private string $type;

    /**
     * @var int
     */
    private int $priority;

    /**
     * @var string[]
     */
    private array $categories;

    /**
     * @var string[]
     */
    private array $tags;

    /**
     * @var bool
     */
    private bool $is_fixable;

    /**
     * @var bool
     */
    private bool $requires_ai;

    /**
     * @var string One of Impact's constants.
     */
    private string $estimated_impact;

    /**
     * @var int
     */
    private int $estimated_time_minutes;

    /**
     * @var string|null
     */
    private ?string $object_type;

    /**
     * @var string|null
     */
    private ?string $object_ref;

    /**
     * @param string      $rule_id                 Rule that produced this recommendation.
     * @param string      $title                   Human-readable summary.
     * @param string      $description             Longer explanation.
     * @param string      $type                    One of RuleType's constants.
     * @param int         $priority                Higher sorts first.
     * @param string[]    $categories              Categories this recommendation belongs to.
     * @param string[]    $tags                    Freeform tags.
     * @param bool        $is_fixable              Whether an AIAction can automatically resolve this.
     * @param bool        $requires_ai             Whether resolving this requires an AI call.
     * @param string      $estimated_impact        One of Impact's constants.
     * @param int         $estimated_time_minutes  Estimated time to resolve.
     * @param string|null $object_type             From the triggering Finding, if any.
     * @param string|null $object_ref              From the triggering Finding, if any.
     */
    public function __construct(
        string $rule_id,
        string $title,
        string $description,
        string $type,
        int $priority,
        array $categories,
        array $tags,
        bool $is_fixable,
        bool $requires_ai,
        string $estimated_impact,
        int $estimated_time_minutes,
        ?string $object_type,
        ?string $object_ref
    ) {
        $this->rule_id                = $rule_id;
        $this->title                  = $title;
        $this->description            = $description;
        $this->type                   = $type;
        $this->priority               = $priority;
        $this->categories             = $categories;
        $this->tags                   = $tags;
        $this->is_fixable             = $is_fixable;
        $this->requires_ai            = $requires_ai;
        $this->estimated_impact       = $estimated_impact;
        $this->estimated_time_minutes = $estimated_time_minutes;
        $this->object_type            = $object_type;
        $this->object_ref             = $object_ref;
    }

    /**
     * @return string
     */
    public function get_rule_id(): string {
        return $this->rule_id;
    }

    /**
     * @return string
     */
    public function get_title(): string {
        return $this->title;
    }

    /**
     * @return string
     */
    public function get_description(): string {
        return $this->description;
    }

    /**
     * @return string
     */
    public function get_type(): string {
        return $this->type;
    }

    /**
     * @return int
     */
    public function get_priority(): int {
        return $this->priority;
    }

    /**
     * @return string[]
     */
    public function get_categories(): array {
        return $this->categories;
    }

    /**
     * @return string[]
     */
    public function get_tags(): array {
        return $this->tags;
    }

    /**
     * @return bool
     */
    public function is_fixable(): bool {
        return $this->is_fixable;
    }

    /**
     * @return bool
     */
    public function requires_ai(): bool {
        return $this->requires_ai;
    }

    /**
     * @return string
     */
    public function get_estimated_impact(): string {
        return $this->estimated_impact;
    }

    /**
     * @return int
     */
    public function get_estimated_time_minutes(): int {
        return $this->estimated_time_minutes;
    }

    /**
     * @return string|null
     */
    public function get_object_type(): ?string {
        return $this->object_type;
    }

    /**
     * @return string|null
     */
    public function get_object_ref(): ?string {
        return $this->object_ref;
    }

    /**
     * @return array<string, mixed>
     */
    public function to_array(): array {
        return array(
            'rule_id'                => $this->rule_id,
            'title'                  => $this->title,
            'description'            => $this->description,
            'type'                   => $this->type,
            'priority'               => $this->priority,
            'categories'             => $this->categories,
            'tags'                   => $this->tags,
            'is_fixable'             => $this->is_fixable,
            'requires_ai'            => $this->requires_ai,
            'estimated_impact'       => $this->estimated_impact,
            'estimated_time_minutes' => $this->estimated_time_minutes,
            'object_type'            => $this->object_type,
            'object_ref'             => $this->object_ref,
        );
    }
}

/**
 * The output of a single Contracts\Report\ReportTypeInterface::generate()
 * call - what Reports\ReportGenerator hands to a
 * Contracts\Report\ReportExporterInterface to render into a file, and what
 * gets JSON-encoded into `vulopilot_reports.meta` for provenance.
 *
 * @class       ReportResult class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class ReportResult {

    /**
     * @var string
     */
    private string $report_type;

    /**
     * @var string
     */
    private string $label;

    /**
     * @var string Y-m-d.
     */
    private string $period_start;

    /**
     * @var string Y-m-d.
     */
    private string $period_end;

    /**
     * @var array<string, int|float|string> Headline metrics shown at the top of the report.
     */
    private array $summary;

    /**
     * @var array<string, array<int, array<string, mixed>>> Section id => rows.
     */
    private array $sections;

    /**
     * @var array<string, array{current: int|float, previous: int|float, change_percent: float|null}>
     */
    private array $trend;

    /**
     * @param string                                                                                    $report_type  The generating ReportTypeInterface's own get_id().
     * @param string                                                                                    $label        Human-readable report title.
     * @param string                                                                                    $period_start Y-m-d.
     * @param string                                                                                    $period_end   Y-m-d.
     * @param array<string, int|float|string>                                                           $summary      Headline metrics.
     * @param array<string, array<int, array<string, mixed>>>                                           $sections     Section id => rows.
     * @param array<string, array{current: int|float, previous: int|float, change_percent: float|null}> $trend  Metric id => current/previous/change_percent, vs. the immediately preceding period of equal length.
     */
    public function __construct(
        string $report_type,
        string $label,
        string $period_start,
        string $period_end,
        array $summary,
        array $sections,
        array $trend = array()
    ) {
        $this->report_type  = $report_type;
        $this->label        = $label;
        $this->period_start = $period_start;
        $this->period_end   = $period_end;
        $this->summary      = $summary;
        $this->sections     = $sections;
        $this->trend        = $trend;
    }

    /**
     * @return string
     */
    public function get_report_type(): string {
        return $this->report_type;
    }

    /**
     * @return string
     */
    public function get_label(): string {
        return $this->label;
    }

    /**
     * @return string
     */
    public function get_period_start(): string {
        return $this->period_start;
    }

    /**
     * @return string
     */
    public function get_period_end(): string {
        return $this->period_end;
    }

    /**
     * @return array<string, int|float|string>
     */
    public function get_summary(): array {
        return $this->summary;
    }

    /**
     * @return array<string, array<int, array<string, mixed>>>
     */
    public function get_sections(): array {
        return $this->sections;
    }

    /**
     * @return array<string, array{current: int|float, previous: int|float, change_percent: float|null}>
     */
    public function get_trend(): array {
        return $this->trend;
    }

    /**
     * @return array<string, mixed>
     */
    public function to_array(): array {
        return array(
            'report_type'  => $this->report_type,
            'label'        => $this->label,
            'period_start' => $this->period_start,
            'period_end'   => $this->period_end,
            'summary'      => $this->summary,
            'sections'     => $this->sections,
            'trend'        => $this->trend,
        );
    }
}

/**
 * The kind of recommendation a rule produces.
 *
 * @class       RuleType class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class RuleType {

    const CRITICAL   = 'critical';
    const ERROR      = 'error';
    const WARNING    = 'warning';
    const SUGGESTION = 'suggestion';
}

/**
 * The outcome of running a single ScannerInterface - fired as
 * `do_action('vulopilot_scan_completed', $result)` by Scanners\ScanRunner.
 *
 * @class       ScanResult class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class ScanResult {

    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED    = 'failed';

    /**
     * @var string
     */
    private string $scanner_id;

    /**
     * @var string One of STATUS_COMPLETED/STATUS_FAILED.
     */
    private string $status;

    /**
     * @var Finding[]
     */
    private array $findings;

    /**
     * @var float
     */
    private float $duration_ms;

    /**
     * @var string|null
     */
    private ?string $error_message;

    /**
     * @var int[] Post/page IDs the scanner considered, whether or not each
     *            one produced a Finding - empty for a scanner that doesn't
     *            implement Contracts\Scanner\TracksScannedObjectsInterface
     *            (e.g. a site-wide, non-per-post check).
     */
    private array $scanned_post_ids;

    /**
     * @param string      $scanner_id       Scanner that produced this result.
     * @param string      $status           One of STATUS_COMPLETED/STATUS_FAILED.
     * @param Finding[]   $findings         Findings produced by the scan.
     * @param float       $duration_ms      How long the scan took.
     * @param string|null $error_message    Set when $status is STATUS_FAILED.
     * @param int[]       $scanned_post_ids Post/page IDs considered, findings or not.
     */
    public function __construct(
        string $scanner_id,
        string $status,
        array $findings,
        float $duration_ms,
        ?string $error_message = null,
        array $scanned_post_ids = array()
    ) {
        $this->scanner_id       = $scanner_id;
        $this->status           = $status;
        $this->findings         = $findings;
        $this->duration_ms      = $duration_ms;
        $this->error_message    = $error_message;
        $this->scanned_post_ids = $scanned_post_ids;
    }

    /**
     * @return string
     */
    public function get_scanner_id(): string {
        return $this->scanner_id;
    }

    /**
     * @return string
     */
    public function get_status(): string {
        return $this->status;
    }

    /**
     * @return float
     */
    public function get_duration_ms(): float {
        return $this->duration_ms;
    }

    /**
     * @return string|null
     */
    public function get_error_message(): ?string {
        return $this->error_message;
    }

    /**
     * @return Finding[]
     */
    public function get_findings(): array {
        return $this->findings;
    }

    /**
     * @return int[]
     */
    public function get_scanned_post_ids(): array {
        return $this->scanned_post_ids;
    }

    /**
     * Counts by severity/category, computed on demand rather than stored.
     *
     * @return array{by_severity: array<string, int>, by_category: array<string, int>, total: int}
     */
    public function get_summary(): array {
        $by_severity = array();
        $by_category = array();

        foreach ( $this->findings as $finding ) {
            $severity = $finding->get_severity();
            $category = $finding->get_category();

            $by_severity[ $severity ] = ( $by_severity[ $severity ] ?? 0 ) + 1;
            $by_category[ $category ] = ( $by_category[ $category ] ?? 0 ) + 1;
        }

        return array(
            'by_severity' => $by_severity,
            'by_category' => $by_category,
            'total'       => count( $this->findings ),
        );
    }
}

/**
 * Finding severity levels. Matches the `severity varchar(20)` column
 * Free's Install.php creates (DEFAULT 'info').
 *
 * @class       Severity class
 * @version     1.0.0
 * @author      VuloLabs
 */
final class Severity {

    const CRITICAL = 'critical';
    const HIGH     = 'high';
    const MEDIUM   = 'medium';
    const LOW      = 'low';
    const INFO     = 'info';

    /**
     * @return string[] Every valid severity, in descending order of urgency.
     */
    public static function all(): array {
        return array( self::CRITICAL, self::HIGH, self::MEDIUM, self::LOW, self::INFO );
    }

    /**
     * @param string $severity Value to check.
     * @return bool
     */
    public static function is_valid( string $severity ): bool {
        return in_array( $severity, self::all(), true );
    }
}
