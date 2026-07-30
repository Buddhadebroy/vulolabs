<?php
/**
 * ManualActionRunner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Automation;

use VuloPilot\Repositories\FindingRepository;
use VuloPilot\ValueObjects\Impact;
use VuloPilot\ValueObjects\Recommendation;
use VuloPilot\ValueObjects\RuleType;

defined( 'ABSPATH' ) || exit;

/**
 * "Manual Actions Only" (readme.txt) — Free's entire automation capability,
 * on purpose much smaller than vulopilot-pro's Automation module: run one
 * registered ActionInterface against one specific, already-known Finding,
 * right now, by hand. No trigger, no bound rule, no cooldown, no
 * `vulopilot_automations` row, no run history — those are exactly the
 * axes vulopilot-pro's own Automation module (Triggers/Conditions/
 * Schedules/Workflow Builder/Logs/Retries) adds on top of this.
 *
 * ActionInterface::execute() takes a Recommendation, not a Finding — this
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
     * — no RuleInterface produced it, so 'manual' is a stable, honest
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
     * @return \VuloPilot\ValueObjects\AutomationRunResult
     *
     * @throws \InvalidArgumentException If the finding or the action isn't found.
     */
    public function run( int $finding_id, string $action_id ) {
        $finding_row = $this->findings->find( $finding_id );

        if ( ! $finding_row ) {
            throw new \InvalidArgumentException( sprintf( 'No finding found for id %d.', $finding_id ) );
        }

        $action = $this->actions->get_action( $action_id );

        if ( ! $action ) {
            throw new \InvalidArgumentException( sprintf( 'No manual action found for id %s.', $action_id ) );
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
