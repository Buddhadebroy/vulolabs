<?php
/**
 * DatabaseCleanupScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Flags database bloat relevant to the "Improve Speed" page specifically:
 * expired transients (rows WordPress itself considers stale, safe to
 * delete) plus revisions beyond the most recent 5 per post. Distinct from
 * DatabaseScanner (category 'database', revisions-only, feeds the Health
 * category instead) — this one is scoped to category 'performance' and
 * combines both signals into a single "Database Cleanup" tile/finding, and
 * its threshold/counts are what PerformanceActions' `database-cleanup`
 * quick action actually deletes.
 *
 * @class       DatabaseCleanupScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class DatabaseCleanupScanner extends AbstractBasicScanner {

    /**
     * How many of the most recent revisions to keep per post before the
     * rest count as bloat.
     */
    const KEEP_REVISIONS_PER_POST = 5;

    /**
     * Combined (expired transients + excess revisions) count above which
     * this is worth flagging.
     */
    private const COMBINED_THRESHOLD = 50;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'database-cleanup';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Database Cleanup', 'vulopilot' );
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
        $expired_transients = self::count_expired_transients();
        $excess_revisions   = self::count_excess_revisions();
        $combined           = $expired_transients + $excess_revisions;

        if ( $combined <= self::COMBINED_THRESHOLD ) {
            return array();
        }

        return array(
            new Finding(
                sprintf(
                    /* translators: 1: number of expired transients, 2: number of excess post revisions. */
                    __( '%1$d expired transients and %2$d excess post revisions', 'vulopilot' ),
                    $expired_transients,
                    $excess_revisions
                ),
                Severity::LOW,
                $this->get_category(),
                __( 'Expired transients and old post revisions accumulate in the database over time, slowing down queries. Use the "Database Cleanup" quick action to remove them.', 'vulopilot' ),
                'table',
                'options',
                array(
                    'expired_transients' => $expired_transients,
                    'excess_revisions'   => $excess_revisions,
                )
            ),
        );
    }

    /**
     * @return int
     */
    public static function count_expired_transients(): int {
        global $wpdb;

        return (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE %s AND option_value < %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $wpdb->esc_like( '_transient_timeout_' ) . '%',
                time()
            )
        );
    }

    /**
     * Counts revisions beyond the most recent KEEP_REVISIONS_PER_POST for
     * each post that has any — a single aggregate query rather than
     * looping every post in PHP.
     *
     * @return int
     */
    public static function count_excess_revisions(): int {
        global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $per_post_counts = $wpdb->get_col(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'revision' GROUP BY post_parent"
        );

        $excess = 0;

        foreach ( $per_post_counts as $count ) {
            $excess += max( 0, (int) $count - self::KEEP_REVISIONS_PER_POST );
        }

        return $excess;
    }
}
