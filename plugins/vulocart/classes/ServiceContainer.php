<?php
/**
 * ServiceContainer class file.
 *
 * @package VuloCart
 */

namespace VuloCart;

defined( 'ABSPATH' ) || exit;

/**
 * A minimal bind/make dependency-injection container.
 *
 * It is separate from the plugin's own `VuloCart::$container` array, which only holds config values and eagerly built
 * services (a service locator). This class is the seam that makes the storage engine replaceable:
 * VuloCart::init_classes() binds each `Domain\...RepositoryInterface` to a closure that builds the
 * `Infrastructure\Database\WPDB...Repository`, and the application services only ask this container for the
 * interface, never `new` the concrete repository. Switching to another storage engine is a one-line change to that
 * binding.
 *
 * It is kept small on purpose: no autowiring, no reflection, no tagging.
 *
 * @class       ServiceContainer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class ServiceContainer {

    /**
     * Registered factories, keyed by the service id (usually an interface
     * name) they resolve.
     *
     * @var array<string, callable>
     */
    private array $bindings = array();

    /**
     * Abstracts that resolve to one shared instance instead of a fresh one
     * per make() call, once resolved.
     *
     * @var array<string, bool>
     */
    private array $shared = array();

    /**
     * Already-resolved shared instances, keyed the same as $bindings.
     *
     * @var array<string, mixed>
     */
    private array $instances = array();

    /**
     * Registers a factory that runs fresh on every make() call.
     *
     * @param string   $service_id Interface or class name being bound.
     * @param callable $factory  Builds and returns a concrete instance.
     * @return void
     */
    public function bind( string $service_id, callable $factory ): void {
        $this->bindings[ $service_id ] = $factory;
        unset( $this->shared[ $service_id ], $this->instances[ $service_id ] );
    }

    /**
     * Registers a factory whose result is built once and reused for every
     * subsequent make() call - what VuloCart::init_classes() uses for
     * ProductRepositoryInterface, since a repository is safe (and cheap) to
     * share for the lifetime of one request.
     *
     * @param string   $service_id Interface or class name being bound.
     * @param callable $factory  Builds and returns a concrete instance.
     * @return void
     */
    public function singleton( string $service_id, callable $factory ): void {
        $this->bind( $service_id, $factory );
        $this->shared[ $service_id ] = true;
    }

    /**
     * Resolves a bound service id to its concrete instance.
     *
     * @param string $service_id Interface or class name to resolve.
     * @return mixed
     * @throws \Exception If nothing has been bound for $service_id.
     */
    public function make( string $service_id ) {
        if ( isset( $this->instances[ $service_id ] ) ) {
            return $this->instances[ $service_id ];
        }

        if ( ! isset( $this->bindings[ $service_id ] ) ) {
            throw new \Exception( sprintf( 'Nothing bound for %s.', esc_html( $service_id ) ) );
        }

        $instance = ( $this->bindings[ $service_id ] )();

        if ( ! empty( $this->shared[ $service_id ] ) ) {
            $this->instances[ $service_id ] = $instance;
        }

        return $instance;
    }
}
