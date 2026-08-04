import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client } from '../../shared/cart';
import { registerCheckoutStep, getPaymentMethodRenderer, isPaymentMethodReady } from '../registry';
import type { CheckoutStepContext } from '../registry';

interface PaymentMethod {
	id: string;
	label: string;
	supports_recurring: boolean;
}

registerCheckoutStep( {
	id: 'payment',
	render( context ) {
		return <PaymentStepView { ...context } />;
	},
} );

type Props = CheckoutStepContext;

function PaymentStepView( props: Props ) {
	const { data, update, mode, goNext, goBack, isFirstStep } = props;
	const [ methods, setMethods ] = useState< PaymentMethod[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );

	const selected = ( data.selectedPaymentMethod as string ) || '';

	useEffect( () => {
		client
			.get< PaymentMethod[] >( '/payment/methods' )
			.then( ( response ) => {
				setMethods( response.data );

				if ( response.data.length > 0 && ! selected ) {
					update( { selectedPaymentMethod: response.data[ 0 ].id } );
				}
			} )
			.finally( () => setIsLoading( false ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount only.
	}, [] );

	// A gateway with its own storefront widget (vulocart-pro's Stripe/
	// PayPal/Razorpay) registers a renderer keyed by its method id — once
	// picked, that widget takes over confirming payment, in place of this
	// step's own generic "Continue" button. Switching away from that
	// method clears any half-confirmed intent from a previous selection.
	const selectedRenderer = selected ? getPaymentMethodRenderer( selected ) : undefined;
	const ready = selected ? isPaymentMethodReady( selected, data ) : false;

	const onSelect = ( methodId: string ) => {
		if ( methodId !== selected ) {
			update( { selectedPaymentMethod: methodId, paymentIntentId: undefined } );
		}
	};

	return (
		<div className="vulocart-checkout-step vulocart-checkout-step-payment">
			{ isLoading && <p>{ __( 'Loading payment methods…', 'vulocart' ) }</p> }

			{ ! isLoading && 0 === methods.length && <p>{ __( 'No payment methods are currently available.', 'vulocart' ) }</p> }

			{ methods.map( ( method ) => (
				<label key={ method.id } className="vulocart-checkout-option-row vulocart-checkout-option-row-block">
					<input
						type="radio"
						name="payment_method"
						checked={ selected === method.id }
						onChange={ () => onSelect( method.id ) }
					/>
					{ method.label }
				</label>
			) ) }

			{ selectedRenderer && (
				<div className="vulocart-checkout-payment-widget">
					{ selectedRenderer( props ) }
				</div>
			) }

			{ 'multi_step' === mode && (
				<div className="vulocart-checkout-step-actions">
					{ ! isFirstStep && (
						<button type="button" onClick={ goBack }>
							{ __( 'Back', 'vulocart' ) }
						</button>
					) }
					{ ! selectedRenderer && (
						<button type="button" className="is-primary" disabled={ methods.length > 0 && ! selected } onClick={ goNext }>
							{ __( 'Continue', 'vulocart' ) }
						</button>
					) }
					{ selectedRenderer && ready && (
						<button type="button" className="is-primary" onClick={ goNext }>
							{ __( 'Continue', 'vulocart' ) }
						</button>
					) }
				</div>
			) }
		</div>
	);
}
