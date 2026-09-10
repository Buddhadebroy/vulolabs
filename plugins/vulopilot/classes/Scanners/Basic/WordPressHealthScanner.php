<?php
/**
 * WordPressHealthScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Wraps 3 of WordPress core's own `WP_Site_Health` tests — the same class
 * and same cached results Tools → Site Health already computes — rather
 * than re-implementing core-version/HTTPS/REST-API checks from scratch,
 * same "wrap core, don't reinvent" posture SitemapManager/RobotsTxtManager
 * already establish for their own core-wrapping services. `WP_Site_Health`
 * isn't autoloaded outside wp-admin, hence the explicit `require_once`.
 * Every wrapped test's own `status` (good/recommended/critical) maps onto
 * Severity 1:1 (recommended → medium, critical → high); a `status` of
 * `good` produces no Finding at all, same "only report actual problems"
 * shape every other scanner here already follows. HTML tags are stripped
 * from each test's own `description` — Finding's own field is plain text,
 * not HTML, everywhere else in this codebase.
 *
 * @class       WordPressHealthScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WordPressHealthScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'wordpress-health';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'WordPress', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'wordpress';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $this->load_dependencies();

        $health   = \WP_Site_Health::get_instance();
        $findings = array();

        foreach ( array( 'get_test_wordpress_version', 'get_test_https_status', 'get_test_rest_availability' ) as $test_method ) {
            if ( ! method_exists( $health, $test_method ) ) {
                continue;
            }

            $finding = $this->finding_from_test_result( $health->$test_method() );

            if ( $finding ) {
                $findings[] = $finding;
            }
        }

        return $findings;
    }

    /**
     * `WP_Site_Health` itself is only autoloaded in wp-admin — but
     * `get_test_wordpress_version()` also calls `get_core_updates()`,
     * from update.php, which it doesn't require for you. Same gap
     * ServerHealthScanner's own `load_dependencies()` documents — only
     * shows up from a REST request (this plugin's real runtime context),
     * not wp-admin or WP-CLI, which is why manual testing there wouldn't
     * catch it.
     *
     * @return void
     */
    private function load_dependencies(): void {
        if ( ! class_exists( '\WP_Site_Health' ) ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-site-health.php';
        }

        if ( ! function_exists( 'get_core_updates' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }
    }

    /**
     * @param array $result A `WP_Site_Health::get_test_*()` return value.
     * @return Finding|null Null when the test's own status is 'good'.
     */
    private function finding_from_test_result( array $result ): ?Finding {
        $status = $result['status'] ?? 'good';

        if ( 'good' === $status ) {
            return null;
        }

        $description = (string) ( $result['description'] ?? '' );
        $paragraphs  = $this->split_into_paragraphs( $description );

        return new Finding(
            wp_strip_all_tags( (string) ( $result['label'] ?? __( 'WordPress health check', 'vulopilot' ) ) ),
            'critical' === $status ? Severity::HIGH : Severity::MEDIUM,
            $this->get_category(),
            wp_strip_all_tags( $description ),
            'site_health_test',
            (string) ( $result['test'] ?? '' ),
            count( $paragraphs ) >= 2
                ? array(
                    'why_it_matters' => $paragraphs[0],
                    'what_happened'  => implode( ' ', array_slice( $paragraphs, 1 ) ),
                )
                : array()
        );
    }

    /**
     * `WP_Site_Health`'s own test descriptions are built from separate real
     * HTML `<p>` blocks (confirmed by reading `WP_Site_Health`'s own core
     * source) — a first paragraph explaining why the check matters, then
     * one or more further paragraphs describing what this specific test
     * actually found — flattened into one plain-text blob by the time
     * `finding_from_test_result()` above stores it as `Finding`'s own
     * `description`. Splitting on `</p>` recovers that real, already-
     * existing structure (never fabricated) so the frontend can show a
     * genuine "Why it matters"/"What happened" split; a description with
     * only one real paragraph returns a single-element array, and the
     * caller above then omits `meta` entirely rather than splitting
     * nothing into two boxes.
     *
     * Some tests (e.g. `get_test_rest_availability()`) join two distinct
     * lines within the SAME paragraph with a real `<br>` rather than a new
     * `<p>` (e.g. "REST API Endpoint: …" and "REST API Response: …") — a
     * bare `wp_strip_all_tags()` would silently drop that tag and glue the
     * two lines together with no separator at all (confirmed live:
     * "…context=editREST API Response: …"). Replacing `<br>` with a real
     * separator first keeps both lines readable without fabricating new
     * wording — still core's own two lines, just not run together.
     *
     * @param string $html_description Raw HTML `description` from a `WP_Site_Health` test result.
     * @return array<int, string> Plain-text paragraphs, in order, empty ones dropped.
     */
    private function split_into_paragraphs( string $html_description ): array {
        $chunks = preg_split( '/<\/p>\s*/i', $html_description ) ?: array();

        return array_values(
            array_filter(
                array_map(
                    static fn( string $chunk ): string => trim(
                        wp_strip_all_tags( preg_replace( '/<br\s*\/?>/i', ' — ', $chunk ) ?? $chunk )
                    ),
                    $chunks
                ),
                static fn( string $paragraph ): bool => '' !== $paragraph
            )
        );
    }
}
