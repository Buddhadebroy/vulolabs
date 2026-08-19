<?php
/**
 * FaqRenderer class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services\Blocks;

defined( 'ABSPATH' ) || exit;

/**
 * Real render logic for the `vulopilot/faq` block
 * (`src/blocks/faq/render.php` calls straight into this — see
 * TableOfContentsRenderer's own docblock for why render.php itself must
 * stay declaration-free).
 *
 * Builds real FAQPage JSON-LD directly from this block instance's own
 * saved `questions` attribute — deliberately independent of
 * Services\SchemaJsonLdRenderer's `_vulopilot_schema_json` postmeta (that
 * mechanism is one generic schema blob per POST; a post can have zero, one,
 * or several FAQ blocks, so a per-post postmeta key is the wrong shape
 * entirely — this schema is scoped to, and printed at, this one block
 * instance).
 *
 * @class       FaqRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FaqRenderer {

    /**
     * @param array<string, mixed> $attributes Real block attributes — `questions: array<{question,answer}>`.
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
     * markup or the JSON-LD — one guard, applied upstream of both, rather
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
