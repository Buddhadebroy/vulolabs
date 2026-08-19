<?php
/**
 * HeadingAnchorResolver test file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Tests;

use Brain\Monkey\Functions;
use VuloPilot\Services\Blocks\HeadingAnchorResolver;

require_once __DIR__ . '/TestCase.php';

/**
 * Real unit tests over HeadingAnchorResolver::collect() — the one shared
 * slug algorithm both the vulopilot/table-of-contents block's own links
 * and HeadingAnchorInjector's real <h2>-<h6> id injection depend on
 * staying in sync (see that class's own docblock).
 *
 * Fixtures use real parse_blocks()-shaped `innerHTML` (not `attrs`) —
 * core/heading's content/level/anchor are all markup-sourced in core's own
 * block.json, so parse_blocks() never puts them in `attrs` at all; only
 * `innerHTML` carries the real saved <h1>-<h6> markup. Confirmed live
 * against a real wp-env post before writing these.
 *
 * @class       TestHeadingAnchorResolver class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TestHeadingAnchorResolver extends TestCase {

    /**
     * @return void
     */
    protected function setUp(): void {
        parent::setUp();

        Functions\when( 'wp_strip_all_tags' )->alias(
            static fn( $text ) => trim( preg_replace( '/<[^>]*>/', '', $text ) )
        );
        Functions\when( 'wp_kses_post' )->returnArg();
        Functions\when( 'sanitize_title' )->alias(
            static fn( $text ) => strtolower( trim( preg_replace( '/[^a-zA-Z0-9]+/', '-', wp_strip_all_tags( $text ) ), '-' ) )
        );
    }

    /**
     * @param int    $level Real heading level.
     * @param string $text  Real heading text.
     * @param string $id    Real `id` attribute already on the tag, or '' for none.
     * @return array parse_blocks()-shaped core/heading block.
     */
    private function heading_block( int $level, string $text, string $id = '' ): array {
        $id_attr = '' !== $id ? sprintf( ' id="%s"', $id ) : '';

        return array(
            'blockName'   => 'core/heading',
            'attrs'       => array(),
            'innerBlocks' => array(),
            'innerHTML'   => sprintf( "\n<h%1\$d class=\"wp-block-heading\"%2\$s>%3\$s</h%1\$d>\n", $level, $id_attr, $text ),
        );
    }

    /**
     * @return void
     */
    public function test_collect_returns_empty_array_when_post_not_found(): void {
        Functions\when( 'get_post' )->justReturn( null );

        $this->assertSame( array(), HeadingAnchorResolver::collect( 999 ) );
    }

    /**
     * @return void
     */
    public function test_collect_finds_headings_nested_inside_a_group(): void {
        $post                = new \stdClass();
        $post->post_content  = '';
        Functions\when( 'get_post' )->justReturn( $post );

        Functions\when( 'parse_blocks' )->justReturn(
            array(
                $this->heading_block( 2, 'Top Level Heading' ),
                array(
                    'blockName'   => 'core/group',
                    'attrs'       => array(),
                    'innerBlocks' => array(
                        $this->heading_block( 3, 'Nested Heading' ),
                    ),
                ),
            )
        );

        $headings = HeadingAnchorResolver::collect( 5 );

        $this->assertCount( 2, $headings );
        $this->assertSame( 'Top Level Heading', $headings[0]['text'] );
        $this->assertSame( 2, $headings[0]['level'] );
        $this->assertSame( 'top-level-heading', $headings[0]['anchor'] );
        $this->assertSame( 'Nested Heading', $headings[1]['text'] );
        $this->assertSame( 3, $headings[1]['level'] );
        $this->assertSame( 'nested-heading', $headings[1]['anchor'] );
    }

    /**
     * @return void
     */
    public function test_collect_de_duplicates_identical_heading_text(): void {
        $post               = new \stdClass();
        $post->post_content = '';
        Functions\when( 'get_post' )->justReturn( $post );

        Functions\when( 'parse_blocks' )->justReturn(
            array(
                $this->heading_block( 2, 'FAQ' ),
                $this->heading_block( 2, 'FAQ' ),
            )
        );

        $headings = HeadingAnchorResolver::collect( 5 );

        $this->assertSame( 'faq', $headings[0]['anchor'] );
        $this->assertSame( 'faq-2', $headings[1]['anchor'] );
    }

    /**
     * @return void
     */
    public function test_collect_skips_a_heading_with_blank_text(): void {
        $post               = new \stdClass();
        $post->post_content = '';
        Functions\when( 'get_post' )->justReturn( $post );

        Functions\when( 'parse_blocks' )->justReturn(
            array( $this->heading_block( 2, '   ' ) )
        );

        $this->assertSame( array(), HeadingAnchorResolver::collect( 5 ) );
    }

    /**
     * @return void
     */
    public function test_collect_reserves_a_manually_set_anchor(): void {
        $post               = new \stdClass();
        $post->post_content = '';
        Functions\when( 'get_post' )->justReturn( $post );

        Functions\when( 'parse_blocks' )->justReturn(
            array( $this->heading_block( 2, 'Custom Anchor Heading', 'my-custom-id' ) )
        );

        $headings = HeadingAnchorResolver::collect( 5 );

        $this->assertSame( 'my-custom-id', $headings[0]['anchor'] );
    }

    /**
     * @return void
     */
    public function test_collect_ignores_non_heading_blocks(): void {
        $post               = new \stdClass();
        $post->post_content = '';
        Functions\when( 'get_post' )->justReturn( $post );

        Functions\when( 'parse_blocks' )->justReturn(
            array(
                array(
                    'blockName'   => 'core/paragraph',
                    'attrs'       => array(),
                    'innerBlocks' => array(),
                    'innerHTML'   => '<p>Just a paragraph.</p>',
                ),
            )
        );

        $this->assertSame( array(), HeadingAnchorResolver::collect( 5 ) );
    }
}
