import { request } from '../client';
import { clear, formatMoney, h } from '../dom';
import { clearStoredCartToken } from '../cart';
import type { AddressFields, Cart, Order, ShippingMethod } from '../types';

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

export interface EmbeddedCheckoutOptions {
	cartToken: string;
	onOrderPlaced?: ( order: Order ) => void;
	onBack?: () => void;
}

const EMPTY_ADDRESS: AddressFields = {
	full_name: '',
	address_1: '',
	city: '',
	state: '',
	postcode: '',
	country: '',
};

/**
 * A genuinely self-contained checkout flow — deliberately NOT the same
 * code as the WordPress-only `checkout-engine` (vulocart's own
 * `src/blocks/checkout-engine`), which depends on `@wordpress/element`
 * (the `wp.element` global) and only ever runs on a page this WordPress
 * site itself rendered. This one has no framework dependency at all —
 * plain DOM (`dom.ts`'s own `h()` helper) — because it has to run on a
 * page that might have nothing else loaded (plain HTML, a `<script>` tag
 * dropped into an arbitrary site). Both call the SAME REST endpoints
 * underneath (`/shipping/methods`, `/payment/methods`, `/review/summary`,
 * `/orders`) — this is a second, minimal presentation layer over
 * identical server-side logic, not a second checkout implementation.
 *
 * One screen, not multi-step — address + shipping + payment all visible
 * at once, "Place order" at the bottom. A merchant wanting the full
 * multi-step wizard experience embeds the `vulocart/checkout` Gutenberg
 * block instead; this widget's whole reason to exist is running
 * somewhere that block CAN'T (Module.php's own docblock on
 * EmbeddedCheckout's WP-only scope boundary, which THIS widget is what
 * finally closes — genuinely cross-domain, not same-site-only).
 */
