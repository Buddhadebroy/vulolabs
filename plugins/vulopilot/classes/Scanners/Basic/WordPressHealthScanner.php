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

        return new Finding(
            wp_strip_all_tags( (string) ( $result['label'] ?? __( 'WordPress health check', 'vulopilot' ) ) ),
            'critical' === $status ? Severity::HIGH : Severity::MEDIUM,
            $this->get_category(),
            wp_strip_all_tags( (string) ( $result['description'] ?? '' ) ),
            'site_health_test',
            (string) ( $result['test'] ?? '' )
        );
    }
}
