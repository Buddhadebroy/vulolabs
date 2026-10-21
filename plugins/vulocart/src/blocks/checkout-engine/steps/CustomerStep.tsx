/* global vulocartFrontendData */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { client } from '../../shared/cart';
import { registerCheckoutStep } from '../registry';
import { TextField } from '../Field';
import { hasCheckoutField } from '../options';

/**
 * The Customer step - email/name/phone. Prefills from `/customer/me` for
 * a logged-in buyer (Customer module's own guest-first design still lets
 * this fail silently for a guest - see the `.catch()` below). Registered
 * standalone rather than combined with Address (the pre-rewrite wizard's
 * "Customer & Address" step): `vulocart_checkout_steps` reports them as
 * two independent ids, so they render as two independent steps -
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

	const account = vulocartFrontendData.currentUser;
	const isSignedIn = Boolean( account?.email );

	useEffect( () => {
		// The WordPress session is the source of truth for a signed-in shopper: no round trip needed.
		if ( isSignedIn && ! data.customerEmail ) {
			update( { customerEmail: account?.email || '', customerName: account?.name || '' } );
			setHasPrefilled( true );
			return;
		}

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
			{ isSignedIn ? (
				<div className="vulocart-checkout-account">
					<span className="vulocart-checkout-account-avatar" aria-hidden="true">
						{ account?.avatar ? <img src={ account.avatar } alt="" /> : ( account?.name || account?.email || '?' ).charAt( 0 ).toUpperCase() }
					</span>
					<span className="vulocart-checkout-account-who">
						<strong>{ account?.name || account?.email }</strong>
						<small>{ account?.email }</small>
					</span>
					{ account?.logoutUrl && <a href={ account.logoutUrl }>{ __( 'Sign out', 'vulocart' ) }</a> }
				</div>
			) : (
				account?.loginUrl && (
					<p className="vulocart-checkout-login-hint">
						{ __( 'Already have an account?', 'vulocart' ) } <a href={ account.loginUrl }>{ __( 'Log in', 'vulocart' ) }</a>
					</p>
				)
			) }
			<div className="vulocart-checkout-field-group">
				{ ! isSignedIn && <TextField type="email" label={ __( 'Email', 'vulocart' ) } autoComplete="email" value={ email } onChange={ ( value ) => update( { customerEmail: value } ) } /> }
				<div className="vulocart-checkout-field-row">
					{ hasCheckoutField( 'name' ) && <TextField label={ __( 'Name (optional)', 'vulocart' ) } autoComplete="name" value={ name } onChange={ ( value ) => update( { customerName: value } ) } /> }
					{ ( hasCheckoutField( 'phone' ) || vulocartFrontendData.requirePhoneNumber ) && (
						<TextField
							type="tel"
							label={ vulocartFrontendData.requirePhoneNumber ? __( 'Phone', 'vulocart' ) : __( 'Phone (optional)', 'vulocart' ) }
							autoComplete="tel"
							value={ phone }
							onChange={ ( value ) => update( { customerPhone: value } ) }
						/>
					) }
				</div>
			</div>

			{ error && <p className="vulocart-checkout-step-error">{ error }</p> }

			{ 'multi_step' === mode && (
				<div className="vulocart-checkout-step-actions">
					{ ! isFirstStep && (
						<button type="button" className="is-secondary" onClick={ goBack }>
							{ __( 'Back', 'vulocart' ) }
						</button>
					) }
					<button type="button" className="is-primary wp-element-button" onClick={ continueToNext }>
						{ __( 'Continue', 'vulocart' ) }
					</button>
				</div>
			) }
		</div>
	);
}
