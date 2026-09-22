<?php
/**
 * Every class in this file used to be its own file under classes/Services/Blocks/
 * (same names, docblocks, and behavior) - merged into one file to reduce
 * classes/'s file count, per direct instruction. Autoloading does not rely on
 * each class's own file matching its own name for this: composer.json's
 * autoload.classmap entry (alongside the existing psr-4 one) makes Composer
 * tokenize every file under classes/ and modules/ and map each class it finds
 * to its real file, however many classes share one file - run
 * `composer dump-autoload` (no `-o`/`--optimize-autoloader` needed) after any
 * further file merge/split here.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services\Blocks;

defined( 'ABSPATH' ) || exit;

/**
 * Real render logic for the `vulopilot/faq` block
 * (`src/blocks/faq/render.php` calls straight into this - see
 * TableOfContentsRenderer's own docblock for why render.php itself must
 * stay declaration-free).
 *
 * Builds real FAQPage JSON-LD directly from this block instance's own
 * saved `questions` attribute - deliberately independent of
 * Services\SchemaJsonLdRenderer's `_vulopilot_schema_json` postmeta (that
 * mechanism is one generic schema blob per POST; a post can have zero, one,
 * or several FAQ blocks, so a per-post postmeta key is the wrong shape
 * entirely - this schema is scoped to, and printed at, this one block
 * instance).
 *
 * @class       FaqRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FaqRenderer {

    /**
     * @param array<string, mixed> $attributes Real block attributes - `questions: array<{question,answer}>`.
     * @return string Real HTML (visible <details> UI + a real <script type="application/ld+json"> FAQPage block), or '' if every row was blank.
     */
    public static function render( array $attributes ): string {
        $questions = self::sanitize_questions( $attributes['questions'] ?? array() );

        if ( empty( $questions ) ) {
            return '';
        }

        $wrapper_attributes = get_block_wrapper_attributes( array( 'class' => 'vulopilot-faq' ) );
        $html               = '<div ' . $wrapper_attributes . '>';

        foreach ( $questions as $item ) {
            $html .= sprintf(
                '<details class="vulopilot-faq__item"><summary class="vulopilot-faq__question">%1$s</summary><div class="vulopilot-faq__answer">%2$s</div></details>',
                wp_kses_post( $item['question'] ),
                wp_kses_post( $item['answer'] )
            );
        }

        $html .= '</div>';
        $html .= self::render_schema( $questions );

        return $html;
    }

    /**
     * Never lets a blank question/answer row reach EITHER the visible
     * markup or the JSON-LD - one guard, applied upstream of both, rather
     * than two separate checks that could drift apart.
     *
     * @param mixed $raw The block's own `questions` attribute value.
     * @return array<int, array{question: string, answer: string}>
     */
    private static function sanitize_questions( $raw ): array {
        if ( ! is_array( $raw ) ) {
            return array();
        }

        $clean = array();

        foreach ( $raw as $row ) {
            if ( ! is_array( $row ) ) {
                continue;
            }

            $question = isset( $row['question'] ) ? trim( wp_kses_post( (string) $row['question'] ) ) : '';
            $answer   = isset( $row['answer'] ) ? trim( wp_kses_post( (string) $row['answer'] ) ) : '';

            if ( '' === wp_strip_all_tags( $question ) || '' === wp_strip_all_tags( $answer ) ) {
                continue;
            }

            $clean[] = array(
                'question' => $question,
                'answer'   => $answer,
            );
        }

        return $clean;
    }

    /**
     * @param array<int, array{question: string, answer: string}> $questions Already sanitized, never empty.
     * @return string
     */
    private static function render_schema( array $questions ): string {
        $entities = array();

        foreach ( $questions as $item ) {
            $entities[] = array(
                '@type'          => 'Question',
                'name'           => wp_strip_all_tags( $item['question'] ),
                'acceptedAnswer' => array(
                    '@type' => 'Answer',
                    'text'  => wp_strip_all_tags( $item['answer'] ),
                ),
            );
        }

        $schema = array(
            '@context'   => 'https://schema.org',
            '@type'      => 'FAQPage',
            'mainEntity' => $entities,
        );

        return '<script type="application/ld+json">' . wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>';
    }
}

/**
 * Injects `id="..."` onto every real `<h1>`-`<h6>` a `vulopilot/table-of-
 * contents` block's own links point to - without this, the TOC's `<a
 * href="#slug">` links would have nowhere real to land.
 *
 * Hooks `the_content` at a late priority (after WordPress's own
 * `do_blocks()`, which runs at priority 9 - confirmed empirically: an
 * earlier version of this class tried hooking the per-block
 * `render_block_core/heading`/`render_block` filters instead, which turned
 * out to fire more than once per real heading with blank placeholder
 * content on at least one of those passes (consistent with WordPress
 * core's own Block Hooks insertion-point scanning re-rendering the tree
 * speculatively) - a positional cursor consumed by BOTH the real and the
 * blank passes silently ran out before the real headings were ever
 * reached. Processing the one, final, fully-assembled content string in a
 * single pass sidesteps that entirely, and also naturally scopes this to
 * the post's OWN content - no risk of a "Comments"/"More posts"/site-title
 * heading elsewhere on the page consuming a real post's anchor slots.
 *
 * Only active when the current post actually has a
 * `vulopilot/table-of-contents` block (`has_block()` - a cheap string
 * check, works regardless of where the TOC block sits relative to the
 * headings it links to). Uses exactly one `HeadingAnchorResolver::collect()`
 * call per post, consumed positionally as each real `<h1>`-`<h6>` tag is
 * found in the assembled content - the same list `TableOfContentsRenderer`
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
                    // anchor) - HeadingAnchorResolver::collect() already
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

/**
 * The one real heading-slug algorithm both the `vulopilot/table-of-contents`
 * block and `HeadingAnchorInjector` build on - kept in exactly one place so
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
     * Uses `parse_blocks()` against the post's own raw `post_content` -
     * NOT `get_the_content()`, which returns rendered/filtered HTML with no
     * block boundaries left to walk.
     *
     * Deliberately returns the FULL list, unfiltered by level - callers
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
     * `"source": "attribute", "attribute": "id"`) - `parse_blocks()` never
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
            // anchor) - reserve it so an auto-generated slug elsewhere
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

/**
 * Real render logic for the `vulopilot/table-of-contents` block
 * (`src/blocks/table-of-contents/render.php` calls straight into this -
 * kept out of render.php itself since WP loads a block's render.php via
 * `require`, not `require_once`, so any top-level declaration in that file
 * would fatal the moment the same block appears twice on one page).
 *
 * Always reflects the post's CURRENT real heading structure -
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
