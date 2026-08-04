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
 * Now owns a real persistent Customer entity (`Install.php`,
 * `Domain\Customer`'s own docblock) — every order dispatches
 * `vulocart_order_created`, this module listens and finds-or-creates the
 * customer, advancing their running totals
 * (`Application\CustomerService::record_order()`). Still no hard
 * cross-module dependency to defer on: this listener is optional (a
 * plain `add_action`, silently a no-op if Order somehow never fires it),
 * so this module still wires everything synchronously in its own
 * constructor, same as before.
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
        $this->container['install']   = new Install();
        $this->container['customers'] = new Infrastructure\WPDBCustomerRepository();
        $this->container['addresses'] = new Infrastructure\WPDBAddressRepository();
        $this->container['notes']     = new Infrastructure\WPDBNoteRepository();
        $this->container['service']   = new Application\CustomerService(
            $this->container['customers'],
            $this->container['addresses'],
            $this->container['notes']
        );

        VuloCart()->customer_service = $this->container['service'];

        $this->container['rest'] = new Rest();

        add_filter( 'vulocart_checkout_steps', array( $this, 'register_checkout_step' ) );
        add_action( 'vulocart_order_created', array( $this, 'maybe_record_order' ) );
    }

    /**
     * `vulocart_order_created`'s own listener.
     *
     * @param array{order: object} $payload Order\Domain\Order under the 'order' key.
     * @return void
     */
    public function maybe_record_order( $payload ) {
        $this->container['service']->record_order( $payload['order'] );
    }

    /**
     * Registers this module's own step into the Checkout Engine's step
     * registry.
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
