import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client, CART_TOKEN_STORAGE_KEY } from '../shared/cart';
import type { CartResponse } from '../shared/cart';
import { getCheckoutStep, getOrderPlacedHandlers, CheckoutRunData } from './registry';
import './checkout-engine.scss';

interface StepDescriptor {
	id: string;
	label: string;
	order: number;
	rest_base: string;
}

interface CheckoutEngineProps {
	cartToken: string;
	cart: CartResponse | null;
	/** `single_page`|`multi_step` — CheckoutMode::free()'s own two values; Pro delivery modes wrap this same component rather than reimplementing it. */
	mode: 'single_page' | 'multi_step';
	onBackToCart: () => void;
}

/**
 * The Checkout Engine's renderer — replaces the old Checkout.tsx's own
 * hardcoded `CheckoutStep` union/step-by-step JSX entirely. Discovers
 * which steps exist from the server (`GET /checkout/steps`,
 * RestAPI\Controllers\Checkout.php) instead of assuming a fixed list, and
 * resolves each one to a component via registry.ts's client-side
 * registry — a step this file has never heard of (a future vulocart-pro
 * one) renders correctly as long as something registered it before this
 * component mounted.
 *
 * `single_page` renders every step's own fields stacked on one page with
 * a single "Place Order" action at the end; `multi_step` shows one at a
 * time with a stepper — the same registered steps and step components
 * back both, only the layout differs. Neither mode, nor this component
 * itself, has any WordPress-page concept anywhere in it — Checkout.tsx
 * (the Gutenberg block) is just today's one caller; a future Popup/
 * Embedded/Hosted delivery mode mounts this exact component the same way.
 */
