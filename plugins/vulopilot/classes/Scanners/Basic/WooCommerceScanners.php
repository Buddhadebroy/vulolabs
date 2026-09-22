<?php
/**
 * Every class in this file used to be its own file under classes/Scanners/Basic/
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

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Flags variable products with zero attributes defined. A variable
 * product's variations are generated from its attributes - with none set,
 * WooCommerce cannot generate any variation at all, so the product is
 * effectively unpurchasable despite appearing to exist. Simple products
 * are skipped entirely: attributes are optional filtering/display data for
 * them, not a structural requirement the way they are for a variable
 * product's variations.
 *
 * @class       ProductAttributesScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductAttributesScanner extends AbstractBasicScanner {

    private const PRODUCTS_BATCH_SIZE = 100;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-attributes';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product Attributes', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'type'   => 'variable',
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product || ! empty( $product->get_attributes() ) ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the product's name. */
                    __( 'Variable product has no attributes: %s', 'vulopilot' ),
                    $product->get_name()
                ),
                Severity::HIGH,
                $this->get_category(),
                __( 'A variable product needs at least one attribute to generate any purchasable variation; without one, this product cannot actually be bought.', 'vulopilot' ),
                'product',
                (string) $product->get_id(),
                array( 'check' => 'missing_attributes' )
            );
        }

        return $findings;
    }
}

/**
 * Product Intelligence's "Product Completeness" check (ARCHITECTURE.md's
 * Prompt 11) - a single deterministic score per product across a fixed
 * checklist (image, categories, tags, short description, long description,
 * SKU, price), rather than a separate scanner per field the way the other
 * ProductMissing*Scanners already are. Those field-level scanners exist so
 * each gap gets its own precise, individually-fixable Finding; this one
 * exists so the dashboard/reports can show one number per product instead
 * of requiring someone to mentally tally seven separate findings. Not an
 * AI-scored analysis like GeoAnalysis\GeoAnalyzer's GeoScore - that's a
 * distinct, larger feature ("AI Product Review") explicitly out of scope
 * for this pass; this is the deterministic half only.
 *
 * @class       ProductCompletenessScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductCompletenessScanner extends AbstractBasicScanner {

    private const PRODUCTS_BATCH_SIZE = 100;

    /**
     * A product scoring below this out of 100 is flagged. Each of the 7
     * checklist items below is worth roughly 100/7 ≈ 14 points.
     */
    private const MIN_ACCEPTABLE_SCORE = 60;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-completeness';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product Completeness', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product ) {
                continue;
            }

            $score = $this->calculate_completeness_score( $product );

            if ( $score >= self::MIN_ACCEPTABLE_SCORE ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: 1: product name, 2: completeness score out of 100. */
                    __( 'Product listing is incomplete (%2$d%%): %1$s', 'vulopilot' ),
                    $product->get_name(),
                    $score
                ),
                $score < 30 ? Severity::HIGH : Severity::MEDIUM,
                $this->get_category(),
                __( 'Scored against image, categories, tags, short description, long description, SKU, and price - each missing item lowers the score.', 'vulopilot' ),
                'product',
                (string) $product->get_id(),
                array(
                    'check'              => 'low_completeness',
                    'completeness_score' => $score,
                ),
                'product-completeness'
            );
        }

        return $findings;
    }

    /**
     * @param \WC_Product $product Product to score.
     * @return int 0-100.
     */
    private function calculate_completeness_score( \WC_Product $product ): int {
        $checklist = array(
            (bool) $product->get_image_id(),
            ! empty( $product->get_category_ids() ),
            ! empty( $product->get_tag_ids() ),
            '' !== trim( wp_strip_all_tags( $product->get_short_description() ) ),
            str_word_count( wp_strip_all_tags( $product->get_description() ) ) >= 20,
            '' !== trim( $product->get_sku() ),
            '' !== $product->get_regular_price(),
        );

        $passed = count( array_filter( $checklist ) );

        return (int) round( ( $passed / count( $checklist ) ) * 100 );
    }
}

