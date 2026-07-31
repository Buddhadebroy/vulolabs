import { __ } from '@wordpress/i18n';
import { registerCheckoutStep } from '../registry';

interface OrderConfirmation {
	order_number: string;
	access_token: string;
	total: number;
	currency: string | null;
}

/**
 * The terminal "thank you" step — CheckoutEngine.tsx sets `data.confirmation`
 * once `POST /orders` succeeds and always renders this step alone (not
 * stacked with the others, even in single-page mode) once that happens.
 */
registerCheckoutStep( {
	id: 'confirmation',
	render( { data } ) {
		const confirmation = data.confirmation as OrderConfirmation | undefined;

		if ( ! confirmation ) {
			return null;
		}

		return (
			<div className="vulocart-checkout-confirmation">
				<h3>{ __( 'Thank you — your order is in!', 'vulocart' ) }</h3>
				<p>
					{ __( 'Order number:', 'vulocart' ) } <strong>{ confirmation.order_number }</strong>
				</p>
				<p>
					{ __( 'Total:', 'vulocart' ) } { confirmation.total } { confirmation.currency }
				</p>
				<p className="vulocart-checkout-confirmation-token">
					{ __( 'Save this access token to check your order status later:', 'vulocart' ) } <code>{ confirmation.access_token }</code>
				</p>
			</div>
		);
	},
} );
