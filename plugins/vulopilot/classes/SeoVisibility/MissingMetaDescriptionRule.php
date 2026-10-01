<?php
/**
 * MissingMetaDescriptionRule file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\SeoVisibility;

use VuloPilot\Utill\AbstractBasicRule;
use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Impact;
use VuloPilot\Utill\Recommendation;
use VuloPilot\Utill\RuleType;

defined( 'ABSPATH' ) || exit;

/**
 * Turns MetaDescriptionScanner's "no excerpt set" Finding into a recommendation to draft
 * one with AI.
 *
 * @class       MissingMetaDescriptionRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class MissingMetaDescriptionRule extends AbstractBasicRule {

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'missing-meta-description';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Missing meta description', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_type(): string {
		return RuleType::SUGGESTION;
	}

	/**
	 * @inheritDoc
	 */
	public function get_priority(): int {
		return 35;
	}

	/**
	 * @inheritDoc
	 */
	public function get_categories(): array {
		return array( 'seo' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_tags(): array {
		return array( 'seo', 'quick-win' );
	}

	/**
	 * @inheritDoc
	 */
	public function is_fixable(): bool {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function requires_ai(): bool {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function get_estimated_impact(): string {
		return Impact::MEDIUM;
	}

	/**
	 * @inheritDoc
	 */
	public function get_estimated_time_minutes(): int {
		return 2;
	}

	/**
	 * @inheritDoc
	 */
	public function applies_to( Finding $finding ): bool {
		// Matched on the `missing_description` meta key MetaDescriptionScanner attaches.
		return 'seo' === $finding->get_category() && array_key_exists( 'missing_description', $finding->get_meta() );
	}

	/**
	 * @inheritDoc
	 */
	public function get_recommendation( Finding $finding ): Recommendation {
		return new Recommendation(
			$this->get_id(),
			__( 'Ask AI to write a meta description', 'vulopilot' ),
			sprintf(
				/* translators: %s is the finding's own title. */
				__( 'A good description improves click-through from search results: %s', 'vulopilot' ),
				$finding->get_title()
			),
			$this->get_type(),
			$this->get_priority(),
			$this->get_categories(),
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
