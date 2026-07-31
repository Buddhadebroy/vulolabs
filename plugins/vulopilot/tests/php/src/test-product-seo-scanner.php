<?php
/**
 * ProductSeoScanner test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use VuloPilot\Scanners\Basic\ProductSeoScanner;
use WC_Product;

require_once __DIR__ . '/TestCase.php';

// WooCommerce/WC_Product test doubles are declared once, globally, in
// tests/php/bootstrap.php — see that file's own comment for why they
// can't live inside this namespaced test file.

/**
 * Real unit tests over ProductSeoScanner's own title-length check —
 * every WordPress/WooCommerce call (wc_get_products()/settings) is
 * mocked, so these exercise the scanner's own logic: the 10-60 character
 * threshold and which of the two messages a too-short vs. too-long title
 * gets.
 *
 * @class       TestProductSeoScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestProductSeoScanner extends TestCase {

    /**
     * @var ProductSeoScanner
     */
    private ProductSeoScanner $scanner;

    /**
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();

        Functions\when( '__' )->returnArg();

        $this->scanner = new ProductSeoScanner();
    }

    /**
     * @return void
     */
    public function test_get_id_get_category_are_stable(): void {
        $this->assertSame( 'product-seo', $this->scanner->get_id() );
        $this->assertSame( 'woocommerce', $this->scanner->get_category() );
        $this->assertSame( 'free', $this->scanner->get_tier() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_a_title_that_is_too_short(): void {
        Functions\when( 'wc_get_products' )->justReturn( array( new WC_Product( 5, 'Mug' ) ) );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'low', $findings[0]->get_severity() );
        $this->assertSame( 'product', $findings[0]->get_object_type() );
        $this->assertSame( '5', $findings[0]->get_object_ref() );
        $this->assertStringContainsString( 'too short', $findings[0]->get_title() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_a_title_that_is_too_long(): void {
        $long_title = str_repeat( 'a', 61 );

        Functions\when( 'wc_get_products' )->justReturn( array( new WC_Product( 6, $long_title ) ) );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertStringContainsString( 'truncated', $findings[0]->get_title() );
    }

    /**
     * @return void
     */
    public function test_scan_reports_nothing_for_a_well_sized_title(): void {
        Functions\when( 'wc_get_products' )->justReturn( array( new WC_Product( 7, 'A Perfectly Sized Product Title' ) ) );

        $this->assertSame( array(), $this->scanner->scan() );
    }

    /**
     * @return void
     */
    public function test_scan_skips_non_wc_product_entries(): void {
        Functions\when( 'wc_get_products' )->justReturn( array( 'not-a-product' ) );

        $this->assertSame( array(), $this->scanner->scan() );
    }
}
