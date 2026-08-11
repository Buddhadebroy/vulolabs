<?php
/**
 * LazyLoadingScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Flags a site where WordPress core's own native lazy-loading
 * (`loading="lazy"`, on by default since WP 5.5) has been disabled by a
 * theme or plugin — a zero-cost check via the exact filter WordPress core
 * itself calls, no HTTP request needed unlike this file's sibling scanners.
 *
 * @class       LazyLoadingScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class LazyLoadingScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'lazy-loading';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Lazy Loading', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'performance';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        if ( wp_lazy_loading_enabled( 'img', 'the_content' ) ) {
            return array();
        }

        return array(
            new Finding(
                __( 'Native lazy-loading is disabled', 'vulopilot' ),
                Severity::LOW,
                $this->get_category(),
                __( 'A theme or plugin has disabled WordPress\'s built-in lazy-loading for images, so all images now load immediately instead of only as visitors scroll to them.', 'vulopilot' ),
                'setting',
                'wp_lazy_loading_enabled'
            ),
        );
    }
}
