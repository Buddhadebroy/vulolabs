import type { CSSProperties } from 'react';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client, CART_TOKEN_STORAGE_KEY } from '../shared/cart';
import type { CartResponse } from '../shared/cart';
import { getCheckoutStep, getOrderPlacedHandlers, CheckoutRunData } from './registry';
import type { CheckoutSummary } from './registry';
import { OrderSummary } from './OrderSummary';
import { applyThemeTokens } from './themeTokens';
import { applyStepOptions, setCheckoutOptions, type CheckoutOptions } from './options';
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
	/** `single_page`|`multi_step` - CheckoutMode::free()'s own two values; Pro delivery modes wrap this same component rather than reimplementing it. */
	mode: 'single_page' | 'multi_step';
	onBackToCart: () => void;
	/** What this checkout shows instead of the site's Settings → Checkout choice (a checkout block's own steps/fields). */
	options?: Partial< CheckoutOptions >;
}

/**
 * The Checkout Engine's renderer. It asks the server which steps exist (`GET /checkout/steps`,
 * RestAPI\Controllers\Checkout.php) and resolves each step to a component through the client-side registry in
 * registry.ts, so a step it has never heard of (for example one from vulocart-pro) renders as long as something
 * registered it before this component mounted.
 *
 * `single_page` stacks every step's fields on one page with a single "Place Order" action at the end; `multi_step`
 * shows one step at a time with a stepper. The same steps back both modes; only the layout differs.
 *
 * Nothing here depends on a WordPress page. The Gutenberg checkout block (Checkout.tsx) is one caller; the Popup,
 * Embedded and Hosted checkout modes of vulocart-pro mount this same component.
 */
