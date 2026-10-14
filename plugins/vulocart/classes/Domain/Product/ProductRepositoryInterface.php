<?php
/**
 * ProductRepositoryInterface class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Domain\Product;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart ProductRepositoryInterface.
 *
 * The contract Application\ProductService depends on - bound to a concrete
 * implementation only in VuloCart::init_classes() (via ServiceContainer),
 * never referenced by class name anywhere else. This is what makes the
 * storage engine replaceable in practice, not just in principle.
 *
 * @class       ProductRepositoryInterface interface
 * @version     1.0.0
 * @author      VuloLabs
 */
interface ProductRepositoryInterface {

    /**
     * Finds one product by id.
     *
     * @param int $id Product id.
     * @return Product|null Null if no product with this id exists.
     */
    public function find( int $id ): ?Product;

    /**
     * Returns a page of products, optionally filtered.
     *
     * @param array{page?: int, per_page?: int, type?: string, status?: string} $args Pagination/filter args.
     * @return array{data: Product[], total: int}
     */
    public function paginate( array $args = array() ): array;

    /**
     * Persists a new product.
     *
     * @param Product $product A product with $id === null.
     * @return Product The same product, with $id (and timestamps) populated.
     */
    public function insert( Product $product ): Product;

    /**
     * Persists changes to an existing product.
     *
     * @param Product $product A product with a non-null $id.
     * @return Product The same product, with $updated_at refreshed.
     */
    public function update( Product $product ): Product;

    /**
     * Deletes one product by id.
     *
     * @param int $id Product id.
     * @return bool True if a row was deleted.
     */
    public function delete( int $id ): bool;

    /**
     * Counts products in each ProductType bucket - backs the Products menu's
     * "Product Types" reference page (`src/pages/ProductTypes/`), same
     * pattern Order's own `count_by_fulfillment_status()` establishes.
     *
     * @return array<string, int> Type value => count.
     */
    public function count_by_type(): array;
}
