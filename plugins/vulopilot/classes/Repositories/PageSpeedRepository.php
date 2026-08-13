<?php
/**
 * PageSpeedRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

defined( 'ABSPATH' ) || exit;

/**
 * Persistence for `vulopilot_page_speed` — "Improve Speed" › Slow Pages'
 * per-page table, written by Services\PageSpeedScanner. One row per real
 * WP page/post/WooCommerce page it has checked; `replace_for_url()` deletes
 * any prior row for that URL before inserting the fresh one, so a page not
 * yet rescanned keeps showing its last real result instead of disappearing
 * mid-scan.
 *
 * @class       PageSpeedRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PageSpeedRepository extends AbstractRepository {

    /**
     * Columns find_all() accepts as exact-match filters.
     *
     * @var string[]
     */
    protected array $filterable_columns = array( 'page_type', 'status' );

    /**
     * Columns an incoming `search` arg is LIKE-matched against.
     *
     * @var string[]
     */
    protected array $searchable_columns = array( 'title', 'url' );

    /**
     * Score, inclusive, at/above which a page counts as "Good" —
     * same real band this codebase's own mockup education copy states.
     */
    public const SCORE_GOOD = 80;

    /**
     * Score, inclusive, at/above which a page counts as "Needs Improvement"
     * rather than "Poor".
     */
    public const SCORE_NEEDS_IMPROVEMENT = 50;

    /**
     * Utill::TABLES key this repository owns.
     *
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'page_speed';
    }

    /**
     * Replaces any existing row for this URL with a fresh one — a rescan
     * supersedes, it never accumulates history (Slow Pages shows current
     * state, not a trend).
     *
     * @param array<string, mixed> $data Row data, must include 'url'.
     * @return int New row id.
     */
    public function replace_for_url( array $data ): int {
        global $wpdb;

        $wpdb->delete( $this->get_table(), array( 'url' => $data['url'] ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $this->insert( $data );
    }

    /**
     * Deletes rows whose URL isn't in the given (current) real page list —
     * so a page removed from the site (e.g. a deleted product) doesn't
     * linger in Slow Pages forever.
     *
     * @param string[] $current_urls Real URLs the latest scan enumerated.
     * @return void
     */
    public function delete_missing( array $current_urls ): void {
        global $wpdb;

        if ( empty( $current_urls ) ) {
            return;
        }

        $placeholders = implode( ', ', array_fill( 0, count( $current_urls ), '%s' ) );

        $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "DELETE FROM {$this->get_table()} WHERE url NOT IN ({$placeholders})", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
                ...$current_urls
            )
        );
    }

    /**
     * Real counts by score band, plus real average desktop/mobile scores
     * across whichever rows have one — `avg_score` (the table's own
     * `score` column, desktop/lab) added for
     * Controllers\ReportsOverview's own "device experience" bars, which
     * need both sides of the same real comparison `avg_mobile_score`
     * alone can't provide.
     *
     * @return array{total: int, slow: int, needs_improvement: int, good: int, avg_score: int|null, avg_mobile_score: int|null, last_scanned_at: string|null}
     */
    public function get_summary(): array {
        global $wpdb;

        $rows = $wpdb->get_results( "SELECT score, mobile_score FROM {$this->get_table()}", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        $rows  = (array) $rows;
        $total = count( $rows );
        $slow  = 0;
        $needs = 0;
        $good  = 0;

        $scores        = array();
        $mobile_scores = array();

        foreach ( $rows as $row ) {
            $score = null === $row['score'] ? null : (int) $row['score'];

            if ( null !== $score ) {
                if ( $score >= self::SCORE_GOOD ) {
                    ++$good;
                } elseif ( $score >= self::SCORE_NEEDS_IMPROVEMENT ) {
                    ++$needs;
                } else {
                    ++$slow;
                }

                $scores[] = $score;
            }

            if ( null !== $row['mobile_score'] ) {
                $mobile_scores[] = (int) $row['mobile_score'];
            }
        }

        $last_scanned_at = $wpdb->get_var( "SELECT MAX(scanned_at) FROM {$this->get_table()}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return array(
            'total'             => $total,
            'slow'              => $slow,
            'needs_improvement' => $needs,
            'good'              => $good,
            'avg_score'         => $scores ? (int) round( array_sum( $scores ) / count( $scores ) ) : null,
            'avg_mobile_score'  => $mobile_scores ? (int) round( array_sum( $mobile_scores ) / count( $mobile_scores ) ) : null,
            'last_scanned_at'   => $last_scanned_at ? $last_scanned_at : null,
        );
    }
}
