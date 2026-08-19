<?php
/**
 * SiteAvailabilityScanner test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use VuloPilot\Scanners\Basic\SiteAvailabilityScanner;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over SiteAvailabilityScanner — every WordPress HTTP call
 * (home_url()/wp_remote_get()/wp_remote_retrieve_response_code()) is
 * mocked, so these exercise the scanner's own logic: what counts as
 * "unreachable" (a WP_Error, i.e. the request never got a response at all)
 * vs. a real server-error response vs. a normal successful one.
 *
 * @class       TestSiteAvailabilityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestSiteAvailabilityScanner extends TestCase {

    /**
     * @var SiteAvailabilityScanner
     */
    private SiteAvailabilityScanner $scanner;

    /**
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();

        Functions\when( '__' )->returnArg();
        Functions\when( 'home_url' )->justReturn( 'https://example.com/' );

        $this->scanner = new SiteAvailabilityScanner();
    }

    /**
     * @return void
     */
    public function test_get_id_get_category_are_stable(): void {
        $this->assertSame( 'site-availability', $this->scanner->get_id() );
        $this->assertSame( 'availability', $this->scanner->get_category() );
        $this->assertSame( 'free', $this->scanner->get_tier() );
    }

    /**
     * @return void
     */
    public function test_scan_reports_nothing_when_the_homepage_loads_successfully(): void {
        Functions\when( 'wp_remote_get' )->justReturn( array( 'response' => array( 'code' => 200 ) ) );
        Functions\when( 'is_wp_error' )->justReturn( false );
        Functions\when( 'wp_remote_retrieve_response_code' )->justReturn( 200 );

        $this->assertSame( array(), $this->scanner->scan() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_a_connection_failure_as_critical_unreachable(): void {
        $error = \Mockery::mock();
        $error->shouldReceive( 'get_error_message' )->andReturn( 'cURL error 7: Failed to connect' );

        Functions\when( 'wp_remote_get' )->justReturn( $error );
        Functions\when( 'is_wp_error' )->justReturn( true );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'critical', $findings[0]->get_severity() );
        $this->assertSame( 'availability', $findings[0]->get_category() );
        $this->assertSame( 'url', $findings[0]->get_object_type() );
        $this->assertSame( 'https://example.com/', $findings[0]->get_object_ref() );
        $this->assertSame( 'unreachable', $findings[0]->get_meta()['reason'] );
    }

    /**
     * @return void
     */
    public function test_scan_flags_a_server_error_response_as_critical(): void {
        Functions\when( 'wp_remote_get' )->justReturn( array( 'response' => array( 'code' => 503 ) ) );
        Functions\when( 'is_wp_error' )->justReturn( false );
        Functions\when( 'wp_remote_retrieve_response_code' )->justReturn( 503 );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'critical', $findings[0]->get_severity() );
        $this->assertSame( 'server-error', $findings[0]->get_meta()['reason'] );
        $this->assertSame( 503, $findings[0]->get_meta()['status_code'] );
    }

    /**
     * @return void
     */
    public function test_scan_flags_an_unexpected_client_error_status_as_high_not_critical(): void {
        Functions\when( 'wp_remote_get' )->justReturn( array( 'response' => array( 'code' => 404 ) ) );
        Functions\when( 'is_wp_error' )->justReturn( false );
        Functions\when( 'wp_remote_retrieve_response_code' )->justReturn( 404 );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'high', $findings[0]->get_severity() );
        $this->assertSame( 'unexpected-status', $findings[0]->get_meta()['reason'] );
    }

    /**
     * @return void
     */
    public function test_scan_reports_nothing_for_a_redirect_status(): void {
        // A 3xx counts as a normal, already-redirected-through response
        // here — `redirection => 5` on the wp_remote_get() call means a
        // genuinely reachable site's final response code is what's being
        // observed, so this only exercises the boundary itself.
        Functions\when( 'wp_remote_get' )->justReturn( array( 'response' => array( 'code' => 301 ) ) );
        Functions\when( 'is_wp_error' )->justReturn( false );
        Functions\when( 'wp_remote_retrieve_response_code' )->justReturn( 301 );

        $this->assertSame( array(), $this->scanner->scan() );
    }
}
