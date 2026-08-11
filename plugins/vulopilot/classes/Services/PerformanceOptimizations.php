<?php
/**
 * PerformanceOptimizations class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Real, reversible effects for 2 of "Improve Speed" Overview's 6 Quick
 * Actions (`classes/RestAPI/Controllers/PerformanceActions.php` only
 * flips the option; this class is what actually reads it on every real
 * request):
 *
 * - `vulopilot_force_lazy_loading` — when set, force-enables WordPress
 *   core's own native `loading="lazy"` behavior via the
 *   `wp_lazy_loading_enabled` filter, overriding any theme/plugin that
 *   disabled it (the exact condition LazyLoadingScanner flags).
 * - `vulopilot_preload_critical_resources` — when set, outputs real
 *   `<link rel="preload">` tags on `wp_head` for the site's custom logo
 *   and its first enqueued front-end stylesheet.
 *
 * @class       PerformanceOptimizations class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceOptimizations {

    /**
     * PerformanceOptimizations constructor.
     */
    public function __construct() {
        if ( get_option( 'vulopilot_force_lazy_loading' ) ) {
            add_filter( 'wp_lazy_loading_enabled', '__return_true', 999 );
        }

        add_action( 'wp_head', array( $this, 'maybe_output_preloads' ), 1 );
    }

    /**
     * @return void
     */
    public function maybe_output_preloads(): void {
        if ( ! get_option( 'vulopilot_preload_critical_resources' ) ) {
            return;
        }

        $logo_id = get_theme_mod( 'custom_logo' );

        if ( $logo_id ) {
            $logo_url = wp_get_attachment_image_url( (int) $logo_id, 'full' );

            if ( $logo_url ) {
                printf(
                    '<link rel="preload" as="image" href="%s" />' . "\n",
                    esc_url( $logo_url )
                );
            }
        }

        global $wp_styles;

        if ( $wp_styles instanceof \WP_Styles ) {
            foreach ( $wp_styles->queue as $handle ) {
                if ( empty( $wp_styles->registered[ $handle ]->src ) ) {
                    continue;
                }

                printf(
                    '<link rel="preload" as="style" href="%s" />' . "\n",
                    esc_url( $wp_styles->registered[ $handle ]->src )
                );
                break;
            }
        }
    }
}
