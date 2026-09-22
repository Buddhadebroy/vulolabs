<?php
/**
 * Every class in this file used to be its own file under classes/RuleEngine/
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

namespace VuloPilot\RuleEngine;

use VuloPilot\Contracts\RuleEngine\RuleInterface;
use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Recommendation;
use VuloPilot\ValueObjects\ScanResult;

defined( 'ABSPATH' ) || exit;

/**
 * VuloPilot RuleEngine class.
 *
 * Runs every registered rule's applies_to() against a batch of Findings
 * and collects the Recommendation each match produces, sorted by
 * priority (highest first) so the dashboard/AI Assistant can just take
 * the top of the list. One rule throwing doesn't stop the batch - same
 * defensive posture as Scanners\ScanRunner toward third-party code.
 *
 * Self-hooks `vulopilot_scan_completed` (fired by Scanners\ScanRunner) so
 * every scan automatically flows into recommendations without either
 * engine needing to know about the other directly - ScanRunner has no
 * idea RuleEngine exists; RuleEngine only knows about ScanResult, a
 * shared value object, not about ScanRunner itself.
 *
 * Deliberately does not persist recommendations - same reasoning as
 * ScanRunner not persisting ScanResults (see ScanRunner's docblock):
 * that's the Repositories/Services layer's job, a separate pass.
 * RuleEngine fires `vulopilot_recommendations_generated` so that layer
 * (or anything else) can react.
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
     * Runs every registered rule against every Finding in a completed
     * scan. Failed scans (ScanResult::STATUS_FAILED) have no findings to
     * process and are ignored.
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
            Rules\MissingAltTextRule::class,
            Rules\UnresolvedCriticalFindingRule::class,
            Rules\CoreUpdateAvailableRule::class,
            Rules\DormantPluginRule::class,
            Rules\SeoTitleRewriteRule::class,
            // SEO module (SEO-MODULE.md).
            Rules\MissingMetaDescriptionRule::class,
            Rules\MissingFeaturedImageRule::class,
            Rules\RobotsBlockingCrawlersRule::class,
            // GEO module (GEO-MODULE.md).
            Rules\FaqOpportunityRule::class,
            Rules\MissingSummaryBlockRule::class,
            // WooCommerce Optimization (readme).
            Rules\MissingProductDescriptionRule::class,
            Rules\MissingProductShortDescriptionRule::class,
            Rules\MissingProductAttributesRule::class,
            Rules\DuplicateProductSkuRule::class,
            Rules\MissingProductPriceRule::class,
            Rules\ProductInventoryIssueRule::class,
            Rules\DuplicateProductRule::class,
            Rules\LowProductCompletenessRule::class,
            Rules\MissingProductCategoryRule::class,
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
