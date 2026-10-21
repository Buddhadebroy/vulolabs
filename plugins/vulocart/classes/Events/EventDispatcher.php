<?php
/**
 * EventDispatcher class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Events;

defined( 'ABSPATH' ) || exit;

/**
 * Broadcasts what happened (`vulocart_product_created`, `vulocart_order_created`, ...) as WordPress actions.
 *
 * WordPress hooks are only the transport: this class decides nothing. The application services decide what happened
 * and then call it. A listener should react (send a webhook, clear a cache), never contain the logic that decided the
 * event.
 *
 * @class       EventDispatcher class
 * @version     1.0.0
 * @author      VuloLabs
 */
class EventDispatcher {

    /**
     * Broadcasts an event as a WordPress action.
     *
     * @param string               $event   Short event name, e.g. 'product_created' - prefixed to `vulocart_{$event}` before firing.
     * @param array<string, mixed> $payload Event data, passed through to listeners unchanged.
     * @return void
     */
    public function dispatch( string $event, array $payload = array() ): void {
        do_action( "vulocart_{$event}", $payload );
    }
}
