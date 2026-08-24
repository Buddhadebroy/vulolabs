<?php
/**
 * AccessibilityScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;


use VuloPilot\Contracts\Scanner\TracksScannedObjectsInterface;
use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Flags published content that contains its own `<h1>` tag. Most themes
 * already render the post title as the page's single `<h1>`, so an
 * `<h1>` inside the post body itself produces two competing top-level
 * headings on the same page — a heading-hierarchy conflict that confuses
 * screen-reader navigation (WCAG 2.4.6, Level AA), independent of
 * ImagesScanner's separate alt-text check.
 *
 * Settings → Scanning → Accessibility's own "WCAG level" row
 * (`target_wcag_level`, Utill::VULOPILOT_SETTINGS_DEFAULTS) gates this
 * one specifically: it's the only one of this codebase's 5 accessibility
 * scanners that maps to a Level AA (not Level A) success criterion, so
 * it's the only one that skips itself at the 'A' target — see that
 * setting's own docblock for the other 4 scanners staying unconditional.
 *
 * @class       AccessibilityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AccessibilityScanner extends AbstractBasicScanner implements TracksScannedObjectsInterface {

    use ScannedPostsTrait;

    /**
     * How many of the most recently published posts/pages to check per run.
     */
    private const BATCH_SIZE = 50;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'accessibility';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Accessibility', 'vulopilot' );
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

        if ( '2.1_a' === ( $settings['target_wcag_level'] ?? '2.1_aa' ) ) {
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
            $this->mark_post_scanned( $post->ID );

            if ( ! preg_match( '/<h1[\s>]/i', $post->post_content ) ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the post/page title. */
                    __( 'Content contains its own <h1>: %s', 'vulopilot' ),
                    get_the_title( $post )
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'Most themes already render the title as the page\'s <h1>. A second <h1> in the content creates a conflicting heading hierarchy for screen readers.', 'vulopilot' ),
                'post',
                (string) $post->ID
            );
        }

        return $findings;
    }
}
