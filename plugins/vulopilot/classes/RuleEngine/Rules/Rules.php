<?php
/**
 * Every class in this file used to be its own file under classes/RuleEngine/Rules/
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

namespace VuloPilot\RuleEngine\Rules;

use VuloPilot\Contracts\RuleEngine\RuleInterface;
use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Impact;
use VuloPilot\ValueObjects\Recommendation;
use VuloPilot\ValueObjects\RuleType;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Base class for every free-tier rule under RuleEngine/Rules/.
 *
 * get_tier() is shared for the same reason Scanners\Basic\AbstractBasicScanner
 * hard-codes it: every rule in this namespace is free-tier by definition.
 * get_tags()/is_fixable()/requires_ai()/get_estimated_impact()/
 * get_estimated_time_minutes() get sensible defaults (no tags, not
 * fixable, no AI required, medium impact, 5 minutes) - most rules only
 * need to override a couple of these, not restate all six every time. The
 * methods that meaningfully differ per rule (id/label/type/priority/
 * categories/applies_to/get_recommendation) stay abstract.
 *
 * @class       AbstractBasicRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class AbstractBasicRule implements RuleInterface {

    /**
     * @inheritDoc
     */
    public function get_tier(): string {
        return 'free';
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array();
    }

    /**
     * @inheritDoc
     */
    public function is_fixable(): bool {
        return false;
    }

    /**
     * @inheritDoc
     */
    public function requires_ai(): bool {
        return false;
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
        return 5;
    }

    /**
     * @inheritDoc
     */
    abstract public function get_id(): string;

    /**
     * @inheritDoc
     */
    abstract public function get_label(): string;

    /**
     * @inheritDoc
     */
    abstract public function get_type(): string;

    /**
     * @inheritDoc
     */
    abstract public function get_priority(): int;

    /**
     * @inheritDoc
     */
    abstract public function get_categories(): array;

    /**
     * @inheritDoc
     */
    abstract public function applies_to( \VuloPilot\ValueObjects\Finding $finding ): bool;

    /**
     * @inheritDoc
     */
    abstract public function get_recommendation( \VuloPilot\ValueObjects\Finding $finding ): \VuloPilot\ValueObjects\Recommendation;
}

