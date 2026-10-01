<?php
/**
 * UnresolvedCriticalFindingRule file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * The cross-cutting rule: applies to any critical Finding regardless of category and gives
 * the highest-priority recommendation.
 *
 * @class       UnresolvedCriticalFindingRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class UnresolvedCriticalFindingRule extends AbstractBasicRule {

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'unresolved-critical-finding';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Critical issue needs attention', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_type(): string {
		return RuleType::CRITICAL;
	}

	/**
	 * @inheritDoc
	 */
	public function get_priority(): int {
		return 100;
	}

	/**
	 * @inheritDoc
	 */
	public function get_categories(): array {
		return array();
	}

	/**
	 * @inheritDoc
	 */
	public function get_estimated_impact(): string {
		return Impact::HIGH;
	}

	/**
	 * @inheritDoc
	 */
	public function get_estimated_time_minutes(): int {
		return 15;
	}

	/**
	 * @inheritDoc
	 */
	public function applies_to( Finding $finding ): bool {
		return Severity::CRITICAL === $finding->get_severity();
	}

	/**
	 * @inheritDoc
	 */
	public function get_recommendation( Finding $finding ): Recommendation {
		return new Recommendation(
			$this->get_id(),
			sprintf(
				/* translators: %s is the finding's own title. */
				__( 'Critical: %s', 'vulopilot' ),
				$finding->get_title()
			),
			$finding->get_description() ?? __( 'This was flagged as critical and should be addressed as soon as possible.', 'vulopilot' ),
			$this->get_type(),
			$this->get_priority(),
			array( $finding->get_category() ),
			$this->get_tags(),
			$this->is_fixable(),
			$this->requires_ai(),
			$this->get_estimated_impact(),
			$this->get_estimated_time_minutes(),
			$finding->get_object_type(),
			$finding->get_object_ref()
		);
	}
}
