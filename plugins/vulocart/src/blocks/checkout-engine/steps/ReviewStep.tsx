import { countryName } from '../../shared/geo';
import { __ } from '@wordpress/i18n';
import { registerCheckoutStep, getCheckoutStepExtensions, isPaymentMethodReady } from '../registry';
import type { CheckoutStepContext } from '../registry';
import { formatMoney } from '../../shared/money';
import type { AddressFields } from './AddressStep';
import { EMPTY_ADDRESS } from './AddressStep';

registerCheckoutStep( {
	id: 'review',
	render( context ) {
		return <ReviewStepView { ...context } />;
	},
} );

type Props = CheckoutStepContext;

/**
 * The Review step - always the checkout run's final interactive step
 * (`vulocart_checkout_steps`' own `order: 50`, just under Confirmation's
 * `100`), in both single-page and multi-step mode: "Place Order" only
 * ever fires once, from here, regardless of layout.
 *
 * The items and the price breakdown live in the order summary beside the steps (the engine keeps that current),
 * so this step is the last look at where the order goes, the room for vulocart-pro's extras (order notes,
 * coupon, gift card) and the button that places it.
 */
function ReviewStepView( props: Props ) {
	const { data, summary, mode, goBack, isFirstStep, onPlaceOrder } = props;

	const billing = ( data.billingAddress as AddressFields ) || EMPTY_ADDRESS;
	const shippingSameAsBilling = false !== data.shippingSameAsBilling;
	const shipping = shippingSameAsBilling ? billing : ( data.shippingAddress as AddressFields ) || EMPTY_ADDRESS;
	const destination = [ shipping.full_name, shipping.address_1, shipping.city, countryName( shipping.country ) ].filter( Boolean ).join( ', ' );

	return (
		<div className="vulocart-checkout-step vulocart-checkout-step-review">
			<dl className="vulocart-checkout-review-recap">
				{ ( data.customerEmail as string ) && (
					<div>
						<dt>{ __( 'Contact', 'vulocart' ) }</dt>
						<dd>{ data.customerEmail as string }</dd>
					</div>
				) }
				{ destination && (
					<div>
						<dt>{ __( 'Ship to', 'vulocart' ) }</dt>
						<dd>{ destination }</dd>
					</div>
				) }
			</dl>

			{ /* Order Notes/Coupons/Gift Cards (vulocart-pro) inject here - registerCheckoutStepExtension()'s own docblock in registry.ts. */ }
			{ getCheckoutStepExtensions( 'review' ).map( ( extension, index ) => (
				<div key={ index } className="vulocart-checkout-step-extension">
					{ extension( props ) }
				</div>
			) ) }

			<div className="vulocart-checkout-step-actions">
				{ 'multi_step' === mode && ! isFirstStep && (
					<button type="button" className="is-secondary" onClick={ goBack }>
						{ __( 'Back', 'vulocart' ) }
					</button>
				) }
				<button
					type="button"
					className="is-primary wp-element-button"
					disabled={ ! summary || ! isPaymentMethodReady( ( data.selectedPaymentMethod as string ) || '', data ) }
					onClick={ onPlaceOrder }
				>
					{ summary ? `${ __( 'Place order', 'vulocart' )} · ${ formatMoney( summary.total, summary.currency ) }` : __( 'Place order', 'vulocart' ) }
				</button>
			</div>
		</div>
	);
}
