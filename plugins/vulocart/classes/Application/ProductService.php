<?php
/**
 * ProductService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Application;

use VuloCart\Domain\Product\Product;
use VuloCart\Domain\Product\ProductRepositoryInterface;
use VuloCart\Events\EventDispatcher;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart ProductService.
 *
 * Where Product business logic actually lives - per the vision's "business
 * logic must never exist inside React components" and "must never exist
 * inside WordPress hooks", RestAPI\Controllers\Products calls only this
 * class, and this class is the only thing that talks to
 * ProductRepositoryInterface. Any future GraphQL resolver or MCP tool
 * (`create_product()`, per the vision's MCP tool list) calls this same
 * service too, rather than re-implementing creation/listing logic against
 * the repository directly.
 *
 * @class       ProductService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ProductService {

    /**
     * The bound repository implementation.
     *
     * @var ProductRepositoryInterface Resolved via ServiceContainer, not `new`d directly.
     */
    private $repository;

    /**
     * Broadcasts what happened after each mutation.
     *
     * @var EventDispatcher Broadcasts what happened; never decides what should happen.
     */
    private $events;

    /**
     * ProductService constructor.
     *
     * @param ProductRepositoryInterface $repository Resolved via ServiceContainer, not `new`d directly.
     * @param EventDispatcher             $events     Broadcasts what happened; never decides what should happen.
     */
    public function __construct( ProductRepositoryInterface $repository, EventDispatcher $events ) {
        $this->repository = $repository;
        $this->events     = $events;
    }

    /**
     * Fetches one product by id.
     *
     * @param int $id Product id.
     * @return Product|null
     */
    public function get_product( $id ) {
        return $this->repository->find( $id );
    }

    /**
     * Returns a page of products, optionally filtered.
     *
     * @param array{page?: int, per_page?: int, type?: string, status?: string, search?: string, category?: string} $args Pagination/filter args, already sanitized by the caller.
     * @return array{data: Product[], total: int}
     */
    public function list_products( $args = array() ) {
        return $this->repository->paginate( $args );
    }

    /**
     * Counts products in each ProductType bucket.
     *
     * @return array<string, int>
     */
    public function count_products_by_type() {
        return $this->repository->count_by_type();
    }

    /**
     * Creates a new product and broadcasts `product_created`.
     *
     * @param array{type: string, title: string, sku?: string, status?: string, price?: float, currency?: string, meta?: array<string, mixed>} $data Already-sanitized input.
     * @return Product
     */
    public function create_product( $data ) {
        $product = new Product(
            null,
            $data['type'],
            $data['title'],
            sanitize_title( $data['title'] ),
            isset( $data['sku'] ) ? $data['sku'] : null,
            isset( $data['status'] ) ? $data['status'] : 'draft',
            isset( $data['price'] ) ? (float) $data['price'] : null,
            isset( $data['currency'] ) ? $data['currency'] : null,
            isset( $data['meta'] ) ? $data['meta'] : array()
        );

        $product = $this->repository->insert( $product );

        $this->events->dispatch( 'product_created', array( 'product' => $product ) );

        return $product;
    }

    /**
     * Updates an existing product and broadcasts `product_updated`.
     *
     * @param int                                                                                                                  $id   Product id.
     * @param array{type?: string, title?: string, status?: string, price?: float, currency?: string, meta?: array<string, mixed>} $data Already-sanitized partial update.
     * @return Product|null Null if no product with this id exists.
     */
    public function update_product( $id, $data ) {
        $product = $this->repository->find( $id );

        if ( ! $product ) {
            return null;
        }

        $product->type     = isset( $data['type'] ) ? $data['type'] : $product->type;
        $product->title    = isset( $data['title'] ) ? $data['title'] : $product->title;
        $product->sku      = array_key_exists( 'sku', $data ) ? ( '' === $data['sku'] ? null : $data['sku'] ) : $product->sku;
        $product->status   = isset( $data['status'] ) ? $data['status'] : $product->status;
        $product->price    = array_key_exists( 'price', $data ) ? (float) $data['price'] : $product->price;
        $product->currency = isset( $data['currency'] ) ? $data['currency'] : $product->currency;
        $product->meta     = isset( $data['meta'] ) ? $data['meta'] : $product->meta;

        // A writer that sent only a new price (no meta): keep the stored default price in step with it.
        if ( array_key_exists( 'price', $data ) && ! isset( $data['meta'] ) ) {
            $product->set_default_price( (float) $data['price'] );
        }

        $product = $this->repository->update( $product );

        $this->events->dispatch( 'product_updated', array( 'product' => $product ) );

        return $product;
    }

    /**
     * Deletes a product and broadcasts `product_deleted`. Does not touch
     * any order line item that already references this product's id -
     * same "additive, never silently rewrite other records" posture
     * Application\TermService::delete_term()'s own docblock documents for
     * a deleted category/brand/collection/tag.
     *
     * @param int $id Product id.
     * @return bool True if a product was found and deleted.
     */
    public function delete_product( $id ) {
        $product = $this->repository->find( $id );

        if ( ! $product ) {
            return false;
        }

        $deleted = $this->repository->delete( $id );

        if ( $deleted ) {
            $this->events->dispatch( 'product_deleted', array( 'product' => $product ) );
        }

        return $deleted;
    }

    /**
     * Bulk-updates status across several products - the Products list
     * screen's bulk-actions dropdown. Reuses update_product() per id
     * rather than a dedicated bulk SQL statement: this is an occasional
     * admin action on at most a page of selected rows, not a hot path, and
     * reusing update_product() keeps `product_updated` firing once per
     * product exactly like a normal single-item edit would.
     *
     * @param int[]  $ids    Product ids.
     * @param string $status New status.
     * @return int Count of products actually updated.
     */
    public function bulk_update_status( array $ids, $status ) {
        $updated = 0;

        foreach ( $ids as $id ) {
            if ( $this->update_product( $id, array( 'status' => $status ) ) ) {
                ++$updated;
            }
        }

        return $updated;
    }

    /**
     * Bulk-sets price and/or sale price across several products -
     * "Bulk Price Update". `$price` writes Product::$price directly (a
     * real column); `$sale_price` merges into the existing `meta` bag
     * (Products.php's own `sanitize_product_meta()` already stores it
     * there) rather than replacing `meta` wholesale the way
     * update_product()'s own `$data['meta']` handling does - a bulk price
     * pass must never clobber a product's other meta (categories,
     * stock, description, ...).
     *
     * @param int[]      $ids        Product ids.
     * @param float|null $price      New price, or null to leave price untouched.
     * @param float|null $sale_price New sale price, or null to leave it untouched.
     * @return int Count of products actually updated.
     */
    public function bulk_update_price( array $ids, $price, $sale_price ) {
        $updated = 0;

        foreach ( $ids as $id ) {
            $product = $this->repository->find( $id );

            if ( ! $product ) {
                continue;
            }

            if ( null !== $price ) {
                $product->price = $price;
                $product->set_default_price( (float) $price );
            }

            if ( null !== $sale_price ) {
                $product->meta['sale_price'] = $sale_price;
                $product->set_default_price( null, true, (float) $sale_price );
            }

            $product = $this->repository->update( $product );

            $this->events->dispatch( 'product_updated', array( 'product' => $product ) );

            ++$updated;
        }

        return $updated;
    }

    /**
     * Bulk-sets stock status and/or stock quantity across several
     * products - "Bulk Inventory Update". Same meta-merge reasoning as
     * bulk_update_price() above: both fields already live in `meta`
     * (`stock_status`/`stock_quantity`, per sanitize_product_meta()), so
     * this merges into the existing bag rather than replacing it.
     *
     * @param int[]       $ids            Product ids.
     * @param string|null $stock_status   New stock status, or null to leave it untouched.
     * @param int|null    $stock_quantity New stock quantity, or null to leave it untouched.
     * @return int Count of products actually updated.
     */
    public function bulk_update_stock( array $ids, $stock_status, $stock_quantity ) {
        $updated = 0;

        foreach ( $ids as $id ) {
            $product = $this->repository->find( $id );

            if ( ! $product ) {
                continue;
            }

            if ( null !== $stock_status ) {
                $product->meta['stock_status'] = $stock_status;
            }

            if ( null !== $stock_quantity ) {
                $product->meta['stock_quantity'] = $stock_quantity;
            }

            $product = $this->repository->update( $product );

            $this->events->dispatch( 'product_updated', array( 'product' => $product ) );

            ++$updated;
        }

        return $updated;
    }

    /**
     * Bulk-deletes products.
     *
     * @param int[] $ids Product ids.
     * @return int Count of products actually deleted.
     */
    public function bulk_delete( array $ids ) {
        $deleted = 0;

        foreach ( $ids as $id ) {
            if ( $this->delete_product( $id ) ) {
                ++$deleted;
            }
        }

        return $deleted;
    }
}
