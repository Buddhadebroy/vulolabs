<?php
/**
 * Module class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Review;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Review Module.
 *
 * The checkout wizard's final "Review your order" step — deliberately its
 * own namespace (`VuloCart\Review`, distinct from the existing product
 * star-rating feature at `VuloCart\Domain\Review`/
 * `VuloCart\Application\ReviewService`, exposed as
 * `VuloCart()->review_service`) to avoid colliding with that unrelated,
 * already-shipped concept. This module registers itself as
 * `VuloCart()->order_review_service`.
 *
 * Same toggleable-addon pattern as VuloCart\Cart\Module. No own table —
 * `build_summary()` is a pure read: it recomputes exactly what
 * `Order\Application\OrderService::create_from_cart()` would charge,
 * without persisting anything, so the wizard's Review step can show the
 * real final total before the buyer commits to "Place Order".
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
     * the main plugin container (`VuloCart()->order_review_service`).
     *
     * @return void
     */
    public function init_classes() {
        $this->container['service'] = new Application\OrderReviewService();

        VuloCart()->order_review_service = $this->container['service'];

        $this->container['rest'] = new Rest();

        add_filter( 'vulocart_checkout_steps', array( $this, 'register_checkout_step' ) );
    }

    /**
     * Registers this module's own step — see Customer/Module.php's own
     * docblock on register_checkout_step() for what this mechanism is.
     *
     * @param array<int, array<string, mixed>> $steps Already-registered step descriptors.
     * @return array<int, array<string, mixed>>
     */
    public function register_checkout_step( $steps ) {
        $steps[] = array(
            'id'        => 'review',
            'label'     => __( 'Review', 'vulocart' ),
            'order'     => 50,
            'rest_base' => 'review',
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
