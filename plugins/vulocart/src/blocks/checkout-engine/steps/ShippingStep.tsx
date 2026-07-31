import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client } from '../../shared/cart';
import { registerCheckoutStep } from '../registry';

interface ShippingMethod {
	id: string;
	label: string;
	cost: number;
}

registerCheckoutStep( {
	id: 'shipping',
	render( { data, update, cart, mode, goNext, goBack, isFirstStep } ) {
		return (
			<ShippingStepView
				data={ data }
				update={ update }
				currency={ cart?.totals.currency ?? null }
				mode={ mode }
				goNext={ goNext }
				goBack={ goBack }
				isFirstStep={ isFirstStep }
			/>
		);
	},
} );

interface Props {
	data: Record< string, unknown >;
	update: ( patch: Record< string, unknown > ) => void;
	currency: string | null;
	mode: 'single_page' | 'multi_step';
	goNext: () => void;
	goBack: () => void;
	isFirstStep: boolean;
}

function ShippingStepView( { data, update, currency, mode, goNext, goBack, isFirstStep }: Props ) {
	const [ methods, setMethods ] = useState< ShippingMethod[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );

	const selected = ( data.selectedShippingMethod as string ) || '';

	useEffect( () => {
		client
			.get< ShippingMethod[] >( '/shipping/methods' )
			.then( ( response ) => {
				setMethods( response.data );

				if ( response.data.length > 0 && ! selected ) {
					update( { selectedShippingMethod: response.data[ 0 ].id } );
				}
			} )
			.finally( () => setIsLoading( false ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount only.
	}, [] );

	return (
		<div className="vulocart-checkout-step vulocart-checkout-step-shipping">
			{ isLoading && <p>{ __( 'Loading shipping methods…', 'vulocart' ) }</p> }

			{ ! isLoading && 0 === methods.length && <p>{ __( 'No shipping methods are currently available.', 'vulocart' ) }</p> }

			{ methods.map( ( method ) => (
				<label key={ method.id } className="vulocart-checkout-option-row">
					<span>
						<input
							type="radio"
							name="shipping_method"
							checked={ selected === method.id }
							onChange={ () => update( { selectedShippingMethod: method.id } ) }
						/>
						{ method.label }
					</span>
					<span>
						{ method.cost } { currency }
					</span>
				</label>
			) ) }

			{ 'multi_step' === mode && (
				<div className="vulocart-checkout-step-actions">
					{ ! isFirstStep && (
						<button type="button" onClick={ goBack }>
							{ __( 'Back', 'vulocart' ) }
						</button>
					) }
					<button type="button" className="is-primary" disabled={ ! selected } onClick={ goNext }>
						{ __( 'Continue', 'vulocart' ) }
					</button>
				</div>
			) }
		</div>
	);
}
