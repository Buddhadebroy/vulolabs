<?php
/**
 * AutomationRepository class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Repositories;

defined( 'ABSPATH' ) || exit;

/**
 * Persistence for vulopilot_automations (DATABASE.md).
 *
 * @class       AutomationRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AutomationRepository extends AbstractRepository {

    /**
     * @var string[]
     */
    protected array $filterable_columns = array( 'status', 'category' );

    /**
     * @var string[]
     */
    protected array $searchable_columns = array( 'name' );

    /**
     * @inheritDoc
     */
    protected function get_table_key(): string {
        return 'automation';
    }

    /**
     * @return int Count of currently enabled automations — what the
     *             dashboard's "active automations" stat card reads.
     */
    public function count_enabled(): int {
        global $wpdb;

        return (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$this->get_table()} WHERE status = 'enabled'" // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        );
    }

    /**
     * Enabled/disabled/draft counts, zero-filled — backs both the
     * "Automation Status" dashboard widget and the Automation table's
     * status-count pill bar ("Active"/"Paused"/"Drafts" — Automate Work's
     * own filter chips read 'enabled'/'disabled'/'draft' by these exact
     * keys). Delegates the actual grouped query to
     * AbstractRepository::count_by_column() rather than running its own
     * SQL (database.md: prefer one query over several, and don't duplicate
     * query-building logic that already exists).
     *
     * @return array{enabled: int, disabled: int, draft: int}
     */
    public function get_status_counts(): array {
        return array_merge(
            array(
                'enabled'  => 0,
                'disabled' => 0,
                'draft'    => 0,
            ),
            $this->count_by_column( 'status' )
        );
    }

    /**
     * Looks up a system-seeded automation by a stable marker embedded in
     * its own `trigger_config` JSON (`{"system_default": "<marker>"}`)
     * rather than by `name` — added specifically for
     * vulopilot-pro's WebsiteHealthScanScheduler, whose seeding logic must
     * stay idempotent (never insert a second "Website Health — Daily
     * Scan" row) even after an administrator has renamed the automation,
     * which a name-based lookup would miss. A plain LIKE match on the raw
     * JSON column, same pragmatic shape FindingRepository::
     * find_open_duplicate() already uses for its own natural-key lookup
     * that doesn't justify a dedicated indexed column.
     *
     * @param string $marker The exact `system_default` value to look for.
     * @return array<string, mixed>|null
     */
    public function find_by_system_default_marker( string $marker ): ?array {
        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$this->get_table()} WHERE trigger_config LIKE %s ORDER BY id ASC LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                '%"system_default":"' . $wpdb->esc_like( $marker ) . '"%'
            ),
            ARRAY_A
        );

        return $row ?: null;
    }
}
