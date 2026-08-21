<?php
/**
 * ActionInterface file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Contracts\Automations;

use VuloPilot\ValueObjects\AutomationsRunResult;
use VuloPilot\ValueObjects\Recommendation;

/**
 * An Automation Engine action — deliberately simpler than
 * Contracts\AI\AIActionInterface's propose/approve/reject/rollback
 * lifecycle: these run synchronously when an automation's trigger fires
 * and its bound rule matches, with no separate human-approval step of
 * their own. An automation that *does* need human approval before making
 * a real change achieves it by using AutomationEngine\Actions\RunAiActionAction
 * to delegate into the AI Action system's own, already-built approval
 * flow, rather than this interface growing a second one.
 *
 * @class       ActionInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface ActionInterface {

    /**
     * @return string Unique, stable action id.
     */
    public function get_id(): string;

    /**
     * @return string Human-readable label.
     */
    public function get_label(): string;

    /**
     * @param Recommendation       $recommendation The recommendation that matched and triggered this run.
     * @param array<string, mixed> $config         This action's own config, from the automation's `actions` JSON.
     * @return AutomationsRunResult
     */
    public function execute( Recommendation $recommendation, array $config ): AutomationsRunResult;

    /**
     * Whether a *successful* execute() call actually changes something on
     * the site (a database row this codebase owns being updated, a real
     * fix applied) versus merely notifying someone about a recommendation
     * — what `vulopilot_automations_runs.changes_made` counts, distinct
     * from `actions_executed` (every action that ran without erroring,
     * change-making or not). True answers must be literal: an action that
     * only *proposes* a change and waits for separate human approval
     * (RunAiActionAction::execute() creates a `pending_approval` row and
     * stops there — see that class's own docblock) hasn't changed
     * anything yet, so it answers false here even though it's a
     * "does something real" action, not a notification.
     *
     * @return bool
     */
    public function changes_site_state(): bool;
}
