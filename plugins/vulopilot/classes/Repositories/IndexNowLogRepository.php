<?php
/**
 * IndexNowLogRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

defined( 'ABSPATH' ) || exit;

/**
 * Persistence for vulopilot_indexnow_log (Scanning → Instant Indexing's
 * "History" card — the mockup's own "The last 100 IndexNow API requests"
 * copy). `find_all()`/pagination is entirely inherited from
 * AbstractRepository, same "repository adds its own query methods beyond
 * the generic CRUD base" pattern CrawlerVisitRepository already uses.
 *
 * One row per real submission attempt (manual or auto-submitted), never
 * upserted/deduped — unlike NotFoundLogRepository's own path-keyed upsert,
 * a repeat IndexNow submission of the same URL weeks apart is each a
 * distinct, meaningful API call worth its own row in the history.
 *
 * @class       IndexNowLogRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class IndexNowLogRepository extends AbstractRepository {

    /**
     * Rows kept — the mockup's own "last 100" cap. trim() below deletes
     * anything beyond this after every insert, so the table never grows
     * unboundedly the way a per-visit log without a cap would.
     */
    private const MAX_ROWS = 100;

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'indexnow_log';
    }

    /**
     * Records one IndexNow submission attempt and trims the table back
     * down to MAX_ROWS.
     *
     * @param string   $url             The submitted URL.
     * @param int|null $response_code   HTTP status code IndexNow returned, or null on a request-level failure (no response at all).
     * @param string   $response_status Human-readable status ('success'/'failed'/'error').
     * @param string   $trigger_type    'manual' (Instant Indexing tab's Submit button) or 'auto' (publish/update/trash hook).
     * @return int Inserted row id.
     */
    public function log( string $url, ?int $response_code, string $response_status, string $trigger_type = 'manual' ): int {
        $id = $this->insert(
            array(
                'url'             => $url,
                'response_code'   => $response_code,
                'response_status' => $response_status,
                'trigger_type'    => $trigger_type,
            )
        );

        $this->trim_to_max_rows();

        return $id;
    }

    /**
     * The most recent MAX_ROWS submissions, newest first — backs the
     * Instant Indexing tab's History table directly (no pagination args
     * needed there, the mockup shows a flat "last 100" list).
     *
     * @return array<int, array<string, mixed>>
     */
    public function get_recent(): array {
        return $this->find_all(
            array(
                'per_page' => self::MAX_ROWS,
                'orderby'  => 'id',
                'order'    => 'desc',
            )
        )['data'];
    }

    /**
     * @return void
     */
    private function trim_to_max_rows(): void {
        global $wpdb;

        $table = $this->get_table();

        $wpdb->query( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "DELETE FROM {$table} WHERE id NOT IN (SELECT id FROM (SELECT id FROM {$table} ORDER BY id DESC LIMIT %d) AS keep_ids)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                self::MAX_ROWS
            )
        );
    }
}