/**
 * Turns Scanners\Basic\UpdatesScanner's WordPress-core-update Finding
 * (object_type 'core') into a recommendation to update now. Marked
 * fixable - a future automation action can trigger core's own update
 * routine directly - and doesn't require AI, since applying a WordPress
 * update is a deterministic operation with no content to generate.
 *
 * @class       CoreUpdateAvailableRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CoreUpdateAvailableRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'core-update-available';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'WordPress core update available', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_type(): string {
        return RuleType::ERROR;
    }

    /**
     * @inheritDoc
     */
    public function get_priority(): int {
        return 90;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'updates' );
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
        return Impact::HIGH;
    }

    /**
     * @inheritDoc
     */
    public function get_estimated_time_minutes(): int {
        return 10;
    }

    /**
     * @inheritDoc
     */
    public function applies_to( Finding $finding ): bool {
        return 'updates' === $finding->get_category() && 'core' === $finding->get_object_type();
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Update WordPress core now', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title, e.g. "WordPress core update available (6.9)". */
                __( 'Running an outdated core version increases security risk: %s', 'vulopilot' ),
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

/**
 * Turns Scanners\Basic\PluginsScanner's "inactive plugin installed"
 * Finding into a recommendation to remove or reactivate it. A warning
 * rather than an error or critical - a dormant plugin is a smaller,
 * lower-urgency risk than an active vulnerability or a broken checkout -
 * and low-impact/quick to resolve, since deleting an unused plugin from
 * Plugins > Installed Plugins takes moments.
 *
 * @class       DormantPluginRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class DormantPluginRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'dormant-plugin';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Remove or reactivate inactive plugin', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_type(): string {
        return RuleType::WARNING;
    }

    /**
     * @inheritDoc
     */
    public function get_priority(): int {
        return 20;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'plugins' );
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
        return 'plugins' === $finding->get_category() && 'plugin' === $finding->get_object_type();
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Clean up an unused plugin', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title, e.g. "Inactive plugin installed: Hello Dolly". */
                __( 'Inactive plugins still carry known vulnerabilities and disk footprint: %s', 'vulopilot' ),
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

/**
 * Not fixable/AI-assisted - whether two identically-titled products are a
 * genuine accidental duplicate (merge/delete one) or intentional (e.g. two
 * different variations sold as separate simple products) is a judgment
 * call for the store owner, not something to resolve automatically.
 *
 * @class       DuplicateProductRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class DuplicateProductRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'duplicate-product';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Review possible duplicate product', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_type(): string {
        return RuleType::WARNING;
    }

    /**
     * @inheritDoc
     */
    public function get_priority(): int {
        return 55;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'woocommerce' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'woocommerce', 'catalog-quality' );
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
        return 10;
    }

    /**
     * @inheritDoc
     */
    public function applies_to( Finding $finding ): bool {
        return 'woocommerce' === $finding->get_category() && 'duplicate_title' === ( $finding->get_meta()['check'] ?? null );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Review this possible duplicate', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title. */
                __( 'Decide whether to merge, rename, or keep both listings: %s', 'vulopilot' ),
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

/**
 * Not fixable/AI-assisted - which product's SKU is the "correct" one and
 * what the duplicate should be renamed to is a store-owner decision this
 * codebase has no basis to guess at. Surfaced anyway because a duplicate
 * SKU silently breaks inventory tracking and any integration keyed off it.
 *
 * @class       DuplicateProductSkuRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class DuplicateProductSkuRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'duplicate-product-sku';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Duplicate SKU breaks inventory tracking', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_type(): string {
        return RuleType::ERROR;
    }

    /**
     * @inheritDoc
     */
    public function get_priority(): int {
        return 75;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'woocommerce' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'woocommerce', 'inventory' );
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
        return 5;
    }

    /**
     * @inheritDoc
     */
    public function applies_to( Finding $finding ): bool {
        return 'woocommerce' === $finding->get_category() && 'duplicate_sku' === ( $finding->get_meta()['check'] ?? null );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Assign a unique SKU', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title. */
                __( 'This SKU is shared with another product, which breaks inventory and integration lookups that assume it is unique: %s', 'vulopilot' ),
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

/**
 * Turns Geo\Scanners\GeoFaqOpportunityScanner's "no FAQ-style
 * questions" Finding into a recommendation to draft one with AI - good
 * FAQ questions have to actually anticipate what a reader would ask
 * about this specific content, which needs the content itself, the same
 * reasoning SeoTitleRewriteRule/MissingMetaDescriptionRule already
 * establish for AI-required rules. Pairs with
 * AiCopilot\Actions\GenerateFaqAction (GEO-MODULE.md).
 *
 * @class       FaqOpportunityRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FaqOpportunityRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'faq-opportunity';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Add an FAQ section', 'vulopilot' );
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
        return 30;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'geo' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'geo', 'ai-search' );
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
        return 3;
    }

    /**
     * @inheritDoc
     */
    public function applies_to( Finding $finding ): bool {
        // Matched on the `faq_opportunity` meta key GeoFaqOpportunityScanner
        // attaches specifically for this - category 'geo' alone is shared
        // by 9 scanners now (GEO-MODULE.md), and `word_count` alone would
        // also match GeoSummaryBlockScanner/ThinContentScanner findings,
        // so a scanner-specific key (not the Finding's already-translated
        // title text) is what disambiguates, same discipline
        // MissingMetaDescriptionRule/MissingFeaturedImageRule established.
        return 'geo' === $finding->get_category() && array_key_exists( 'faq_opportunity', $finding->get_meta() );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Ask AI to draft an FAQ section', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title. */
                __( 'Question-phrased headings are more likely to be lifted directly into an AI answer engine\'s response: %s', 'vulopilot' ),
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

/**
 * The one recommendation with requires_ai() true but is_fixable() false -
 * Scanners\Basic\ProductCompletenessScanner's score is a composite across
 * 7 fields, so there is no single AIAction that resolves it directly the
 * way MissingProductDescriptionRule pairs with one action. AI can still
 * help (e.g. the AI Assistant page reasoning about which specific field to
 * tackle first), just not through the propose/approve one-click flow.
 *
 * @class       LowProductCompletenessRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class LowProductCompletenessRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'low-product-completeness';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product listing needs more detail', 'vulopilot' );
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
        return 45;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'woocommerce' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'woocommerce', 'catalog-quality' );
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
        return 15;
    }

    /**
     * @inheritDoc
     */
    public function applies_to( Finding $finding ): bool {
        return 'woocommerce' === $finding->get_category() && 'low_completeness' === ( $finding->get_meta()['check'] ?? null );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Fill in the missing product details', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title, which already includes the completeness percentage. */
                __( 'This listing is missing several of image, categories, tags, descriptions, SKU, or price: %s', 'vulopilot' ),
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

/**
 * The flagship example from RULE-ENGINE.md: turns
 * Seo\Scanners\ImagesScanner's "image missing alt text" Finding into a
 * concrete "generate an ALT text suggestion" recommendation. Writing good
 * alt text requires actually understanding what the image shows, which is
 * why this is the one rule where requires_ai() is true and is_fixable()
 * is also true - an AI call generates the suggestion, an
 * automation action (once built) could apply it.
 *
 * @class       MissingAltTextRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class MissingAltTextRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'missing-alt-text';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Missing image alt text', 'vulopilot' );
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
        return 40;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'images' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'accessibility', 'seo', 'quick-win' );
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
        return 'images' === $finding->get_category() && 'attachment' === $finding->get_object_type();
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Generate an ALT text suggestion', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title, e.g. "Image missing alt text: photo.jpg". */
                __( 'AI can draft alt text for this image based on what it shows: %s', 'vulopilot' ),
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

/**
 * Turns Seo\Scanners\SeoImagesScanner's "no featured image" Finding
 * into a recommendation. Deliberately fixable() = true but
 * requires_ai() = false - unlike MissingAltTextRule/SeoTitleRewriteRule/
 * MissingMetaDescriptionRule, there's nothing for AI to generate here:
 * "pick a featured image" is a mechanical editorial task (open the post,
 * choose or upload an image), the same shape DormantPluginRule's
 * fixable-but-manual recommendation already established.
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
        // Matched on the `missing_featured_image` meta key SeoImagesScanner
        // attaches - category alone ('seo') is shared by 14 different
        // scanners now (SEO-MODULE.md), so it can't distinguish this
        // finding from any other SEO finding on its own.
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

/**
 * Turns Seo\Scanners\MetaDescriptionScanner's "no excerpt set" Finding
 * into a recommendation to draft one with AI - same reasoning as
 * SeoTitleRewriteRule: a good description has to actually summarize the
 * page's content, which needs the content itself, not a fixed template.
 * Pairs with AiCopilot\Actions\Seo\WriteMetaDescriptionAction
 * (SEO-MODULE.md) by the same by-convention id match AI-ACTIONS.md
 * documents for MissingAltTextRule ↔ GenerateAltAction.
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
        // Matched on the `missing_description` meta key MetaDescriptionScanner
        // attaches - not the Finding's title text, which is already
        // translated by the time a rule sees it and so isn't a reliable
        // matcher under any locale but English (the same reason
        // SeoTitleRewriteRule matches on a meta key, not title text).
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

/**
 * Not fixable/AI-assisted - deciding what attributes a variable product
 * should have (size, color, material, …) and what variations to generate
 * from them is a business decision, not something an AI action can safely
 * apply automatically. Still worth surfacing as a recommendation: this
 * scanner catches a product that looks published but cannot actually be
 * bought, which is high-impact even without an automated fix.
 *
 * @class       MissingProductAttributesRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class MissingProductAttributesRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'missing-product-attributes';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Variable product cannot be purchased', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_type(): string {
        return RuleType::ERROR;
    }

    /**
     * @inheritDoc
     */
    public function get_priority(): int {
        return 80;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'woocommerce' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'woocommerce', 'conversion' );
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
        return 10;
    }

    /**
     * @inheritDoc
     */
    public function applies_to( Finding $finding ): bool {
        return 'woocommerce' === $finding->get_category() && 'missing_attributes' === ( $finding->get_meta()['check'] ?? null );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Add attributes so this product can be purchased', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title. */
                __( 'This variable product has no attributes, so WooCommerce cannot generate any purchasable variation: %s', 'vulopilot' ),
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

/**
 * Not fixable/AI-assisted - which category (or categories) a product
 * belongs to is a store-taxonomy decision, not something to guess and
 * apply automatically. Still worth its own recommendation: an
 * uncategorized product is effectively unreachable through normal shop
 * browsing.
 *
 * @class       MissingProductCategoryRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class MissingProductCategoryRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'missing-product-category';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product is not reachable by category browse', 'vulopilot' );
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
        return 50;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'woocommerce' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'woocommerce', 'catalog-quality' );
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
        return 'woocommerce' === $finding->get_category() && 'missing_category' === ( $finding->get_meta()['check'] ?? null );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Assign this product to a category', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title. */
                __( 'Without a category, this product does not appear in any shop category browse: %s', 'vulopilot' ),
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

/**
 * WooCommerce AI's "AI Improvements" fix loop (ARCHITECTURE.md's Prompt 11):
 * turns Scanners\Basic\ProductMissingDescriptionScanner's Finding into a
 * recommendation to generate a long description, closed by
 * AiCopilot\Actions\WriteProductLongDescriptionAction - the same
 * Finding-to-Recommendation-to-Action shape as MissingAltTextRule's.
 *
 * @class       MissingProductDescriptionRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class MissingProductDescriptionRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'missing-product-description';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product needs a description', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_type(): string {
        return RuleType::WARNING;
    }

    /**
     * @inheritDoc
     */
    public function get_priority(): int {
        return 60;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'woocommerce' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'woocommerce', 'seo', 'conversion' );
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
        return Impact::HIGH;
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
        return 'woocommerce' === $finding->get_category() && 'missing_description' === ( $finding->get_meta()['check'] ?? null );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Write a product description', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title. */
                __( 'AI can draft a long description from this product\'s title, price, and category: %s', 'vulopilot' ),
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

/**
 * The most urgent WooCommerce recommendation this pass produces - a
 * published product with no price literally cannot be bought. Not
 * fixable/AI-assisted: setting a real price is a business decision this
 * codebase should never guess at.
 *
 * @class       MissingProductPriceRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class MissingProductPriceRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'missing-product-price';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product cannot be purchased without a price', 'vulopilot' );
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
        return 95;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'woocommerce' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'woocommerce', 'conversion' );
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
        return 3;
    }

    /**
     * @inheritDoc
     */
    public function applies_to( Finding $finding ): bool {
        return 'woocommerce' === $finding->get_category() && 'missing_price' === ( $finding->get_meta()['check'] ?? null );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Set a regular price', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title. */
                __( 'This published product has no regular price and cannot be added to cart: %s', 'vulopilot' ),
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

/**
 * Closed by AiCopilot\Actions\WriteProductShortDescriptionAction. Lower
 * priority/impact than MissingProductDescriptionRule - the short
 * description is a conversion nicety next to the add-to-cart button, not
 * the primary body of on-page product content the long description is.
 *
 * @class       MissingProductShortDescriptionRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class MissingProductShortDescriptionRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'missing-product-short-description';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product needs a short description', 'vulopilot' );
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
        return 40;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'woocommerce' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'woocommerce', 'conversion' );
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
        return 'woocommerce' === $finding->get_category() && 'missing_short_description' === ( $finding->get_meta()['check'] ?? null );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Write a short description', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title. */
                __( 'AI can draft a short summary for the add-to-cart area: %s', 'vulopilot' ),
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

/**
 * Turns Geo\Scanners\GeoSummaryBlockScanner's "no upfront summary"
 * Finding into a recommendation to draft one with AI - a good summary
 * has to actually distill this specific content's key points, which
 * needs the content itself. Pairs with
 * AiCopilot\Actions\GenerateSummaryBlockAction (GEO-MODULE.md).
 *
 * @class       MissingSummaryBlockRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class MissingSummaryBlockRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'missing-summary-block';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Add a summary block', 'vulopilot' );
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
        return 30;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'geo' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'geo', 'ai-search' );
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
        return 3;
    }

    /**
     * @inheritDoc
     */
    public function applies_to( Finding $finding ): bool {
        // Matched on the `missing_summary_block` meta key
        // GeoSummaryBlockScanner attaches specifically for this - see
        // FaqOpportunityRule's docblock for why category/word_count alone
        // aren't specific enough among 9 scanners sharing category 'geo'.
        return 'geo' === $finding->get_category() && array_key_exists( 'missing_summary_block', $finding->get_meta() );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Ask AI to write a summary block', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title. */
                __( 'A short upfront summary makes this content easier for AI answer engines to extract a direct answer from: %s', 'vulopilot' ),
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

/**
 * Covers both of Scanners\Basic\ProductInventoryHealthScanner's checks
 * ('invalid_stock_quantity' and 'instock_zero_quantity') under one rule -
 * both are the same underlying problem (the tracked quantity doesn't
 * reflect reality) and warrant the identical recommendation: go verify and
 * correct the real stock count. Not AI-fixable - the actual quantity is
 * physical-world information this codebase has no way to know.
 *
 * @class       ProductInventoryIssueRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductInventoryIssueRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-inventory-issue';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Inventory quantity looks incorrect', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_type(): string {
        return RuleType::ERROR;
    }

    /**
     * @inheritDoc
     */
    public function get_priority(): int {
        return 70;
    }

    /**
     * @inheritDoc
     */
    public function get_categories(): array {
        return array( 'woocommerce' );
    }

    /**
     * @inheritDoc
     */
    public function get_tags(): array {
        return array( 'woocommerce', 'inventory' );
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
        return 5;
    }

    /**
     * @inheritDoc
     */
    public function applies_to( Finding $finding ): bool {
        return 'woocommerce' === $finding->get_category()
            && in_array( $finding->get_meta()['check'] ?? null, array( 'invalid_stock_quantity', 'instock_zero_quantity' ), true );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Verify and correct the stock quantity', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title. */
                __( 'This product\'s tracked inventory does not match a state WooCommerce can sell against safely: %s', 'vulopilot' ),
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

/**
 * Turns Seo\Scanners\RobotsTxtScanner's "robots.txt blocks every
 * crawler" HIGH-severity Finding into a critical recommendation.
 * Deliberately NOT fixable - unlike MissingMetaDescriptionRule/
 * MissingFeaturedImageRule, automatically rewriting a site's robots.txt
 * (a single file controlling crawl access to the entire site) is exactly
 * the kind of high-blast-radius change no AIAction here should make
 * unattended; a site owner needs to look at the file and understand why
 * that rule is there before it's removed, the same reasoning
 * License/LicenseManager.php's vendored-code handling applies to "don't
 * automate what's too risky to get wrong."
 *
 * @class       RobotsBlockingCrawlersRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RobotsBlockingCrawlersRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'robots-blocking-crawlers';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'robots.txt is blocking search engines', 'vulopilot' );
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
        return 95;
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
        return array( 'seo', 'indexing' );
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
        return 10;
    }

    /**
     * @inheritDoc
     */
    public function applies_to( Finding $finding ): bool {
        // Matched on the `blocks_all_crawlers` meta key RobotsTxtScanner
        // attaches only to this specific finding - RobotsTxtScanner's
        // other finding (robots.txt unreachable) and every other
        // category-'seo' scanner sharing object_type 'url' (SchemaScanner,
        // SitemapScanner, OpenGraphScanner, …) would otherwise collide.
        return 'seo' === $finding->get_category() && array_key_exists( 'blocks_all_crawlers', $finding->get_meta() );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Review and fix robots.txt', 'vulopilot' ),
            __( 'robots.txt is currently telling every search engine not to crawl any page on this site. If unintentional, this can remove the site from search results entirely.', 'vulopilot' ),
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

/**
 * Turns Seo\Scanners\SeoScanner's title-length Finding into a
 * recommendation to rewrite the title. Like MissingAltTextRule, this
 * needs AI: a good title has to actually summarize the page's content
 * within a length constraint, which isn't something a fixed template can
 * produce well.
 *
 * @class       SeoTitleRewriteRule class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SeoTitleRewriteRule extends AbstractBasicRule {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'seo-title-rewrite';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Improve page title for search results', 'vulopilot' );
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
        return 30;
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
    public function applies_to( Finding $finding ): bool {
        // SEO-MODULE.md added 13 more scanners sharing the 'seo' category
        // alongside the original SeoScanner this rule was written for -
        // category alone is no longer specific enough to mean "a title
        // length problem." SeoScanner is the only scanner that attaches a
        // `title_length` meta key, so checking for it is what keeps this
        // rule from firing on, say, a thin-content or duplicate-title
        // finding that also happens to be category 'seo'.
        return 'seo' === $finding->get_category() && array_key_exists( 'title_length', $finding->get_meta() );
    }

    /**
     * @inheritDoc
     */
    public function get_recommendation( Finding $finding ): Recommendation {
        return new Recommendation(
            $this->get_id(),
            __( 'Ask AI to rewrite this title', 'vulopilot' ),
            sprintf(
                /* translators: %s is the finding's own title. */
                __( 'A search-optimized title improves click-through from search results: %s', 'vulopilot' ),
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

/**
 * The one cross-cutting rule in this set: applies to any Finding with
 * Severity::CRITICAL regardless of category (get_categories() returns an
 * empty array - see RuleInterface's docblock for what that means), and
 * always produces the engine's highest-priority recommendation. Not
 * marked fixable - a critical finding could come from any scanner
 * (WooCommerceScanner's missing checkout page, RestApiScanner's exposed
 * user data, …) and there's no single generic fix to offer; a
 * category-specific rule with a real fix (like CoreUpdateAvailableRule)
 * can still also match the same Finding and offer one.
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
