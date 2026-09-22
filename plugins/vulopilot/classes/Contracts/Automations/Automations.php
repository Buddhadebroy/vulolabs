<?php
/**
 * Every class in this file used to be its own file under classes/Contracts/Automations/
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

namespace VuloPilot\Contracts\Automations;

use VuloPilot\ValueObjects\AutomationsRunResult;
use VuloPilot\ValueObjects\Recommendation;

defined( 'ABSPATH' ) || exit;

/**
 * An Automation Engine action - deliberately simpler than
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
     * - what `vulopilot_automations_runs.changes_made` counts, distinct
     * from `actions_executed` (every action that ran without erroring,
     * change-making or not). True answers must be literal: an action that
     * only *proposes* a change and waits for separate human approval
     * (RunAiActionAction::execute() creates a `pending_approval` row and
     * stops there - see that class's own docblock) hasn't changed
     * anything yet, so it answers false here even though it's a
     * "does something real" action, not a notification.
     *
     * @return bool
     */
    public function changes_site_state(): bool;
}

/**
 * A trigger decides *when* AutomationEngine re-checks automations bound to
 * it - a cron tick (hourly/daily/weekly/monthly), a WordPress/WooCommerce
 * event (product created, order completed, …), or nothing at all for
 * triggers invoked directly (manual "Run now", REST/webhook call).
 * Implemented by AutomationEngine\Triggers\* (free) and any premium
 * trigger Pro registers via `vulopilot_trigger_sources`.
 *
 * @class       TriggerInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface TriggerInterface {

    /**
     * @return string Unique, stable trigger id (also the `trigger_type` value
     *                stored on an automation row).
     */
    public function get_id(): string;

    /**
     * @return string Human-readable label.
     */
    public function get_label(): string;

    /**
     * Hooks whatever WordPress/cron mechanism this trigger needs, calling
     * $on_fire whenever it fires. Triggers with no ambient firing mechanism
     * (manual, REST/webhook - invoked directly instead) may leave this a
     * no-op.
     *
     * @param callable $on_fire function( string $trigger_id, string $object_type, ?string $object_ref ): void.
     *                          $trigger_id is always $this->get_id() - passed back explicitly (rather than
     *                          relying on the closure's own scope) so AutomationEngine can filter automations
     *                          by `trigger_type` without needing a reference back to the trigger instance.
     * @return void
     */
    public function register( callable $on_fire ): void;
}