/**
 * Flags published products that share the exact same title
 * (case-insensitive, whitespace-trimmed) with at least one other
 * published product - a common symptom of an accidental duplicate import
 * or a copy-paste-new-product workflow that never got renamed. Deliberately
 * an exact-title match, not fuzzy/AI similarity - a cheap, deterministic
 * first pass; AI Product Review (a separate, richer per-product analysis)
 * is where a fuzzier "these two products look similar" judgment belongs.
 *
 * @class       ProductDuplicateScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductDuplicateScanner extends AbstractBasicScanner {

    private const PRODUCTS_BATCH_SIZE = 200;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-duplicate';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Duplicate Products', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        $products_by_title = array();

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product ) {
                continue;
            }

            $normalized_title = strtolower( trim( $product->get_name() ) );

            if ( '' === $normalized_title ) {
                continue;
            }

            $products_by_title[ $normalized_title ][] = $product;
        }

        foreach ( $products_by_title as $matching_products ) {
            if ( count( $matching_products ) < 2 ) {
                continue;
            }

            foreach ( $matching_products as $product ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the product's name. */
                        __( 'Possible duplicate product: %s', 'vulopilot' ),
                        $product->get_name()
                    ),
                    Severity::MEDIUM,
                    $this->get_category(),
                    sprintf(
                        /* translators: %d is how many products share this exact title. */
                        __( '%d published products share this exact title, which usually indicates an accidental duplicate.', 'vulopilot' ),
                        count( $matching_products )
                    ),
                    'product',
                    (string) $product->get_id(),
                    array( 'check' => 'duplicate_title' )
                );
            }
        }

        return $findings;
    }
}

/**
 * Flags two inventory-tracking inconsistencies: a product with stock
 * management enabled whose recorded quantity is null or negative (a data
 * problem, since WooCommerce expects a non-negative integer once tracking
 * is on), and a product marked 'in stock' with a tracked quantity of zero
 * or less (a status/quantity mismatch that lets customers order something
 * that isn't actually available).
 *
 * @class       ProductInventoryHealthScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductInventoryHealthScanner extends AbstractBasicScanner {

    private const PRODUCTS_BATCH_SIZE = 200;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-inventory-health';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product Inventory', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product || ! $product->get_manage_stock() ) {
                continue;
            }

            $quantity = $product->get_stock_quantity();

            if ( null === $quantity || $quantity < 0 ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the product's name. */
                        __( 'Product has an invalid stock quantity: %s', 'vulopilot' ),
                        $product->get_name()
                    ),
                    Severity::HIGH,
                    $this->get_category(),
                    __( 'Stock management is enabled for this product but its recorded quantity is missing or negative.', 'vulopilot' ),
                    'product',
                    (string) $product->get_id(),
                    array( 'check' => 'invalid_stock_quantity' )
                );
                continue;
            }

            if ( 'instock' === $product->get_stock_status() && $quantity <= 0 ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the product's name. */
                        __( 'Product is marked in stock with zero quantity: %s', 'vulopilot' ),
                        $product->get_name()
                    ),
                    Severity::HIGH,
                    $this->get_category(),
                    __( 'This product is purchasable and shown as in-stock, but its tracked quantity is zero - customers can order something that is not actually available.', 'vulopilot' ),
                    'product',
                    (string) $product->get_id(),
                    array( 'check' => 'instock_zero_quantity' )
                );
            }
        }

        return $findings;
    }
}

/**
 * Flags published products with no `product_cat` term assigned - an
 * uncategorized product doesn't appear in any shop-page category browse
 * or category-scoped widget, so it's effectively unreachable except via
 * direct link or search.
 *
 * @class       ProductMissingCategoriesScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductMissingCategoriesScanner extends AbstractBasicScanner {

    private const PRODUCTS_BATCH_SIZE = 100;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-missing-categories';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product Categories', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product || ! empty( $product->get_category_ids() ) ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the product's name. */
                    __( 'Product has no category: %s', 'vulopilot' ),
                    $product->get_name()
                ),
                Severity::MEDIUM,
                $this->get_category(),
                __( 'An uncategorized product does not appear in any shop category browse or category widget.', 'vulopilot' ),
                'product',
                (string) $product->get_id(),
                array( 'check' => 'missing_category' )
            );
        }

        return $findings;
    }
}

