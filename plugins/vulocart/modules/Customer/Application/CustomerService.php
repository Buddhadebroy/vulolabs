<?php
/**
 * CustomerService class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer\Application;

use VuloCart\Customer\Domain\Customer;
use VuloCart\Customer\Infrastructure\WPDBAddressRepository;
use VuloCart\Customer\Infrastructure\WPDBCustomerRepository;
use VuloCart\Customer\Infrastructure\WPDBNoteRepository;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Customer module CustomerService.
 *
 * Where Customer business logic lives — Rest calls only this class. Now
 * backed by a real persistent `Customer` entity (Domain\Customer's own
 * docblock explains the shift from this class's previous snapshot-only
 * design) — `resolve_current()`/`sanitize()`/`remember_phone()` are
 * unchanged and still work exactly as before (existing callers, e.g.
 * `Order\Rest::create_item()`, need no changes); everything below them is
 * new.
 *
 * @class       CustomerService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CustomerService {

    /**
     * Usermeta key a logged-in buyer's phone number is remembered under,
     * once they've given it at checkout — read back by resolve_current()
     * so a repeat logged-in buyer doesn't have to retype it.
     *
     * @var string
     */
    const PHONE_USER_META_KEY = 'vulocart_phone';

    /**
     * Owns the customers table.
     *
     * @var WPDBCustomerRepository
     */
    private $customers;

    /**
     * Owns the customer addresses table.
     *
     * @var WPDBAddressRepository
     */
    private $addresses;

    /**
     * Owns the customer notes table.
     *
     * @var WPDBNoteRepository
     */
    private $notes;

    /**
     * CustomerService constructor.
     *
     * @param WPDBCustomerRepository $customers Owns the customers table.
     * @param WPDBAddressRepository  $addresses Owns the customer addresses table.
     * @param WPDBNoteRepository     $notes     Owns the customer notes table.
     */
    public function __construct( WPDBCustomerRepository $customers, WPDBAddressRepository $addresses, WPDBNoteRepository $notes ) {
        $this->customers = $customers;
        $this->addresses = $addresses;
        $this->notes     = $notes;
    }

    /**
     * Resolves the checkout wizard's Customer step starting values: a
     * logged-in buyer gets their WP account's name/email (and remembered
     * phone, if any) prefilled; a guest gets an empty shape to fill in
     * themselves. Never blocks checkout either way — this is prefill data,
     * not an authorization check (guest checkout's own gate is the
     * Checkout tab's `guest_checkout_enabled` setting, enforced elsewhere).
     *
     * @return array{is_logged_in: bool, user_id: int|null, email: string, name: string, phone: string}
     */
    public function resolve_current(): array {
        if ( ! is_user_logged_in() ) {
            return array(
                'is_logged_in' => false,
                'user_id'      => null,
                'email'        => '',
                'name'         => '',
                'phone'        => '',
            );
        }

        $user = wp_get_current_user();

        return array(
            'is_logged_in' => true,
            'user_id'      => (int) $user->ID,
            'email'        => (string) $user->user_email,
            'name'         => (string) $user->display_name,
            'phone'        => (string) get_user_meta( $user->ID, self::PHONE_USER_META_KEY, true ),
        );
    }

    /**
     * Sanitizes a raw `{email, name, phone}` bag posted from the checkout
     * wizard's Customer step.
     *
     * @param array<string, mixed> $data Raw posted customer fields.
     * @return array{email: string, name: string, phone: string}
     */
    public function sanitize( array $data ): array {
        return array(
            'email' => isset( $data['email'] ) ? sanitize_email( (string) $data['email'] ) : '',
            'name'  => isset( $data['name'] ) ? sanitize_text_field( (string) $data['name'] ) : '',
            'phone' => isset( $data['phone'] ) ? sanitize_text_field( (string) $data['phone'] ) : '',
        );
    }

    /**
     * Remembers a logged-in buyer's phone number for next time.
     *
     * @param int    $user_id WP user id.
     * @param string $phone   Phone number to remember.
     * @return void
     */
    public function remember_phone( int $user_id, string $phone ): void {
        if ( '' === $phone ) {
            return;
        }

        update_user_meta( $user_id, self::PHONE_USER_META_KEY, sanitize_text_field( $phone ) );
    }

    /**
     * Fetches one customer by id.
     *
     * @param int $id Customer id.
     * @return Customer|null
     */
    public function get( int $id ): ?Customer {
        return $this->customers->find( $id );
    }

    /**
     * Fetches one customer by email.
     *
     * @param string $email A candidate email.
     * @return Customer|null
     */
    public function get_by_email( string $email ): ?Customer {
        return $this->customers->find_by_email( $email );
    }

    /**
     * A page of customers, optionally searched — backs the admin
     * Customers list screen.
     *
     * @param array{page?: int, per_page?: int, search?: string} $args Pagination/filter args.
     * @return array{data: Customer[], total: int}
     */
    public function list_customers( array $args = array() ): array {
        return $this->customers->paginate( $args );
    }

    /**
     * Finds the existing customer for an email, or creates a fresh one —
     * the entrypoint every write path (an order, a future storefront
     * registration) goes through, so an email only ever gets one
     * customer row no matter how many times it's seen.
     *
     * Fires `vulocart_customer_created` the first time an email gets a
     * customer row at all — vulocart-pro's WorkflowBuilder module's own
     * "Customer Registered" trigger listens for this rather than WP's own
     * `user_register` (checkout is guest-capable, `Checkout.php`'s own
     * cart-token-based session — a guest's first order genuinely is "a
     * new customer showed up" even with no WP account ever created).
     *
     * @param string      $email      An email — the durable identity key.
     * @param string|null $name       Display name, if known.
     * @param string|null $phone      Phone number, if known.
     * @param int|null    $wp_user_id WP user id, if the request is logged in.
     * @return Customer
     */
    public function find_or_create_by_email( string $email, $name = null, $phone = null, $wp_user_id = null ): Customer {
        $existing = $this->customers->find_by_email( $email );

        if ( $existing ) {
            // Most-recently-seen values win (Domain\Customer's own
            // docblock) — a buyer's name/phone/account can legitimately
            // change between orders.
            $existing->name       = $name ? $name : $existing->name;
            $existing->phone      = $phone ? $phone : $existing->phone;
            $existing->wp_user_id = $wp_user_id ? $wp_user_id : $existing->wp_user_id;

            return $this->customers->update( $existing );
        }

        $customer = $this->customers->insert( new Customer( null, $email, $wp_user_id, $name, $phone ) );

        do_action( 'vulocart_customer_created', array( 'customer' => $customer ) );

        return $customer;
    }

    /**
     * `vulocart_order_created`'s own listener (`Module::maybe_record_order()`)
     * — finds-or-creates the customer and advances their running totals.
     * Silently does nothing for an order with no email on file (same
     * "valid, real state" reasoning `Notifications\OrderEmails::
     * send_order_confirmation()`'s own docblock gives for the identical
     * check) — a customer record needs a durable identity to key on.
     *
     * @param object $order `Order\Domain\Order`.
     * @return void
     */
    public function record_order( $order ): void {
        if ( empty( $order->customer_email ) ) {
            return;
        }

        $customer = $this->find_or_create_by_email(
            $order->customer_email,
            $order->customer_name,
            $order->customer_phone,
            $order->customer_user_id
        );

        $customer->total_orders  = $customer->total_orders + 1;
        $customer->total_spent   = $customer->total_spent + (float) $order->total;
        $customer->last_order_at = current_time( 'mysql' );

        $this->customers->update( $customer );
    }

    /**
     * Updates a customer's own editable profile fields.
     *
     * @param int                   $id   Customer id.
     * @param array<string, mixed> $data Already-sanitized partial update (`name`/`phone`/`wp_user_id`).
     * @return Customer|null Null if no customer with this id exists.
     */
    public function update_profile( int $id, array $data ): ?Customer {
        $customer = $this->customers->find( $id );

        if ( ! $customer ) {
            return null;
        }

        $customer->name       = array_key_exists( 'name', $data ) ? $data['name'] : $customer->name;
        $customer->phone      = array_key_exists( 'phone', $data ) ? $data['phone'] : $customer->phone;
        $customer->wp_user_id = array_key_exists( 'wp_user_id', $data ) ? $data['wp_user_id'] : $customer->wp_user_id;

        return $this->customers->update( $customer );
    }

    /**
     * Every address belonging to a customer.
     *
     * @param int $customer_id Owning customer's id.
     * @return array<int, array<string, mixed>>
     */
    public function list_addresses( int $customer_id ): array {
        return $this->addresses->list_for_customer( $customer_id );
    }

    /**
     * Adds an address to a customer's own address book.
     *
     * @param int                   $customer_id Owning customer's id.
     * @param array<string, mixed> $data        Already-sanitized address fields.
     * @return array<string, mixed>
     */
    public function add_address( int $customer_id, array $data ): array {
        if ( ! empty( $data['is_default_billing'] ) ) {
            $this->addresses->clear_default( $customer_id, 'is_default_billing' );
        }

        if ( ! empty( $data['is_default_shipping'] ) ) {
            $this->addresses->clear_default( $customer_id, 'is_default_shipping' );
        }

        $data['customer_id'] = $customer_id;

        return $this->addresses->insert( $data );
    }

    /**
     * Updates an address in a customer's own address book.
     *
     * @param int                   $id          Address id.
     * @param int                   $customer_id Owning customer's id.
     * @param array<string, mixed> $data        Already-sanitized partial update.
     * @return array<string, mixed>|null Null if no address with this id exists for this customer.
     */
    public function update_address( int $id, int $customer_id, array $data ): ?array {
        $address = $this->addresses->find( $id );

        if ( ! $address || (int) $address['customer_id'] !== $customer_id ) {
            return null;
        }

        if ( ! empty( $data['is_default_billing'] ) ) {
            $this->addresses->clear_default( $customer_id, 'is_default_billing' );
        }

        if ( ! empty( $data['is_default_shipping'] ) ) {
            $this->addresses->clear_default( $customer_id, 'is_default_shipping' );
        }

        return $this->addresses->update( $id, $data );
    }

    /**
     * Deletes an address from a customer's own address book.
     *
     * @param int $id          Address id.
     * @param int $customer_id Owning customer's id.
     * @return bool
     */
    public function delete_address( int $id, int $customer_id ): bool {
        return $this->addresses->delete( $id, $customer_id );
    }

    /**
     * Every note belonging to a customer.
     *
     * @param int $customer_id Owning customer's id.
     * @return array<int, array<string, mixed>>
     */
    public function list_notes( int $customer_id ): array {
        return $this->notes->list_for_customer( $customer_id );
    }

    /**
     * Adds an internal note about a customer.
     *
     * @param int    $customer_id    Owning customer's id.
     * @param int    $author_user_id The WP user id who wrote it.
     * @param string $note           Note text.
     * @return array<string, mixed>
     */
    public function add_note( int $customer_id, int $author_user_id, string $note ): array {
        return $this->notes->add( $customer_id, $author_user_id, $note );
    }

    /**
     * Deletes a note.
     *
     * @param int $id          Note id.
     * @param int $customer_id Owning customer's id.
     * @return bool
     */
    public function delete_note( int $id, int $customer_id ): bool {
        return $this->notes->delete( $id, $customer_id );
    }

    /**
     * A customer's own order history, paginated — resolves Order's own
     * repository via the main plugin container's optional-service
     * resolution (same "gracefully absent" pattern `Order\Application\
     * OrderService::resolve_optional_service()`'s own docblock
     * establishes, applied here in the other direction: Customer reaching
     * for Order, not Order reaching for an optional sibling), since
     * Customer has no hard dependency on Order's own namespace.
     *
     * @param string $email    Customer's own email.
     * @param int    $page     Page number.
     * @param int    $per_page Page size.
     * @return array{data: array<int, mixed>, total: int}
     */
    public function get_order_history( string $email, int $page = 1, int $per_page = 20 ): array {
        try {
            return VuloCart()->order_service->list_orders( // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- magic __get(), not a real property.
                array(
                    'page'     => $page,
                    'per_page' => $per_page,
                    'search'   => $email,
                )
            );
        } catch ( \Exception $e ) {
            unset( $e );
            return array( 'data' => array(), 'total' => 0 );
        }
    }

    /**
     * Counts or fetches every customer matching a small set of AND-
     * combined criteria — see `WPDBCustomerRepository::find_matching()`'s
     * own docblock for the full contract; this is a plain pass-through,
     * kept here so Pro's own Segments feature depends on this service
     * (Free's own public API), not the repository/table directly.
     *
     * @param array<int, array{field: string, operator: string, value: mixed}> $criteria AND-combined criteria.
     * @param bool $only_count Whether to return just the count.
     * @return array{data: Customer[], total: int}
     */
    public function find_matching( array $criteria, bool $only_count = false ): array {
        return $this->customers->find_matching( $criteria, $only_count );
    }

    /**
     * Lifetime analytics for one customer — `total_orders`/`total_spent`/
     * `last_order_at` are already-maintained columns (`record_order()`),
     * `average_order_value` is the one value actually computed on read
     * (cheap — a single division, not worth its own maintained column).
     *
     * @param Customer $customer A customer entity.
     * @return array{total_orders: int, total_spent: float, average_order_value: float, last_order_at: string|null}
     */
    public function get_analytics( Customer $customer ): array {
        return array(
            'total_orders'        => $customer->total_orders,
            'total_spent'         => $customer->total_spent,
            'average_order_value' => $customer->total_orders > 0 ? round( $customer->total_spent / $customer->total_orders, 2 ) : 0.0,
            'last_order_at'       => $customer->last_order_at,
        );
    }
}
