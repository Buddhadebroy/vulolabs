<?php
/**
 * ActionInterface file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

use VuloPilot\Automations\AutomationsRunResult;

defined( 'ABSPATH' ) || exit;

/**
 * An automation action. Runs synchronously when the trigger fires and the rule matches,
 * with no separate approval step.
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
	 * Whether a successful execute() changes something on the site, versus only notifying.
	 * Counted as `changes_made` in automation runs.
	 *
	 * @return bool
	 */
	public function changes_site_state(): bool;
}
