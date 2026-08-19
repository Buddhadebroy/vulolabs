<?php
/**
 * TableOfContentsRenderer test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use VuloPilot\Services\Blocks\TableOfContentsRenderer;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over TableOfContentsRenderer::render() — real
 * HeadingAnchorResolver::collect() call underneath (not mocked out), so
 * these exercise the real min/max level filtering and the real "nothing
 * to show" empty-string contract render.php depends on (an empty return
 * means the block prints nothing at all, rather than an empty shell).
 *
 * @class       TestTableOfContentsRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestTableOfContentsRenderer extends TestCase {

    /**
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();

        Functions\when( '__' )->returnArg();
        Functions\when( 'wp_strip_all_tags' )->alias(
            static fn( $text ) => trim( preg_replace( '/<[^>]*>/', '', $text ) )
        );
        Functions\when( 'wp_kses_post' )->returnArg();
        Functions\when( 'esc_attr' )->returnArg();
        Functions\when( 'esc_html' )->returnArg();
        Functions\when( 'sanitize_title' )->alias(
            static fn( $text ) => strtolower( trim( preg_replace( '/[^a-zA-Z0-9]+/', '-', wp_strip_all_tags( $text ) ), '-' ) )
        );
        Functions\when( 'get_block_wrapper_attributes' )->justReturn( 'class="vulopilot-toc"' );
    }

    /**
     * @param array $blocks parse_blocks()-shaped array.
     * @return void
     */
    private function stub_headings( array $blocks ): void {
        $post               = new \stdClass();
        $post->post_content = '';

        Functions\when( 'get_post' )->justReturn( $post );
        Functions\when( 'parse_blocks' )->justReturn( $blocks );
    }

    /**
     * @return void
     */
    public function test_render_returns_empty_string_when_no_headings(): void {
        $this->stub_headings( array() );

        $this->assertSame( '', TableOfContentsRenderer::render( array(), 5 ) );
    }

    /**
     * @return void
     */
    public function test_render_returns_empty_string_when_no_post_id(): void {
        $this->assertSame( '', TableOfContentsRenderer::render( array(), 0 ) );
    }

    /**
     * @return void
     */
    public function test_render_applies_min_and_max_level_filtering(): void {
        $this->stub_headings(
            array(
                $this->heading_block( 2, 'H2 Heading' ),
                $this->heading_block( 3, 'H3 Heading' ),
                $this->heading_block( 4, 'H4 Heading' ),
            )
        );

        $html = TableOfContentsRenderer::render(
            array(
                'minLevel' => 3,
                'maxLevel' => 3,
            ),
            5
        );

        $this->assertStringContainsString( 'H3 Heading', $html );
        $this->assertStringNotContainsString( 'H2 Heading', $html );
        $this->assertStringNotContainsString( 'H4 Heading', $html );
    }

    /**
     * @return void
     */
    public function test_render_links_to_the_real_anchor(): void {
        $this->stub_headings( array( $this->heading_block( 2, 'My Heading' ) ) );

        $html = TableOfContentsRenderer::render( array(), 5 );

        $this->assertStringContainsString( 'href="#my-heading"', $html );
    }

    /**
     * @return void
     */
    public function test_render_wraps_in_details_when_collapsible(): void {
        $this->stub_headings( array( $this->heading_block( 2, 'My Heading' ) ) );

        $html = TableOfContentsRenderer::render( array( 'collapsible' => true ), 5 );

        $this->assertStringContainsString( '<details', $html );
        $this->assertStringContainsString( '<summary', $html );
    }

    /**
     * parse_blocks()-shaped fixture using real `innerHTML` — core/heading's
     * content/level are markup-sourced in core's own block.json, so
     * parse_blocks() never puts them in `attrs` at all (confirmed live
     * against a real wp-env post).
     *
     * @param int    $level Real heading level.
     * @param string $text  Real heading text.
     * @return array
     */
    private function heading_block( int $level, string $text ): array {
        return array(
            'blockName'   => 'core/heading',
            'attrs'       => array(),
            'innerBlocks' => array(),
            'innerHTML'   => sprintf( "\n<h%1\$d class=\"wp-block-heading\">%2\$s</h%1\$d>\n", $level, $text ),
        );
    }
}