/**
 * Flags published products whose long description (`post_content`) is
 * empty or too short to be useful - the product-specific counterpart to
 * ThinContentScanner, which only looks at `post`/`page`. Kept as a
 * separate scanner rather than widening ThinContentScanner's post-type
 * list, since the threshold and fix path (WriteProductLongDescriptionAction,
 * not ImproveReadabilityAction) are both product-specific.
 *
 * @class       ProductMissingDescriptionScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductMissingDescriptionScanner extends AbstractBasicScanner {

    private const PRODUCTS_BATCH_SIZE = 100;
    private const MIN_WORD_COUNT      = 20;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-missing-description';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product Descriptions', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product ) {
                continue;
            }

            $word_count = str_word_count( wp_strip_all_tags( $product->get_description() ) );

            if ( $word_count >= self::MIN_WORD_COUNT ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the product's name. */
                    __( 'Product has little or no description: %s', 'vulopilot' ),
                    $product->get_name()
                ),
                Severity::MEDIUM,
                $this->get_category(),
                sprintf(
                    /* translators: %d is the minimum recommended word count. */
                    __( 'A thin product description hurts both SEO and conversion; aim for at least %d words explaining what the product is and why to buy it.', 'vulopilot' ),
                    self::MIN_WORD_COUNT
                ),
                'product',
                (string) $product->get_id(),
                array( 'check' => 'missing_description' )
            );
        }

        return $findings;
    }
}

/**
 * WooCommerce AI's Product Intelligence pass (ARCHITECTURE.md's Prompt 11):
 * flags published products with no featured image - the single most
 * visible product-data gap, since a product with no image renders as a
 * placeholder everywhere it's listed (shop archive, cart, related
 * products). Guards on WooCommerce being active the same way
 * WooCommerceScanner does, since VuloPilot has no hard WooCommerce
 * dependency.
 *
 * @class       ProductMissingImagesScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductMissingImagesScanner extends AbstractBasicScanner {

    private const PRODUCTS_BATCH_SIZE = 100;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-missing-images';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product Images', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product || $product->get_image_id() ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the product's name. */
                    __( 'Product has no featured image: %s', 'vulopilot' ),
                    $product->get_name()
                ),
                Severity::MEDIUM,
                $this->get_category(),
                __( 'A product with no featured image shows a placeholder on the shop archive, cart, and related-product widgets.', 'vulopilot' ),
                'product',
                (string) $product->get_id(),
                array( 'check' => 'missing_image' )
            );
        }

        return $findings;
    }
}

/**
 * Flags published products with an empty short description
 * (`post_excerpt`) - the summary WooCommerce renders directly beside the
 * add-to-cart button on the single product page, distinct from
 * ProductMissingDescriptionScanner's long-description check.
 *
 * @class       ProductMissingShortDescriptionScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductMissingShortDescriptionScanner extends AbstractBasicScanner {

    private const PRODUCTS_BATCH_SIZE = 100;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-missing-short-description';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product Short Descriptions', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product || '' !== trim( wp_strip_all_tags( $product->get_short_description() ) ) ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the product's name. */
                    __( 'Product has no short description: %s', 'vulopilot' ),
                    $product->get_name()
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'The short description appears next to the add-to-cart button on the product page; an empty one leaves that space blank.', 'vulopilot' ),
                'product',
                (string) $product->get_id(),
                array( 'check' => 'missing_short_description' )
            );
        }

        return $findings;
    }
}

/**
 * Flags published products with no `product_tag` term. Lower severity
 * than ProductMissingCategoriesScanner - a missing category makes a
 * product unreachable via browse navigation, a missing tag only weakens
 * cross-linking (related products, tag clouds), so this is Severity::LOW,
 * not MEDIUM.
 *
 * @class       ProductMissingTagsScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductMissingTagsScanner extends AbstractBasicScanner {

    private const PRODUCTS_BATCH_SIZE = 100;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-missing-tags';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product Tags', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product || ! empty( $product->get_tag_ids() ) ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the product's name. */
                    __( 'Product has no tags: %s', 'vulopilot' ),
                    $product->get_name()
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'Tags help WooCommerce surface related products and power tag-based browsing; an untagged product misses both.', 'vulopilot' ),
                'product',
                (string) $product->get_id(),
                array( 'check' => 'missing_tags' )
            );
        }

        return $findings;
    }
}

