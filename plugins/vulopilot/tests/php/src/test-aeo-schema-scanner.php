<?php
/**
 * AeoSchemaScanner test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use VuloPilot\Scanners\Basic\AeoSchemaScanner;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over AeoSchemaScanner's deterministic content-shape
 * detection (looks_faq_shaped()/looks_howto_shaped()/get_declared_schema_types()) —
 * exactly the signal this scanner's finding depends on, invoked via
 * Reflection since those are private (not something this pass changes the
 * visibility of just to make testable — real tests should exercise real
 * code, not a redesigned one).
 *
 * @class       TestAeoSchemaScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestAeoSchemaScanner extends TestCase {

    /**
     * @var AeoSchemaScanner
     */
    private AeoSchemaScanner $scanner;

    /**
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();
        $this->scanner = new AeoSchemaScanner();
    }

    /**
     * @param string $method Private/protected method name.
     * @param array  $args   Positional arguments.
     * @return mixed
     */
    private function invoke_private( string $method, array $args ) {
        $reflection = new \ReflectionMethod( AeoSchemaScanner::class, $method );
        $reflection->setAccessible( true );

        return $reflection->invokeArgs( $this->scanner, $args );
    }

    /**
     * @return void
     */
    public function test_get_id_get_category_are_stable(): void {
        $this->assertSame( 'aeo-schema', $this->scanner->get_id() );
        $this->assertSame( 'geo', $this->scanner->get_category() );
        $this->assertSame( 'free', $this->scanner->get_tier() );
    }

    /**
     * @return void
     */
    public function test_looks_faq_shaped_detects_a_question_heading(): void {
        $this->assertTrue(
            $this->invoke_private( 'looks_faq_shaped', array( '<h2>What is GEO?</h2><p>Text</p>' ) )
        );
    }

    /**
     * @return void
     */
    public function test_looks_faq_shaped_ignores_a_non_question_heading(): void {
        $this->assertFalse(
            $this->invoke_private( 'looks_faq_shaped', array( '<h2>About GEO</h2><p>Text</p>' ) )
        );
    }

    /**
     * @return void
     */
    public function test_looks_howto_shaped_requires_at_least_three_steps(): void {
        $two_steps   = '<ol><li>Step one</li><li>Step two</li></ol>';
        $three_steps = '<ol><li>Step one</li><li>Step two</li><li>Step three</li></ol>';

        $this->assertFalse( $this->invoke_private( 'looks_howto_shaped', array( $two_steps ) ) );
        $this->assertTrue( $this->invoke_private( 'looks_howto_shaped', array( $three_steps ) ) );
    }

    /**
     * @return void
     */
    public function test_looks_howto_shaped_ignores_content_with_no_list(): void {
        $this->assertFalse(
            $this->invoke_private( 'looks_howto_shaped', array( '<p>Just a paragraph, no list at all.</p>' ) )
        );
    }

    /**
     * @return void
     */
    public function test_get_declared_schema_types_reads_faqpage_from_postmeta(): void {
        Functions\expect( 'get_post_meta' )
            ->once()
            ->with( 42, '_vulopilot_schema_json', true )
            ->andReturn( $this->encode_stub( array( '@type' => 'FAQPage' ) ) );

        $types = $this->invoke_private( 'get_declared_schema_types', array( 42 ) );

        $this->assertSame( array( 'FAQPage' ), $types );
    }

    /**
     * @return void
     */
    public function test_get_declared_schema_types_is_empty_when_nothing_saved(): void {
        Functions\expect( 'get_post_meta' )
            ->once()
            ->andReturn( '' );

        $this->assertSame( array(), $this->invoke_private( 'get_declared_schema_types', array( 42 ) ) );
    }

    /**
     * Minimal, dependency-free stand-in for wp_json_encode() — the scanner
     * itself never calls this (it reads/json_decode()s), this test only
     * needs a JSON string to feed into get_post_meta()'s stub.
     *
     * @param array $data Data to encode.
     * @return string
     */
    private function encode_stub( array $data ): string {
        return json_encode( $data ); // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- test-only helper, not production code; the real class under test never calls raw json_encode() itself.
    }
}
