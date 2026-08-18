<?php
/**
 * PerformanceActions controller file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\RestAPI\Controllers;

use VuloPilot\Scanners\Basic\DatabaseCleanupScanner;
use VuloPilot\Scanners\Basic\ImageCleanupScanner;

defined( 'ABSPATH' ) || exit;

/**
 * `POST /performance-actions/{action_id}` — backs "Improve Speed"
 * Overview's Quick Actions card (QuickActionsCard.tsx). Each of the 6
 * actions is a real, deterministic WordPress-core-or-known-plugin
 * operation, never a fabricated "done" — `minify-css-js` explicitly
 * returns `success: false` with an honest explanation when no
 * minification-capable plugin is active, rather than pretending to have
 * minified anything.
 *
 * @class       PerformanceActions controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class PerformanceActions extends \WP_REST_Controller {

    /**
     * REST base for this controller's routes.
     *
     * @var string
     */
    protected $rest_base = 'performance-actions';

    /**
     * Main plugin files → their own real cache-purge function, same known-
     * plugin list CacheDetectionScanner already checks is_plugin_active()
     * against — this maps to what to *call*, not just detect.
     *
     * @var array<string, string>
     */
    private const CACHE_PLUGIN_FLUSH_FUNCTIONS = array(
        'WP Rocket'        => 'rocket_clean_domain',
        'W3 Total Cache'   => 'w3tc_flush_all',
        'WP Super Cache'   => 'wp_cache_clear_cache',
        'WP Fastest Cache' => 'wpfc_clear_all_cache',
    );

    /**
     * Same size threshold LargeImagesScanner.php flags — duplicated rather
     * than made public there, matching this codebase's own established
     * "duplicate a small shared constant across scopes" precedent.
     */
    private const LARGE_IMAGE_THRESHOLD_BYTES = 512000; // 500KB.

    /**
     * How many oversized images to regenerate per click — bounded so a
     * single request can't run away on a media library with thousands of
     * oversized images.
     */
    private const MAX_IMAGES_PER_RUN = 10;

    /**
     * Registers POST /performance-actions/{action_id}.
     *
     * @inheritDoc
     */
    public function register_routes() {
        register_rest_route(
            VuloPilot()->rest_namespace,
            '/' . $this->rest_base . '/(?P<action_id>[a-z-]+)',
            array(
                array(
                    'methods'             => \WP_REST_Server::CREATABLE,
                    'callback'            => array( $this, 'run_action' ),
                    'permission_callback' => array( $this, 'run_action_permissions_check' ),
                ),
            )
        );
    }

    /**
     * Same manage_options gate every other VuloPilot REST route uses.
     *
     * @param \WP_REST_Request $request Full request object.
     * @return bool
     */
    public function run_action_permissions_check( $request ) {
        return current_user_can( 'manage_options' );
    }

    /**
     * @param \WP_REST_Request $request Full request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public function run_action( $request ) {
        $action_id = sanitize_key( (string) $request->get_param( 'action_id' ) );

        switch ( $action_id ) {
            case 'clear-caches':
                return rest_ensure_response( $this->run_clear_caches() );
            case 'minify-css-js':
                return rest_ensure_response( $this->run_minify_css_js() );
            case 'optimize-images':
                return rest_ensure_response( $this->run_optimize_images() );
            case 'database-cleanup':
                return rest_ensure_response( $this->run_database_cleanup() );
            case 'image-cleanup':
                return rest_ensure_response( $this->run_image_cleanup() );
            case 'lazy-loading':
                return rest_ensure_response( $this->run_enable_lazy_loading() );
            case 'preload-resources':
                return rest_ensure_response( $this->run_enable_preload_resources() );
            default:
                return new \WP_Error(
                    'vulopilot_unknown_performance_action',
                    __( 'Unknown quick action.', 'vulopilot' ),
                    array( 'status' => 404 )
                );
        }
    }

    /**
     * Flushes the WordPress object cache plus every known caching plugin's
     * own real purge function, if active.
     *
     * @return array{success: bool, message: string}
     */
    private function run_clear_caches(): array {
        wp_cache_flush();

        $flushed = $this->flush_known_cache_plugins();

        return array(
            'success' => true,
            'message' => empty( $flushed )
                ? __( 'WordPress object cache flushed.', 'vulopilot' )
                : sprintf(
                    /* translators: %s is a comma-separated list of cache plugin names that were also flushed. */
                    __( 'WordPress object cache flushed, plus: %s.', 'vulopilot' ),
                    implode( ', ', $flushed )
                ),
        );
    }

    /**
     * Regenerates minified assets via a known minification-capable
     * plugin's own real function — returns an honest failure, not a
     * fabricated success, when none is active.
     *
     * @return array{success: bool, message: string}
     */
    private function run_minify_css_js(): array {
        $regenerated = array();

        if ( class_exists( '\autoptimizeCache' ) && method_exists( '\autoptimizeCache', 'clearall' ) ) {
            \autoptimizeCache::clearall();
            $regenerated[] = 'Autoptimize';
        }

        if ( function_exists( 'rocket_clean_domain' ) ) {
            rocket_clean_domain();
            $regenerated[] = 'WP Rocket';
        }

        if ( empty( $regenerated ) ) {
            return array(
                'success' => false,
                'message' => __( 'No minification plugin detected — install Autoptimize, WP Rocket, or a similar plugin to enable this action.', 'vulopilot' ),
            );
        }

        return array(
            'success' => true,
            'message' => sprintf(
                /* translators: %s is a comma-separated list of plugin names that regenerated minified assets. */
                __( 'Regenerated minified assets via: %s.', 'vulopilot' ),
                implode( ', ', $regenerated )
            ),
        );
    }

    /**
     * Regenerates registered thumbnail sizes (never the original file) for
     * the largest oversized image attachments, at a lower JPEG/WebP
     * quality — the same real mechanism "Regenerate Thumbnails" uses.
     *
     * @return array{success: bool, message: string}
     */
    private function run_optimize_images(): array {
        if ( ! function_exists( 'wp_generate_attachment_metadata' ) ) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }

        $attachments = get_posts(
            array(
                'post_type'      => 'attachment',
                'post_mime_type' => 'image',
                'post_status'    => 'inherit',
                'posts_per_page' => 100,
                'orderby'        => 'date',
                'order'          => 'DESC',
                'fields'         => 'ids',
            )
        );

        $optimized_count = 0;
        $bytes_saved     = 0;

        add_filter( 'wp_editor_set_quality', array( __CLASS__, 'filter_image_quality' ) );

        foreach ( $attachments as $attachment_id ) {
            if ( $optimized_count >= self::MAX_IMAGES_PER_RUN ) {
                break;
            }

            $file = get_attached_file( $attachment_id );

            if ( ! $file || ! file_exists( $file ) || filesize( $file ) <= self::LARGE_IMAGE_THRESHOLD_BYTES ) {
                continue;
            }

            $bytes_before = $this->sum_registered_size_files( $attachment_id );
            $metadata     = wp_generate_attachment_metadata( $attachment_id, $file );

            if ( is_array( $metadata ) ) {
                wp_update_attachment_metadata( $attachment_id, $metadata );
            }

            $bytes_saved += max( 0, $bytes_before - $this->sum_registered_size_files( $attachment_id ) );
            ++$optimized_count;
        }

        remove_filter( 'wp_editor_set_quality', array( __CLASS__, 'filter_image_quality' ) );

        return array(
            'success' => true,
            'message' => 0 === $optimized_count
                ? __( 'No oversized images found to optimize.', 'vulopilot' )
                : sprintf(
                    /* translators: 1: number of images optimized, 2: formatted byte size saved, e.g. "1.4 MB". */
                    __( 'Optimized %1$d image(s), saved %2$s.', 'vulopilot' ),
                    $optimized_count,
                    size_format( $bytes_saved )
                ),
        );
    }

    /**
     * Deletes real expired transients and real excess post revisions —
     * the same rows DatabaseCleanupScanner counts.
     *
     * @return array{success: bool, message: string}
     */
    private function run_database_cleanup(): array {
        global $wpdb;

        $expired_timeout_keys = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s AND option_value < %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $wpdb->esc_like( '_transient_timeout_' ) . '%',
                time()
            )
        );

        $deleted_transients = 0;

        foreach ( $expired_timeout_keys as $timeout_key ) {
            delete_option( $timeout_key );
            delete_option( str_replace( '_transient_timeout_', '_transient_', $timeout_key ) );
            ++$deleted_transients;
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $posts_with_revisions = $wpdb->get_col(
            "SELECT DISTINCT post_parent FROM {$wpdb->posts} WHERE post_type = 'revision'"
        );

        $deleted_revisions = 0;

        foreach ( $posts_with_revisions as $post_id ) {
            $revisions = wp_get_post_revisions(
                (int) $post_id,
                array(
					'order'  => 'DESC',
					'fields' => 'ids',
                )
            );

            foreach ( array_slice( $revisions, DatabaseCleanupScanner::KEEP_REVISIONS_PER_POST ) as $revision_id ) {
                if ( wp_delete_post_revision( $revision_id ) ) {
                    ++$deleted_revisions;
                }
            }
        }

        return array(
            'success' => true,
            'message' => sprintf(
                /* translators: 1: number of expired transients deleted, 2: number of old post revisions deleted. */
                __( 'Deleted %1$d expired transients and %2$d old post revisions.', 'vulopilot' ),
                $deleted_transients,
                $deleted_revisions
            ),
        );
    }

    /**
     * Deletes the real unattached, unused image attachments
     * ImageCleanupScanner counts — same protected-id exclusions (featured
     * images, site icon, custom logo) and same 30-day age gate, since this
     * re-uses that scanner's own `get_orphaned_image_ids()` rather than
     * re-implementing the query. Bounded by MAX_IMAGES_PER_RUN per click,
     * same safety cap `run_optimize_images()` uses, so a media library with
     * hundreds of orphaned images doesn't time out a single request.
     *
     * @return array{success: bool, message: string}
     */
    private function run_image_cleanup(): array {
        $orphaned_ids = ImageCleanupScanner::get_orphaned_image_ids();

        if ( empty( $orphaned_ids ) ) {
            return array(
                'success' => true,
                'message' => __( 'No unused images found to clean up.', 'vulopilot' ),
            );
        }

        $to_delete   = array_slice( $orphaned_ids, 0, self::MAX_IMAGES_PER_RUN );
        $deleted     = 0;
        $bytes_freed = 0;

        foreach ( $to_delete as $attachment_id ) {
            $file = get_attached_file( $attachment_id );
            $size = ( $file && file_exists( $file ) ) ? filesize( $file ) : 0;

            if ( wp_delete_attachment( $attachment_id, true ) ) {
                ++$deleted;
                $bytes_freed += $size;
            }
        }

        $remaining = count( $orphaned_ids ) - $deleted;

        return array(
            'success' => true,
            'message' => $remaining > 0
                ? sprintf(
                    /* translators: 1: number of images deleted, 2: formatted bytes freed, 3: number of remaining unused images not yet processed. */
                    __( 'Deleted %1$d unused image(s), freed %2$s. %3$d more found — run again to continue.', 'vulopilot' ),
                    $deleted,
                    size_format( $bytes_freed ),
                    $remaining
                )
                : sprintf(
                    /* translators: 1: number of images deleted, 2: formatted bytes freed. */
                    __( 'Deleted %1$d unused image(s), freed %2$s.', 'vulopilot' ),
                    $deleted,
                    size_format( $bytes_freed )
                ),
        );
    }

    /**
     * Real, reversible toggle — Services\PerformanceOptimizations reads
     * this option on every request and force-enables WordPress's own
     * native lazy-loading filter when set.
     *
     * @return array{success: bool, message: string}
     */
    private function run_enable_lazy_loading(): array {
        $was_enabled = (bool) get_option( 'vulopilot_force_lazy_loading' );

        update_option( 'vulopilot_force_lazy_loading', true );

        return array(
            'success' => true,
            'message' => $was_enabled
                ? __( 'Lazy loading was already force-enabled.', 'vulopilot' )
                : __( 'Lazy loading is now force-enabled site-wide.', 'vulopilot' ),
        );
    }

    /**
     * Real, reversible toggle — Services\PerformanceOptimizations reads
     * this option on every `wp_head` and outputs real preload tags when set.
     *
     * @return array{success: bool, message: string}
     */
    private function run_enable_preload_resources(): array {
        $was_enabled = (bool) get_option( 'vulopilot_preload_critical_resources' );

        update_option( 'vulopilot_preload_critical_resources', true );

        return array(
            'success' => true,
            'message' => $was_enabled
                ? __( 'Critical resource preloading was already enabled.', 'vulopilot' )
                : __( 'Critical resource preloading is now enabled — the site logo and main stylesheet will be preloaded.', 'vulopilot' ),
        );
    }

    /**
     * @return array<int, string> Display names of cache plugins actually flushed.
     */
    private function flush_known_cache_plugins(): array {
        $flushed = array();

        foreach ( self::CACHE_PLUGIN_FLUSH_FUNCTIONS as $label => $function_name ) {
            if ( function_exists( $function_name ) ) {
                call_user_func( $function_name );
                $flushed[] = $label;
            }
        }

        if ( class_exists( '\Cache_Enabler' ) && method_exists( '\Cache_Enabler', 'clear_total_cache' ) ) {
            \Cache_Enabler::clear_total_cache();
            $flushed[] = 'Cache Enabler';
        }

        if ( has_action( 'litespeed_purge_all' ) ) {
            do_action( 'litespeed_purge_all' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals -- third-party plugin's own action name, not ours to prefix.
            $flushed[] = 'LiteSpeed Cache';
        }

        return $flushed;
    }

    /**
     * @param int $attachment_id Attachment id.
     * @return int Total bytes across every registered (non-original) size file currently on disk.
     */
    private function sum_registered_size_files( int $attachment_id ): int {
        $metadata = wp_get_attachment_metadata( $attachment_id );

        if ( ! is_array( $metadata ) || empty( $metadata['sizes'] ) ) {
            return 0;
        }

        $base_dir = trailingslashit( dirname( get_attached_file( $attachment_id ) ) );
        $total    = 0;

        foreach ( $metadata['sizes'] as $size ) {
            $path = $base_dir . $size['file'];

            if ( file_exists( $path ) ) {
                $total += filesize( $path );
            }
        }

        return $total;
    }

    /**
     * `wp_editor_set_quality` filter callback used only for the duration of
     * run_optimize_images()'s regeneration loop.
     *
     * @return int
     */
    public static function filter_image_quality(): int {
        return 82;
    }
}