/**
 * Flags two pricing problems: a purchasable simple product with no
 * regular price set at all (it cannot legally be added to cart in this
 * state), and a sale price that is greater than or equal to the regular
 * price (a discount that isn't actually a discount). Variable products
 * are skipped - their variations each carry their own price, checked at
 * the variation level, not the parent product level.
 *
 * @class       ProductPricingScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductPricingScanner extends AbstractBasicScanner {

    private const PRODUCTS_BATCH_SIZE = 200;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-pricing';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product Pricing', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'type'   => array( 'simple', 'external', 'grouped' ),
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product ) {
                continue;
            }

            $regular_price = $product->get_regular_price();

            if ( '' === $regular_price || null === $regular_price ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the product's name. */
                        __( 'Product has no price set: %s', 'vulopilot' ),
                        $product->get_name()
                    ),
                    Severity::CRITICAL,
                    $this->get_category(),
                    __( 'A published product with no regular price cannot be purchased.', 'vulopilot' ),
                    'product',
                    (string) $product->get_id(),
                    array( 'check' => 'missing_price' )
                );
                continue;
            }

            $sale_price = $product->get_sale_price();

            if ( '' !== $sale_price && null !== $sale_price && (float) $sale_price >= (float) $regular_price ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the product's name. */
                        __( 'Product sale price is not a real discount: %s', 'vulopilot' ),
                        $product->get_name()
                    ),
                    Severity::MEDIUM,
                    $this->get_category(),
                    __( 'The sale price is greater than or equal to the regular price, so it advertises a discount that does not actually reduce the price.', 'vulopilot' ),
                    'product',
                    (string) $product->get_id(),
                    array( 'check' => 'invalid_sale_price' )
                );
            }
        }

        return $findings;
    }
}

/**
 * "Product SEO" (readme.txt Phase 9) - the product-specific counterpart to
 * SeoScanner, which only looks at `post`/`page` (its own docblock: a
 * dedicated meta-description field can't be checked generically, since its
 * meta key varies by whichever SEO plugin, if any, is active - the title
 * itself is the one thing every install has). Title length only, same
 * 10-60 character thresholds SeoScanner already uses: a product's short
 * description (`post_excerpt`) is already monitored by
 * ProductMissingShortDescriptionScanner under its own product-page-UX
 * framing, so re-checking that same field here under an "SEO" label would
 * be a duplicate finding for the same underlying gap, not a new check.
 *
 * @class       ProductSeoScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductSeoScanner extends AbstractBasicScanner {

    private const TITLE_MIN_LENGTH    = 10;
    private const TITLE_MAX_LENGTH    = 60;
    private const PRODUCTS_BATCH_SIZE = 100;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-seo';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product SEO', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product ) {
                continue;
            }

            $title_length = mb_strlen( trim( $product->get_name() ) );

            if ( $title_length >= self::TITLE_MIN_LENGTH && $title_length <= self::TITLE_MAX_LENGTH ) {
                continue;
            }

            $findings[] = new Finding(
                $title_length < self::TITLE_MIN_LENGTH
                    ? sprintf(
                        /* translators: %s is the product's name. */
                        __( 'Product title is too short for search results: %s', 'vulopilot' ),
                        $product->get_name()
                    )
                    : sprintf(
                        /* translators: %s is the product's name. */
                        __( 'Product title may be truncated in search results: %s', 'vulopilot' ),
                        $product->get_name()
                    ),
                Severity::LOW,
                $this->get_category(),
                sprintf(
                    /* translators: 1: minimum recommended title length, 2: maximum recommended title length. */
                    __( 'Search engines display roughly %1$d–%2$d characters of a title before truncating.', 'vulopilot' ),
                    self::TITLE_MIN_LENGTH,
                    self::TITLE_MAX_LENGTH
                ),
                'product',
                (string) $product->get_id(),
                array( 'title_length' => $title_length )
            );
        }

        return $findings;
    }
}

