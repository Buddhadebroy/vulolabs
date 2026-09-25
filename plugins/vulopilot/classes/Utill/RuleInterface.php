<?php
/**
 * RuleInterface file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * @class       RuleInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface RuleInterface {

	/**
	 * @return string Unique, stable rule id.
	 */
	public function get_id(): string;

	/**
	 * @return string Human-readable label.
	 */
	public function get_label(): string;

	/**
	 * @return string One of ValueObjects\RuleType's constants.
	 */
	public function get_type(): string;

	/**
	 * @return int Higher runs/sorts first.
	 */
	public function get_priority(): int;

	/**
	 * @return string[] Categories this rule applies to; an empty array means "any category".
	 */
	public function get_categories(): array;

	/**
	 * @return string[]
	 */
	public function get_tags(): array;

	/**
	 * @return bool Whether an AIAction can automatically resolve this rule's recommendation.
	 */
	public function is_fixable(): bool;

	/**
	 * @return bool Whether resolving this rule's recommendation requires an AI call.
	 */
	public function requires_ai(): bool;

	/**
	 * @return string One of ValueObjects\Impact's constants.
	 */
	public function get_estimated_impact(): string;

	/**
	 * @return int
	 */
	public function get_estimated_time_minutes(): int;

	/**
	 * @return string 'free' or 'pro'.
	 */
	public function get_tier(): string;

	/**
	 * @param Finding $finding Finding to test.
	 * @return bool Whether this rule applies to the given finding.
	 */
	public function applies_to( Finding $finding ): bool;

	/**
	 * @param Finding $finding Finding to turn into a recommendation.
	 * @return Recommendation
	 */
	public function get_recommendation( Finding $finding ): Recommendation;
}
