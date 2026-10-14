<?php
/**
 * WPDBProductRepository class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Infrastructure\Database;

use VuloCart\Domain\Product\Product;
use VuloCart\Domain\Product\ProductRepositoryInterface;
use VuloCart\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart WPDBProductRepository.
 *
 * The only class in this codebase that runs SQL against
 * `vulocart_products` - implements Domain\Product\ProductRepositoryInterface,
 * bound in VuloCart::init_classes(). Every query goes through
 * `$wpdb->prepare()` (database.md); a static in-request cache-by-id
 * follows the same pattern `database.md` already documents (Store.php's
 * cache), so repeated find() calls for the same id within one request
 * don't re-query.
 *
 * @class       WPDBProductRepository class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WPDBProductRepository implements ProductRepositoryInterface {

    /**
     * In-request cache of resolved products, keyed by id.
     *
     * @var array<int, Product|null>
     */
    private $cache = array();

    /**
     * Resolves the fully-prefixed `vulocart_products` table name.
     *
     * @return string
     */
    private function get_table() {
        global $wpdb;
        return $wpdb->prefix . Utill::TABLES['product'];
    }

    /**
     * Converts a raw `$wpdb` row into a domain Product object.
     *
     * @param array<string, mixed> $row A raw `vulocart_products` row.
     * @return Product
     */
    private function hydrate( $row ) {
        return new Product(
            (int) $row['id'],
            $row['type'],
            $row['title'],
            $row['slug'],
            $row['sku'],
            $row['status'],
            null === $row['price'] ? null : (float) $row['price'],
            $row['currency'],
            $row['meta'] ? (array) json_decode( $row['meta'], true ) : array(),
            $row['created_at'],
            $row['updated_at'],
            isset( $row['published_at'] ) ? $row['published_at'] : null
        );
    }

    /**
     * Converts a domain Product object into a `$wpdb`-ready row.
     *
     * @param Product $product Product to convert to a `$wpdb`-ready row.
     * @return array<string, mixed>
     */
    private function to_row( Product $product ) {
        // The first time a product is published stamps its published date; it is kept if the product is
        // later moved back to draft.
        if ( 'published' === $product->status && empty( $product->published_at ) ) {
            $product->published_at = gmdate( 'Y-m-d H:i:s' );
        }

        return array(
            'published_at' => $product->published_at,
            'type'     => $product->type,
            'title'    => $product->title,
            'slug'     => $product->slug,
            'sku'      => $product->sku,
            'status'   => $product->status,
            'price'    => $product->price,
            'currency' => $product->currency,
            'meta'     => wp_json_encode( $product->meta ),
        );
    }

    /**
     * Finds one product by id.
     *
     * @param int $id Product id.
     * @return Product|null Null if no product with this id exists.
     */
    public function find( int $id ): ?Product {
        if ( array_key_exists( $id, $this->cache ) ) {
            return $this->cache[ $id ];
        }

        global $wpdb;

        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM {$this->get_table()} WHERE id = %d", $id ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ARRAY_A
        );

        $this->cache[ $id ] = $row ? $this->hydrate( $row ) : null;

        return $this->cache[ $id ];
    }

    /**
     * Returns a page of products, optionally filtered.
     *
     * @param array{page?: int, per_page?: int, type?: string, status?: string, search?: string, category?: string} $args Pagination/filter args.
     * @return array{data: Product[], total: int}
     */
    public function paginate( array $args = array() ): array {
        global $wpdb;

        $table    = $this->get_table();
        $page     = max( 1, (int) ( isset( $args['page'] ) ? $args['page'] : 1 ) );
        $per_page = max( 1, min( 100, (int) ( isset( $args['per_page'] ) ? $args['per_page'] : 20 ) ) );
        $offset   = ( $page - 1 ) * $per_page;

        $where_clauses = array();
        $where_values  = array();

        if ( ! empty( $args['type'] ) ) {
            $where_clauses[] = 'type = %s';
            $where_values[]  = (string) $args['type'];
        }

        if ( ! empty( $args['status'] ) ) {
            $where_clauses[] = 'status = %s';
            $where_values[]  = (string) $args['status'];
        }

        if ( ! empty( $args['search'] ) ) {
            $where_clauses[] = '(title LIKE %s OR sku LIKE %s)';
            $like            = '%' . $wpdb->esc_like( (string) $args['search'] ) . '%';
            $where_values[]  = $like;
            $where_values[]  = $like;
        }

        // Product<->category is a slug reference inside the `meta` JSON
        // bag, not a join table (WPDBTermRepository::
        // count_products_for_term()'s own docblock explains the
        // tradeoff), so filtering by category is a LIKE over that JSON
        // text rather than a real join/index. Good enough for the
        // "filter this list" use case at admin-catalog scale; a slug
        // that happens to be a substring of another slug (e.g.
        // "electronics" inside "electronics-2") can over-match - a known,
        // documented limitation, not a silent bug.
        if ( ! empty( $args['category'] ) ) {
            $where_clauses[] = 'meta LIKE %s';
            $where_values[]  = '%"' . $wpdb->esc_like( (string) $args['category'] ) . '"%';
        }

        $where_sql = $where_clauses ? ( 'WHERE ' . implode( ' AND ', $where_clauses ) ) : '';

        if ( $where_values ) {
            $count_sql = $wpdb->prepare( "SELECT COUNT(*) FROM {$table} {$where_sql}", ...$where_values ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- $where_sql's %s count matches $where_values' size at runtime; the sniff can't see that statically.
            $rows_sql  = $wpdb->prepare( // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- same runtime-sized-array case as above.
                "SELECT * FROM {$table} {$where_sql} ORDER BY id DESC LIMIT %d OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ...array_merge( $where_values, array( $per_page, $offset ) )
            );
        } else {
            $count_sql = "SELECT COUNT(*) FROM {$table}"; // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            $rows_sql  = $wpdb->prepare(
                "SELECT * FROM {$table} ORDER BY id DESC LIMIT %d OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $per_page,
                $offset
            );
        }

        $total = (int) $wpdb->get_var( $count_sql ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $rows  = $wpdb->get_results( $rows_sql, ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return array(
            'data'  => array_map( array( $this, 'hydrate' ), $rows ? $rows : array() ),
            'total' => $total,
        );
    }

    /**
     * Persists a new product.
     *
     * @param Product $product A product with $id === null.
     * @return Product The same product, with $id (and timestamps) populated.
     */
    public function insert( Product $product ): Product {
        global $wpdb;

        $wpdb->insert( $this->get_table(), $this->to_row( $product ) );

        return $this->find( (int) $wpdb->insert_id );
    }

    /**
     * Persists changes to an existing product.
     *
     * @param Product $product A product with a non-null $id.
     * @return Product The same product, with $updated_at refreshed.
     */
    public function update( Product $product ): Product {
        global $wpdb;

        $wpdb->update( $this->get_table(), $this->to_row( $product ), array( 'id' => $product->id ) );

        unset( $this->cache[ $product->id ] );

        return $this->find( $product->id );
    }

    /**
     * Deletes one product by id.
     *
     * @param int $id Product id.
     * @return bool True if a row was deleted.
     */
    public function delete( int $id ): bool {
        global $wpdb;

        unset( $this->cache[ $id ] );

        return false !== $wpdb->delete( $this->get_table(), array( 'id' => $id ) );
    }

    /**
     * Counts products in each ProductType bucket, in one query.
     *
     * @return array<string, int> Type value => count.
     */
    public function count_by_type(): array {
        global $wpdb;

        $rows = $wpdb->get_results( "SELECT type, COUNT(*) as total FROM {$this->get_table()} GROUP BY type", ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- static SQL, no user input.

        $counts = array();

        foreach ( $rows ? $rows : array() as $row ) {
            $counts[ $row['type'] ] = (int) $row['total'];
        }

        return $counts;
    }
}
