/* global vulocartFrontendData */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client, getOrCreateCartToken } from '../shared/cart';
import type { CartResponse } from '../shared/cart';
import { CheckoutEngine } from '../checkout-engine/CheckoutEngine';
import '../checkout-engine/mount'; // side-effect only — registers Free's 5 interactive steps AND patches window.vulocartCheckoutEngine.mount()/unmount() (see mount.tsx).
import './checkout.scss';

interface OfferingSummary {
	id: number;
	title: string;
	type: string;
	price: number | null;
	currency: string | null;
	status: string;
}

interface ShippingMethod {
	id: string;
	label: string;
	cost: number;
}

/**
 * The Checkout block — cart browsing/editing (unchanged from before), then
 * hands off to `CheckoutEngine` (`../checkout-engine/`) for everything
 * checkout itself. This file used to hardcode the entire step sequence
 * and every field's markup inline; now it owns only what's genuinely
 * block-specific (rendering the offerings list, mounting into this
 * Gutenberg block's DOM node) and nothing about WHICH checkout steps
 * exist or how they're laid out — that's `CheckoutEngine`'s job, and it
 * has no idea this block exists. `checkoutMode` (single_page/multi_step)
 * is a block/plugin setting (`vulocartFrontendData.checkoutMode`), not
 * hardcoded — a merchant can switch it without any code change, and a
 * future vulocart-pro delivery mode (Popup/Embedded/Hosted) mounts the
 * exact same `CheckoutEngine` component this file does, just from a
 * different entry point with no WordPress page underneath it at all.
 */
