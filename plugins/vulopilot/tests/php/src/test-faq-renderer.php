<?php
/**
 * FaqRenderer test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use VuloPilot\Services\Blocks\FaqRenderer;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over FaqRenderer::render() — the one guard
 * (sanitize_questions()) that keeps a blank question/answer row out of
 * BOTH the visible markup and the FAQPage JSON-LD, and the real JSON
 * shape search engines expect.
 *
 * @class       TestFaqRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestFaqRenderer extends TestCase {

    /**
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();

        Functions\when( 'wp_kses_post' )->returnArg();
        Functions\when( 'wp_strip_all_tags' )->alias(
            static fn( $text ) => trim( preg_replace( '/<[^>]*>/', '', $text ) )
        );
        Functions\when( 'get_block_wrapper_attributes' )->justReturn( 'class="vulopilot-faq"' );
        Functions\when( 'wp_json_encode' )->alias(
            static fn( $data, $flags = 0 ) => json_encode( $data, $flags ) // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- test-only stub for the real wp_json_encode(), not production code.
        );
    }

    /**
     * @return void
     */
    public function test_render_returns_empty_string_when_no_real_questions(): void {
        $this->assertSame( '', FaqRenderer::render( array( 'questions' => array() ) ) );
    }

    /**
     * @return void
     */
    public function test_render_excludes_a_row_with_a_blank_answer_from_html_and_schema(): void {
        $html = FaqRenderer::render(
            array(
                'questions' => array(
                    array(
                        'question' => 'Real question',
                        'answer'   => 'Real answer',
                    ),
                    array(
                        'question' => 'Blank-answer question',
                        'answer'   => '   ',
                    ),
                ),
            )
        );

        $this->assertStringContainsString( 'Real question', $html );
        $this->assertStringContainsString( 'Real answer', $html );
        $this->assertStringNotContainsString( 'Blank-answer question', $html );

        $schema = $this->extract_schema( $html );

        $this->assertCount( 1, $schema['mainEntity'] );
        $this->assertSame( 'Real question', $schema['mainEntity'][0]['name'] );
    }

    /**
     * @return void
     */
    public function test_render_outputs_valid_faqpage_shape(): void {
        $html = FaqRenderer::render(
            array(
                'questions' => array(
                    array(
                        'question' => 'What is VuloPilot?',
                        'answer'   => 'An AI-powered WordPress SEO plugin.',
                    ),
                ),
            )
        );

        $schema = $this->extract_schema( $html );

        $this->assertSame( 'https://schema.org', $schema['@context'] );
        $this->assertSame( 'FAQPage', $schema['@type'] );
        $this->assertSame( 'Question', $schema['mainEntity'][0]['@type'] );
        $this->assertSame( 'What is VuloPilot?', $schema['mainEntity'][0]['name'] );
        $this->assertSame( 'Answer', $schema['mainEntity'][0]['acceptedAnswer']['@type'] );
        $this->assertSame( 'An AI-powered WordPress SEO plugin.', $schema['mainEntity'][0]['acceptedAnswer']['text'] );
    }

    /**
     * @param string $html Real render() output.
     * @return array Decoded contents of the <script type="application/ld+json"> block.
     */
    private function extract_schema( string $html ): array {
        preg_match( '#<script type="application/ld\+json">(.+?)</script>#s', $html, $matches );

        $this->assertNotEmpty( $matches, 'No JSON-LD script tag found in render() output.' );

        return json_decode( $matches[1], true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.json_decode_json_decode -- test-only, decoding this test's own captured output.
    }
}
