<?php
/**
 * ServerHealthScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Same `WP_Site_Health`-wrapping approach WordPressHealthScanner uses,
 * scoped to the 2 tests that are actually about the hosting environment
 * rather than WordPress itself — PHP version and the SQL server version —
 * so "Server" and "WordPress" stay two genuinely distinct categories
 * rather than one grab-bag. See WordPressHealthScanner's own docblock for
 * the full "wrap core, don't reinvent" / status-mapping reasoning, shared
 * here rather than abstracted into a common base class — two ~15-line
 * private methods duplicated once is simpler than a new shared class for
 * two callers, same restraint every other scanner pair in this codebase
 * already shows.
 *
 * @class       ServerHealthScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ServerHealthScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'server-health';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Server', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'server';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $this->load_dependencies();

        $health   = \WP_Site_Health::get_instance();
        $findings = array();

        foreach ( array( 'get_test_php_version', 'get_test_sql_server' ) as $test_method ) {
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
     * `get_test_php_version()` also calls `wp_check_php_version()`, which
     * lives in wp-admin/includes/misc.php, not autoloaded outside
     * wp-admin either. A gap that only shows up when this scanner runs
     * from a REST request (this plugin's real runtime context), not
     * wp-admin or WP-CLI (both happen to already have misc.php loaded,
     * masking the gap in manual testing).
     *
     * @return void
     */
    private function load_dependencies(): void {
        if ( ! class_exists( '\WP_Site_Health' ) ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-site-health.php';
        }

        if ( ! function_exists( 'wp_check_php_version' ) ) {
            require_once ABSPATH . 'wp-admin/includes/misc.php';
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
            wp_strip_all_tags( (string) ( $result['label'] ?? __( 'Server health check', 'vulopilot' ) ) ),
            'critical' === $status ? Severity::HIGH : Severity::MEDIUM,
            $this->get_category(),
            wp_strip_all_tags( (string) ( $result['description'] ?? '' ) ),
            'site_health_test',
            (string) ( $result['test'] ?? '' )
        );
    }
}
