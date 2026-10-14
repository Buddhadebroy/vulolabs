<?php
/**
 * EventDispatcher class file.
 *
 * @package VuloCart
 */

namespace VuloCart\Events;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart EventDispatcher.
 *
 * The vision: "Everything emits events" (ProductCreated, CartUpdated, ...).
 * WordPress's own action hook system is used here purely as *transport* -
 * this class doesn't decide what happened or hold business logic itself,
 * it only broadcasts what Application\ProductService (or a future
 * Application service) already decided. A hook callback listening to
 * `vulocart_product_created` is expected to *react* (send a webhook, update
 * a cache), never to *contain* the logic that decided the product should be
 * created - keeping "business logic must never exist inside WordPress
 * hooks" true even though hooks are the delivery mechanism.
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
