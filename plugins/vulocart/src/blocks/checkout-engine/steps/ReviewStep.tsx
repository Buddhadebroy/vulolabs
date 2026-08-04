import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client } from '../../shared/cart';
import { registerCheckoutStep, getCheckoutStepExtensions, isPaymentMethodReady } from '../registry';
import type { CheckoutStepContext } from '../registry';
import type { AddressFields } from './AddressStep';
import { EMPTY_ADDRESS } from './AddressStep';

interface ReviewSummary {
	currency: string | null;
	items: { title: string; quantity: number; subtotal: number; currency: string | null }[];
	shipping_method: string | null;
	shipping_cost: number;
	payment_method: string | null;
	subtotal: number;
	tax_amount: number;
	total: number;
}

registerCheckoutStep( {
	id: 'review',
	render( context ) {
		return <ReviewStepView { ...context } />;
	},
} );

type Props = CheckoutStepContext;

/**
 * The Review step — always the checkout run's final interactive step
 * (`vulocart_checkout_steps`' own `order: 50`, just under Confirmation's
 * `100`), in both single-page and multi-step mode: "Place Order" only
 * ever fires once, from here, regardless of layout.
 */
function ReviewStepView( props: Props ) {
	const { cartToken, data, mode, goBack, isFirstStep, onPlaceOrder } = props;
	const [ summary, setSummary ] = useState< ReviewSummary | null >( null );

	const billing = ( data.billingAddress as AddressFields ) || EMPTY_ADDRESS;
	const shippingSameAsBilling = false !== data.shippingSameAsBilling;
	const shipping = shippingSameAsBilling ? billing : ( data.shippingAddress as AddressFields ) || EMPTY_ADDRESS;

	useEffect( () => {
		client
			.post< ReviewSummary >(
				'/review/summary',
				{
					billing_address: billing,
					shipping_address: shipping,
					shipping_method: data.selectedShippingMethod,
					payment_method: data.selectedPaymentMethod,
				},
				{ headers: { 'X-Cart-Token': cartToken } }
			)
			.then( ( response ) => setSummary( response.data ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- recompute only when the fields feeding the summary actually change.
	}, [ data.selectedShippingMethod, data.selectedPaymentMethod, data.shippingSameAsBilling ] );

	return (
		<div className="vulocart-checkout-step vulocart-checkout-step-review">
			{ ! summary && <p>{ __( 'Loading…', 'vulocart' ) }</p> }

			{ summary && (
				<>
					{ summary.items.map( ( item, index ) => (
						<div key={ index } className="vulocart-checkout-review-line">
							<span>
								{ item.title } x{ item.quantity }
							</span>
							<span>
								{ item.subtotal } { item.currency }
							</span>
						</div>
					) ) }

					<p className="vulocart-checkout-review-meta">
						{ __( 'Shipping to:', 'vulocart' ) } { shipping.address_1 }, { shipping.city }
					</p>

					<div className="vulocart-checkout-review-totals">
						<div className="vulocart-checkout-review-line">
							<span>{ __( 'Subtotal', 'vulocart' ) }</span>
							<span>
								{ summary.subtotal } { summary.currency }
							</span>
						</div>
						<div className="vulocart-checkout-review-line">
							<span>{ __( 'Shipping', 'vulocart' ) }</span>
							<span>
								{ summary.shipping_cost } { summary.currency }
							</span>
						</div>
						{ summary.tax_amount > 0 && (
							<div className="vulocart-checkout-review-line">
								<span>{ __( 'Tax', 'vulocart' ) }</span>
								<span>
									{ summary.tax_amount } { summary.currency }
								</span>
							</div>
						) }
						<div className="vulocart-checkout-review-line vulocart-checkout-review-total">
							<span>{ __( 'Total', 'vulocart' ) }</span>
							<span>
								{ summary.total } { summary.currency }
							</span>
						</div>
					</div>
				</>
			) }

			{ /* Order Notes/Coupons/Gift Cards (vulocart-pro) inject here — registerCheckoutStepExtension()'s own docblock in registry.ts. */ }
			{ getCheckoutStepExtensions( 'review' ).map( ( extension, index ) => (
				<div key={ index } className="vulocart-checkout-step-extension">
					{ extension( props ) }
				</div>
			) ) }

			<div className="vulocart-checkout-step-actions">
				{ 'multi_step' === mode && ! isFirstStep && (
					<button type="button" onClick={ goBack }>
						{ __( 'Back', 'vulocart' ) }
					</button>
				) }
				<button
					type="button"
					className="is-primary"
					disabled={ ! summary || ! isPaymentMethodReady( ( data.selectedPaymentMethod as string ) || '', data ) }
					onClick={ onPlaceOrder }
				>
					{ __( 'Place Order', 'vulocart' ) }
				</button>
			</div>
		</div>
	);
}