/**
 * Flags two distinct SKU problems in one pass since both require the same
 * full product list to detect: a published, purchasable product with no
 * SKU at all (Severity::LOW - inventory/ops inconvenience, not
 * customer-facing), and two or more products sharing the same non-empty
 * SKU (Severity::HIGH - breaks inventory tracking, shipping integrations,
 * and third-party catalog sync that key off SKU as a unique identifier).
 *
 * @class       ProductSkuIssuesScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductSkuIssuesScanner extends AbstractBasicScanner {

    private const PRODUCTS_BATCH_SIZE = 200;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'product-sku-issues';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Product SKUs', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return $findings;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => self::PRODUCTS_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        $products_by_sku = array();

        foreach ( $products as $product ) {
            if ( ! $product instanceof \WC_Product ) {
                continue;
            }

            $sku = trim( $product->get_sku() );

            if ( '' === $sku ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the product's name. */
                        __( 'Product has no SKU: %s', 'vulopilot' ),
                        $product->get_name()
                    ),
                    Severity::LOW,
                    $this->get_category(),
                    __( 'A SKU is how inventory tools, shipping integrations, and catalog feeds identify this exact product.', 'vulopilot' ),
                    'product',
                    (string) $product->get_id(),
                    array( 'check' => 'missing_sku' )
                );
                continue;
            }

            $products_by_sku[ $sku ][] = $product;
        }

        foreach ( $products_by_sku as $sku => $matching_products ) {
            if ( count( $matching_products ) < 2 ) {
                continue;
            }

            foreach ( $matching_products as $product ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: 1: SKU value, 2: product name. */
                        __( 'Duplicate SKU "%1$s": %2$s', 'vulopilot' ),
                        $sku,
                        $product->get_name()
                    ),
                    Severity::HIGH,
                    $this->get_category(),
                    sprintf(
                        /* translators: %d is how many products share this SKU. */
                        __( 'This SKU is shared by %d products, which breaks inventory tracking and any integration that relies on SKU uniqueness.', 'vulopilot' ),
                        count( $matching_products )
                    ),
                    'product',
                    (string) $product->get_id(),
                    array(
                        'check' => 'duplicate_sku',
                        'sku'   => $sku,
                    )
                );
            }
        }

        return $findings;
    }
}

/**
 * "Checkout & Payments" - two real risks the original WooCommerceScanner
 * doesn't cover (that one only checks whether a gateway is enabled at
 * all, not its configuration): checkout served over plain HTTP, and a
 * payment gateway still left in test/sandbox mode. Test-mode detection is
 * necessarily a best-effort, documented list - WooCommerce core has no
 * single "is this gateway in test mode" API; each gateway extension
 * defines its own settings option and key. Covers the 4 most common
 * WooCommerce payment extensions (Stripe, PayPal Payments, Square,
 * Braintree - real settings-option/key names, confirmed against each
 * plugin's own source). A gateway outside this list is silently skipped
 * rather than guessed at.
 *
 * @class       WooCommerceCheckoutScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceCheckoutScanner extends AbstractBasicScanner {

	/**
	 * gateway_id => { option: settings option name, key: the field to
	 * read, value: (optional) the exact string that means "test mode" -
	 * omitted for plain WC-style yes/no checkboxes, where any of
	 * 'yes'/'1'/true means enabled.
	 *
	 * @var array<string, array{option: string, key: string, value?: string}>
	 */
	private const GATEWAY_TEST_MODE_CHECKS = array(
		'stripe'                => array(
			'option' => 'woocommerce_stripe_settings',
			'key'    => 'testmode',
		),
		'ppcp-gateway'          => array(
			'option' => 'woocommerce-ppcp-settings',
			'key'    => 'sandbox_on',
		),
		'square_credit_card'    => array(
			'option' => 'woocommerce_square_credit_card_settings',
			'key'    => 'sandbox',
		),
		'braintree_credit_card' => array(
			'option' => 'woocommerce_braintree_credit_card_settings',
			'key'    => 'environment',
			'value'  => 'sandbox',
		),
	);

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'woocommerce-checkout';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Checkout & Payments', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'woocommerce';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_page_id' ) ) {
			return array();
		}

		return array_merge(
			array_filter( array( $this->check_checkout_ssl() ) ),
			$this->check_gateway_test_mode()
		);
	}

	/**
	 * @return Finding|null
	 */
	private function check_checkout_ssl(): ?Finding {
		$checkout_page_id = wc_get_page_id( 'checkout' );

		if ( $checkout_page_id <= 0 || is_ssl() ) {
			return null;
		}

		return new Finding(
			__( 'Checkout is not served over HTTPS', 'vulopilot' ),
			Severity::HIGH,
			$this->get_category(),
			__( 'Customers are asked for payment details on an insecure connection - enable SSL and force HTTPS on the checkout page.', 'vulopilot' ),
			'setting',
			'woocommerce_checkout_ssl'
		);
	}

	/**
	 * @return Finding[]
	 */
	private function check_gateway_test_mode(): array {
		if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
			return array();
		}

		$findings            = array();
		$enabled_gateway_ids = array_keys( WC()->payment_gateways()->get_available_payment_gateways() );

		foreach ( $enabled_gateway_ids as $gateway_id ) {
			if ( ! isset( self::GATEWAY_TEST_MODE_CHECKS[ $gateway_id ] ) ) {
				continue;
			}

			$check    = self::GATEWAY_TEST_MODE_CHECKS[ $gateway_id ];
			$settings = get_option( $check['option'], array() );
			$raw      = is_array( $settings ) ? ( $settings[ $check['key'] ] ?? null ) : null;

			if ( null === $raw ) {
				continue;
			}

			$is_test_mode = isset( $check['value'] )
				? $check['value'] === $raw
				: in_array( $raw, array( 'yes', '1', 1, true ), true );

			if ( ! $is_test_mode ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: %s is the payment gateway's id, e.g. "stripe". */
					__( '%s is in test mode', 'vulopilot' ),
					ucfirst( str_replace( array( '-gateway', '_credit_card' ), '', $gateway_id ) )
				),
				Severity::HIGH,
				$this->get_category(),
				__( 'This payment gateway is live on the store but still set to test/sandbox mode - real customers cannot complete a real payment through it.', 'vulopilot' ),
				'setting',
				'woocommerce_payment_gateway_test_mode_' . $gateway_id
			);
		}

		return $findings;
	}
}

