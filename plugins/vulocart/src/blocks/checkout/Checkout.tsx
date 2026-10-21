/* global vulocartFrontendData */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client, getOrCreateCartToken } from '../shared/cart';
import type { CartResponse } from '../shared/cart';
import { CheckoutEngine } from '../checkout-engine/CheckoutEngine';
import '../checkout-engine/mount'; // side-effect only - registers Free's 5 interactive steps AND patches window.vulocartCheckoutEngine.mount()/unmount() (see mount.tsx).
import './checkout.scss';

/**
 * The Checkout block: the shopper's cart goes straight into `CheckoutEngine` (`../checkout-engine/`) - contact,
 * address, shipping, payment and review beside a live order summary. Editing quantities and browsing products
 * belong to the Cart and Shop pages, so none of that is repeated here; "Edit cart" in the summary links back.
 *
 * This file owns only what is genuinely block-specific (the unavailable / guest / empty states and mounting into
 * this Gutenberg block's DOM node) and nothing about WHICH steps exist or how they are laid out - that is the
 * engine's job, and it has no idea this block exists. `checkoutMode` (single_page/multi_step) is a plugin setting
 * (`vulocartFrontendData.checkoutMode`); a vulocart-pro delivery mode (Popup/Embedded/Hosted) mounts the exact
 * same `CheckoutEngine` from a different entry point with no WordPress page underneath it at all.
 */
export interface CheckoutBlockSettings {
	/** The layout this block forces; empty follows Settings → Checkout. */
	layout?: string;
	/** The steps this block shows, in order; omit to follow Settings → Checkout. */
	steps?: string[];
	/** The optional fields this block shows; omit to follow Settings → Checkout. */
	fields?: string[];
}

/**
 * The checkout block: loads the shopper's cart and renders the checkout engine with the chosen layout, steps and
 * optional fields.
 */
export function Checkout( { layout, steps, fields }: CheckoutBlockSettings = {} ) {
	const [ cartToken, setCartToken ] = useState( '' );
	const [ cart, setCart ] = useState< CartResponse | null >( null );
	const [ isLoading, setIsLoading ] = useState( true );

	useEffect( () => {
		const token = getOrCreateCartToken();
		setCartToken( token );

		client
			.get< CartResponse >( '/cart', { headers: { 'X-Cart-Token': token } } )
			.then( ( response ) => setCart( response.data ) )
			.finally( () => setIsLoading( false ) );
	}, [] );

	if ( isLoading ) {
		return (
			<div className="vulocart-checkout-loading" aria-busy="true" aria-label={ __( 'Loading checkout…', 'vulocart' ) }>
				<span />
				<span />
				<span />
			</div>
		);
	}

	if ( ! vulocartFrontendData.guestCheckoutEnabled && ! vulocartFrontendData.isLoggedIn ) {
		return (
			<div className="vulocart-checkout-notice">
				<p>{ __( 'Guest checkout is disabled for this store. Please log in to place an order.', 'vulocart' ) }</p>
				<a href="/wp-login.php" className="vulocart-checkout-notice-link">
					{ __( 'Log in', 'vulocart' ) }
				</a>
			</div>
		);
	}

	if ( ! cart || 0 === cart.items.length ) {
		const shopUrl = vulocartFrontendData.shopPageUrl;

		return (
			<div className="vulocart-checkout-empty">
				<h2>{ __( 'Your cart is empty', 'vulocart' ) }</h2>
				<p>{ __( 'Add something to your cart and it will show up here.', 'vulocart' ) }</p>
				{ shopUrl && (
					<a className="wp-element-button" href={ shopUrl }>
						{ __( 'Browse the shop', 'vulocart' ) }
					</a>
				) }
			</div>
		);
	}

	return (
		<CheckoutEngine
			cartToken={ cartToken }
			cart={ cart }
			mode={ 'single_page' === ( layout || vulocartFrontendData.checkoutMode ) ? 'single_page' : 'multi_step' }
			options={ { ...( steps ? { steps } : {} ), ...( fields ? { fields } : {} ) } }
			onBackToCart={ () => {
				if ( vulocartFrontendData.cartPageUrl ) {
					window.location.href = vulocartFrontendData.cartPageUrl;
				}
			} }
		/>
	);
}
