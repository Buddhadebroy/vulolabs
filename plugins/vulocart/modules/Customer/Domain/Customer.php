<?php
/**
 * Customer class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer\Domain;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Customer module Customer entity.
 *
 * The persistent profile this module previously deliberately didn't have
 * (Module.php's own pre-existing docblock explained why a snapshot-only
 * model was enough until now) — every downstream feature this plugin
 * pair's own Customer Management pass adds (Addresses/Wishlist/Saved
 * Carts/Groups/Segments/Loyalty/Wallet/Communication History/Notes/
 * Analytics/Timeline) needs a stable id to attach to, which an
 * Order-row snapshot alone can't provide. Keyed by `email` (`UNIQUE KEY`,
 * `Install.php`) — not `wp_user_id` — since guest checkout is this app's
 * own default posture (`guest_checkout_enabled` setting) and a guest
 * still deserves a real Wishlist/order history; `wp_user_id` is an
 * optional, nullable upgrade once/if that same email logs in or
 * registers, resolved by `CustomerService::find_or_create_by_email()`.
 * `total_orders`/`total_spent`/`last_order_at` are maintained running
 * totals (updated on every `vulocart_order_created`), not computed live
 * on every read — the same "cache the aggregate, don't recompute it"
 * tradeoff `Order\Domain\Order`'s own docblocks never needed to make
 * (an Order's own totals are fixed at creation) but a Customer's own
 * totals, summed across a potentially large and growing order history,
 * genuinely do.
 *
 * @class       Customer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Customer {

    /**
     * Customer id.
     *
     * @var int|null Null for a customer not yet persisted.
     */
    public $id;

    /**
     * The durable identity this record is keyed by.
     *
     * @var string
     */
    public $email;

    /**
     * The WP user id this email currently belongs to, if any — resolved
     * opportunistically (an order/registration under this email while
     * logged in), never required.
     *
     * @var int|null
     */
    public $wp_user_id;

    /**
     * Display name — most-recently-seen value, not locked to the first
     * order's own name (a buyer's name can legitimately change).
     *
     * @var string|null
     */
    public $name;

    /**
     * Phone number — same "most-recently-seen" freshness as `$name`.
     *
     * @var string|null
     */
    public $phone;

    /**
     * Running count of orders placed under this email — maintained by
     * `CustomerService::record_order()`, not recomputed on read.
     *
     * @var int
     */
    public $total_orders;

    /**
     * Running sum of every associated order's own `$total` — same
     * maintained-not-computed reasoning as `$total_orders`.
     *
     * @var float
     */
    public $total_spent;

    /**
     * Most recent order's own `created_at`, mirrored here so "last
     * ordered" is a plain column read, not a join, for the admin list
     * screen's own sortable column.
     *
     * @var string|null MySQL datetime string.
     */
    public $last_order_at;

    /**
     * First-seen timestamp — set once, at creation.
     *
     * @var string|null MySQL datetime string, once persisted.
     */
    public $created_at;

    /**
     * Last-updated timestamp.
     *
     * @var string|null MySQL datetime string, once persisted.
     */
    public $updated_at;

    /**
     * Customer constructor.
     *
     * @param int|null    $id            Null for a customer not yet persisted.
     * @param string      $email         The durable identity this record is keyed by.
     * @param int|null    $wp_user_id    The WP user id this email currently belongs to, if any.
     * @param string|null $name          Display name.
     * @param string|null $phone         Phone number.
     * @param int         $total_orders  Running count of orders placed under this email.
     * @param float       $total_spent   Running sum of every associated order's own total.
     * @param string|null $last_order_at Most recent order's own created_at.
     * @param string|null $created_at    First-seen timestamp.
     * @param string|null $updated_at    Last-updated timestamp.
     */
    public function __construct(
        $id,
        $email,
        $wp_user_id = null,
        $name = null,
        $phone = null,
        $total_orders = 0,
        $total_spent = 0.0,
        $last_order_at = null,
        $created_at = null,
        $updated_at = null
    ) {
        $this->id            = $id;
        $this->email         = $email;
        $this->wp_user_id    = $wp_user_id;
        $this->name          = $name;
        $this->phone         = $phone;
        $this->total_orders  = $total_orders;
        $this->total_spent   = $total_spent;
        $this->last_order_at = $last_order_at;
        $this->created_at    = $created_at;
        $this->updated_at    = $updated_at;
    }
}
