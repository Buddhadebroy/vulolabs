<?php
/**
 * Every class in this file used to be its own file under classes/Scanners/Basic/
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

namespace VuloPilot\Scanners\Basic;

use VuloPilot\Contracts\Scanner\TracksScannedObjectsInterface;
use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Flags published content that contains its own `<h1>` tag. Most themes
 * already render the post title as the page's single `<h1>`, so an
 * `<h1>` inside the post body itself produces two competing top-level
 * headings on the same page - a heading-hierarchy conflict that confuses
 * screen-reader navigation (WCAG 2.4.6, Level AA), independent of
 * ImagesScanner's separate alt-text check.
 *
 * Settings → Scanning → Accessibility's own "WCAG level" row
 * (`target_wcag_level`, Utill::VULOPILOT_SETTINGS_DEFAULTS) gates this
 * one specifically: it's the only one of this codebase's 5 accessibility
 * scanners that maps to a Level AA (not Level A) success criterion, so
 * it's the only one that skips itself at the 'A' target - see that
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

/**
 * AEO (Answer Engine Optimization) - the one GEO check this pass adds that
 * the existing 9 `geo`-category scanners don't already cover: whether a
 * post whose own content is *already shaped* like an answer-engine-ready
 * FAQ or HowTo (question-phrased headings, or a numbered step list) also
 * has the matching `FAQPage`/`HowTo` schema.org markup search/answer
 * engines actually read to lift it into a rich answer box. This is
 * deliberately narrower than GeoFaqOpportunityScanner (which flags content
 * with NO question headings at all) - this scanner only ever fires for
 * content that already looks FAQ/HowTo-shaped but is missing the schema
 * that would let an answer engine recognize it as such, a distinct,
 * currently-uncovered signal, not a restatement of that scanner's own
 * check.
 *
 * Reads `_vulopilot_schema_json` postmeta directly (Services\SchemaJsonLdRenderer's
 * own key - the same JSON-LD this codebase already renders on `wp_head` for
 * a post, see GenerateSchemaAction/SchemaJsonLdRenderer) rather than making
 * a real HTTP request per post - every signal this scanner needs already
 * exists locally, so there's no reason to fetch the page over the network
 * the way Pro's SitewideStructuredDataScanner does for its own, different
 * ("is there any JSON-LD present at all") check.
 *
 * @class       AeoSchemaScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AeoSchemaScanner extends AbstractBasicScanner implements TracksScannedObjectsInterface {

    use ScannedPostsTrait;

    private const BATCH_SIZE = 50;

    /**
     * Must match SchemaJsonLdRenderer::META_KEY / GenerateSchemaAction::META_KEY.
     */
    private const SCHEMA_META_KEY = '_vulopilot_schema_json';

    /**
     * A numbered/ordered list with at least this many steps reads as a
     * genuine "how to" sequence rather than an incidental short list.
     */
    private const MIN_HOWTO_STEPS = 3;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'aeo-schema';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'AEO Schema Coverage', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'geo';
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
            $this->mark_post_scanned( $post->ID );

            $schema_types = $this->get_declared_schema_types( $post->ID );

            if ( $this->looks_faq_shaped( $post->post_content ) && ! in_array( 'FAQPage', $schema_types, true ) ) {
                $findings[] = $this->build_finding( $post, 'FAQPage', 'faq' );
            }

            if ( $this->looks_howto_shaped( $post->post_content ) && ! in_array( 'HowTo', $schema_types, true ) ) {
                $findings[] = $this->build_finding( $post, 'HowTo', 'howto' );
            }
        }

        return $findings;
    }

    /**
     * @param string $content Post content HTML.
     * @return bool Whether this content already has GeoFaqOpportunityScanner's own "question-phrased heading" signal.
     */
    private function looks_faq_shaped( string $content ): bool {
        return 1 === preg_match( '/<h[2-6][^>]*>[^<]*\?\s*<\/h[2-6]>/i', $content );
    }

    /**
     * @param string $content Post content HTML.
     * @return bool Whether an ordered list with at least MIN_HOWTO_STEPS items is present.
     */
    private function looks_howto_shaped( string $content ): bool {
        if ( ! preg_match_all( '/<ol[^>]*>(.*?)<\/ol>/is', $content, $lists ) ) {
            return false;
        }

        foreach ( $lists[1] as $list_body ) {
            if ( preg_match_all( '/<li[^>]*>/i', $list_body ) >= self::MIN_HOWTO_STEPS ) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param int $post_id Post to read declared schema types for.
     * @return string[] `@type` value(s) already saved to this post's own SCHEMA_META_KEY, empty if none/malformed.
     */
    private function get_declared_schema_types( int $post_id ): array {
        $raw = get_post_meta( $post_id, self::SCHEMA_META_KEY, true );

        if ( '' === $raw || ! is_string( $raw ) ) {
            return array();
        }

        $decoded = json_decode( $raw, true );

        if ( ! is_array( $decoded ) || empty( $decoded['@type'] ) ) {
            return array();
        }

        return is_array( $decoded['@type'] ) ? $decoded['@type'] : array( $decoded['@type'] );
    }

    /**
     * @param \WP_Post $post        The post missing schema.
     * @param string   $schema_type 'FAQPage' or 'HowTo'.
     * @param string   $shape       'faq' or 'howto' - recorded in meta for AiCopilot\Actions\GenerateSchemaAction to read a hint from, same convention GeoTrustSignalsScanner's own meta already establishes.
     * @return Finding
     */
    private function build_finding( \WP_Post $post, string $schema_type, string $shape ): Finding {
        return new Finding(
            sprintf(
                /* translators: 1: schema.org type (FAQPage/HowTo), 2: post/page title. */
                __( 'Missing %1$s schema: %2$s', 'vulopilot' ),
                $schema_type,
                get_the_title( $post )
            ),
            Severity::MEDIUM,
            $this->get_category(),
            sprintf(
                /* translators: %s is the schema.org type (FAQPage/HowTo). */
                __( "This content is already shaped like %s content (matching headings/list structure) but has no matching schema.org markup, so AI answer engines can't confidently recognize it as one.", 'vulopilot' ),
                $schema_type
            ),
            'post',
            (string) $post->ID,
            array(
                'aeo_schema_gap'     => true,
                'aeo_suggested_type' => $schema_type,
                'aeo_content_shape'  => $shape,
            )
        );
    }
}

/**
 * Flags interactive-looking elements - a <div> or <span> with an onclick
 * handler - that carry no `role` attribute. Screen readers only announce
 * these as interactive when a role (e.g. "button") is present; a bare
 * onclick on a non-interactive element is invisible to assistive tech. A
 * narrow, concrete check rather than attempting general ARIA validation,
 * matching this codebase's one-thing-per-scanner convention
 * (AccessibilityScanner's own docblock makes the same choice).
 *
 * @class       AriaAttributesScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AriaAttributesScanner extends AbstractBasicScanner implements TracksScannedObjectsInterface {

    use ScannedPostsTrait;

    /**
     * How many of the most recently published posts/pages to check per run.
     */
    private const BATCH_SIZE = 50;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'aria-attributes';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'ARIA Attributes', 'vulopilot' );
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
            $this->mark_post_scanned( $post->ID );

            $count = $this->count_missing_roles( $post->post_content );

            if ( 0 === $count ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: 1: number of elements missing a role attribute, 2: the post/page title. */
                    __( '%1$d interactive element(s) missing a role attribute: %2$s', 'vulopilot' ),
                    $count,
                    get_the_title( $post )
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'A <div> or <span> with a click handler but no role attribute is invisible to screen readers as an interactive element.', 'vulopilot' ),
                'post',
                (string) $post->ID,
                array( 'missing_role_count' => $count ),
                'missing-aria-role'
            );
        }

        return $findings;
    }

    /**
     * @param string $content Raw post_content HTML.
     * @return int Number of clickable <div>/<span> elements with no role attribute.
     */
    private function count_missing_roles( string $content ): int {
        if ( ! preg_match_all( '/<(div|span)\b([^>]*\bonclick=[^>]*)>/i', $content, $matches, PREG_SET_ORDER ) ) {
            return 0;
        }

        $missing = 0;

        foreach ( $matches as $match ) {
            if ( preg_match( '/\brole=["\'][^"\']+["\']/i', $match[2] ) ) {
                continue;
            }

            ++$missing;
        }

        return $missing;
    }
}

