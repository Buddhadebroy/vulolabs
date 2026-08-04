<?php
/**
 * WPDBCustomerRepository class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer\Infrastructure;

use VuloCart\Customer\Domain\Customer;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Customer module WPDBCustomerRepository.
 *
 * The only class in this codebase that runs SQL against
 * `vulocart_customers` — same "one repository owns the raw SQL for its
 * own table" convention `Order\Infrastructure\WPDBOrderRepository`
 * already establishes.
 *
 * @class       WPDBCustomerRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WPDBCustomerRepository {

    /**
     * Resolves the fully-prefixed table name.
     *
     * @return string
     */
    private function get_table(): string {
        global $wpdb;
        return $wpdb->prefix . 'vulocart_customers';
    }

    /**
     * Converts a raw row into a domain Customer object.
     *
     * @param array<string, mixed> $row A raw row.
     * @return Customer
     */
    private function hydrate( array $row ): Customer {
        return new Customer(
            (int) $row['id'],
            $row['email'],
            ! empty( $row['wp_user_id'] ) ? (int) $row['wp_user_id'] : null,
            $row['name'],
            $row['phone'],
            (int) $row['total_orders'],
            (float) $row['total_spent'],
            $row['last_order_at'],
            $row['created_at'],
            $row['updated_at']
        );
    }

    /**
     * Finds one customer by id.
     *
     * @param int $id Customer id.
     * @return Customer|null
     */
    public function find( int $id ): ?Customer {
        global $wpdb;

        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        return $row ? $this->hydrate( $row ) : null;
    }

    /**
     * Finds one customer by their email — the durable identity key
     * (Domain\Customer's own docblock).
     *
     * @param string $email A candidate email.
     * @return Customer|null
     */
    public function find_by_email( string $email ): ?Customer {
        global $wpdb;

        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE email = %s", $email ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        return $row ? $this->hydrate( $row ) : null;
    }

    /**
     * Finds one customer by their linked WP user id.
     *
     * @param int $wp_user_id A candidate WP user id.
     * @return Customer|null
     */
    public function find_by_wp_user_id( int $wp_user_id ): ?Customer {
        global $wpdb;

        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE wp_user_id = %d", $wp_user_id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        return $row ? $this->hydrate( $row ) : null;
    }

    /**
     * A page of customers, optionally searched — backs the admin
     * Customers list screen.
     *
     * @param array{page?: int, per_page?: int, search?: string} $args Pagination/filter args.
     * @return array{data: Customer[], total: int}
     */
    public function paginate( array $args = array() ): array {
        global $wpdb;

        $table    = $this->get_table();
        $page     = max( 1, (int) ( $args['page'] ?? 1 ) );
        $per_page = max( 1, min( 100, (int) ( $args['per_page'] ?? 20 ) ) );
        $offset   = ( $page - 1 ) * $per_page;

        if ( ! empty( $args['search'] ) ) {
            $like      = '%' . $wpdb->esc_like( (string) $args['search'] ) . '%';
            $count_sql = $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE email LIKE %s OR name LIKE %s", $like, $like ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $rows_sql  = $wpdb->prepare(
                "SELECT * FROM {$table} WHERE email LIKE %s OR name LIKE %s ORDER BY id DESC LIMIT %d OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $like,
                $like,
                $per_page,
                $offset
            );
        } else {
            $count_sql = "SELECT COUNT(*) FROM {$table}"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            $rows_sql  = $wpdb->prepare( "SELECT * FROM {$table} ORDER BY id DESC LIMIT %d OFFSET %d", $per_page, $offset ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        }

        $rows = (array) $wpdb->get_results( $rows_sql, ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return array(
            'data'  => array_map( array( $this, 'hydrate' ), $rows ),
            'total' => (int) $wpdb->get_var( $count_sql ), // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        );
    }

    /**
     * Every column a `$criteria` entry (below) is allowed to filter on —
     * a deliberate allowlist, not "whatever field name a caller passes,"
     * since `find_matching()`'s own `$field` ultimately becomes a raw SQL
     * identifier (can't be parameterized the way a value can).
     *
     * @var string[]
     */
    const CRITERIA_FIELDS = array( 'total_spent', 'total_orders', 'last_order_at' );

    /**
     * Every comparison operator `find_matching()` accepts.
     *
     * @var string[]
     */
    const CRITERIA_OPERATORS = array( '>', '>=', '<', '<=', '=' );

    /**
     * Counts (or, when `$args['data'] = true`, fetches) every customer
     * matching a small set of AND-combined criteria — the query engine
     * behind `vulocart-pro`'s own Segments feature ("spent over $500",
     * "3+ orders", "hasn't ordered since a date"). Deliberately generic
     * (lives here, on Free's own repository, rather than Pro reaching
     * into this table with raw SQL of its own) since computing "which of
     * my own customers match a simple rule" is squarely this repository's
     * own job, not a cross-plugin boundary violation for Pro to work
     * around — Pro's `SegmentUtil` calls `CustomerService::find_matching()`,
     * never this table directly.
     *
     * @param array<int, array{field: string, operator: string, value: mixed}> $criteria Each entry AND-combined; unknown fields/operators are silently skipped, not errors — a merchant-typo'd segment definition should degrade to "matches everyone," not 500.
     * @param bool $only_count Whether to return just the count (segment "member count" display) or the full row set (segment "view members" list).
     * @return array{data: Customer[], total: int}
     */
    public function find_matching( array $criteria, bool $only_count = false ): array {
        global $wpdb;

        $where  = array();
        $values = array();

        foreach ( $criteria as $rule ) {
            $field    = isset( $rule['field'] ) ? (string) $rule['field'] : '';
            $operator = isset( $rule['operator'] ) ? (string) $rule['operator'] : '';

            if ( ! in_array( $field, self::CRITERIA_FIELDS, true ) || ! in_array( $operator, self::CRITERIA_OPERATORS, true ) ) {
                continue;
            }

            $where[]  = "{$field} {$operator} %s"; // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $field/$operator are both allowlist-checked above, never raw user input.
            $values[] = isset( $rule['value'] ) ? $rule['value'] : '';
        }

        $where_sql = $where ? 'WHERE ' . implode( ' AND ', $where ) : '';
        $table     = $this->get_table();

        if ( $only_count ) {
            $sql = $values
                ? $wpdb->prepare( "SELECT COUNT(*) FROM {$table} {$where_sql}", ...$values ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- placeholder count varies with $criteria's own size, matched to $values at runtime.
                : "SELECT COUNT(*) FROM {$table}"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

            return array( 'data' => array(), 'total' => (int) $wpdb->get_var( $sql ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        }

        $sql = $values
            ? $wpdb->prepare( "SELECT * FROM {$table} {$where_sql} ORDER BY id DESC", ...$values ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
            : "SELECT * FROM {$table} ORDER BY id DESC"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

        $rows = (array) $wpdb->get_results( $sql, ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return array( 'data' => array_map( array( $this, 'hydrate' ), $rows ), 'total' => count( $rows ) );
    }

    /**
     * Persists a new customer.
     *
     * @param Customer $customer A customer with `$id === null`.
     * @return Customer The same customer, with `$id`/timestamps populated.
     */
    public function insert( Customer $customer ): Customer {
        global $wpdb;

        $wpdb->insert(
            $this->get_table(),
            array(
                'email'         => $customer->email,
                'wp_user_id'    => $customer->wp_user_id,
                'name'          => $customer->name,
                'phone'         => $customer->phone,
                'total_orders'  => $customer->total_orders,
                'total_spent'   => $customer->total_spent,
                'last_order_at' => $customer->last_order_at,
            )
        );

        return $this->find( (int) $wpdb->insert_id );
    }

    /**
     * Persists changes to an existing customer.
     *
     * @param Customer $customer A customer with a non-null `$id`.
     * @return Customer The same customer, freshly re-read from storage.
     */
    public function update( Customer $customer ): Customer {
        global $wpdb;

        $wpdb->update(
            $this->get_table(),
            array(
                'wp_user_id'    => $customer->wp_user_id,
                'name'          => $customer->name,
                'phone'         => $customer->phone,
                'total_orders'  => $customer->total_orders,
                'total_spent'   => $customer->total_spent,
                'last_order_at' => $customer->last_order_at,
            ),
            array( 'id' => $customer->id )
        );

        return $this->find( $customer->id );
    }
}
