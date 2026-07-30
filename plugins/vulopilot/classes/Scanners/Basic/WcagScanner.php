<?php
/**
 * WcagScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * "WCAG Scanner" (readme.txt Phase 8) — flags links whose entire visible
 * text is a generic, out-of-context phrase ("click here", "read more",
 * "learn more", etc, self::AMBIGUOUS_PHRASES). WCAG 2.4.4 (Link Purpose,
 * In Context) requires link text to make sense on its own — a screen
 * reader user who pulls up a page's list of links (a common navigation
 * shortcut) hears nothing but "click here, click here, click here" with
 * no way to tell them apart. This is the single most common rule
 * automated accessibility auditors (axe-core's `link-name`, WAVE's
 * "Suspicious Link Text") flag, and this codebase had no check for it
 * yet — distinct from AriaAttributesScanner (missing role on a clickable
 * non-link element) and FormLabelsScanner (unlabeled form fields). One
 * concrete, well-defined rule per scanner, same convention those two
 * already establish.
 *
 * @class       WcagScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WcagScanner extends AbstractBasicScanner {

    /**
     * How many of the most recently published posts/pages to check per run.
     */
    private const BATCH_SIZE = 50;

    /**
     * A link's entire visible text (trimmed, lowercased) matching one of
     * these exactly — not merely containing it — is what makes it
     * ambiguous; a link reading "click here to read our shipping policy"
     * has real context and isn't flagged.
     *
     * @var string[]
     */
    private const AMBIGUOUS_PHRASES = array(
        'click here',
        'here',
        'read more',
        'learn more',
        'more',
        'this link',
        'link',
    );

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'wcag-scanner';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'WCAG Scanner', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'accessibility';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_wcag_scanner'] ) ) {
            return array();
        }

        $findings = array();
        $posts    = get_posts(
            array(
                'post_type'      => array( 'post', 'page' ),
                'post_status'    => 'publish',
                'posts_per_page' => self::BATCH_SIZE,
                'orderby'        => 'modified',
                'order'          => 'DESC',
            )
        );

        foreach ( $posts as $post ) {
            $count = $this->count_ambiguous_links( $post->post_content );

            if ( 0 === $count ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: 1: number of ambiguous links, 2: the post/page title. */
                    __( '%1$d link(s) with generic, out-of-context text: %2$s', 'vulopilot' ),
                    $count,
                    get_the_title( $post )
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'A link reading only "click here" or "read more" makes no sense out of context — screen reader users who navigate by a page\'s link list can\'t tell them apart. Link text should describe its own destination (WCAG 2.4.4).', 'vulopilot' ),
                'post',
                (string) $post->ID,
                array( 'ambiguous_link_count' => $count )
            );
        }

        return $findings;
    }

    /**
     * @param string $content Raw post_content HTML.
     * @return int Number of <a> elements whose entire visible text is one of AMBIGUOUS_PHRASES.
     */
    private function count_ambiguous_links( string $content ): int {
        if ( ! preg_match_all( '/<a\b[^>]*>(.*?)<\/a>/is', $content, $matches ) ) {
            return 0;
        }

        $ambiguous = 0;

        foreach ( $matches[1] as $link_text ) {
            $text = strtolower( trim( wp_strip_all_tags( $link_text ) ) );

            if ( in_array( $text, self::AMBIGUOUS_PHRASES, true ) ) {
                ++$ambiguous;
            }
        }

        return $ambiguous;
    }
}
