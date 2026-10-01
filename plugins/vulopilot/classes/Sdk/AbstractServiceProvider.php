<?php
/**
 * AbstractServiceProvider class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Sdk;

defined( 'ABSPATH' ) || exit;

/**
 * Optional base class an extension can use to organize its own internal service wiring.
 *
 * @class       AbstractServiceProvider class
 * @version     1.0.0
 * @author      VuloLabs
 */
abstract class AbstractServiceProvider {

	/**
	 * @var array<string, callable>
	 */
	private array $factories = array();

	/**
	 * @var array<string, mixed>
	 */
	private array $resolved = array();

	/**
	 * Registers this provider's services - call bind() here for
	 * everything the extension wants resolvable through make().
	 *
	 * @return void
	 */
	abstract public function register(): void;

	/**
	 * @param string   $id      Service id.
	 * @param callable $factory Called once, lazily, the first time make() asks for $id.
	 * @return void
	 */
	protected function bind( string $id, callable $factory ): void {
		$this->factories[ $id ] = $factory;
	}

	/**
	 * @param string $id Service id previously bind()'d.
	 * @return mixed
	 * @throws \InvalidArgumentException When $id was never bind()'d.
	 */
	public function make( string $id ) {
		if ( array_key_exists( $id, $this->resolved ) ) {
			return $this->resolved[ $id ];
		}

		if ( ! isset( $this->factories[ $id ] ) ) {
			throw new \InvalidArgumentException( esc_html( sprintf( 'No service registered for id "%s".', $id ) ) );
		}

		$this->resolved[ $id ] = ( $this->factories[ $id ] )();

		return $this->resolved[ $id ];
	}

	/**
	 * @param string $id Service id.
	 * @return bool
	 */
	public function has( string $id ): bool {
		return isset( $this->factories[ $id ] );
	}
}
