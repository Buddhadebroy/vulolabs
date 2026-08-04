import { getCart, getOrCreateCartToken, removeItem, updateItem } from '../cart';
import { clear, formatMoney, h } from '../dom';
import { mountEmbeddedCheckout } from './embedded-checkout';
import type { Cart, Order } from '../types';

export interface EmbeddedCartOptions {
	/** Where checkout mounts when "Checkout" is clicked. Defaults to replacing this same container's own content in place. */
	checkoutTarget?: HTMLElement;
	onOrderPlaced?: ( order: Order ) => void;
}

/**
 * The ambient ("ongoing shopping session") cart — a standalone widget,
 * unlike Buy Button's own always-fresh ephemeral cart (buy-button.ts's
 * own docblock on why those two are deliberately different tokens). Uses
 * `getOrCreateCartToken()` (the same localStorage-persisted token the
 * WordPress-side checkout block itself reads via its own equivalent
 * helper), so a shopper's cart built up via Buy Buttons/an Embedded Cart
 * widget on one page carries over to the WordPress site's own checkout
 * page too, as long as both run on the same origin (cart.ts's own
 * docblock on the cross-origin storage limitation).
 */
export function mountEmbeddedCart( container: HTMLElement, options: EmbeddedCartOptions = {} ): () => void {
	const { checkoutTarget, onOrderPlaced } = options;

	let destroyed = false;
	const cartToken = getOrCreateCartToken();

	container.classList.add( 'vulocart-sdk-embedded-cart' );

	function load() {
		getCart( cartToken )
			.then( render )
			.catch( ( err ) => {
				if ( destroyed ) {
					return;
				}
				clear( container );
				container.append( h( 'p', { class: 'vulocart-sdk-error' }, [ err instanceof Error ? err.message : 'Could not load cart.' ] ) );
			} );
	}

	function render( cart: Cart ) {
		if ( destroyed ) {
			return;
		}

		clear( container );

		if ( 0 === cart.items.length ) {
			container.append( h( 'p', { class: 'vulocart-sdk-empty-cart' }, [ 'Your cart is empty.' ] ) );
			return;
		}

		const rows = cart.items.map( ( item ) => {
			const qtyInput = h( 'input', { type: 'number', min: '1', value: String( item.quantity ) } );
			qtyInput.addEventListener( 'change', () => {
				const next = Math.max( 1, parseInt( ( qtyInput as HTMLInputElement ).value, 10 ) || 1 );
				updateItem( cartToken, item.id, next ).then( render ).catch( () => undefined );
			} );

			const removeButton = h( 'button', { type: 'button', class: 'vulocart-sdk-remove-item' }, [ 'Remove' ] );
			removeButton.addEventListener( 'click', () => {
				removeItem( cartToken, item.id ).then( render ).catch( () => undefined );
			} );

			return h( 'div', { class: 'vulocart-sdk-cart-row' }, [
				h( 'span', { class: 'vulocart-sdk-cart-row-title' }, [ item.title ] ),
				qtyInput,
				h( 'span', { class: 'vulocart-sdk-cart-row-subtotal' }, [ formatMoney( item.subtotal, item.currency || cart.currency ) ] ),
				removeButton,
			] );
		} );

		const checkoutButton = h( 'button', { type: 'button', class: 'vulocart-sdk-checkout-button' }, [ 'Checkout' ] );
		checkoutButton.addEventListener( 'click', () => {
			const destination = checkoutTarget || container;
			mountEmbeddedCheckout( destination, { cartToken, onOrderPlaced } );
		} );

		container.append(
			h( 'div', { class: 'vulocart-sdk-cart-rows' }, rows ),
			h( 'div', { class: 'vulocart-sdk-cart-total' }, [ `Total: ${ formatMoney( cart.totals.total, cart.currency ) }` ] ),
			checkoutButton
		);
	}

	load();

	return () => {
		destroyed = true;
		clear( container );
	};
}