/**
 * Flags <input>/<textarea>/<select> elements in published content with no
 * associated label - no <label for="...">, aria-label, or
 * aria-labelledby. Screen readers can't announce what an unlabeled field
 * is for. Same bounded recent-posts batch and regex-over-post_content
 * approach as AccessibilityScanner, just checking a different pattern.
 *
 * @class       FormLabelsScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FormLabelsScanner extends AbstractBasicScanner implements TracksScannedObjectsInterface {

    use ScannedPostsTrait;

    /**
     * How many of the most recently published posts/pages to check per run.
     */
    private const BATCH_SIZE = 50;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'form-labels';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Form Labels', 'vulopilot' );
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
            $this->mark_post_scanned( $post->ID );

            $unlabeled_count = $this->count_unlabeled_fields( $post->post_content );

            if ( 0 === $unlabeled_count ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: 1: number of unlabeled form fields, 2: the post/page title. */
                    __( '%1$d unlabeled form field(s): %2$s', 'vulopilot' ),
                    $unlabeled_count,
                    get_the_title( $post )
                ),
                Severity::MEDIUM,
                $this->get_category(),
                __( 'Every <input>/<textarea>/<select> needs an associated <label>, aria-label, or aria-labelledby so screen reader users know what it is for.', 'vulopilot' ),
                'post',
                (string) $post->ID,
                array( 'unlabeled_count' => $unlabeled_count ),
                'unlabeled-form-fields'
            );
        }

        return $findings;
    }

    /**
     * @param string $content Raw post_content HTML.
     * @return int Number of form fields with no detectable label.
     */
    private function count_unlabeled_fields( string $content ): int {
        if ( ! preg_match_all( '/<(input|textarea|select)\b([^>]*)>/i', $content, $matches, PREG_SET_ORDER ) ) {
            return 0;
        }

        $unlabeled = 0;

        foreach ( $matches as $match ) {
            $tag        = strtolower( $match[1] );
            $attributes = $match[2];

            if ( 'input' === $tag && preg_match( '/type=["\'](hidden|submit|button|image)["\']/i', $attributes ) ) {
                continue;
            }

            if ( preg_match( '/\baria-label(ledby)?=["\'][^"\']+["\']/i', $attributes ) ) {
                continue;
            }

            if ( preg_match( '/\bid=["\']([^"\']+)["\']/i', $attributes, $id_match )
                && preg_match( '/<label\b[^>]*\bfor=["\']' . preg_quote( $id_match[1], '/' ) . '["\']/i', $content ) ) {
                continue;
            }

            ++$unlabeled;
        }

        return $unlabeled;
    }
}

