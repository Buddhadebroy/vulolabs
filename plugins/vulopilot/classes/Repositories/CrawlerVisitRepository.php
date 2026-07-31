<?php
/**
 * CrawlerVisitRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

defined( 'ABSPATH' ) || exit;

/**
 * Persistence for vulopilot_crawler_visits (AI Crawler Traffic Monitoring,
 * readme.txt). `find_all()`/pagination is entirely inherited from
 * AbstractRepository — this only adds the aggregate reads the Crawler
 * Traffic page's summary section needs (bot counts, last-seen timestamps,
 * most-crawled pages, daily volume), the same "repository adds its own
 * query methods beyond the generic CRUD base" pattern
 * SiteHealthSnapshotRepository (vulopilot-pro) already uses.
 *
 * @class       CrawlerVisitRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CrawlerVisitRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'bot_name' );

    /**
     * @var string[]
     */
    protected array $searchable_columns = array( 'requested_url' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'crawler_visit';
    }

    /**
     * Records one detected bot visit — no IP address, user id, or any
     * other visitor-identifying data is ever stored (readme.txt's FAQ:
     * "It does not track human visitors, IP addresses, or personal data.").
     *
     * @param string $bot_name      Display name of the matched bot (CrawlerTrafficLogger::BOT_SIGNATURES value).
     * @param string $user_agent    The raw User-Agent header that matched.
     * @param string $requested_url The requested path.
     * @return int Inserted row id.
     */
    public function log( string $bot_name, string $user_agent, string $requested_url ): int {
        return $this->insert(
            array(
                'bot_name'      => $bot_name,
                'user_agent'    => $user_agent,
                'requested_url' => $requested_url,
            )
        );
    }

    /**
     * Visit counts per bot — backs the Crawler Traffic page's filter-pill
     * bar, same "reuse count_by_column()" pattern
     * ActivityLogRepository::get_actor_type_counts() already uses.
     *
     * @return array<string, int>
     */
    public function get_bot_counts(): array {
        return $this->count_by_column( 'bot_name' );
    }

    /**
     * Most recent visit timestamp per bot — readme.txt's "Last-Seen
     * Timestamps."
     *
     * @return array<int, array{bot_name: string, last_seen_at: string}>
     */
    public function get_bot_last_seen(): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            "SELECT bot_name, MAX(created_at) AS last_seen_at FROM {$this->get_table()} GROUP BY bot_name ORDER BY last_seen_at DESC", // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            ARRAY_A
        );

        return $rows ?: array();
    }

    /**
     * Most-requested URLs across every bot — readme.txt's "Most-Crawled
     * Pages."
     *
     * @param int $limit Max rows to return.
     * @return array<int, array{requested_url: string, total: int}>
     */
    public function get_most_crawled_pages( int $limit = 10 ): array {
        global $wpdb;

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT requested_url, COUNT(*) AS total FROM {$this->get_table()} GROUP BY requested_url ORDER BY total DESC LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                max( 1, $limit )
            ),
            ARRAY_A
        );

        return $rows ?: array();
    }

    /**
     * Visit counts per calendar day over a trailing window, zero-filled for
     * days with no visits — readme.txt's "Crawl Volume Trend Over Time."
     * Zero-filling follows the same care FindingRepository::get_status_counts()
     * already takes, so a trend chart never shows a misleading gap.
     *
     * @param int $days Trailing window size.
     * @return array<int, array{date: string, total: int}> Oldest first.
     */
    public function get_daily_volume( int $days = 30 ): array {
        global $wpdb;

        $days = max( 1, $days );

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT DATE(created_at) AS visit_date, COUNT(*) AS total FROM {$this->get_table()} WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %d DAY) GROUP BY visit_date", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $days
            ),
            ARRAY_A
        );

        $counts_by_date = array();
        foreach ( (array) $rows as $row ) {
            $counts_by_date[ $row['visit_date'] ] = (int) $row['total'];
        }

        $volume = array();
        for ( $offset = $days - 1; $offset >= 0; $offset-- ) {
            $date     = gmdate( 'Y-m-d', strtotime( "-{$offset} days" ) );
            $volume[] = array(
                'date'  => $date,
                'total' => $counts_by_date[ $date ] ?? 0,
            );
        }

        return $volume;
    }

    /**
     * Per-bot visit counts per calendar day over a trailing window, zero-
     * filled the same way get_daily_volume() already is — backs
     * vulopilot-pro's "Historical Crawl Trends" (AI-CRAWLER-ANALYTICS-MODULE.md),
     * which needs a per-bot breakdown get_daily_volume() itself doesn't
     * return. Lives here (Free's own repository) rather than in Pro, same
     * "Free owns the table + its query methods, Pro decides which ones its
     * UI calls" posture FindingRepository::get_severity_breakdown_for_scanner_ids()
     * already established for a method added for a later Pro consumer.
     *
     * @param int $days Trailing window size.
     * @return array<string, array<int, array{date: string, total: int}>> Bot name => daily volume, oldest first.
     */
    public function get_daily_volume_by_bot( int $days = 30 ): array {
        global $wpdb;

        $days = max( 1, $days );

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT bot_name, DATE(created_at) AS visit_date, COUNT(*) AS total FROM {$this->get_table()} WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %d DAY) GROUP BY bot_name, visit_date", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $days
            ),
            ARRAY_A
        );

        $counts_by_bot = array();
        foreach ( (array) $rows as $row ) {
            $counts_by_bot[ $row['bot_name'] ][ $row['visit_date'] ] = (int) $row['total'];
        }

        $volume_by_bot = array();
        foreach ( $counts_by_bot as $bot_name => $counts_by_date ) {
            $volume = array();
            for ( $offset = $days - 1; $offset >= 0; $offset-- ) {
                $date     = gmdate( 'Y-m-d', strtotime( "-{$offset} days" ) );
                $volume[] = array(
                    'date'  => $date,
                    'total' => $counts_by_date[ $date ] ?? 0,
                );
            }
            $volume_by_bot[ $bot_name ] = $volume;
        }

        return $volume_by_bot;
    }

    /**
     * Aggregate stats for a fixed date range — backs vulopilot-pro's "Crawl
     * Reports" (Reports\Types\CrawlReport there), same "generate() only
     * ever reads plain SQL, never calls out to anything" rule
     * AiVisibilityReport's own docblock documents, applied to crawler-visit
     * data instead of findings.
     *
     * @param string $period_start Y-m-d, inclusive.
     * @param string $period_end   Y-m-d, inclusive.
     * @return array{total: int, by_bot: array<string, int>, top_pages: array<int, array{requested_url: string, total: int}>}
     */
    public function get_stats_for_period( string $period_start, string $period_end ): array {
        global $wpdb;

        $total = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->get_table()} WHERE created_at >= %s AND created_at < DATE_ADD(%s, INTERVAL 1 DAY)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            )
        );

        $bot_rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT bot_name, COUNT(*) AS total FROM {$this->get_table()} WHERE created_at >= %s AND created_at < DATE_ADD(%s, INTERVAL 1 DAY) GROUP BY bot_name", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            ),
            ARRAY_A
        );

        $by_bot = array();
        foreach ( (array) $bot_rows as $row ) {
            $by_bot[ $row['bot_name'] ] = (int) $row['total'];
        }

        $top_pages = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT requested_url, COUNT(*) AS total FROM {$this->get_table()} WHERE created_at >= %s AND created_at < DATE_ADD(%s, INTERVAL 1 DAY) GROUP BY requested_url ORDER BY total DESC LIMIT 10", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $period_start,
                $period_end
            ),
            ARRAY_A
        );

        return array(
            'total'     => $total,
            'by_bot'    => $by_bot,
            'top_pages' => $top_pages ?: array(),
        );
    }

    /**
     * Deletes rows older than $days — the retention/cleanup half of
     * readme.txt's Pro "Historical Logs" line (Services\CrawlerTrafficLogger's
     * daily cron calls this with `apply_filters('vulopilot_crawler_log_retention_days', 30)`).
     *
     * @param int $days Rows with `created_at` older than this many days are deleted.
     * @return int Number of rows deleted.
     */
    public function delete_older_than( int $days ): int {
        global $wpdb;

        $deleted = $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$this->get_table()} WHERE created_at < DATE_SUB(NOW(), INTERVAL %d DAY)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                max( 1, $days )
            )
        );

        return false !== $deleted ? (int) $deleted : 0;
    }
}
