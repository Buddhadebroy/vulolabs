<?php
/**
 * KeyboardAccessibilityScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Flags a positive `tabindex` (`tabindex="1"` and above) in published
 * content — WCAG 2.4.3 (Focus Order): a positive tabindex pulls that
 * element out of the page's natural DOM tab order and inserts it at a
 * fixed position ahead of every `tabindex="0"`/unset element, which
 * almost always produces a confusing, unpredictable keyboard-navigation
 * jump rather than the intended fix. `tabindex="0"` (adds a native
 * element to the natural order) and `tabindex="-1"` (programmatic-focus
 * only, removed from tab order) are both legitimate and not flagged —
 * only values of 1 or greater are a genuine anti-pattern. Same bounded
 * recent-posts-batch, regex-over-post_content approach as
 * AriaAttributesScanner/FormLabelsScanner/WcagScanner — one concrete,
 * well-defined rule per scanner, same convention those three establish;
 * this is this codebase's only check for keyboard/focus-order issues
 * specifically (see PROTECT-MY-SITE.md's "Keyboard & Assistive
 * Technology" audit note on why a fuller keyboard-trap/focus-visible
 * audit isn't attempted here — those are runtime interaction checks a
 * static content scan can't perform).
 *
 * @class       KeyboardAccessibilityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class KeyboardAccessibilityScanner extends AbstractBasicScanner {

    /**
     * How many of the most recently published posts/pages to check per run.
     */
    private const BATCH_SIZE = 50;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'keyboard-accessibility';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Keyboard Accessibility', 'vulopilot' );
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
            $count = $this->count_positive_tabindex( $post->post_content );

            if ( 0 === $count ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: 1: number of elements with a positive tabindex, 2: the post/page title. */
                    __( '%1$d element(s) with a positive tabindex: %2$s', 'vulopilot' ),
                    $count,
                    get_the_title( $post )
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'A tabindex of 1 or higher pulls an element out of the page\'s natural keyboard tab order and inserts it at a fixed position — this almost always produces a confusing, unpredictable focus jump rather than the intended fix. Use tabindex="0" (join the natural order) or remove it entirely (WCAG 2.4.3).', 'vulopilot' ),
                'post',
                (string) $post->ID,
                array( 'positive_tabindex_count' => $count )
            );
        }

        return $findings;
    }

    /**
     * @param string $content Raw post_content HTML.
     * @return int Number of tabindex attributes set to 1 or higher.
     */
    private function count_positive_tabindex( string $content ): int {
        if ( ! preg_match_all( '/tabindex\s*=\s*["\'](\d+)["\']/i', $content, $matches ) ) {
            return 0;
        }

        $positive = array_filter(
            $matches[1],
            static fn( $value ) => (int) $value > 0
        );

        return count( $positive );
    }
}
