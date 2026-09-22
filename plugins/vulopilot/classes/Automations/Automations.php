<?php
/**
 * Every class in this file used to be its own file under classes/Automations/
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

namespace VuloPilot\Automations;

use VuloPilot\Contracts\Automations\ActionInterface;
use VuloPilot\Repositories\AutomationsRepository;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\ValueObjects\Impact;
use VuloPilot\ValueObjects\Recommendation;
use VuloPilot\ValueObjects\RuleType;

defined( 'ABSPATH' ) || exit;

/**
 * Free's own action registry - deliberately separate from
 * vulopilot-pro's Automations\ActionRegistry (a different filter,
 * `vulopilot_manual_action_sources`, not `vulopilot_automations_action_sources`):
 * Pro's registry backs the full trigger→rule→action AutomationEngine
 * (cooldown, multi-recommendation fan-out, run history); this one backs
 * only ManualActionRunner's "run one action against one open finding, right
 * now" - no automation row, no trigger, no rule matching, no engine. Same
 * filter-based discovery shape as every other registry in this codebase
 * (ScannerRegistry/RuleRegistry/vulopilot-pro's own TriggerRegistry/
 * ActionRegistry) - see any of their docblocks for why this doesn't use
 * Modules.php's folder-scan mechanism for a single-class extension point.
 *
 * @class       ActionRegistry class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ActionRegistry {

    /**
     * @var array<string, ActionInterface>
     */
    private array $actions = array();

    /**
     * ActionRegistry constructor.
     */
    public function __construct() {
        add_action( 'init', array( $this, 'register_actions' ), 20 );
    }

    /**
     * @return void
     */
    public function register_actions(): void {
        $action_classes = apply_filters( 'vulopilot_manual_action_sources', $this->get_default_action_classes() );

        foreach ( $action_classes as $action_class ) {
            if ( ! is_string( $action_class ) || ! class_exists( $action_class ) ) {
                continue;
            }

            $action = new $action_class();

            if ( ! $action instanceof ActionInterface ) {
                continue;
            }

            $this->actions[ $action->get_id() ] = $action;
        }
    }

    /**
     * @return string[]
     */
    private function get_default_action_classes(): array {
        return array(
            Actions\SnoozeFindingAction::class,
        );
    }

    /**
     * @param string $action_id An action's get_id().
     * @return ActionInterface|null
     */
    public function get_action( string $action_id ): ?ActionInterface {
        return $this->actions[ $action_id ] ?? null;
    }

    /**
     * @return array<string, ActionInterface>
     */
    public function get_all_actions(): array {
        return $this->actions;
    }
}

/**
 * Seeds Free's own two fixed, schedule-only automations - "Run Full Site
 * Scan" and "Send Visibility Report" (VuloPilot Free vs Pro Automation
 * Builder Prompt.md: "Free will get only 2 predefined automations"). Real
 * `vulopilot_automations` rows, same table every automation (Free or Pro)
 * lives in, so they show up in the existing Automations table/dashboard
 * widget for free - but their own `trigger_type` (`TRIGGER_FULL_SITE_SCAN`/
 * `TRIGGER_VISIBILITY_REPORT`) is deliberately outside vulopilot-pro's
 * TriggerRegistry vocabulary (hourly/daily/weekly/monthly/...), so Pro's
 * AutomationsEngine - which is Recommendation-driven, see
 * WebsiteHealthScanScheduler's own docblock for why that engine can't run a
 * bare site-level action like these two - never selects or fires these
 * rows even when Pro is active. Services\AutomationScheduler is the only
 * thing that ever reads/runs them.
 *
 * Idempotent the same way vulopilot-pro's WebsiteHealthScanScheduler
 * already is: a stable `trigger_config.system_default` marker
 * (AutomationsRepository::find_by_system_default_marker()) means a renamed
 * row is never mistaken for "not seeded yet," and a site-wide "already
 * seeded" option means a deleted row is never silently resurrected.
 *
 * @class       BuiltinAutomationSeeder class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BuiltinAutomationSeeder {

    /**
     * @var string
     */
    public const TRIGGER_FULL_SITE_SCAN = 'free_full_site_scan';

    /**
     * @var string
     */
    public const TRIGGER_VISIBILITY_REPORT = 'free_visibility_report';

    /**
     * @var string Public - Services\AutomationScheduler looks its two rows up by these same markers.
     */
    public const MARKER_FULL_SITE_SCAN = 'free-full-site-scan';

    /**
     * @var string
     */
    public const MARKER_VISIBILITY_REPORT = 'free-visibility-report';

    /**
     * @var string
     */
    private const SEEDED_OPTION = 'vulopilot_builtin_automations_seeded';

    /**
     * @var AutomationsRepository
     */
    private AutomationsRepository $automations;

    /**
     * @param AutomationsRepository|null $automations Defaults to a new instance - injectable for tests.
     */
    public function __construct( ?AutomationsRepository $automations = null ) {
        $this->automations = $automations ?? new AutomationsRepository();

        add_action( 'init', array( $this, 'ensure_seeded' ), 20 );
    }

    /**
     * Runs on every request (cheap no-op after the first, via
     * SEEDED_OPTION) rather than only on activation - same posture
     * WebsiteHealthScanScheduler::ensure_seeded() already documents.
     *
     * @return void
     */
    public function ensure_seeded(): void {
        if ( get_option( self::SEEDED_OPTION ) ) {
            return;
        }

        $scan_ok = $this->ensure_row(
            self::MARKER_FULL_SITE_SCAN,
            self::TRIGGER_FULL_SITE_SCAN,
            __( 'Run Full Site Scan', 'vulopilot' ),
            'monitoring',
            array( 'frequency' => 'daily' ),
            array(
                array(
                    'type'   => 'run-full-site-scan',
                    'config' => array(),
                ),
            ),
            'enabled'
        );

        $report_ok = $this->ensure_row(
            self::MARKER_VISIBILITY_REPORT,
            self::TRIGGER_VISIBILITY_REPORT,
            __( 'Send Visibility Report', 'vulopilot' ),
            'reporting',
            array(
                'frequency'   => 'weekly',
                'day_of_week' => 1, // Monday, matching the spec's own example.
            ),
            array(
                array(
                    'type'   => 'send-visibility-report',
                    'config' => array(),
                ),
            ),
            'disabled' // Opt-in - unlike a schedule scan, an unsolicited recurring email shouldn't start firing without the site owner choosing it.
        );

        if ( $scan_ok && $report_ok ) {
            update_option( self::SEEDED_OPTION, '1', false );
        }
    }

    /**
     * @param string $marker         Stable `trigger_config.system_default` value.
     * @param string $trigger_type   One of this class's own TRIGGER_* constants.
     * @param string $name           Automation row name.
     * @param string $category       Automation row category.
     * @param array  $trigger_config Merged with `system_default` before insert.
     * @param array  $actions        Automation row `actions`.
     * @param string $default_status 'enabled'|'disabled'.
     * @return bool True if the row already existed or was just created; false only on a real insert failure (retried next request).
     */
    private function ensure_row( string $marker, string $trigger_type, string $name, string $category, array $trigger_config, array $actions, string $default_status ): bool {
        if ( $this->automations->find_by_system_default_marker( $marker ) ) {
            return true;
        }

        $trigger_config['system_default'] = $marker;

        $automation_id = $this->automations->insert(
            array(
                'name'           => $name,
                'rule_id'        => null,
                'category'       => $category,
                'trigger_type'   => $trigger_type,
                'trigger_config' => wp_json_encode( $trigger_config ),
                'conditions'     => null,
                'actions'        => wp_json_encode( $actions ),
                'status'         => $default_status,
                'created_by'     => 0, // System-seeded, not a specific admin user.
            )
        );

        return (bool) $automation_id;
    }
}