export function CheckoutEngine( { cartToken, cart, mode, onBackToCart, options }: CheckoutEngineProps ) {
	// Before any step renders: the steps and address fields read these.
	setCheckoutOptions( options );

	const [ steps, setSteps ] = useState< StepDescriptor[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ activeIndex, setActiveIndex ] = useState( 0 );
	const [ data, setData ] = useState< CheckoutRunData >( {} );
	const [ error, setError ] = useState< string | null >( null );
	const [ isPlacingOrder, setIsPlacingOrder ] = useState( false );
	const [ summary, setSummary ] = useState< CheckoutSummary | null >( null );
	const [ refreshTick, setRefreshTick ] = useState( 0 );

	useEffect( () => {
		Promise.all( [
			client.get< StepDescriptor[] >( '/checkout/steps' ),
			client
				.post( '/checkout/sessions', { cart_token: cartToken, mode } )
				.catch( () => null ), // session tracking is best-effort - a failure here shouldn't block checkout itself.
		] )
			.then( ( [ stepsResponse ] ) => setSteps( applyStepOptions( stepsResponse.data ) ) )
			.finally( () => setIsLoading( false ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- cartToken/mode are fixed for this component's lifetime.
	}, [] );

	// A step that changes the price without touching the fields below (vulocart-pro's coupon and gift card boxes)
	// asks for a fresh breakdown with `window.dispatchEvent( new Event( 'vulocart:checkout-refresh' ) )`.
	useEffect( () => {
		const refresh = () => setRefreshTick( ( tick ) => tick + 1 );

		window.addEventListener( 'vulocart:checkout-refresh', refresh );

		return () => window.removeEventListener( 'vulocart:checkout-refresh', refresh );
	}, [] );

	// Keeps the order summary's numbers authoritative: shipping, tax and any discount come from the same endpoint
	// the order is priced with. Debounced, because address fields change on every keystroke.
	const priceInputs = JSON.stringify( [ data.billingAddress, data.shippingAddress, data.shippingSameAsBilling, data.selectedShippingMethod, data.selectedPaymentMethod, refreshTick ] );

	useEffect( () => {
		if ( ! cart || 0 === cart.items.length || data.confirmation ) {
			return undefined;
		}

		const billing = ( data.billingAddress as Record< string, unknown > ) || {};
		const shipping = false !== data.shippingSameAsBilling ? billing : ( data.shippingAddress as Record< string, unknown > ) || billing;
		const timer = window.setTimeout( () => {
			client
				.post< CheckoutSummary >(
					'/review/summary',
					{ billing_address: billing, shipping_address: shipping, shipping_method: data.selectedShippingMethod, payment_method: data.selectedPaymentMethod },
					{ headers: { 'X-Cart-Token': cartToken } }
				)
				.then( ( response ) => setSummary( response.data ) )
				.catch( () => setSummary( null ) ); // Before the address is complete the server may refuse; the cart's own subtotal shows meanwhile.
		}, 350 );

		return () => window.clearTimeout( timer );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `priceInputs` is the serialised list of everything the request reads.
	}, [ priceInputs ] );

	const update = ( patch: CheckoutRunData ) => setData( ( prev ) => ( { ...prev, ...patch } ) );

	const reportProgress = ( stepId: string ) => {
		client.patch( `/checkout/sessions/${ cartToken }`, {
			current_step: stepId,
			customer_email: data.customerEmail || undefined,
		} );
	};

	// Review folds into Payment when both exist: the order summary beside the steps already shows what is being bought,
	// so a separate "Review" page only repeated it. Payment then carries the extras and the Place order button.
	const hasPayment = steps.some( ( step ) => 'payment' === step.id );
	const interactiveSteps = steps.filter( ( step ) => 'confirmation' !== step.id && ! ( hasPayment && 'review' === step.id ) );
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
				// Fire-and-forget, in parallel - registerOrderPlacedHandler()'s
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
				// The cart link and any open cart page now show an empty cart.
				window.dispatchEvent( new CustomEvent( 'vulocart:cart-updated', { detail: { item_count: 0, items: [] } } ) );
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
					'Checkout has no active steps - activate Customer, Address, Shipping, and Payment from the Modules admin page.',
					'vulocart'
				) }
			</p>
		);
	}

	// Terminal state - an order was placed. Rendered via the SAME registry
	// mechanism as every other step (Confirmation/Module.php's own
	// docblock explains why it's a real registered step, not a special
	// case at the PHP layer) rather than bespoke JSX here, so a future
	// custom confirmation step (vulocart-pro Checkout Templates) overrides
	// this exactly the way it would any other step.
	if ( data.confirmation && confirmationStep ) {
		const step = getCheckoutStep( confirmationStep.id );

		return (
			<div className="vulocart-checkout-engine" ref={ applyThemeTokens }>
				{ step
					? step.render( {
							cartToken,
							cart,
							data,
							summary,
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
				<h3>
					{ 'single_page' === mode && <span className="vulocart-checkout-engine-step-number">{ index + 1 }</span> }
					{ descriptor.label }
				</h3>
				{ step.render( {
					cartToken,
					cart,
					data,
					summary,
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
		<div className="vulocart-checkout-engine" ref={ applyThemeTokens }>
			<div className="vulocart-checkout-layout">
				<div className="vulocart-checkout-main">
				<p className="vulocart-checkout-secure">
					<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<rect x="4" y="11" width="16" height="10" rx="2" />
						<path d="M8 11V7a4 4 0 0 1 8 0v4" />
					</svg>
					{ __( 'Secure checkout', 'vulocart' ) }
				</p>
				{ 'multi_step' === mode && (
					<ol className="vulocart-checkout-engine-stepper" style={ { '--vc-steps': interactiveSteps.length, '--vc-active': activeIndex } as CSSProperties }>
						{ interactiveSteps.map( ( step, index ) => (
							<li
								key={ step.id }
								className={ `vulocart-checkout-engine-stepper-item${ index === activeIndex ? ' is-active' : '' }${ index < activeIndex ? ' is-done' : '' }` }
								aria-current={ index === activeIndex ? 'step' : undefined }
							>
								<span className="vulocart-checkout-engine-stepper-badge">{ index < activeIndex ? '✓' : index + 1 }</span>
								{ step.label }
							</li>
						) ) }
					</ol>
				) }

				{ error && (
					<p className="vulocart-checkout-engine-error" role="alert">
						{ error }
					</p>
				) }
				{ isPlacingOrder && <p className="vulocart-checkout-engine-busy">{ __( 'Placing order…', 'vulocart' ) }</p> }

				{ 'single_page' === mode ? interactiveSteps.map( renderStep ) : renderStep( interactiveSteps[ activeIndex ], activeIndex ) }
			</div>

				<OrderSummary cart={ cart } summary={ summary } hasShipping={ Boolean( data.selectedShippingMethod ) } />
			</div>
		</div>
	);
}
