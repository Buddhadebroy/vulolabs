<?php
/**
 * ActionRegistry class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Automations;

use VuloPilot\Contracts\Automations\ActionInterface;

defined( 'ABSPATH' ) || exit;

/**
 * Free's own action registry — deliberately separate from
 * vulopilot-pro's Automations\ActionRegistry (a different filter,
 * `vulopilot_manual_action_sources`, not `vulopilot_automations_action_sources`):
 * Pro's registry backs the full trigger→rule→action AutomationEngine
 * (cooldown, multi-recommendation fan-out, run history); this one backs
 * only ManualActionRunner's "run one action against one open finding, right
 * now" — no automation row, no trigger, no rule matching, no engine. Same
 * filter-based discovery shape as every other registry in this codebase
 * (ScannerRegistry/RuleRegistry/vulopilot-pro's own TriggerRegistry/
 * ActionRegistry) — see any of their docblocks for why this doesn't use
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