/**
 * "Compatibility" - one real finding per theme-overridden WooCommerce
 * template file that's older than the version WooCommerce core itself
 * now ships. Not a heuristic: this is the exact same
 * `WC_Admin_Status::scan_template_files()` + `get_file_version()` +
 * `version_compare()` comparison WooCommerce's own System Status page
 * (Tools > Status) already runs to populate its "Templates" section - a
 * theme's own copy of a WC template can silently miss bug fixes/new
 * hooks that shipped in a newer core template, causing subtle checkout/
 * cart/product-page bugs that are hard to trace back to "the theme's
 * template override is stale."
 *
 * @class       WooCommerceCompatibilityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceCompatibilityScanner extends AbstractBasicScanner {

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'woocommerce-compatibility';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Compatibility', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'woocommerce';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'WC' ) || ! defined( 'WC_ABSPATH' ) ) {
			return array();
		}

		if ( ! class_exists( '\WC_Admin_Status' ) ) {
			require_once WC_ABSPATH . 'includes/admin/class-wc-admin-status.php';
		}

		if ( ! class_exists( '\WC_Admin_Status' ) || ! function_exists( 'wc_locate_template' ) ) {
			return array();
		}

		$wc_templates_dir = trailingslashit( WC()->plugin_path() ) . 'templates/';
		$scan_files        = \WC_Admin_Status::scan_template_files( $wc_templates_dir );
		$findings          = array();

		foreach ( $scan_files as $file ) {
			$located = wc_locate_template( $file, WC()->template_path(), $wc_templates_dir );

			// Not overridden by the active theme - nothing to compare.
			if ( 0 === strpos( $located, $wc_templates_dir ) || ! file_exists( $located ) ) {
				continue;
			}

			$core_version     = \WC_Admin_Status::get_file_version( $wc_templates_dir . $file );
			$override_version = \WC_Admin_Status::get_file_version( $located );

			if ( ! $core_version || '' === $override_version || ! version_compare( $override_version, $core_version, '<' ) ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: %s is the template file's relative path, e.g. "cart/cart.php". */
					__( 'Outdated theme template override: %s', 'vulopilot' ),
					$file
				),
				Severity::LOW,
				$this->get_category(),
				sprintf(
					/* translators: 1: the theme's own template version, 2: WooCommerce core's current template version. */
					__( 'The active theme\'s copy of this template is version %1$s, but WooCommerce core is now on %2$s - the theme\'s override may be missing fixes or hooks from newer versions.', 'vulopilot' ),
					$override_version,
					$core_version
				),
				'setting',
				str_replace( ABSPATH, '', $located )
			);
		}

		return $findings;
	}
}

