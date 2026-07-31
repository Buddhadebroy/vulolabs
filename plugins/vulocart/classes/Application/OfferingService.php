<?php
/**
 * OfferingService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Application;

use VuloCart\Domain\Offering\Offering;
use VuloCart\Domain\Offering\OfferingRepositoryInterface;
use VuloCart\Events\EventDispatcher;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart OfferingService.
 *
 * Where Offering business logic actually lives — per the vision's "business
 * logic must never exist inside React components" and "must never exist
 * inside WordPress hooks", RestAPI\Controllers\Offerings calls only this
 * class, and this class is the only thing that talks to
 * OfferingRepositoryInterface. Any future GraphQL resolver or MCP tool
 * (`create_offering()`, per the vision's MCP tool list) calls this same
 * service too, rather than re-implementing creation/listing logic against
 * the repository directly.
 *
 * @class       OfferingService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class OfferingService {

    /**
     * The bound repository implementation.
     *
     * @var OfferingRepositoryInterface Resolved via ServiceContainer, not `new`d directly.
     */
    private $repository;

    /**
     * Broadcasts what happened after each mutation.
     *
     * @var EventDispatcher Broadcasts what happened; never decides what should happen.
     */
    private $events;

    /**
     * OfferingService constructor.
     *
     * @param OfferingRepositoryInterface $repository Resolved via ServiceContainer, not `new`d directly.
     * @param EventDispatcher             $events     Broadcasts what happened; never decides what should happen.
     */
    public function __construct( OfferingRepositoryInterface $repository, EventDispatcher $events ) {
        $this->repository = $repository;
        $this->events     = $events;
    }

    /**
     * Fetches one offering by id.
     *
     * @param int $id Offering id.
     * @return Offering|null
     */
    public function get_offering( $id ) {
        return $this->repository->find( $id );
    }

    /**
     * Returns a page of offerings, optionally filtered.
     *
     * @param array{page?: int, per_page?: int, type?: string, status?: string, search?: string, category?: string} $args Pagination/filter args, already sanitized by the caller.
     * @return array{data: Offering[], total: int}
     */
    public function list_offerings( $args = array() ) {
        return $this->repository->paginate( $args );
    }

    /**
     * Counts offerings in each OfferingType bucket.
     *
     * @return array<string, int>
     */
    public function count_offerings_by_type() {
        return $this->repository->count_by_type();
    }

    /**
     * Creates a new offering and broadcasts `offering_created`.
     *
     * @param array{type: string, title: string, sku?: string, status?: string, price?: float, currency?: string, meta?: array<string, mixed>} $data Already-sanitized input.
     * @return Offering
     */
    public function create_offering( $data ) {
        $offering = new Offering(
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

        $offering = $this->repository->insert( $offering );

        $this->events->dispatch( 'offering_created', array( 'offering' => $offering ) );

        return $offering;
    }

    /**
     * Updates an existing offering and broadcasts `offering_updated`.
     *
     * @param int                                                                                                                  $id   Offering id.
     * @param array{type?: string, title?: string, status?: string, price?: float, currency?: string, meta?: array<string, mixed>} $data Already-sanitized partial update.
     * @return Offering|null Null if no offering with this id exists.
     */
    public function update_offering( $id, $data ) {
        $offering = $this->repository->find( $id );

        if ( ! $offering ) {
            return null;
        }

        $offering->type     = isset( $data['type'] ) ? $data['type'] : $offering->type;
        $offering->title    = isset( $data['title'] ) ? $data['title'] : $offering->title;
        $offering->status   = isset( $data['status'] ) ? $data['status'] : $offering->status;
        $offering->price    = array_key_exists( 'price', $data ) ? (float) $data['price'] : $offering->price;
        $offering->currency = isset( $data['currency'] ) ? $data['currency'] : $offering->currency;
        $offering->meta     = isset( $data['meta'] ) ? $data['meta'] : $offering->meta;

        $offering = $this->repository->update( $offering );

        $this->events->dispatch( 'offering_updated', array( 'offering' => $offering ) );

        return $offering;
    }

    /**
     * Deletes an offering and broadcasts `offering_deleted`. Does not touch
     * any order line item that already references this offering's id —
     * same "additive, never silently rewrite other records" posture
     * Application\TermService::delete_term()'s own docblock documents for
     * a deleted category/brand/collection/tag.
     *
     * @param int $id Offering id.
     * @return bool True if an offering was found and deleted.
     */
    public function delete_offering( $id ) {
        $offering = $this->repository->find( $id );

        if ( ! $offering ) {
            return false;
        }

        $deleted = $this->repository->delete( $id );

        if ( $deleted ) {
            $this->events->dispatch( 'offering_deleted', array( 'offering' => $offering ) );
        }

        return $deleted;
    }

    /**
     * Bulk-updates status across several offerings — the Offerings list
     * screen's bulk-actions dropdown. Reuses update_offering() per id
     * rather than a dedicated bulk SQL statement: this is an occasional
     * admin action on at most a page of selected rows, not a hot path, and
     * reusing update_offering() keeps `offering_updated` firing once per
     * offering exactly like a normal single-item edit would.
     *
     * @param int[]  $ids    Offering ids.
     * @param string $status New status.
     * @return int Count of offerings actually updated.
     */
    public function bulk_update_status( array $ids, $status ) {
        $updated = 0;

        foreach ( $ids as $id ) {
            if ( $this->update_offering( $id, array( 'status' => $status ) ) ) {
                ++$updated;
            }
        }

        return $updated;
    }

    /**
     * Bulk-sets price and/or sale price across several offerings —
     * "Bulk Price Update". `$price` writes Offering::$price directly (a
     * real column); `$sale_price` merges into the existing `meta` bag
     * (Offerings.php's own `sanitize_offering_meta()` already stores it
     * there) rather than replacing `meta` wholesale the way
     * update_offering()'s own `$data['meta']` handling does — a bulk price
     * pass must never clobber an offering's other meta (categories,
     * stock, description, ...).
     *
     * @param int[]      $ids        Offering ids.
     * @param float|null $price      New price, or null to leave price untouched.
     * @param float|null $sale_price New sale price, or null to leave it untouched.
     * @return int Count of offerings actually updated.
     */
    public function bulk_update_price( array $ids, $price, $sale_price ) {
        $updated = 0;

        foreach ( $ids as $id ) {
            $offering = $this->repository->find( $id );

            if ( ! $offering ) {
                continue;
            }

            if ( null !== $price ) {
                $offering->price = $price;
            }

            if ( null !== $sale_price ) {
                $offering->meta['sale_price'] = $sale_price;
            }

            $offering = $this->repository->update( $offering );

            $this->events->dispatch( 'offering_updated', array( 'offering' => $offering ) );

            ++$updated;
        }

        return $updated;
    }

    /**
     * Bulk-sets stock status and/or stock quantity across several
     * offerings — "Bulk Inventory Update". Same meta-merge reasoning as
     * bulk_update_price() above: both fields already live in `meta`
     * (`stock_status`/`stock_quantity`, per sanitize_offering_meta()), so
     * this merges into the existing bag rather than replacing it.
     *
     * @param int[]       $ids            Offering ids.
     * @param string|null $stock_status   New stock status, or null to leave it untouched.
     * @param int|null    $stock_quantity New stock quantity, or null to leave it untouched.
     * @return int Count of offerings actually updated.
     */
    public function bulk_update_stock( array $ids, $stock_status, $stock_quantity ) {
        $updated = 0;

        foreach ( $ids as $id ) {
            $offering = $this->repository->find( $id );

            if ( ! $offering ) {
                continue;
            }

            if ( null !== $stock_status ) {
                $offering->meta['stock_status'] = $stock_status;
            }

            if ( null !== $stock_quantity ) {
                $offering->meta['stock_quantity'] = $stock_quantity;
            }

            $offering = $this->repository->update( $offering );

            $this->events->dispatch( 'offering_updated', array( 'offering' => $offering ) );

            ++$updated;
        }

        return $updated;
    }

    /**
     * Bulk-deletes offerings.
     *
     * @param int[] $ids Offering ids.
     * @return int Count of offerings actually deleted.
     */
    public function bulk_delete( array $ids ) {
        $deleted = 0;

        foreach ( $ids as $id ) {
            if ( $this->delete_offering( $id ) ) {
                ++$deleted;
            }
        }

        return $deleted;
    }
}