/**
 * "Manual Actions Only" (readme.txt) - Free's entire automation capability,
 * on purpose much smaller than vulopilot-pro's Automations module: run one
 * registered ActionInterface against one specific, already-known Finding,
 * right now, by hand. No trigger, no bound rule, no cooldown, no
 * `vulopilot_automations` row, no run history - those are exactly the
 * axes vulopilot-pro's own Automations module (Triggers/Conditions/
 * Schedules/Workflow Builder/Logs/Retries) adds on top of this.
 *
 * ActionInterface::execute() takes a Recommendation, not a Finding - this
 * class is the one place that builds a synthetic one directly off a real
 * Finding row (`rule_id` = self::MANUAL_RULE_ID) rather than getting it
 * from RuleEngine::generate_recommendations(), since a manual run has no
 * rule to have matched in the first place; the human, not a rule, decided
 * this action should run against this specific finding.
 *
 * @class       ManualActionRunner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ManualActionRunner {

    /**
     * Synthetic rule_id stamped on every Recommendation this class builds
     * - no RuleInterface produced it, so 'manual' is a stable, honest
     * marker rather than an empty string or a name borrowed from an
     * unrelated real rule.
     */
    private const MANUAL_RULE_ID = 'manual';

    /**
     * @var ActionRegistry
     */
    private ActionRegistry $actions;

    /**
     * @var FindingRepository
     */
    private FindingRepository $findings;

    /**
     * @param ActionRegistry         $actions  Registry to resolve the requested action id from.
     * @param FindingRepository|null $findings Defaults to a new instance (injectable for tests).
     */
    public function __construct( ActionRegistry $actions, ?FindingRepository $findings = null ) {
        $this->actions  = $actions;
        $this->findings = $findings ?? new FindingRepository();
    }

    /**
     * @param int    $finding_id A `vulopilot_scan_findings` row id.
     * @param string $action_id  A registered ActionInterface's get_id().
     * @return \VuloPilot\ValueObjects\AutomationsRunResult
     *
     * @throws \InvalidArgumentException If the finding or the action isn't found.
     */
    public function run( int $finding_id, string $action_id ) {
        $finding_row = $this->findings->find( $finding_id );

        if ( ! $finding_row ) {
            throw new \InvalidArgumentException( sprintf( 'No finding found for id %d.', absint( $finding_id ) ) );
        }

        $action = $this->actions->get_action( $action_id );

        if ( ! $action ) {
            throw new \InvalidArgumentException( sprintf( 'No manual action found for id %s.', esc_html( $action_id ) ) );
        }

        return $action->execute( $this->build_recommendation( $finding_row ), array() );
    }

    /**
     * @param array<string, mixed> $finding_row A `vulopilot_scan_findings` row.
     * @return Recommendation
     */
    private function build_recommendation( array $finding_row ): Recommendation {
        return new Recommendation(
            self::MANUAL_RULE_ID,
            (string) $finding_row['title'],
            (string) ( $finding_row['description'] ?? '' ),
            RuleType::SUGGESTION,
            0,
            array( (string) $finding_row['category'] ),
            array(),
            false,
            false,
            Impact::LOW,
            0,
            $finding_row['object_type'] ?? null,
            $finding_row['object_ref'] ?? null
        );
    }
}
