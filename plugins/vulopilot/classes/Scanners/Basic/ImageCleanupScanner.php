<?php
/**
 * ImageCleanupScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Flags unused image attachments the same way real media-cleaner plugins
 * define "orphaned": unattached (`post_parent = 0`), not set as anyone's
 * featured image, not the site icon or custom logo, and uploaded more than
 * MIN_AGE_DAYS ago (a safety gate so an image mid-upload for a post that
 * hasn't been saved yet, or one intentionally kept unattached, doesn't get
 * flagged the same day it lands in the library). Distinct from
 * LargeImagesScanner (category 'performance' too, but flags oversized
 * *in-use* images, not unused ones). Same "combined count above a
 * threshold" shape DatabaseCleanupScanner uses, and its own counting logic
 * is what PerformanceActions' `image-cleanup` quick action actually deletes.
 *
 * @class       ImageCleanupScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ImageCleanupScanner extends AbstractBasicScanner {

    /**
     * How old an unattached image must be before it's flagged — avoids
     * catching images uploaded moments ago for a post that isn't saved yet.
     */
    const MIN_AGE_DAYS = 30;

    /**
     * Orphaned-image count above which this is worth flagging.
     */
    private const THRESHOLD = 5;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'image-cleanup';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Image Cleanup', 'vulopilot' );
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
        $orphaned_ids = self::get_orphaned_image_ids();
        $count        = count( $orphaned_ids );

        if ( $count <= self::THRESHOLD ) {
            return array();
        }

        $bytes = self::sum_attachment_file_sizes( $orphaned_ids );

        return array(
            new Finding(
                sprintf(
                    /* translators: 1: number of unused images, 2: formatted total file size, e.g. "3.2 MB". */
                    __( '%1$d unused images found (%2$s)', 'vulopilot' ),
                    $count,
                    size_format( $bytes )
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'These images are not attached to any post or page, are not used as a featured image, site icon, or logo, and were uploaded more than 30 days ago. Use the "Image Cleanup" quick action to remove them and reclaim disk space.', 'vulopilot' ),
                'table',
                'options',
                array(
                    'orphaned_image_count' => $count,
                    'bytes'                => $bytes,
                ),
                'unused-images'
            ),
        );
    }

    /**
     * Unattached image attachments older than MIN_AGE_DAYS, minus anything
     * currently protected (see get_protected_image_ids()) — the single
     * source of truth both scan() and PerformanceActions::run_image_cleanup()
     * use, so what's counted here is exactly what gets deleted there.
     *
     * @return array<int, int> Attachment ids.
     */
    public static function get_orphaned_image_ids(): array {
        global $wpdb;

        $cutoff = gmdate( 'Y-m-d H:i:s', time() - ( self::MIN_AGE_DAYS * DAY_IN_SECONDS ) );

        $candidate_ids = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'attachment' AND post_mime_type LIKE %s AND post_parent = 0 AND post_date < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                'image/%',
                $cutoff
            )
        );

        if ( empty( $candidate_ids ) ) {
            return array();
        }

        $protected_ids = self::get_protected_image_ids();

        return array_values(
            array_diff( array_map( 'intval', $candidate_ids ), $protected_ids )
        );
    }

    /**
     * Image attachment ids that must never be treated as orphaned, even if
     * `post_parent` happens to be 0 (legacy media-library uploads commonly
     * have no parent even when actively used as a featured image/site
     * icon/logo).
     *
     * @return array<int, int>
     */
    private static function get_protected_image_ids(): array {
        global $wpdb;

        $protected = array();

        $site_icon_id = (int) get_option( 'site_icon' );

        if ( $site_icon_id > 0 ) {
            $protected[] = $site_icon_id;
        }

        $custom_logo_id = (int) get_theme_mod( 'custom_logo' );

        if ( $custom_logo_id > 0 ) {
            $protected[] = $custom_logo_id;
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $thumbnail_ids = $wpdb->get_col(
            "SELECT DISTINCT meta_value FROM {$wpdb->postmeta} WHERE meta_key = '_thumbnail_id'"
        );

        foreach ( $thumbnail_ids as $thumbnail_id ) {
            $protected[] = (int) $thumbnail_id;
        }

        return array_unique( $protected );
    }

    /**
     * @param array<int, int> $attachment_ids Attachment ids.
     * @return int Total bytes across the original files currently on disk.
     */
    public static function sum_attachment_file_sizes( array $attachment_ids ): int {
        $total = 0;

        foreach ( $attachment_ids as $attachment_id ) {
            $file = get_attached_file( $attachment_id );

            if ( $file && file_exists( $file ) ) {
                $total += filesize( $file );
            }
        }

        return $total;
    }
}
