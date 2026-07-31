<?php
/**
 * WeakPasswordScanner test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use VuloPilot\Scanners\Basic\WeakPasswordScanner;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over WeakPasswordScanner — every WordPress call
 * (get_users()/wp_check_password()/settings) is mocked, so these exercise
 * the scanner's own logic: the settings kill switch, iterating
 * administrators, and stopping at the first dictionary match per user
 * rather than reporting the same account more than once.
 *
 * @class       TestWeakPasswordScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestWeakPasswordScanner extends TestCase {

    /**
     * @var WeakPasswordScanner
     */
    private WeakPasswordScanner $scanner;

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

        $this->scanner = new WeakPasswordScanner();
    }

    /**
     * @return void
     */
    public function test_get_id_get_category_are_stable(): void {
        $this->assertSame( 'weak-passwords', $this->scanner->get_id() );
        $this->assertSame( 'security', $this->scanner->get_category() );
        $this->assertSame( 'free', $this->scanner->get_tier() );
    }

    /**
     * @return void
     */
    public function test_scan_returns_nothing_when_setting_is_disabled(): void {
        Functions\when( 'get_option' )->justReturn( array( 'enable_weak_password_scanner' => array() ) );
        Functions\expect( 'get_users' )->never();

        $this->assertSame( array(), $this->scanner->scan() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_administrator_with_common_password(): void {
        Functions\when( 'get_option' )->justReturn( array( 'enable_weak_password_scanner' => array( 'enable_weak_password_scanner' ) ) );

        $admin = (object) array(
            'ID'         => 7,
            'user_login' => 'siteadmin',
            'user_pass'  => 'some-hash',
        );

        Functions\expect( 'get_users' )
            ->once()
            ->with( array( 'role' => 'administrator' ) )
            ->andReturn( array( $admin ) );

        Functions\when( 'wp_check_password' )->alias(
            static fn( $candidate, $hash, $user_id ) => 'password' === $candidate && 7 === $user_id
        );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'critical', $findings[0]->get_severity() );
        $this->assertSame( 'user', $findings[0]->get_object_type() );
        $this->assertSame( '7', $findings[0]->get_object_ref() );
    }

    /**
     * @return void
     */
    public function test_scan_only_reports_once_per_user_even_if_multiple_candidates_would_match(): void {
        Functions\when( 'get_option' )->justReturn( array( 'enable_weak_password_scanner' => array( 'enable_weak_password_scanner' ) ) );

        $admin = (object) array(
            'ID'         => 9,
            'user_login' => 'another',
            'user_pass'  => 'some-hash',
        );

        Functions\when( 'get_users' )->justReturn( array( $admin ) );
        Functions\when( 'wp_check_password' )->justReturn( true );

        $this->assertCount( 1, $this->scanner->scan() );
    }

    /**
     * @return void
     */
    public function test_scan_reports_nothing_for_a_strong_password(): void {
        Functions\when( 'get_option' )->justReturn( array( 'enable_weak_password_scanner' => array( 'enable_weak_password_scanner' ) ) );

        $admin = (object) array(
            'ID'         => 3,
            'user_login' => 'safe',
            'user_pass'  => 'some-hash',
        );

        Functions\when( 'get_users' )->justReturn( array( $admin ) );
        Functions\when( 'wp_check_password' )->justReturn( false );

        $this->assertSame( array(), $this->scanner->scan() );
    }
}
