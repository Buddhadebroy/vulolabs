<?php
/**
 * WcagScanner test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use VuloPilot\Scanners\Basic\WcagScanner;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over WcagScanner — every WordPress call (get_posts()/
 * get_the_title()/settings) is mocked, so these exercise the scanner's own
 * logic: the settings kill switch and the exact-match (not
 * merely-contains) definition of an ambiguous link.
 *
 * @class       TestWcagScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestWcagScanner extends TestCase {

    /**
     * @var WcagScanner
     */
    private WcagScanner $scanner;

    /**
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();

        Functions\when( '__' )->returnArg();
        Functions\when( 'wp_parse_args' )->alias(
            static function ( $args, $defaults ) {
                return array_merge( $defaults, (array) $args );
            }
        );
        Functions\when( 'wp_strip_all_tags' )->alias(
            static fn( $text ) => trim( preg_replace( '/<[^>]*>/', '', $text ) )
        );
        Functions\when( 'get_the_title' )->alias( static fn( $post ) => $post->post_title );

        $this->scanner = new WcagScanner();
    }

    /**
     * @return void
     */
    public function test_get_id_get_category_are_stable(): void {
        $this->assertSame( 'wcag-scanner', $this->scanner->get_id() );
        $this->assertSame( 'accessibility', $this->scanner->get_category() );
        $this->assertSame( 'free', $this->scanner->get_tier() );
    }

    /**
     * @return void
     */
    public function test_scan_returns_nothing_when_setting_is_disabled(): void {
        Functions\when( 'get_option' )->justReturn( array( 'enable_wcag_scanner' => array() ) );
        Functions\expect( 'get_posts' )->never();

        $this->assertSame( array(), $this->scanner->scan() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_a_link_whose_entire_text_is_click_here(): void {
        Functions\when( 'get_option' )->justReturn( array( 'enable_wcag_scanner' => array( 'enable_wcag_scanner' ) ) );

        $post = (object) array(
            'ID'           => 5,
            'post_title'   => 'A post',
            'post_content' => '<p>See our policy <a href="/policy">Click Here</a>.</p>',
        );

        Functions\when( 'get_posts' )->justReturn( array( $post ) );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'low', $findings[0]->get_severity() );
        $this->assertSame( 'post', $findings[0]->get_object_type() );
        $this->assertSame( '5', $findings[0]->get_object_ref() );
    }

    /**
     * @return void
     */
    public function test_scan_does_not_flag_link_text_with_real_context(): void {
        Functions\when( 'get_option' )->justReturn( array( 'enable_wcag_scanner' => array( 'enable_wcag_scanner' ) ) );

        $post = (object) array(
            'ID'           => 6,
            'post_title'   => 'Another post',
            'post_content' => '<p><a href="/shipping">click here to read our shipping policy</a>.</p>',
        );

        Functions\when( 'get_posts' )->justReturn( array( $post ) );

        $this->assertSame( array(), $this->scanner->scan() );
    }

    /**
     * @return void
     */
    public function test_scan_counts_multiple_ambiguous_links_in_one_post(): void {
        Functions\when( 'get_option' )->justReturn( array( 'enable_wcag_scanner' => array( 'enable_wcag_scanner' ) ) );

        $post = (object) array(
            'ID'           => 8,
            'post_title'   => 'Third post',
            'post_content' => '<a href="/a">Read More</a> and <a href="/b">Learn More</a>',
        );

        Functions\when( 'get_posts' )->justReturn( array( $post ) );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 2, $findings[0]->get_meta()['ambiguous_link_count'] );
    }

    /**
     * @return void
     */
    public function test_scan_reports_nothing_when_no_links_are_ambiguous(): void {
        Functions\when( 'get_option' )->justReturn( array( 'enable_wcag_scanner' => array( 'enable_wcag_scanner' ) ) );

        $post = (object) array(
            'ID'           => 9,
            'post_title'   => 'Fourth post',
            'post_content' => '<p>No links here at all.</p>',
        );

        Functions\when( 'get_posts' )->justReturn( array( $post ) );

        $this->assertSame( array(), $this->scanner->scan() );
    }
}
