/* global vulocartFrontendData */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { registerCheckoutStep } from '../registry';
import { formatMoney } from '../../shared/money';

interface OrderConfirmation {
	order_number: string;
	access_token: string;
	total: number;
	currency: string | null;
}

function CopyToken( { token }: { token: string } ) {
	const [ copied, setCopied ] = useState( false );

	return (
		<button
			type="button"
			className="vulocart-checkout-copy"
			onClick={ () => {
				window.navigator.clipboard?.writeText( token ).then( () => {
					setCopied( true );
					window.setTimeout( () => setCopied( false ), 2000 );
				} );
			} }
		>
			{ copied ? __( 'Copied', 'vulocart' ) : __( 'Copy', 'vulocart' ) }
		</button>
	);
}

/**
 * The terminal "thank you" step - CheckoutEngine.tsx sets `data.confirmation`
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
			<div className="vulocart-checkout-confirmation" role="status">
				<span className="vulocart-checkout-confirmation-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
						<path d="m5 12.5 4.5 4.5L19 7.5" />
					</svg>
				</span>
				<h3>{ __( 'Thank you - your order is in!', 'vulocart' ) }</h3>
				<p className="vulocart-checkout-confirmation-lede">{ __( 'We\'ve received your order and will email you the details shortly.', 'vulocart' ) }</p>
				<dl className="vulocart-checkout-confirmation-facts">
					<div>
						<dt>{ __( 'Order number', 'vulocart' ) }</dt>
						<dd>{ confirmation.order_number }</dd>
					</div>
					<div>
						<dt>{ __( 'Total', 'vulocart' ) }</dt>
						<dd>{ formatMoney( confirmation.total, confirmation.currency ) }</dd>
					</div>
				</dl>
				<div className="vulocart-checkout-confirmation-token">
					<span>{ __( 'Keep this access token to check your order status later:', 'vulocart' ) }</span>
					<span className="vulocart-checkout-confirmation-code">
						<code>{ confirmation.access_token }</code>
						<CopyToken token={ confirmation.access_token } />
					</span>
				</div>
				{ ( vulocartFrontendData.shopPageUrl || vulocartFrontendData.productsPageUrl ) && (
					<a className="vulocart-checkout-confirmation-continue" href={ vulocartFrontendData.shopPageUrl || vulocartFrontendData.productsPageUrl || '#' }>
						{ __( 'Continue shopping', 'vulocart' ) }
					</a>
				) }
			</div>
		);
	},
} );
