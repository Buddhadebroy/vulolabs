<?php
/**
 * TableOfContentsRenderer class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services\Blocks;

defined( 'ABSPATH' ) || exit;

/**
 * Real render logic for the `vulopilot/table-of-contents` block
 * (`src/blocks/table-of-contents/render.php` calls straight into this —
 * kept out of render.php itself since WP loads a block's render.php via
 * `require`, not `require_once`, so any top-level declaration in that file
 * would fatal the moment the same block appears twice on one page).
 *
 * Always reflects the post's CURRENT real heading structure —
 * HeadingAnchorResolver::collect() re-parses the post's raw content on
 * every render, so nothing here can go stale the way a save()-time
 * snapshot would the moment an editor adds/removes/reorders headings
 * elsewhere in the post.
 *
 * @class       TableOfContentsRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TableOfContentsRenderer {

    /**
     * @param array<string, mixed> $attributes Real block attributes (title/minLevel/maxLevel/collapsible).
     * @param int                  $post_id    The post this block instance is rendering on.
     * @return string Real HTML, or '' if the post has no matching headings (no empty shell rendered).
     */
    public static function render( array $attributes, int $post_id ): string {
        if ( ! $post_id ) {
            return '';
        }

        $min_level   = isset( $attributes['minLevel'] ) ? (int) $attributes['minLevel'] : 2;
        $max_level   = isset( $attributes['maxLevel'] ) ? (int) $attributes['maxLevel'] : 6;
        $title       = ! empty( $attributes['title'] ) ? (string) $attributes['title'] : __( 'Table of Contents', 'vulopilot' );
        $collapsible = ! empty( $attributes['collapsible'] );

        $headings = array_values(
            array_filter(
                HeadingAnchorResolver::collect( $post_id ),
                static function ( array $heading ) use ( $min_level, $max_level ): bool {
                    return $heading['level'] >= $min_level && $heading['level'] <= $max_level;
                }
            )
        );

        if ( empty( $headings ) ) {
            return '';
        }

        $list_html          = self::build_list( $headings );
        $wrapper_attributes = get_block_wrapper_attributes( array( 'class' => 'vulopilot-toc' ) );

        if ( $collapsible ) {
            return sprintf(
                '<nav %1$s aria-label="%2$s"><details class="vulopilot-toc__details" open><summary class="vulopilot-toc__title">%3$s</summary>%4$s</details></nav>',
                $wrapper_attributes,
                esc_attr( $title ),
                esc_html( $title ),
                $list_html
            );
        }

        return sprintf(
            '<nav %1$s aria-label="%2$s"><p class="vulopilot-toc__title">%3$s</p>%4$s</nav>',
            $wrapper_attributes,
            esc_attr( $title ),
            esc_html( $title ),
            $list_html
        );
    }

    /**
     * @param array<int, array{level: int, text: string, anchor: string}> $headings Already level-filtered.
     * @return string
     */
    private static function build_list( array $headings ): string {
        $items = '';

        foreach ( $headings as $heading ) {
            $items .= sprintf(
                '<li class="vulopilot-toc__item vulopilot-toc__item--level-%1$d"><a href="#%2$s">%3$s</a></li>',
                $heading['level'],
                esc_attr( $heading['anchor'] ),
                wp_kses_post( $heading['text'] )
            );
        }

        return '<ul class="vulopilot-toc__list">' . $items . '</ul>';
    }
}