export function Checkout() {
	const [ cartToken, setCartToken ] = useState( '' );
	const [ cart, setCart ] = useState< CartResponse | null >( null );
	const [ offerings, setOfferings ] = useState< OfferingSummary[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ hasEnteredCheckout, setHasEnteredCheckout ] = useState( false );
	const [ shippingEstimate, setShippingEstimate ] = useState< ShippingMethod | null >( null );

	useEffect( () => {
		if ( ! vulocartFrontendData.cartCheckoutEnabled ) {
			return;
		}

		const token = getOrCreateCartToken();
		setCartToken( token );

		( vulocartFrontendData.offeringsListingEnabled
			? client.get< OfferingSummary[] >( '/offerings', { params: { per_page: 50 } } )
			: Promise.resolve( { data: [] as OfferingSummary[] } )
		)
			.then( ( offeringsResponse ) => {
				setOfferings( offeringsResponse.data );
				return client.get< CartResponse >( '/cart', { headers: { 'X-Cart-Token': token } } );
			} )
			.then( ( cartResponse ) => setCart( cartResponse.data ) )
			.finally( () => setIsLoading( false ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount only.
	}, [] );

	/**
	 * Shipping Estimation — a real capability, not a stub: the same
	 * `/shipping/methods` endpoint the Shipping step itself later calls
	 * (Shipping\Rest::get_methods(), public, no address required since
	 * this plugin's shipping model is flat-rate — ShippingService's own
	 * docblock), surfaced here on the cart view so a shopper sees what
	 * shipping will roughly cost before committing to checkout at all,
	 * the actual point of "estimate before you commit" rather than a
	 * numbers-matching coincidence.
	 */
	useEffect( () => {
		if ( ! cart || 0 === cart.items.length ) {
			setShippingEstimate( null );
			return;
		}

		client.get< ShippingMethod[] >( '/shipping/methods' ).then( ( response ) => {
			if ( 0 === response.data.length ) {
				return;
			}

			setShippingEstimate( response.data.reduce( ( cheapest, method ) => ( method.cost < cheapest.cost ? method : cheapest ) ) );
		} );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch when the cart's item composition (not e.g. isLoading) changes.
	}, [ cart?.items.length ] );

	const addToCart = ( offeringId: number ) => {
		client
			.post< CartResponse >( '/cart/items', { offering_id: offeringId, quantity: 1 }, { headers: { 'X-Cart-Token': cartToken } } )
			.then( ( response ) => setCart( response.data ) );
	};

	const changeQuantity = ( itemId: number, quantity: number ) => {
		if ( quantity <= 0 ) {
			client
				.delete< CartResponse >( `/cart/items/${ itemId }`, { headers: { 'X-Cart-Token': cartToken } } )
				.then( ( response ) => setCart( response.data ) );
			return;
		}

		client
			.put< CartResponse >( `/cart/items/${ itemId }`, { quantity }, { headers: { 'X-Cart-Token': cartToken } } )
			.then( ( response ) => setCart( response.data ) );
	};

	if ( ! vulocartFrontendData.cartCheckoutEnabled ) {
		return (
			<div className="vulocart-checkout-notice">
				<p>{ __( 'Checkout is temporarily unavailable. Please check back soon.', 'vulocart' ) }</p>
			</div>
		);
	}

	if ( isLoading ) {
		return <p>{ __( 'Loading…', 'vulocart' ) }</p>;
	}

	if ( ! vulocartFrontendData.guestCheckoutEnabled && ! vulocartFrontendData.isLoggedIn ) {
		return (
			<div className="vulocart-checkout-notice">
				<p>{ __( 'Guest checkout is disabled for this store. Please log in to place an order.', 'vulocart' ) }</p>
				<a href="/wp-login.php" style={ { fontWeight: 700 } }>
					{ __( 'Log in', 'vulocart' ) }
				</a>
			</div>
		);
	}

	if ( hasEnteredCheckout ) {
		return (
			<CheckoutEngine
				cartToken={ cartToken }
				cart={ cart }
				mode={ 'single_page' === vulocartFrontendData.checkoutMode ? 'single_page' : 'multi_step' }
				onBackToCart={ () => setHasEnteredCheckout( false ) }
			/>
		);
	}

	return (
		<div className="vulocart-checkout-cart-view">
			{ vulocartFrontendData.offeringsListingEnabled && (
				<div className="vulocart-checkout-offerings">
					<h3>{ __( 'Available Offerings', 'vulocart' ) }</h3>
					{ 0 === offerings.length && <p>{ __( 'No offerings yet.', 'vulocart' ) }</p> }
					{ offerings.map( ( offering ) => (
						<div key={ offering.id } className="vulocart-checkout-offering-row">
							<div>
								<strong>
									{ vulocartFrontendData.offeringsPageUrl ? (
										<a href={ `${ vulocartFrontendData.offeringsPageUrl }?offering=${ offering.id }` }>{ offering.title }</a>
									) : (
										offering.title
									) }
								</strong>
								<div className="vulocart-checkout-offering-price">
									{ null !== offering.price ? `${ offering.price } ${ offering.currency ?? '' }` : __( 'Price not set', 'vulocart' ) }
								</div>
							</div>
							<button type="button" onClick={ () => addToCart( offering.id ) }>
								{ __( 'Add to cart', 'vulocart' ) }
							</button>
						</div>
					) ) }
				</div>
			) }

			<div className="vulocart-checkout-cart">
				<h3>{ __( 'Your Cart', 'vulocart' ) }</h3>

				{ ( ! cart || 0 === cart.items.length ) && <p>{ __( 'Your cart is empty.', 'vulocart' ) }</p> }

				{ cart?.items.map( ( item ) => (
					<div key={ item.id } className="vulocart-checkout-cart-item">
						<span>{ item.title }</span>
						<div className="vulocart-checkout-cart-item-controls">
							<button type="button" onClick={ () => changeQuantity( item.id, item.quantity - 1 ) }>
								−
							</button>
							<span>{ item.quantity }</span>
							<button type="button" onClick={ () => changeQuantity( item.id, item.quantity + 1 ) }>
								+
							</button>
							<span>
								{ item.subtotal } { item.currency }
							</span>
						</div>
					</div>
				) ) }

				{ cart && cart.items.length > 0 && (
					<p className="vulocart-checkout-cart-subtotal">
						{ __( 'Subtotal:', 'vulocart' ) } { cart.totals.total } { cart.totals.currency }
					</p>
				) }

				{ shippingEstimate && (
					<p className="vulocart-checkout-shipping-estimate">
						{ __( 'Estimated shipping:', 'vulocart' ) } { shippingEstimate.cost } { cart?.totals.currency } { ' ' }
						({ shippingEstimate.label })
					</p>
				) }

				<button
					type="button"
					className="vulocart-checkout-continue"
					disabled={ ! cart || 0 === cart.items.length }
					onClick={ () => setHasEnteredCheckout( true ) }
				>
					{ __( 'Continue to Checkout', 'vulocart' ) }
				</button>
			</div>
		</div>
	);
}
