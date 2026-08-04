import { addItem, createEphemeralCartToken } from '../cart';
import { clear, h } from '../dom';
import { mountEmbeddedCheckout } from './embedded-checkout';
import type { Order } from '../types';

export interface BuyButtonOptions {
	offeringId: number;
	quantity?: number;
	/** Mounts checkout inline into this container instead of an overlay this widget creates itself. */
	target?: HTMLElement;
	onOrderPlaced?: ( order: Order ) => void;
}

/**
 * Buy Button — always a fresh, throwaway cart (`createEphemeralCartToken()`,
 * not the visitor's ambient cart token), since clicking "Buy Now" on one
 * specific offering means "I want to buy JUST this," not "add this to
 * whatever else I already have queued up." Deliberately its own overlay
 * implementation, not a reuse of vulocart-pro's licensed "Popup Checkout"
 * module — Buy Button ships in the free tier (Sdk.php's own
 * `features.buyButton: true`, unconditional), so it can't depend on
 * anything gated behind a Pro license.
 *
 * @param el      The trigger element (typically a `<button>` or styled `<div>`).
 * @param options Buy Button config.
 * @return Cleanup function that removes the click listener.
 */
export function mountBuyButton( el: HTMLElement, options: BuyButtonOptions ): () => void {
	const { offeringId, quantity = 1, target, onOrderPlaced } = options;

	const onClick = ( event: Event ) => {
		event.preventDefault();
		open();
	};

	function open() {
		const cartToken = createEphemeralCartToken();

		addItem( cartToken, offeringId, quantity )
			.then( () => {
				if ( target ) {
					mountEmbeddedCheckout( target, { cartToken, onOrderPlaced } );
					return;
				}

				openOverlay( cartToken );
			} )
			.catch( () => {
				el.dispatchEvent( new CustomEvent( 'vulocart:error', { bubbles: true, detail: { message: 'Could not start checkout.' } } ) );
			} );
	}

	function openOverlay( cartToken: string ) {
		const overlay = h( 'div', { class: 'vulocart-sdk-overlay' } );
		const modal = h( 'div', { class: 'vulocart-sdk-modal' } );
		const closeButton = h( 'button', { type: 'button', class: 'vulocart-sdk-overlay-close', 'aria-label': 'Close' }, [ '×' ] );
		const mountPoint = h( 'div', {} );

		const close = () => {
			clear( mountPoint );
			overlay.remove();
			document.removeEventListener( 'keydown', onKeyDown );
		};

		const onKeyDown = ( keyEvent: KeyboardEvent ) => {
			if ( 'Escape' === keyEvent.key ) {
				close();
			}
		};

		closeButton.addEventListener( 'click', close );
		overlay.addEventListener( 'click', ( overlayEvent ) => {
			if ( overlayEvent.target === overlay ) {
				close();
			}
		} );
		document.addEventListener( 'keydown', onKeyDown );

		modal.append( closeButton, mountPoint );
		overlay.append( modal );
		document.body.append( overlay );

		mountEmbeddedCheckout( mountPoint, {
			cartToken,
			onOrderPlaced,
			onBack: close,
		} );
	}

	el.addEventListener( 'click', onClick );

	return () => el.removeEventListener( 'click', onClick );
}