/**
 * "Orders" - one real finding per order WooCommerce itself marked
 * `wc-failed` (a real payment attempt that didn't complete) in the last
 * LOOKBACK_DAYS. Bounded to a recent window, same
 * performance-bounding convention Pro's own
 * InventoryIntelligenceScanner::get_sales_velocity_by_product() already
 * follows for its own order query, rather than an unbounded historical
 * scan on every run.
 *
 * @class       WooCommerceFailedOrdersScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceFailedOrdersScanner extends AbstractBasicScanner {

	private const LOOKBACK_DAYS = 30;
	private const ORDERS_BATCH_SIZE = 200;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'woocommerce-failed-orders';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Failed Orders', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'woocommerce';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_orders' ) ) {
			return array();
		}

		$order_ids = wc_get_orders(
			array(
				'status'       => array( 'failed' ),
				'date_created' => '>' . ( time() - self::LOOKBACK_DAYS * DAY_IN_SECONDS ),
				'limit'        => self::ORDERS_BATCH_SIZE,
				'return'       => 'ids',
			)
		);

		$findings = array();

		foreach ( $order_ids as $order_id ) {
			$order = wc_get_order( $order_id );

			if ( ! $order instanceof \WC_Order ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: %d is the order number. */
					__( 'Payment failed for order #%d', 'vulopilot' ),
					$order->get_order_number()
				),
				Severity::HIGH,
				$this->get_category(),
				__( 'This order\'s payment attempt failed - the customer never completed checkout. Follow up or the sale is lost.', 'vulopilot' ),
				'order',
				(string) $order_id
			);
		}

		return $findings;
	}
}

/**
 * "Store Health" (readme.txt Phase 9) - four checks over whether the
 * store is even minimally able to sell, bundled into one scanner rather
 * than four (same "several related hardening checks, one scanner"
 * pattern BasicVulnerabilitiesScanner's own docblock already establishes
 * for a different category): a missing/unpublished checkout page (the
 * original, pre-Phase-9 check - customers can't complete an order at
 * all), a missing/unpublished cart page, a missing/unpublished My Account
 * page, no store base location configured, and no enabled payment
 * gateway. VuloPilot itself has no hard dependency on WooCommerce (unlike
 * vulolabs-pro - see plugin-families.md) - this is the one scanner that's
 * inherently WooCommerce-specific, so it guards on WooCommerce actually
 * being active and simply returns no findings otherwise, rather than the
 * whole plugin requiring WooCommerce to load.
 *
 * @class       WooCommerceScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'WooCommerce', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'woocommerce';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_page_id' ) ) {
            return array();
        }

        return array_values(
            array_filter(
                array(
                    $this->check_essential_page( 'checkout', __( 'checkout', 'vulopilot' ), Severity::CRITICAL ),
                    $this->check_essential_page( 'cart', __( 'cart', 'vulopilot' ), Severity::HIGH ),
                    $this->check_essential_page( 'myaccount', __( 'My Account', 'vulopilot' ), Severity::MEDIUM ),
                    $this->check_base_location(),
                    $this->check_payment_gateways(),
                )
            )
        );
    }

    /**
     * @param string $page_id_key WooCommerce's own `wc_get_page_id()` key ('checkout'/'cart'/'myaccount').
     * @param string $page_label  Human-readable name for the Finding text.
     * @param string $severity    One of Severity's constants.
     * @return Finding|null
     */
    private function check_essential_page( string $page_id_key, string $page_label, string $severity ): ?Finding {
        $page_id = wc_get_page_id( $page_id_key );

        if ( $page_id > 0 && 'publish' === get_post_status( $page_id ) ) {
            return null;
        }

        return new Finding(
            sprintf(
                /* translators: %s is the page's own name, e.g. "checkout". */
                __( 'No published %s page configured', 'vulopilot' ),
                $page_label
            ),
            $severity,
            $this->get_category(),
            sprintf(
                /* translators: %s is the page's own name, e.g. "checkout". */
                __( 'WooCommerce > Settings > Advanced must point this to a published page, or customers cannot use the %s.', 'vulopilot' ),
                $page_label
            ),
            'setting',
            'woocommerce_' . $page_id_key . '_page_id'
        );
    }

    /**
     * `woocommerce_default_country` is a real WooCommerce core setting,
     * never empty on a normally-configured store (its own onboarding wizard
     * requires it) - an empty value here means the store setup wizard was
     * skipped or the option was cleared, and every location-dependent
     * feature (tax rates, shipping zones, currency defaults) has nothing to
     * key off.
     *
     * @return Finding|null
     */
    private function check_base_location(): ?Finding {
        if ( '' !== trim( (string) get_option( 'woocommerce_default_country', '' ) ) ) {
            return null;
        }

        return new Finding(
            __( 'No store base location configured', 'vulopilot' ),
            Severity::HIGH,
            $this->get_category(),
            __( 'WooCommerce > Settings > General\'s "Store address" country/state must be set - tax rates, shipping zones, and currency defaults all key off this.', 'vulopilot' ),
            'setting',
            'woocommerce_default_country'
        );
    }

    /**
     * @return Finding|null
     */
    private function check_payment_gateways(): ?Finding {
        if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
            return null;
        }

        if ( ! empty( WC()->payment_gateways()->get_available_payment_gateways() ) ) {
            return null;
        }

        return new Finding(
            __( 'No payment gateway is enabled', 'vulopilot' ),
            Severity::CRITICAL,
            $this->get_category(),
            __( 'WooCommerce > Settings > Payments has no enabled gateway - customers can reach checkout but cannot actually pay.', 'vulopilot' ),
            'setting',
            'woocommerce_payment_gateways'
        );
    }
}

