<?php
/**
 * HeadingAnchorInjector class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services\Blocks;

defined( 'ABSPATH' ) || exit;

/**
 * Injects `id="..."` onto every real `<h1>`-`<h6>` a `vulopilot/table-of-
 * contents` block's own links point to — without this, the TOC's `<a
 * href="#slug">` links would have nowhere real to land.
 *
 * Hooks `the_content` at a late priority (after WordPress's own
 * `do_blocks()`, which runs at priority 9 — confirmed empirically: an
 * earlier version of this class tried hooking the per-block
 * `render_block_core/heading`/`render_block` filters instead, which turned
 * out to fire more than once per real heading with blank placeholder
 * content on at least one of those passes (consistent with WordPress
 * core's own Block Hooks insertion-point scanning re-rendering the tree
 * speculatively) — a positional cursor consumed by BOTH the real and the
 * blank passes silently ran out before the real headings were ever
 * reached. Processing the one, final, fully-assembled content string in a
 * single pass sidesteps that entirely, and also naturally scopes this to
 * the post's OWN content — no risk of a "Comments"/"More posts"/site-title
 * heading elsewhere on the page consuming a real post's anchor slots.
 *
 * Only active when the current post actually has a
 * `vulopilot/table-of-contents` block (`has_block()` — a cheap string
 * check, works regardless of where the TOC block sits relative to the
 * headings it links to). Uses exactly one `HeadingAnchorResolver::collect()`
 * call per post, consumed positionally as each real `<h1>`-`<h6>` tag is
 * found in the assembled content — the same list `TableOfContentsRenderer`
 * already built its own links from, so the ids landing on the real
 * headings are guaranteed to match.
 *
 * @class       HeadingAnchorInjector class
 * @version     1.0.0
 * @author      VuloLabs
 */
class HeadingAnchorInjector {

    /**
     * HeadingAnchorInjector constructor.
     */
    public function __construct() {
        add_filter( 'the_content', array( $this, 'inject_anchors' ), 20 );
    }

    /**
     * @param string $content Real, fully block-rendered post content (do_blocks() has already run by priority 20).
     * @return string
     */
    public function inject_anchors( string $content ): string {
        $post_id = get_the_ID();

        if ( ! $post_id || ! has_block( 'vulopilot/table-of-contents', $post_id ) ) {
            return $content;
        }

        $headings = HeadingAnchorResolver::collect( $post_id );

        if ( empty( $headings ) ) {
            return $content;
        }

        $cursor = 0;

        return preg_replace_callback(
            '#<h[1-6]([^>]*)>#i',
            static function ( array $matches ) use ( $headings, &$cursor ): string {
                if ( false !== stripos( $matches[1], 'id=' ) ) {
                    // Already has an id (e.g. a manually-set custom
                    // anchor) — HeadingAnchorResolver::collect() already
                    // reserved this exact slug for it, don't consume a
                    // queue position or add a second id attribute.
                    return $matches[0];
                }

                if ( ! isset( $headings[ $cursor ] ) ) {
                    return $matches[0];
                }

                $anchor = $headings[ $cursor ]['anchor'];
                ++$cursor;

                return preg_replace( '/^(<h[1-6])/i', '$1 id="' . esc_attr( $anchor ) . '"', $matches[0], 1 );
            },
            $content
        );
    }
}
