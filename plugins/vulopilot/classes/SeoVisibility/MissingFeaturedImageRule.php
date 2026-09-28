<?php
/**
 * MissingFeaturedImageRule file.
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
 * Turns SeoImagesScanner's "no featured image" Finding into a recommendation.
 *
 * @class       MissingFeaturedImageRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class MissingFeaturedImageRule extends AbstractBasicRule {

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'missing-featured-image';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Missing featured image', 'vulopilot' );
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
		return 15;
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
		return array( 'seo', 'social-sharing' );
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
	public function get_estimated_impact(): string {
		return Impact::LOW;
	}

	/**
	 * @inheritDoc
	 */
	public function get_estimated_time_minutes(): int {
		return 3;
	}

	/**
	 * @inheritDoc
	 */
	public function applies_to( Finding $finding ): bool {
		// Matched on the `missing_featured_image` meta key SeoImagesScanner attaches.
		return 'seo' === $finding->get_category() && array_key_exists( 'missing_featured_image', $finding->get_meta() );
	}

	/**
	 * @inheritDoc
	 */
	public function get_recommendation( Finding $finding ): Recommendation {
		return new Recommendation(
			$this->get_id(),
			__( 'Set a featured image', 'vulopilot' ),
			sprintf(
				/* translators: %s is the finding's own title. */
				__( 'A featured image improves how this page previews when shared or displayed in some search formats: %s', 'vulopilot' ),
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
