import { useState } from 'react';
import type { ReactNode } from 'react';
import { addItem, createEphemeralCartToken } from '@vulocart/sdk';
import type { Order } from '@vulocart/sdk';
import { EmbeddedCheckout } from './EmbeddedCheckout';

export interface BuyButtonProps {
	offeringId: number;
	quantity?: number;
	children?: ReactNode;
	onOrderPlaced?: ( order: Order ) => void;
}

/**
 * React equivalent of `@vulocart/sdk`'s vanilla `mountBuyButton()`
 * (`widgets/buy-button.ts`'s own docblock on the ephemeral-cart
 * reasoning — identical here). Renders its own modal overlay via a
 * plain `<div>` rather than a portal — no dependency on
 * `react-dom/client`'s portal API being available/desired in every
 * consumer's setup, and this component's own overlay is a single fixed
 * element, not something that needs true DOM-tree escape (z-index alone
 * is sufficient, same as the vanilla widget's own overlay).
 */
export function BuyButton( { offeringId, quantity = 1, children, onOrderPlaced }: BuyButtonProps ) {
	const [ cartToken, setCartToken ] = useState< string | null >( null );
	const [ error, setError ] = useState< string | null >( null );

	function open() {
		const token = createEphemeralCartToken();

		addItem( token, offeringId, quantity )
			.then( () => setCartToken( token ) )
			.catch( ( err ) => setError( err instanceof Error ? err.message : 'Could not start checkout.' ) );
	}

	return (
		<>
			<button type="button" className="vulocart-react-buy-button" onClick={ open }>
				{ children || 'Buy Now' }
			</button>
			{ error && <p className="vulocart-react-error">{ error }</p> }
			{ cartToken && (
				<div className="vulocart-react-overlay" onClick={ ( e ) => e.target === e.currentTarget && setCartToken( null ) }>
					<div className="vulocart-react-modal">
						<button type="button" className="vulocart-react-overlay-close" aria-label="Close" onClick={ () => setCartToken( null ) }>
							×
						</button>
						<EmbeddedCheckout
							cartToken={ cartToken }
							onOrderPlaced={ onOrderPlaced }
							onBack={ () => setCartToken( null ) }
						/>
					</div>
				</div>
			) }
		</>
	);
}
