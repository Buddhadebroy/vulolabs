<?php
/**
 * ProductSeoScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * "Product SEO" (readme.txt Phase 9) — the product-specific counterpart to
 * SeoScanner, which only looks at `post`/`page` (its own docblock: a
 * dedicated meta-description field can't be checked generically, since its
 * meta key varies by whichever SEO plugin, if any, is active — the title
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
