<?php
/**
 * CoreFileIntegrityScanner test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use VuloPilot\Scanners\Basic\CoreFileIntegrityScanner;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over CoreFileIntegrityScanner — get_core_checksums()
 * (core's own function, not this scanner's) is mocked, but file_exists()/
 * md5_file() are real PHP internals Patchwork refuses to redefine without
 * an allowlist this suite doesn't carry (unlike get_core_checksums, which
 * doesn't really exist as a PHP/WP-core builtin in this test process, so
 * Brain\Monkey can define it fresh). These tests instead create real,
 * small fixture files under ABSPATH (this suite's bootstrap.php already
 * fixes ABSPATH to tests/php/) so file_exists()/md5_file() run for real
 * against them, cleaned up in tearDown().
 *
 * @class       TestCoreFileIntegrityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestCoreFileIntegrityScanner extends TestCase {

    /**
     * @var CoreFileIntegrityScanner
     */
    private CoreFileIntegrityScanner $scanner;

    /**
     * @var string[]
     */
    private array $fixture_files = array();

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
        Functions\when( 'get_option' )->justReturn( array( 'enable_core_file_integrity_scanner' => array( 'enable_core_file_integrity_scanner' ) ) );
        Functions\when( 'get_locale' )->justReturn( 'en_US' );

        global $wp_version;
        $wp_version = '6.5';

        $this->scanner = new CoreFileIntegrityScanner();
    }

    /**
     * @return void
     */
    protected function tearDown(): void {
        foreach ( $this->fixture_files as $path ) {
            @unlink( $path ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- test-only cleanup, failure is harmless.
        }

        parent::tearDown();
    }

    /**
     * @param string $relative_path Path relative to ABSPATH.
     * @param string $contents      File contents to write.
     * @return void
     */
    private function write_fixture( string $relative_path, string $contents ): void {
        $absolute_path          = ABSPATH . $relative_path;
        $this->fixture_files[] = $absolute_path;

        file_put_contents( $absolute_path, $contents );
    }

    /**
     * @return void
     */
    public function test_get_id_get_category_are_stable(): void {
        $this->assertSame( 'core-file-integrity', $this->scanner->get_id() );
        $this->assertSame( 'security', $this->scanner->get_category() );
        $this->assertSame( 'free', $this->scanner->get_tier() );
    }

    /**
     * @return void
     */
    public function test_scan_returns_nothing_when_setting_is_disabled(): void {
        Functions\when( 'get_option' )->justReturn( array( 'enable_core_file_integrity_scanner' => array() ) );
        Functions\expect( 'get_core_checksums' )->never();

        $this->assertSame( array(), $this->scanner->scan() );
    }

    /**
     * @return void
     */
    public function test_scan_returns_nothing_when_checksums_are_unavailable(): void {
        Functions\when( 'get_core_checksums' )->justReturn( false );

        $this->assertSame( array(), $this->scanner->scan() );
    }

    /**
     * @return void
     */
    public function test_scan_ignores_a_file_whose_hash_matches(): void {
        $this->write_fixture( 'vulopilot-fixture-unchanged.php', 'unchanged contents' );

        Functions\when( 'get_core_checksums' )->justReturn(
            array( 'vulopilot-fixture-unchanged.php' => md5( 'unchanged contents' ) )
        );

        $this->assertSame( array(), $this->scanner->scan() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_a_file_whose_hash_does_not_match(): void {
        $this->write_fixture( 'vulopilot-fixture-modified.php', 'actual contents' );

        Functions\when( 'get_core_checksums' )->justReturn(
            array( 'vulopilot-fixture-modified.php' => md5( 'expected contents' ) )
        );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'high', $findings[0]->get_severity() );
        $this->assertSame( 'vulopilot-fixture-modified.php', $findings[0]->get_object_ref() );
    }

    /**
     * @return void
     */
    public function test_scan_flags_a_missing_file(): void {
        Functions\when( 'get_core_checksums' )->justReturn(
            array( 'vulopilot-fixture-missing.php' => md5( 'never existed on disk' ) )
        );

        $findings = $this->scanner->scan();

        $this->assertCount( 1, $findings );
        $this->assertSame( 'high', $findings[0]->get_severity() );
        $this->assertSame( 'vulopilot-fixture-missing.php', $findings[0]->get_object_ref() );
    }

    /**
     * @return void
     */
    public function test_scan_reports_both_modified_and_missing_together_but_not_unchanged(): void {
        $this->write_fixture( 'vulopilot-fixture-unchanged2.php', 'same' );
        $this->write_fixture( 'vulopilot-fixture-modified2.php', 'actual' );

        Functions\when( 'get_core_checksums' )->justReturn(
            array(
                'vulopilot-fixture-unchanged2.php' => md5( 'same' ),
                'vulopilot-fixture-modified2.php'  => md5( 'expected' ),
                'vulopilot-fixture-missing2.php'   => md5( 'never existed' ),
            )
        );

        $findings = $this->scanner->scan();
        $refs     = array_map( static fn( $finding ) => $finding->get_object_ref(), $findings );

        $this->assertCount( 2, $findings );
        $this->assertContains( 'vulopilot-fixture-modified2.php', $refs );
        $this->assertContains( 'vulopilot-fixture-missing2.php', $refs );
    }
}
