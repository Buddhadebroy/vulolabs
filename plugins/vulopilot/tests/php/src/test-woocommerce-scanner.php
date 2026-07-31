<?php
/**
 * WooCommerceScanner test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use Mockery;
use VuloPilot\Scanners\Basic\WooCommerceScanner;

require_once __DIR__ . '/TestCase.php';

// WooCommerce/WC_Product/WC() test doubles are declared once, globally,
// in tests/php/bootstrap.php — see that file's own comments for why they
// can't live inside this namespaced test file.

/**
 * Real unit tests over WooCommerceScanner's own "Store Health" checks —
 * every WooCommerce call (wc_get_page_id()/get_post_status()/get_option()/
 * WC()->payment_gateways()) is mocked/stubbed, so these exercise the
 * scanner's own logic: which of the five checks fires for which missing
 * piece of store configuration.
 *
 * @class       TestWooCommerceScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestWooCommerceScanner extends TestCase {

    /**
     * @var WooCommerceScanner
     */
    private WooCommerceScanner $scanner;

    /**
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();

        Functions\when( '__' )->returnArg();

        // A fully-healthy store by default — each test only overrides the
        // one piece of configuration it's exercising.
        Functions\when( 'wc_get_page_id' )->justReturn( 42 );
        Functions\when( 'get_post_status' )->justReturn( 'publish' );
        Functions\when( 'get_option' )->justReturn( 'US' );

        $gateways                              = Mockery::mock();
        $gateways->shouldReceive( 'get_available_payment_gateways' )->andReturn( array( 'stripe' => true ) );
        $wc_instance                            = Mockery::mock();
        $wc_instance->shouldReceive( 'payment_gateways' )->andReturn( $gateways );
        $GLOBALS['vulopilot_test_wc_instance'] = $wc_instance;

        $this->scanner = new WooCommerceScanner();
    }

    /**
     * @return void
     */
    protected function tearDown(): void {
        unset( $GLOBALS['vulopilot_test_wc_instance'] );
        parent::tearDown();
    }

    /**
     * @return void
     */
    public function test_get_id_get_category_are_stable(): void {
        $this->assertSame( 'woocommerce', $this->scanner->get_id() );
        $this->assertSame( 'woocommerce', $this->scanner->get_category() );
        $this->assertSame( 'free', $this->scanner->get_tier() );
    }

    /**
     * @return void
     */
    public function test_scan_reports_nothing_for_a_fully_healthy_store(): void {
        $this->assertSame( array(), $this->scanner->scan() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_a_missing_checkout_page(): void {
        Functions\when( 'wc_get_page_id' )->alias(
            static fn( $key ) => 'checkout' === $key ? 0 : 42
        );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'critical', $findings[0]->get_severity() );
        $this->assertSame( 'woocommerce_checkout_page_id', $findings[0]->get_object_ref() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_an_unpublished_cart_page(): void {
        Functions\when( 'get_post_status' )->alias(
            static fn( $id ) => 'draft'
        );
        Functions\when( 'wc_get_page_id' )->alias(
            static fn( $key ) => 'cart' === $key ? 42 : 0
        );

        $findings = $this->scanner->scan();

        // Every essential page is now unpublished/missing — only 'cart'
        // has a real page id, but get_post_status() is stubbed to always
        // report 'draft', so it alone fails the "published" half of the
        // check while the other two fail the "has a page id" half.
        $cart_finding = current(
            array_filter(
                $findings,
                static fn( $finding ) => 'woocommerce_cart_page_id' === $finding->get_object_ref()
            )
        );

        $this->assertNotFalse( $cart_finding );
        $this->assertSame( 'high', $cart_finding->get_severity() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_a_missing_my_account_page(): void {
        Functions\when( 'wc_get_page_id' )->alias(
            static fn( $key ) => 'myaccount' === $key ? 0 : 42
        );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'medium', $findings[0]->get_severity() );
        $this->assertSame( 'woocommerce_myaccount_page_id', $findings[0]->get_object_ref() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_no_base_location_configured(): void {
        Functions\when( 'get_option' )->justReturn( '' );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'high', $findings[0]->get_severity() );
        $this->assertSame( 'woocommerce_default_country', $findings[0]->get_object_ref() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_no_enabled_payment_gateway(): void {
        $gateways = Mockery::mock();
        $gateways->shouldReceive( 'get_available_payment_gateways' )->andReturn( array() );
        $wc_instance = Mockery::mock();
        $wc_instance->shouldReceive( 'payment_gateways' )->andReturn( $gateways );
        $GLOBALS['vulopilot_test_wc_instance'] = $wc_instance;

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'critical', $findings[0]->get_severity() );
        $this->assertSame( 'woocommerce_payment_gateways', $findings[0]->get_object_ref() );
    }
}