/**
 * Flags a positive `tabindex` (`tabindex="1"` and above) in published
 * content - WCAG 2.4.3 (Focus Order): a positive tabindex pulls that
 * element out of the page's natural DOM tab order and inserts it at a
 * fixed position ahead of every `tabindex="0"`/unset element, which
 * almost always produces a confusing, unpredictable keyboard-navigation
 * jump rather than the intended fix. `tabindex="0"` (adds a native
 * element to the natural order) and `tabindex="-1"` (programmatic-focus
 * only, removed from tab order) are both legitimate and not flagged -
 * only values of 1 or greater are a genuine anti-pattern. Same bounded
 * recent-posts-batch, regex-over-post_content approach as
 * AriaAttributesScanner/FormLabelsScanner/WcagScanner - one concrete,
 * well-defined rule per scanner, same convention those three establish;
 * this is this codebase's only check for keyboard/focus-order issues
 * specifically (see PROTECT-MY-SITE.md's "Keyboard & Assistive
 * Technology" audit note on why a fuller keyboard-trap/focus-visible
 * audit isn't attempted here - those are runtime interaction checks a
 * static content scan can't perform).
 *
 * @class       KeyboardAccessibilityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class KeyboardAccessibilityScanner extends AbstractBasicScanner implements TracksScannedObjectsInterface {

    use ScannedPostsTrait;

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
            $this->mark_post_scanned( $post->ID );

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
                __( 'A tabindex of 1 or higher pulls an element out of the page\'s natural keyboard tab order and inserts it at a fixed position - this almost always produces a confusing, unpredictable focus jump rather than the intended fix. Use tabindex="0" (join the natural order) or remove it entirely (WCAG 2.4.3).', 'vulopilot' ),
                'post',
                (string) $post->ID,
                array( 'positive_tabindex_count' => $count ),
                'positive-tabindex'
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

/**
 * Checks whether a bounded batch of recently-modified published posts'
 * OWN permalinks resolve - distinct from BrokenLinksScanner, which only
 * checks outbound/internal links found INSIDE content, never whether the
 * post's own URL actually loads (a rewrite-rule/permalink-structure
 * change is a common, otherwise-invisible way for this to silently break).
 *
 * @class       NotFoundScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class NotFoundScanner extends AbstractBasicScanner implements TracksScannedObjectsInterface {

    use ScannedPostsTrait;

    private const BATCH_SIZE              = 30;
    private const REQUEST_TIMEOUT_SECONDS = 5;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'not-found';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( '404 Detection', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'not-found';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['content_search_scans']['links']['enable'] ) ) {
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

            $permalink = get_permalink( $post );
            $response  = wp_remote_head(
                $permalink,
                array(
                    'timeout'     => self::REQUEST_TIMEOUT_SECONDS,
                    'redirection' => 5,
                    'sslverify'   => false,
                )
            );

            if ( is_wp_error( $response ) ) {
                continue;
            }

            if ( 404 !== wp_remote_retrieve_response_code( $response ) ) {
                continue;
            }

            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the post/page title. */
                    __( 'Published content returns a 404: %s', 'vulopilot' ),
                    get_the_title( $post )
                ),
                Severity::HIGH,
                $this->get_category(),
                __( 'This page is published but its own URL does not resolve - often caused by a permalink structure or rewrite rule change.', 'vulopilot' ),
                'post',
                (string) $post->ID,
                array( 'url' => $permalink )
            );
        }

        return $findings;
    }
}

