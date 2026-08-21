<?php
/**
 * ConditionInterface file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Contracts\Automations;

use VuloPilot\ValueObjects\Recommendation;

/**
 * An extra, composable filter an automation can apply on top of its bound
 * rule (`trigger_config.rule_key`) — e.g. "only when priority is at least
 * 50" or "only for the 'images' category". Deliberately flat and ANDed
 * (AutomationEngine\AutomationEngine requires every configured condition to
 * match, same as it already requires the bound rule to match), not a
 * nested AND/OR tree — RULE-ENGINE.md rejected a composable condition-tree
 * abstraction for RuleInterface itself for the same reason: nothing in this
 * codebase yet needs one, and a flat ordered list (matching how an
 * automation's `actions` are already a flat ordered list, not a tree)
 * is enough to express "match this rule AND priority >= 50 AND category is
 * one of X". Implemented by AutomationEngine\Conditions\* (Pro) and
 * registered via `vulopilot_automations_condition_sources`.
 *
 * @class       ConditionInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface ConditionInterface {

    /**
     * @return string Unique, stable condition id (the `type` value stored
     *                in an automation's `conditions` JSON).
     */
    public function get_id(): string;

    /**
     * @return string Human-readable label.
     */
    public function get_label(): string;

    /**
     * @param Recommendation       $recommendation The recommendation an automation is deciding whether to act on.
     * @param array<string, mixed> $config         This condition's own config, from the automation's `conditions` JSON.
     * @return bool True if this condition is satisfied.
     */
    public function matches( Recommendation $recommendation, array $config ): bool;
}