export function mountEmbeddedCheckout( container: HTMLElement, options: EmbeddedCheckoutOptions ): () => void {
	const { cartToken, onOrderPlaced, onBack } = options;

	let destroyed = false;
	let cart: Cart | null = null;
	let shippingMethods: ShippingMethod[] = [];
	let paymentMethods: PaymentMethod[] = [];
	let summary: ReviewSummary | null = null;

	const billing: AddressFields = { ...EMPTY_ADDRESS };
	let selectedShipping = '';
	let selectedPayment = '';
	let error: string | null = null;
	let placing = false;

	container.classList.add( 'vulocart-sdk-embedded-checkout' );

	function refreshSummary() {
		if ( ! selectedShipping || ! selectedPayment ) {
			summary = null;
			render();
			return;
		}

		request< ReviewSummary >(
			'POST',
			'/review/summary',
			{
				billing_address: billing,
				shipping_address: billing,
				shipping_method: selectedShipping,
				payment_method: selectedPayment,
			},
			{ 'X-Cart-Token': cartToken }
		)
			.then( ( response ) => {
				summary = response;
				render();
			} )
			.catch( () => undefined );
	}

	async function placeOrder() {
		for ( const field of [ 'full_name', 'address_1', 'city', 'state', 'postcode', 'country' ] as const ) {
			if ( ! billing[ field ] ) {
				error = 'Please complete your billing address.';
				render();
				return;
			}
		}

		if ( ! selectedShipping || ! selectedPayment ) {
			error = 'Please choose a shipping and payment method.';
			render();
			return;
		}

		placing = true;
		error = null;
		render();

		try {
			const order = await request< Order >( 'POST', '/orders', {
				cart_token: cartToken,
				customer_email: ( container.querySelector( '[data-field="email"]' ) as HTMLInputElement )?.value ?? '',
				customer_name: billing.full_name,
				billing_address: billing,
				shipping_address: billing,
				shipping_method: selectedShipping,
				payment_method: selectedPayment,
			} );

			clearStoredCartToken();
			renderConfirmation( order );
			onOrderPlaced?.( order );
		} catch ( err ) {
			error = err instanceof Error ? err.message : 'Could not place order.';
			placing = false;
			render();
		}
	}

	function renderConfirmation( order: Order ) {
		if ( destroyed ) {
			return;
		}

		clear( container );
		container.append(
			h( 'div', { class: 'vulocart-sdk-confirmation' }, [
				h( 'h3', {}, [ 'Order placed!' ] ),
				h( 'p', {}, [ `Order ${ order.order_number } — ${ formatMoney( order.total, order.currency ) }` ] ),
			] )
		);
	}

	function render() {
		if ( destroyed || ! cart ) {
			return;
		}

		clear( container );

		const fields: [ keyof AddressFields, string ][] = [
			[ 'full_name', 'Full name' ],
			[ 'address_1', 'Address' ],
			[ 'city', 'City' ],
			[ 'state', 'State / region' ],
			[ 'postcode', 'Postcode' ],
			[ 'country', 'Country' ],
		];

		const addressInputs = fields.map( ( [ field, placeholder ] ) => {
			const input = h( 'input', { type: 'text', placeholder, value: billing[ field ] || '' } );
			input.addEventListener( 'input', () => {
				billing[ field ] = ( input as HTMLInputElement ).value;
			} );
			return input;
		} );

		const emailInput = h( 'input', { type: 'email', placeholder: 'Email', 'data-field': 'email' } );

		const shippingSelect = h( 'select', {} );
		shippingSelect.append( h( 'option', { value: '' }, [ 'Select shipping…' ] ) );
		for ( const method of shippingMethods ) {
			shippingSelect.append( h( 'option', { value: method.id }, [ `${ method.label } — ${ formatMoney( method.cost, cart.currency ) }` ] ) );
		}
		shippingSelect.addEventListener( 'change', () => {
			selectedShipping = ( shippingSelect as HTMLSelectElement ).value;
			refreshSummary();
		} );

		const paymentSelect = h( 'select', {} );
		paymentSelect.append( h( 'option', { value: '' }, [ 'Select payment…' ] ) );
		for ( const method of paymentMethods ) {
			paymentSelect.append( h( 'option', { value: method.id }, [ method.label ] ) );
		}
		paymentSelect.addEventListener( 'change', () => {
			selectedPayment = ( paymentSelect as HTMLSelectElement ).value;
			refreshSummary();
		} );

		const placeOrderButton = h( 'button', { type: 'button', class: 'vulocart-sdk-place-order' }, [ placing ? 'Placing order…' : 'Place order' ] );
		( placeOrderButton as HTMLButtonElement ).disabled = placing;
		placeOrderButton.addEventListener( 'click', () => void placeOrder() );

		const children: ( Node | string )[] = [
			h( 'h4', {}, [ 'Contact' ] ),
			emailInput,
			h( 'h4', {}, [ 'Billing address' ] ),
			...addressInputs,
			h( 'h4', {}, [ 'Shipping' ] ),
			shippingSelect,
			h( 'h4', {}, [ 'Payment' ] ),
			paymentSelect,
		];

		if ( summary ) {
			children.push(
				h( 'div', { class: 'vulocart-sdk-summary' }, [
					h( 'div', {}, [ `Subtotal: ${ formatMoney( summary.subtotal, summary.currency ) }` ] ),
					h( 'div', {}, [ `Shipping: ${ formatMoney( summary.shipping_cost, summary.currency ) }` ] ),
					h( 'div', {}, [ `Tax: ${ formatMoney( summary.tax_amount, summary.currency ) }` ] ),
					h( 'div', { class: 'vulocart-sdk-summary-total' }, [ `Total: ${ formatMoney( summary.total, summary.currency ) }` ] ),
				] )
			);
		}

		if ( error ) {
			children.push( h( 'p', { class: 'vulocart-sdk-error' }, [ error ] ) );
		}

		children.push( placeOrderButton );

		if ( onBack ) {
			const backButton = h( 'button', { type: 'button', class: 'vulocart-sdk-back' }, [ 'Back' ] );
			backButton.addEventListener( 'click', onBack );
			children.push( backButton );
		}

		container.append( h( 'div', { class: 'vulocart-sdk-checkout-form' }, children ) );
	}

	Promise.all( [
		request< Cart >( 'GET', '/cart', undefined, { 'X-Cart-Token': cartToken } ),
		request< ShippingMethod[] >( 'GET', '/shipping/methods' ),
		request< PaymentMethod[] >( 'GET', '/payment/methods' ),
	] )
		.then( ( [ cartResponse, shippingResponse, paymentResponse ] ) => {
			cart = cartResponse;
			shippingMethods = shippingResponse;
			paymentMethods = paymentResponse;
			render();
		} )
		.catch( ( err ) => {
			if ( destroyed ) {
				return;
			}
			clear( container );
			container.append( h( 'p', { class: 'vulocart-sdk-error' }, [ err instanceof Error ? err.message : 'Could not load checkout.' ] ) );
		} );

	return () => {
		destroyed = true;
		clear( container );
	};
}