/**
 * Walks the homepage's own redirect chain (if any), manually following
 * `Location` headers rather than letting wp_remote_get()'s own
 * `redirection` option silently follow them - the same
 * `wp_remote_get( home_url() )` idiom RobotsTxtScanner/SitemapScanner
 * already use for hitting the site's own front end, just with redirects
 * disabled so each hop can be inspected. Flags a chain longer than
 * MAX_HEALTHY_HOPS, or one that doesn't terminate within MAX_HOPS_CHECKED
 * (a likely redirect loop).
 *
 * @class       RedirectAnalysisScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class RedirectAnalysisScanner extends AbstractBasicScanner {

    /**
     * A chain this long or shorter is normal (e.g. http -> https, or a
     * single canonical www/non-www redirect) and isn't worth flagging.
     */
    private const MAX_HEALTHY_HOPS = 2;

    /**
     * Hard cap on hops followed before giving up and treating the chain
     * as a likely loop - bounds the request count this scanner can make.
     */
    private const MAX_HOPS_CHECKED = 5;

    private const REQUEST_TIMEOUT_SECONDS = 5;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'redirect-analysis';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Redirect Analysis', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'redirects';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['content_search_scans']['links']['enable'] ) ) {
            return array();
        }

        $url  = home_url( '/' );
        $hops = array();

        for ( $i = 0; $i < self::MAX_HOPS_CHECKED; $i++ ) {
            $response = wp_remote_get(
                $url,
                array(
                    'timeout'     => self::REQUEST_TIMEOUT_SECONDS,
                    'redirection' => 0,
                    'sslverify'   => false,
                )
            );

            if ( is_wp_error( $response ) ) {
                return array();
            }

            $status_code = wp_remote_retrieve_response_code( $response );

            if ( $status_code < 300 || $status_code >= 400 ) {
                break;
            }

            $location = wp_remote_retrieve_header( $response, 'location' );

            if ( empty( $location ) ) {
                break;
            }

            $hops[] = $url;
            $url    = $location;
        }

        if ( count( $hops ) > self::MAX_HEALTHY_HOPS ) {
            $looped = count( $hops ) === self::MAX_HOPS_CHECKED;

            return array(
                new Finding(
                    $looped
                        ? __( 'Homepage redirect did not resolve within the checked hop limit', 'vulopilot' )
                        : sprintf(
                            /* translators: %d is the number of redirect hops. */
                            __( 'Homepage redirects through %d hops before resolving', 'vulopilot' ),
                            count( $hops )
                        ),
                    $looped ? Severity::HIGH : Severity::MEDIUM,
                    $this->get_category(),
                    __( 'Long or looping redirect chains slow down every visit and hurt search engine crawling.', 'vulopilot' ),
                    'url',
                    home_url( '/' ),
                    array( 'chain' => $hops ),
                    'homepage-redirect-chain'
                ),
            );
        }

        return array();
    }
}

/**
 * "WCAG Scanner" (readme.txt Phase 8) - flags links whose entire visible
 * text is a generic, out-of-context phrase ("click here", "read more",
 * "learn more", etc, self::AMBIGUOUS_PHRASES). WCAG 2.4.4 (Link Purpose,
 * In Context) requires link text to make sense on its own - a screen
 * reader user who pulls up a page's list of links (a common navigation
 * shortcut) hears nothing but "click here, click here, click here" with
 * no way to tell them apart. This is the single most common rule
 * automated accessibility auditors (axe-core's `link-name`, WAVE's
 * "Suspicious Link Text") flag, and this codebase had no check for it
 * yet - distinct from AriaAttributesScanner (missing role on a clickable
 * non-link element) and FormLabelsScanner (unlabeled form fields). One
 * concrete, well-defined rule per scanner, same convention those two
 * already establish.
 *
 * @class       WcagScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WcagScanner extends AbstractBasicScanner implements TracksScannedObjectsInterface {

    use ScannedPostsTrait;

    /**
     * How many of the most recently published posts/pages to check per run.
     */
    private const BATCH_SIZE = 50;

    /**
     * A link's entire visible text (trimmed, lowercased) matching one of
     * these exactly - not merely containing it - is what makes it
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
            $this->mark_post_scanned( $post->ID );

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
                __( 'A link reading only "click here" or "read more" makes no sense out of context - screen reader users who navigate by a page\'s link list can\'t tell them apart. Link text should describe its own destination (WCAG 2.4.4).', 'vulopilot' ),
                'post',
                (string) $post->ID,
                array( 'ambiguous_link_count' => $count ),
                'generic-link-text'
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
