<?php
/**
 * HeadingAnchorResolver class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services\Blocks;

defined( 'ABSPATH' ) || exit;

/**
 * The one real heading-slug algorithm both the `vulopilot/table-of-contents`
 * block and `HeadingAnchorInjector` build on — kept in exactly one place so
 * the TOC's own `<a href="#...">` links and the `id="..."` actually injected
 * onto the real `<h2>`-`<h6>` tags can never silently diverge into two
 * different slug sequences.
 *
 * @class       HeadingAnchorResolver class
 * @version     1.0.0
 * @author      VuloLabs
 */
class HeadingAnchorResolver {

    /**
     * Every real `core/heading` block in a post's raw content, in document
     * order, at any nesting depth (inside `core/group`/`core/columns`/etc).
     * Uses `parse_blocks()` against the post's own raw `post_content` —
     * NOT `get_the_content()`, which returns rendered/filtered HTML with no
     * block boundaries left to walk.
     *
     * Deliberately returns the FULL list, unfiltered by level — callers
     * (TableOfContentsRenderer, HeadingAnchorInjector) filter it themselves.
     * Filtering here would be a real correctness bug: both callers must see
     * the identical full sequence, or their anchor ids can drift apart.
     *
     * @param int $post_id Real post id.
     * @return array<int, array{level: int, text: string, anchor: string}>
     */
    public static function collect( int $post_id ): array {
        $post = get_post( $post_id );

        if ( ! $post ) {
            return array();
        }

        $headings = array();
        $used     = array();

        self::walk( parse_blocks( $post->post_content ), $headings, $used );

        return $headings;
    }

    /**
     * @param array<int, array<string, mixed>> $blocks   parse_blocks() output (or an innerBlocks slice of it).
     * @param array<int, array<string, mixed>> $headings Accumulator, appended to by reference.
     * @param array<string, bool>              $used     Slugs already claimed, keyed by slug, appended to by reference.
     * @return void
     */
    private static function walk( array $blocks, array &$headings, array &$used ): void {
        foreach ( $blocks as $block ) {
            if ( 'core/heading' === ( $block['blockName'] ?? null ) ) {
                $heading = self::extract_heading( (string) ( $block['innerHTML'] ?? '' ), $used );

                if ( null !== $heading ) {
                    $headings[] = $heading;
                }
            }

            if ( ! empty( $block['innerBlocks'] ) ) {
                self::walk( $block['innerBlocks'], $headings, $used );
            }
        }
    }

    /**
     * `core/heading`'s `content`/`level`/`anchor` attributes are all
     * markup-sourced in core's own block.json (`"source": "rich-text"` /
     * `"source": "attribute", "attribute": "id"`) — `parse_blocks()` never
     * puts markup-sourced values into `$block['attrs']` at all, only
     * explicit non-default JSON comment attributes. The real level, text,
     * and any manually-set custom anchor all have to be read straight off
     * the real saved `<h1>`-`<h6>` markup in `innerHTML` instead.
     *
     * @param string              $inner_html A core/heading block's raw `innerHTML`.
     * @param array<string, bool> $used       Slugs already claimed, appended to by reference.
     * @return array{level: int, text: string, anchor: string}|null Null if no real heading markup or blank text.
     */
    private static function extract_heading( string $inner_html, array &$used ): ?array {
        if ( ! preg_match( '#<h([1-6])([^>]*)>(.*)</h\1>#is', $inner_html, $matches ) ) {
            return null;
        }

        $level         = (int) $matches[1];
        $opening_attrs = $matches[2];
        $raw_text      = trim( $matches[3] );
        $plain         = trim( wp_strip_all_tags( $raw_text ) );

        if ( '' === $plain ) {
            return null;
        }

        $existing_id = '';
        if ( preg_match( '#\sid=["\']([^"\']+)["\']#i', $opening_attrs, $id_match ) ) {
            $existing_id = $id_match[1];
        }

        if ( '' !== $existing_id ) {
            // A real, already-present id (a manually-set custom HTML
            // anchor) — reserve it so an auto-generated slug elsewhere
            // can't collide with it, and HeadingAnchorInjector's own
            // "already has an id" check will correctly leave it alone.
            $anchor          = $existing_id;
            $used[ $anchor ] = true;
        } else {
            $anchor = self::unique_slug( $plain, $used );
        }

        return array(
            'level'  => $level,
            'text'   => wp_kses_post( $raw_text ),
            'anchor' => $anchor,
        );
    }

    /**
     * @param string              $text Real heading text to slugify.
     * @param array<string, bool> $used Slugs already claimed, appended to by reference.
     * @return string A slug guaranteed not already present in $used.
     */
    private static function unique_slug( string $text, array &$used ): string {
        $base = sanitize_title( $text );
        $base = '' !== $base ? $base : 'heading';

        $slug  = $base;
        $index = 2;

        while ( isset( $used[ $slug ] ) ) {
            $slug = $base . '-' . $index;
            ++$index;
        }

        $used[ $slug ] = true;

        return $slug;
    }
}
