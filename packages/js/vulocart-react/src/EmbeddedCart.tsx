import { useEffect, useState } from 'react';
import { getCart, getOrCreateCartToken, removeItem, updateItem } from '@vulocart/sdk';
import type { Cart, Order } from '@vulocart/sdk';
import { EmbeddedCheckout } from './EmbeddedCheckout';

export interface EmbeddedCartProps {
	onOrderPlaced?: ( order: Order ) => void;
}

/**
 * React equivalent of `@vulocart/sdk`'s vanilla `mountEmbeddedCart()`
 * widget (`widgets/embedded-cart.ts`'s own docblock covers the shared
 * cart-token/cross-origin-storage reasoning — identical here). Clicking
 * "Checkout" swaps this component's own render for `<EmbeddedCheckout>`
 * in place, rather than mounting into a separate DOM node the way the
 * vanilla widget does — the natural React way to do it.
 */
export function EmbeddedCart( { onOrderPlaced }: EmbeddedCartProps ) {
	const [ cartToken ] = useState( () => getOrCreateCartToken() );
	const [ cart, setCart ] = useState< Cart | null >( null );
	const [ error, setError ] = useState< string | null >( null );
	const [ checkingOut, setCheckingOut ] = useState( false );

	function reload() {
		getCart( cartToken )
			.then( setCart )
			.catch( ( err ) => setError( err instanceof Error ? err.message : 'Could not load cart.' ) );
	}

	useEffect( reload, [ cartToken ] );

	if ( checkingOut ) {
		return <EmbeddedCheckout cartToken={ cartToken } onOrderPlaced={ onOrderPlaced } onBack={ () => setCheckingOut( false ) } />;
	}

	if ( error ) {
		return <p className="vulocart-react-error">{ error }</p>;
	}

	if ( ! cart ) {
		return <p>Loading…</p>;
	}

	if ( 0 === cart.items.length ) {
		return <p className="vulocart-react-empty-cart">Your cart is empty.</p>;
	}

	return (
		<div className="vulocart-react-embedded-cart">
			<div className="vulocart-react-cart-rows">
				{ cart.items.map( ( item ) => (
					<div key={ item.id } className="vulocart-react-cart-row">
						<span>{ item.title }</span>
						<input
							type="number"
							min={ 1 }
							value={ item.quantity }
							onChange={ ( e ) => {
								const next = Math.max( 1, parseInt( e.target.value, 10 ) || 1 );
								updateItem( cartToken, item.id, next ).then( setCart ).catch( () => undefined );
							} }
						/>
						<span>
							{ item.subtotal } { item.currency || cart.currency }
						</span>
						<button type="button" onClick={ () => removeItem( cartToken, item.id ).then( setCart ).catch( () => undefined ) }>
							Remove
						</button>
					</div>
				) ) }
			</div>
			<div className="vulocart-react-cart-total">
				Total: { cart.totals.total } { cart.currency }
			</div>
			<button type="button" className="vulocart-react-checkout-button" onClick={ () => setCheckingOut( true ) }>
				Checkout
			</button>
		</div>
	);
}
