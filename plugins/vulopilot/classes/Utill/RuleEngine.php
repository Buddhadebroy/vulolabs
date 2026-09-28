<?php
/**
 * RuleEngine class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot RuleEngine class.
 *
 * @class       RuleEngine class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RuleEngine {

	/**
	 * @var RuleRegistry
	 */
	private RuleRegistry $registry;

	/**
	 * @param RuleRegistry $registry Registry to pull rules from.
	 */
	public function __construct( RuleRegistry $registry ) {
		$this->registry = $registry;

		add_action( 'vulopilot_scan_completed', array( $this, 'handle_scan_completed' ) );
	}

	/**
	 * Runs every registered rule against every Finding in a completed scan.
	 *
	 * @param ScanResult $scan_result The completed scan.
	 * @return void
	 */
	public function handle_scan_completed( ScanResult $scan_result ): void {
		if ( ScanResult::STATUS_COMPLETED !== $scan_result->get_status() ) {
			return;
		}

		$this->generate_recommendations( $scan_result->get_findings() );
	}

	/**
	 * Runs every registered rule against a batch of Findings.
	 *
	 * @param Finding[] $findings Findings to evaluate.
	 * @return Recommendation[] Sorted by priority, highest first.
	 */
	public function generate_recommendations( array $findings ): array {
		$recommendations = array();

		foreach ( $findings as $finding ) {
			foreach ( $this->registry->get_all_rules() as $rule ) {
				try {
					if ( ! $rule->applies_to( $finding ) ) {
						continue;
					}

					$recommendations[] = $rule->get_recommendation( $finding );
				} catch ( \Throwable $exception ) {
					continue;
				}
			}
		}

		usort(
			$recommendations,
			static fn( Recommendation $a, Recommendation $b ) => $b->get_priority() <=> $a->get_priority()
		);

		do_action( 'vulopilot_recommendations_generated', $recommendations, $findings );

		return $recommendations;
	}
}
