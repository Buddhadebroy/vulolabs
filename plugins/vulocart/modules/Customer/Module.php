<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Customer;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Customer Module.
 *
 * Same toggleable-addon pattern as VuloCart\Cart\Module. No hard
 * cross-module dependency to defer — CustomerService only ever reads
 * `wp_get_current_user()`/usermeta, so (unlike Order\Module) this module
 * wires everything synchronously in its own constructor.
 *
 * Lightweight by design: no `vulocart_customers` table, no Install.php.
 * A Customer here is a per-order snapshot (Order's own `customer_email`/
 * `customer_name`/`customer_phone`/`customer_user_id` columns), optionally
 * linked to a real WP user id when logged in — not a separate persistent
 * account/profile entity. This module's whole job is resolving *that*
 * snapshot's starting values (prefill for a logged-in buyer) and
 * sanitizing whatever the checkout wizard's Customer step posts.
 *
 * @class       Module class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Module {

    /**
     * Container for this module's own class instances.
     *
     * @var array
     */
    private $container = array();

    /**
     * Module constructor.
     */
    public function __construct() {
        $this->init_classes();
    }

    /**
     * Constructs this module's own classes and registers its service on
     * the main plugin container (`VuloCart()->customer_service`).
     *
     * @return void
     */
    public function init_classes() {
        $this->container['service'] = new Application\CustomerService();

        VuloCart()->customer_service = $this->container['service'];

        $this->container['rest'] = new Rest();

        add_filter( 'vulocart_checkout_steps', array( $this, 'register_checkout_step' ) );
    }

    /**
     * Registers this module's own step into the Checkout Engine's step
     * registry (RestAPI\Controllers\Checkout::get_steps() — see that
     * method's own docblock for why this is the pluggability mechanism
     * itself, not a hardcoded client-side list).
     *
     * @param array<int, array<string, mixed>> $steps Already-registered step descriptors.
     * @return array<int, array<string, mixed>>
     */
    public function register_checkout_step( $steps ) {
        $steps[] = array(
            'id'        => 'customer',
            'label'     => __( 'Customer', 'vulocart' ),
            'order'     => 10,
            'rest_base' => 'customer',
        );

        return $steps;
    }

    /**
     * Magic getter for this module's own container.
     *
     * @param string $class_name Container key to retrieve.
     * @return mixed
     * @throws \Exception If the requested key does not exist in the container.
     */
    public function __get( $class_name ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.classFound
        if ( array_key_exists( $class_name, $this->container ) ) {
            return $this->container[ $class_name ];
        }

        throw new \Exception( sprintf( 'Call to unknown class %s.', esc_html( $class_name ) ) );
    }
}