export function CheckoutEngine( { cartToken, cart, mode, onBackToCart }: CheckoutEngineProps ) {
	const [ steps, setSteps ] = useState< StepDescriptor[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ activeIndex, setActiveIndex ] = useState( 0 );
	const [ data, setData ] = useState< CheckoutRunData >( {} );
	const [ error, setError ] = useState< string | null >( null );
	const [ isPlacingOrder, setIsPlacingOrder ] = useState( false );

	useEffect( () => {
		Promise.all( [
			client.get< StepDescriptor[] >( '/checkout/steps' ),
			client
				.post( '/checkout/sessions', { cart_token: cartToken, mode } )
				.catch( () => null ), // session tracking is best-effort — a failure here shouldn't block checkout itself.
		] )
			.then( ( [ stepsResponse ] ) => setSteps( stepsResponse.data ) )
			.finally( () => setIsLoading( false ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- cartToken/mode are fixed for this component's lifetime.
	}, [] );

	const update = ( patch: CheckoutRunData ) => setData( ( prev ) => ( { ...prev, ...patch } ) );

	const reportProgress = ( stepId: string ) => {
		client.patch( `/checkout/sessions/${ cartToken }`, {
			current_step: stepId,
			customer_email: data.customerEmail || undefined,
		} );
	};

	const interactiveSteps = steps.filter( ( step ) => 'confirmation' !== step.id );
	const confirmationStep = steps.find( ( step ) => 'confirmation' === step.id );

	const goNext = () => {
		if ( activeIndex < interactiveSteps.length - 1 ) {
			const nextIndex = activeIndex + 1;
			setActiveIndex( nextIndex );
			reportProgress( interactiveSteps[ nextIndex ].id );
		}
	};

	const goBack = () => {
		if ( 0 === activeIndex ) {
			onBackToCart();
			return;
		}

		setActiveIndex( activeIndex - 1 );
	};

	const placeOrder = () => {
		if ( ! cart || 0 === cart.items.length ) {
			return;
		}

		setIsPlacingOrder( true );
		setError( null );

		const billing = ( data.billingAddress as Record< string, unknown > ) || {};
		const shippingSame = false !== data.shippingSameAsBilling;
		const shipping = shippingSame ? billing : ( data.shippingAddress as Record< string, unknown > ) || billing;

		client
			.post(
				'/orders',
				{
					customer_email: data.customerEmail,
					customer_name: data.customerName || undefined,
					customer_phone: data.customerPhone || undefined,
					billing_address: billing,
					shipping_address: shipping,
					shipping_method: data.selectedShippingMethod,
					payment_method: data.selectedPaymentMethod,
					payment_intent_id: data.paymentIntentId || undefined,
				},
				{ headers: { 'X-Cart-Token': cartToken } }
			)
			.then( ( response ) => {
				// Fire-and-forget, in parallel — registerOrderPlacedHandler()'s
				// own docblock explains why a slow/failing handler
				// (vulocart-pro's Order Notes/Coupons/Gift Cards
				// redemption-recording) must never block the shopper from
				// seeing their confirmation screen.
				getOrderPlacedHandlers().forEach( ( handler ) => {
					try {
						void handler( response.data, data, cartToken );
					} catch {
						// A misbehaving handler is still not this shopper's problem.
					}
				} );

				update( { confirmation: response.data } );
				window.localStorage.removeItem( CART_TOKEN_STORAGE_KEY );
			} )
			.catch( () => setError( __( 'Could not place order. Your cart may be empty.', 'vulocart' ) ) )
			.finally( () => setIsPlacingOrder( false ) );
	};

	if ( isLoading ) {
		return <p>{ __( 'Loading checkout…', 'vulocart' ) }</p>;
	}

	if ( 0 === interactiveSteps.length ) {
		return (
			<p>
				{ __(
					'Checkout has no active steps — activate Customer, Address, Shipping, and Payment from the Modules admin page.',
					'vulocart'
				) }
			</p>
		);
	}

	// Terminal state — an order was placed. Rendered via the SAME registry
	// mechanism as every other step (Confirmation/Module.php's own
	// docblock explains why it's a real registered step, not a special
	// case at the PHP layer) rather than bespoke JSX here, so a future
	// custom confirmation step (vulocart-pro Checkout Templates) overrides
	// this exactly the way it would any other step.
	if ( data.confirmation && confirmationStep ) {
		const step = getCheckoutStep( confirmationStep.id );

		return (
			<div className="vulocart-checkout-engine">
				{ step
					? step.render( {
							cartToken,
							cart,
							data,
							update,
							mode,
							goNext: () => undefined,
							goBack: () => undefined,
							onPlaceOrder: () => undefined,
							isFirstStep: true,
							isLastStep: true,
					  } )
					: null }
			</div>
		);
	}

	const renderStep = ( descriptor: StepDescriptor, index: number ) => {
		const step = getCheckoutStep( descriptor.id );

		if ( ! step ) {
			return (
				<p key={ descriptor.id } className="vulocart-checkout-engine-missing-step">
					{ __( 'No renderer registered for step:', 'vulocart' ) } { descriptor.label }
				</p>
			);
		}

		return (
			<div key={ descriptor.id } className="vulocart-checkout-engine-step">
				{ 'multi_step' === mode && <h3>{ descriptor.label }</h3> }
				{ step.render( {
					cartToken,
					cart,
					data,
					update,
					mode,
					goNext,
					goBack,
					onPlaceOrder: placeOrder,
					isFirstStep: 0 === index,
					isLastStep: index === interactiveSteps.length - 1,
				} ) }
			</div>
		);
	};

	return (
		<div className="vulocart-checkout-engine">
			{ 'multi_step' === mode && (
				<div className="vulocart-checkout-engine-stepper">
					{ interactiveSteps.map( ( step, index ) => (
						<div
							key={ step.id }
							className={ `vulocart-checkout-engine-stepper-item${ index === activeIndex ? ' is-active' : '' }` }
						>
							<span className="vulocart-checkout-engine-stepper-badge">{ index + 1 }</span>
							{ step.label }
							{ index < interactiveSteps.length - 1 && <span className="vulocart-checkout-engine-stepper-sep">›</span> }
						</div>
					) ) }
				</div>
			) }

			{ error && <p className="vulocart-checkout-engine-error">{ error }</p> }
			{ isPlacingOrder && <p>{ __( 'Placing order…', 'vulocart' ) }</p> }

			{ 'single_page' === mode
				? interactiveSteps.map( renderStep )
				: renderStep( interactiveSteps[ activeIndex ], activeIndex ) }
		</div>
	);
}
