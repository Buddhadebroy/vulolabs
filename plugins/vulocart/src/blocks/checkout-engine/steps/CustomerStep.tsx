/* global vulocartFrontendData */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client } from '../../shared/cart';
import { registerCheckoutStep } from '../registry';

/**
 * The Customer step — email/name/phone. Prefills from `/customer/me` for
 * a logged-in buyer (Customer module's own guest-first design still lets
 * this fail silently for a guest — see the `.catch()` below). Registered
 * standalone rather than combined with Address (the pre-rewrite wizard's
 * "Customer & Address" step): `vulocart_checkout_steps` reports them as
 * two independent ids, so they render as two independent steps —
 * pluggable means genuinely separable, not a hardcoded pairing.
 */
registerCheckoutStep( {
	id: 'customer',
	render( { data, update, mode, goNext, goBack, isFirstStep } ) {
		return <CustomerStepView data={ data } update={ update } mode={ mode } goNext={ goNext } goBack={ goBack } isFirstStep={ isFirstStep } />;
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

function CustomerStepView( { data, update, mode, goNext, goBack, isFirstStep }: Props ) {
	const [ error, setError ] = useState< string | null >( null );
	const [ hasPrefilled, setHasPrefilled ] = useState( false );

	useEffect( () => {
		if ( hasPrefilled || data.customerEmail ) {
			setHasPrefilled( true );
			return;
		}

		client
			.get( '/customer/me' )
			.then( ( response ) => {
				if ( response.data ) {
					update( {
						customerEmail: response.data.email || '',
						customerName: response.data.name || '',
						customerPhone: response.data.phone || '',
					} );
				}
			} )
			.catch( () => undefined )
			.finally( () => setHasPrefilled( true ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount only.
	}, [] );

	const email = ( data.customerEmail as string ) || '';
	const name = ( data.customerName as string ) || '';
	const phone = ( data.customerPhone as string ) || '';

	const continueToNext = () => {
		if ( ! email ) {
			setError( __( 'Email is required.', 'vulocart' ) );
			return;
		}

		if ( vulocartFrontendData.requirePhoneNumber && ! phone ) {
			setError( __( 'Phone number is required.', 'vulocart' ) );
			return;
		}

		setError( null );
		goNext();
	};

	return (
		<div className="vulocart-checkout-step vulocart-checkout-step-customer">
			<div className="vulocart-checkout-field-group">
				<input
					type="email"
					placeholder={ __( 'Email', 'vulocart' ) }
					value={ email }
					onChange={ ( event ) => update( { customerEmail: event.target.value } ) }
				/>
				<input
					type="text"
					placeholder={ __( 'Name (optional)', 'vulocart' ) }
					value={ name }
					onChange={ ( event ) => update( { customerName: event.target.value } ) }
				/>
				<input
					type="tel"
					placeholder={
						vulocartFrontendData.requirePhoneNumber
							? __( 'Phone number', 'vulocart' )
							: __( 'Phone number (optional)', 'vulocart' )
					}
					value={ phone }
					onChange={ ( event ) => update( { customerPhone: event.target.value } ) }
				/>
			</div>

			{ error && <p className="vulocart-checkout-step-error">{ error }</p> }

			{ 'multi_step' === mode && (
				<div className="vulocart-checkout-step-actions">
					{ ! isFirstStep && (
						<button type="button" onClick={ goBack }>
							{ __( 'Back', 'vulocart' ) }
						</button>
					) }
					<button type="button" className="is-primary" onClick={ continueToNext }>
						{ __( 'Continue', 'vulocart' ) }
					</button>
				</div>
			) }
		</div>
	);
}
