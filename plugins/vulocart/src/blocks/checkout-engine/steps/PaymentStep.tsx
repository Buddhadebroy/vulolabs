import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client } from '../../shared/cart';
import { registerCheckoutStep } from '../registry';

interface PaymentMethod {
	id: string;
	label: string;
}

registerCheckoutStep( {
	id: 'payment',
	render( { data, update, mode, goNext, goBack, isFirstStep } ) {
		return <PaymentStepView data={ data } update={ update } mode={ mode } goNext={ goNext } goBack={ goBack } isFirstStep={ isFirstStep } />;
	},
} );

interface Props {
	data: Record< string, unknown >;
	update: ( patch: Record< string, unknown > ) => void;
	mode: 'single_page' | 'multi_step';
	goNext: () => void;
	goBack: () => void;
	isFirstStep: boolean;
}

function PaymentStepView( { data, update, mode, goNext, goBack, isFirstStep }: Props ) {
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
						onChange={ () => update( { selectedPaymentMethod: method.id } ) }
					/>
					{ method.label }
				</label>
			) ) }

			{ 'multi_step' === mode && (
				<div className="vulocart-checkout-step-actions">
					{ ! isFirstStep && (
						<button type="button" onClick={ goBack }>
							{ __( 'Back', 'vulocart' ) }
						</button>
					) }
					<button type="button" className="is-primary" disabled={ methods.length > 0 && ! selected } onClick={ goNext }>
						{ __( 'Continue', 'vulocart' ) }
					</button>
				</div>
			) }
		</div>
	);
}
