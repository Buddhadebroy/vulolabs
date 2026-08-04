import { useEffect, useState } from 'react';
import { getCart, request } from '@vulocart/sdk';
import type { AddressFields, Cart, Order, ShippingMethod } from '@vulocart/sdk';

interface PaymentMethod {
	id: string;
	label: string;
}

interface ReviewSummary {
	currency: string;
	shipping_cost: number;
	tax_amount: number;
	subtotal: number;
	total: number;
}

const EMPTY_ADDRESS: AddressFields = {
	full_name: '',
	address_1: '',
	city: '',
	state: '',
	postcode: '',
	country: '',
};

export interface EmbeddedCheckoutProps {
	cartToken: string;
	onOrderPlaced?: ( order: Order ) => void;
	onBack?: () => void;
}

/**
 * The React-idiomatic equivalent of `@vulocart/sdk`'s own vanilla-DOM
 * `mountEmbeddedCheckout()` (`widgets/embedded-checkout.ts`) — same REST
 * calls, same one-screen (not multi-step) shape, but implemented as a
 * real React component with its own state/render cycle instead of
 * imperative DOM manipulation, since that's what a React consumer
 * actually wants to compose with the rest of their app (styling via
 * their own component library, embedding inside their own layout, etc.)
 * rather than a black-box `<div>` this package manages directly.
 */
export function EmbeddedCheckout( { cartToken, onOrderPlaced, onBack }: EmbeddedCheckoutProps ) {
	const [ cart, setCart ] = useState< Cart | null >( null );
	const [ shippingMethods, setShippingMethods ] = useState< ShippingMethod[] >( [] );
	const [ paymentMethods, setPaymentMethods ] = useState< PaymentMethod[] >( [] );
	const [ billing, setBilling ] = useState< AddressFields >( EMPTY_ADDRESS );
	const [ email, setEmail ] = useState( '' );
	const [ shippingMethod, setShippingMethod ] = useState( '' );
	const [ paymentMethod, setPaymentMethod ] = useState( '' );
	const [ summary, setSummary ] = useState< ReviewSummary | null >( null );
	const [ error, setError ] = useState< string | null >( null );
	const [ placing, setPlacing ] = useState( false );
	const [ order, setOrder ] = useState< Order | null >( null );

	useEffect( () => {
		Promise.all( [
			getCart( cartToken ),
			request< ShippingMethod[] >( 'GET', '/shipping/methods' ),
			request< PaymentMethod[] >( 'GET', '/payment/methods' ),
		] )
			.then( ( [ cartResponse, shippingResponse, paymentResponse ] ) => {
				setCart( cartResponse );
				setShippingMethods( shippingResponse );
				setPaymentMethods( paymentResponse );
			} )
			.catch( ( err ) => setError( err instanceof Error ? err.message : 'Could not load checkout.' ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only ever needs to run once per cartToken.
	}, [ cartToken ] );

	useEffect( () => {
		if ( ! shippingMethod || ! paymentMethod ) {
			setSummary( null );
			return;
		}

		request< ReviewSummary >(
			'POST',
			'/review/summary',
			{ billing_address: billing, shipping_address: billing, shipping_method: shippingMethod, payment_method: paymentMethod },
			{ 'X-Cart-Token': cartToken }
		)
			.then( setSummary )
			.catch( () => undefined );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only on the fields that change the total, same as ReviewStep.tsx's own equivalent effect (checkout-engine).
	}, [ shippingMethod, paymentMethod ] );

	async function placeOrder() {
		for ( const field of [ 'full_name', 'address_1', 'city', 'state', 'postcode', 'country' ] as const ) {
			if ( ! billing[ field ] ) {
				setError( 'Please complete your billing address.' );
				return;
			}
		}

		if ( ! shippingMethod || ! paymentMethod ) {
			setError( 'Please choose a shipping and payment method.' );
			return;
		}

		setPlacing( true );
		setError( null );

		try {
			const placedOrder = await request< Order >( 'POST', '/orders', {
				cart_token: cartToken,
				customer_email: email,
				customer_name: billing.full_name,
				billing_address: billing,
				shipping_address: billing,
				shipping_method: shippingMethod,
				payment_method: paymentMethod,
			} );

			setOrder( placedOrder );
			onOrderPlaced?.( placedOrder );
		} catch ( err ) {
			setError( err instanceof Error ? err.message : 'Could not place order.' );
		} finally {
			setPlacing( false );
		}
	}

	if ( order ) {
		return (
			<div className="vulocart-react-confirmation">
				<h3>Order placed!</h3>
				<p>
					Order { order.order_number } — { order.total } { order.currency }
				</p>
			</div>
		);
	}

	if ( ! cart ) {
		return <p>{ error || 'Loading…' }</p>;
	}

	return (
		<div className="vulocart-react-checkout-form">
			<h4>Contact</h4>
			<input type="email" placeholder="Email" value={ email } onChange={ ( e ) => setEmail( e.target.value ) } />

			<h4>Billing address</h4>
			{ (
				[
					[ 'full_name', 'Full name' ],
					[ 'address_1', 'Address' ],
					[ 'city', 'City' ],
					[ 'state', 'State / region' ],
					[ 'postcode', 'Postcode' ],
					[ 'country', 'Country' ],
				] as [ keyof AddressFields, string ][]
			).map( ( [ field, placeholder ] ) => (
				<input
					key={ field }
					type="text"
					placeholder={ placeholder }
					value={ billing[ field ] || '' }
					onChange={ ( e ) => setBilling( { ...billing, [ field ]: e.target.value } ) }
				/>
			) ) }

			<h4>Shipping</h4>
			<select value={ shippingMethod } onChange={ ( e ) => setShippingMethod( e.target.value ) }>
				<option value="">Select shipping…</option>
				{ shippingMethods.map( ( method ) => (
					<option key={ method.id } value={ method.id }>
						{ method.label } — { method.cost } { cart.currency }
					</option>
				) ) }
			</select>

			<h4>Payment</h4>
			<select value={ paymentMethod } onChange={ ( e ) => setPaymentMethod( e.target.value ) }>
				<option value="">Select payment…</option>
				{ paymentMethods.map( ( method ) => (
					<option key={ method.id } value={ method.id }>
						{ method.label }
					</option>
				) ) }
			</select>

			{ summary && (
				<div className="vulocart-react-summary">
					<div>Subtotal: { summary.subtotal } { summary.currency }</div>
					<div>Shipping: { summary.shipping_cost } { summary.currency }</div>
					<div>Tax: { summary.tax_amount } { summary.currency }</div>
					<div className="vulocart-react-summary-total">Total: { summary.total } { summary.currency }</div>
				</div>
			) }

			{ error && <p className="vulocart-react-error">{ error }</p> }

			<button type="button" disabled={ placing } onClick={ () => void placeOrder() }>
				{ placing ? 'Placing order…' : 'Place order' }
			</button>

			{ onBack && (
				<button type="button" onClick={ onBack }>
					Back
				</button>
			) }
		</div>
	);
}