/**
 * "Orders" - one real finding per order still `wc-on-hold` after
 * STALE_AFTER_DAYS. WooCommerce itself uses on-hold for orders awaiting
 * manual verification (offline payment, manual fraud review, stock
 * awaiting confirmation) - a real order sitting in that state this long
 * usually means it was never actually reviewed, not that review is still
 * genuinely in progress.
 *
 * @class       WooCommerceStaleOnHoldOrdersScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceStaleOnHoldOrdersScanner extends AbstractBasicScanner {

	private const STALE_AFTER_DAYS = 7;
	private const ORDERS_BATCH_SIZE = 200;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'woocommerce-stale-onhold-orders';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Stale On-Hold Orders', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'woocommerce';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_orders' ) ) {
			return array();
		}

		$order_ids = wc_get_orders(
			array(
				'status'       => array( 'on-hold' ),
				'date_created' => '<' . ( time() - self::STALE_AFTER_DAYS * DAY_IN_SECONDS ),
				'limit'        => self::ORDERS_BATCH_SIZE,
				'return'       => 'ids',
			)
		);

		$findings = array();

		foreach ( $order_ids as $order_id ) {
			$order = wc_get_order( $order_id );

			if ( ! $order instanceof \WC_Order ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: 1: the order number, 2: how many days it's been on hold. */
					__( 'Order #%1$d has been on hold for over %2$d days', 'vulopilot' ),
					$order->get_order_number(),
					self::STALE_AFTER_DAYS
				),
				Severity::MEDIUM,
				$this->get_category(),
				__( 'This order has been awaiting manual review (payment verification, stock, or fraud check) longer than usual - it likely needs attention.', 'vulopilot' ),
				'order',
				(string) $order_id
			);
		}

		return $findings;
	}
}

/**
 * "Orders" - one real finding per order still stuck in `wc-pending`
 * (payment initiated but never confirmed) after STALE_AFTER_HOURS. A
 * pending order this old almost always means the customer abandoned
 * checkout mid-payment or a payment webhook never arrived - distinct
 * from WooCommerceFailedOrdersScanner's own `wc-failed` orders (WooCommerce
 * only marks an order failed when a gateway explicitly reports failure;
 * plenty of abandoned payments just sit in `pending` forever instead).
 *
 * @class       WooCommerceStalePendingOrdersScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WooCommerceStalePendingOrdersScanner extends AbstractBasicScanner {

	private const STALE_AFTER_HOURS = 48;
	private const ORDERS_BATCH_SIZE = 200;

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'woocommerce-stale-pending-orders';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Stale Pending Orders', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'woocommerce';
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_orders' ) ) {
			return array();
		}

		$order_ids = wc_get_orders(
			array(
				'status'       => array( 'pending' ),
				'date_created' => '<' . ( time() - self::STALE_AFTER_HOURS * HOUR_IN_SECONDS ),
				'limit'        => self::ORDERS_BATCH_SIZE,
				'return'       => 'ids',
			)
		);

		$findings = array();

		foreach ( $order_ids as $order_id ) {
			$order = wc_get_order( $order_id );

			if ( ! $order instanceof \WC_Order ) {
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: 1: the order number, 2: how many hours it's been pending. */
					__( 'Order #%1$d has been pending for over %2$d hours', 'vulopilot' ),
					$order->get_order_number(),
					self::STALE_AFTER_HOURS
				),
				Severity::MEDIUM,
				$this->get_category(),
				__( 'This order was created but payment was never confirmed - the customer likely abandoned checkout or a payment webhook never arrived.', 'vulopilot' ),
				'order',
				(string) $order_id
			);
		}

		return $findings;
	}
}
