<?php
/**
 * BasicVulnerabilitiesScanner test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use VuloPilot\Scanners\Basic\BasicVulnerabilitiesScanner;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over BasicVulnerabilitiesScanner's three checks —
 * every wp_remote_get() call and $wpdb access is mocked, so these exercise
 * the scanner's own response-parsing/prefix-comparison logic, not real
 * HTTP or a real database.
 *
 * @class       TestBasicVulnerabilitiesScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestBasicVulnerabilitiesScanner extends TestCase {

    /**
     * @var BasicVulnerabilitiesScanner
     */
    private BasicVulnerabilitiesScanner $scanner;

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
        Functions\when( 'home_url' )->alias(
            static fn( $path = '' ) => 'https://example.test' . $path
        );
        Functions\when( 'get_option' )->justReturn( array( 'enable_basic_vulnerabilities_scanner' => array( 'enable_basic_vulnerabilities_scanner' ) ) );

        global $wpdb;
        $wpdb = (object) array( 'prefix' => 'wp_' ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- test-only stand-in for the real $wpdb.

        $this->scanner = new BasicVulnerabilitiesScanner();
    }

    /**
     * @return void
     */
    public function test_get_id_get_category_are_stable(): void {
        $this->assertSame( 'basic-vulnerabilities', $this->scanner->get_id() );
        $this->assertSame( 'security', $this->scanner->get_category() );
        $this->assertSame( 'free', $this->scanner->get_tier() );
    }

    /**
     * @return void
     */
    public function test_scan_returns_nothing_when_setting_is_disabled(): void {
        Functions\when( 'get_option' )->justReturn( array( 'enable_basic_vulnerabilities_scanner' => array() ) );
        Functions\expect( 'wp_remote_get' )->never();

        $this->assertSame( array(), $this->scanner->scan() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_all_three_issues_when_present(): void {
        Functions\when( 'wp_remote_get' )->alias(
            static function ( $url ) {
                return array( 'url' => $url );
            }
        );
        Functions\when( 'is_wp_error' )->justReturn( false );
        Functions\when( 'wp_remote_retrieve_response_code' )->justReturn( 200 );
        Functions\when( 'wp_remote_retrieve_body' )->alias(
            static function ( $response ) {
                if ( false !== strpos( $response['url'], 'readme.html' ) ) {
                    return '<h1>WordPress 6.5</h1>';
                }

                return '<meta name="generator" content="WordPress 6.5">';
            }
        );

        global $wpdb;
        $wpdb->prefix = 'wp_';

        $findings = $this->scanner->scan();

        $this->assertCount( 3, $findings );
        $this->assertSame(
            array( 'medium', 'low', 'low' ),
            array_map( static fn( $finding ) => $finding->get_severity(), $findings )
        );
    }

    /**
     * @return void
     */
    public function test_scan_ignores_non_wordpress_generator_tag(): void {
        Functions\when( 'wp_remote_get' )->alias(
            static function ( $url ) {
                return array( 'url' => $url );
            }
        );
        Functions\when( 'is_wp_error' )->justReturn( false );
        Functions\when( 'wp_remote_retrieve_response_code' )->justReturn( 200 );
        Functions\when( 'wp_remote_retrieve_body' )->alias(
            static function ( $response ) {
                if ( false !== strpos( $response['url'], 'readme.html' ) ) {
                    return '<h1>WordPress 6.5</h1>';
                }

                return '<meta name="generator" content="Some Other CMS">';
            }
        );

        global $wpdb;
        $wpdb->prefix = 'wp_';

        $findings = $this->scanner->scan();

        // readme.html check + prefix check still fire (both stubbed to
        // "present"/"default" above); only the generator-tag Finding is
        // suppressed by this test's non-WordPress generator body.
        $this->assertCount( 2, $findings );
    }

    /**
     * @return void
     */
    public function test_scan_ignores_a_failed_request(): void {
        Functions\when( 'wp_remote_get' )->justReturn( 'stubbed-error' );
        Functions\when( 'is_wp_error' )->justReturn( true );

        global $wpdb;
        $wpdb->prefix = 'wp_';

        $findings = $this->scanner->scan();

        // Both HTTP checks fail; only the prefix check (no HTTP request)
        // still produces a Finding.
        $this->assertCount( 1, $findings );
        $this->assertSame( 'low', $findings[0]->get_severity() );
    }

    /**
     * @return void
     */
    public function test_scan_ignores_a_non_default_table_prefix(): void {
        Functions\when( 'wp_remote_get' )->justReturn( 'stubbed-error' );
        Functions\when( 'is_wp_error' )->justReturn( true );

        global $wpdb;
        $wpdb->prefix = 'custom_';

        $this->assertSame( array(), $this->scanner->scan() );
    }
}
