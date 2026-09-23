<?php
/**
 * RuleRegistry class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Utill;


defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot RuleRegistry class.
 *
 * Collects every registered rule and instantiates it - the RuleEngine
 * equivalent of Scanners\ScannerRegistry, same filter-based discovery
 * mechanism and same reasoning for why it isn't Modules.php's folder-scan
 * approach (see ScannerRegistry's docblock; a rule is one class
 * implementing one small interface, not a multi-file package). Free's own
 * 5 Basic rules always run; Pro's premium rules and any third-party rule
 * register on top via the `vulopilot_rule_sources` filter - see
 * RULE-ENGINE.md's "Extension strategy".
 *
 * @class       RuleRegistry class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RuleRegistry {

	/**
	 * Instantiated rules, keyed by their own get_id().
	 *
	 * @var array<string, RuleInterface>
	 */
	private array $rules = array();

	/**
	 * RuleRegistry constructor.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'register_rules' ), 20 );
	}

	/**
	 * Instantiates every registered rule class and indexes it by id. A
	 * rule class that doesn't exist, or doesn't implement RuleInterface,
	 * is silently skipped rather than fataling the whole registry.
	 *
	 * @return void
	 */
	public function register_rules(): void {
		$rule_classes = apply_filters( 'vulopilot_rule_sources', $this->get_default_rule_classes() );

		foreach ( $rule_classes as $rule_class ) {
			if ( ! is_string( $rule_class ) || ! class_exists( $rule_class ) ) {
				continue;
			}

			$rule = new $rule_class();

			if ( ! $rule instanceof RuleInterface ) {
				continue;
			}

			$this->rules[ $rule->get_id() ] = $rule;
		}
	}

	/**
	 * Free's own always-available rules.
	 *
	 * @return string[] Fully-qualified class names implementing RuleInterface.
	 */
	private function get_default_rule_classes(): array {
		return array(
			\VuloPilot\Accessibility\MissingAltTextRule::class,
			\VuloPilot\Utill\UnresolvedCriticalFindingRule::class,
			\VuloPilot\SiteHealth\CoreUpdateAvailableRule::class,
			\VuloPilot\SiteHealth\DormantPluginRule::class,
			\VuloPilot\SeoVisibility\SeoTitleRewriteRule::class,
			// SEO module (SEO-MODULE.md).
			\VuloPilot\SeoVisibility\MissingMetaDescriptionRule::class,
			\VuloPilot\SeoVisibility\MissingFeaturedImageRule::class,
			\VuloPilot\SeoVisibility\RobotsBlockingCrawlersRule::class,
			// GEO module (GEO-MODULE.md).
			\VuloPilot\Content\FaqOpportunityRule::class,
			\VuloPilot\Content\MissingSummaryBlockRule::class,
			// WooCommerce Optimization's 9 rules used to be hardcoded here
			// unconditionally. Per direct architecture decision, WooCommerce
			// detection is a Pro module like every other Pro module's
			// scanners/rules, so they've all moved to vulopilot-pro's
			// WooCommerceIntelligence module (`Rules/`), registered via
			// `vulopilot_rule_sources` and gated on WooCommerce actually
			// being active - see that module's own Module.php docblock.
		);
	}

	/**
	 * @param string $rule_id A rule's get_id().
	 * @return RuleInterface|null
	 */
	public function get_rule( string $rule_id ): ?RuleInterface {
		return $this->rules[ $rule_id ] ?? null;
	}

	/**
	 * @return array<string, RuleInterface>
	 */
	public function get_all_rules(): array {
		return $this->rules;
	}

	/**
	 * @param string $category e.g. 'seo', 'images'.
	 * @return array<string, RuleInterface>
	 */
	public function get_rules_by_category( string $category ): array {
		return array_filter(
			$this->rules,
			static fn( RuleInterface $rule ) => in_array( $category, $rule->get_categories(), true )
		);
	}
}
