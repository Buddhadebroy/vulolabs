/* global vulocartFrontendData */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { registerCheckoutStep, getCheckoutStepExtensions } from '../registry';
import type { CheckoutStepContext } from '../registry';

export interface AddressFields {
	full_name: string;
	phone: string;
	address_1: string;
	address_2: string;
	city: string;
	state: string;
	postcode: string;
	country: string;
}

export const EMPTY_ADDRESS: AddressFields = {
	full_name: '',
	phone: '',
	address_1: '',
	address_2: '',
	city: '',
	state: '',
	postcode: '',
	country: '',
};

const REQUIRED_ADDRESS_FIELDS: ( keyof AddressFields )[] = [ 'full_name', 'address_1', 'city', 'state', 'postcode', 'country' ];

export function renderAddressFields( value: AddressFields, onChange: ( next: AddressFields ) => void ) {
	return (
		<div className="vulocart-checkout-field-group">
			<input
				type="text"
				placeholder={ __( 'Full name', 'vulocart' ) }
				value={ value.full_name }
				onChange={ ( event ) => onChange( { ...value, full_name: event.target.value } ) }
			/>
			<input
				type="text"
				placeholder={ __( 'Address line 1', 'vulocart' ) }
				value={ value.address_1 }
				onChange={ ( event ) => onChange( { ...value, address_1: event.target.value } ) }
			/>
			<input
				type="text"
				placeholder={ __( 'Address line 2 (optional)', 'vulocart' ) }
				value={ value.address_2 }
				onChange={ ( event ) => onChange( { ...value, address_2: event.target.value } ) }
			/>
			<div className="vulocart-checkout-field-row">
				<input
					type="text"
					placeholder={ __( 'City', 'vulocart' ) }
					value={ value.city }
					onChange={ ( event ) => onChange( { ...value, city: event.target.value } ) }
				/>
				<input
					type="text"
					placeholder={ __( 'State / region', 'vulocart' ) }
					value={ value.state }
					onChange={ ( event ) => onChange( { ...value, state: event.target.value } ) }
				/>
			</div>
			<div className="vulocart-checkout-field-row">
				<input
					type="text"
					placeholder={ __( 'Postcode', 'vulocart' ) }
					value={ value.postcode }
					onChange={ ( event ) => onChange( { ...value, postcode: event.target.value } ) }
				/>
				<input
					type="text"
					placeholder={ __( 'Country', 'vulocart' ) }
					value={ value.country }
					onChange={ ( event ) => onChange( { ...value, country: event.target.value } ) }
				/>
			</div>
		</div>
	);
}

/**
 * The Address step — billing address, optional separate shipping address,
 * and terms acceptance (grouped here rather than a 7th registered step:
 * it's a single checkbox gating "may I proceed", not independently
 * pluggable content in its own right).
 */
registerCheckoutStep( {
	id: 'address',
	render( context ) {
		return <AddressStepView { ...context } />;
	},
} );

type Props = CheckoutStepContext;

function AddressStepView( props: Props ) {
	const { data, update, mode, goNext, goBack, isFirstStep } = props;
	const [ error, setError ] = useState< string | null >( null );

	const billing = ( data.billingAddress as AddressFields ) || EMPTY_ADDRESS;
	const shippingSameAsBilling = false !== data.shippingSameAsBilling;
	const shipping = ( data.shippingAddress as AddressFields ) || EMPTY_ADDRESS;
	const termsAccepted = Boolean( data.termsAccepted );

	const continueToNext = () => {
		for ( const field of REQUIRED_ADDRESS_FIELDS ) {
			if ( ! billing[ field ] ) {
				setError( __( 'Please complete your billing address.', 'vulocart' ) );
				return;
			}
		}

		if ( ! shippingSameAsBilling ) {
			for ( const field of REQUIRED_ADDRESS_FIELDS ) {
				if ( ! shipping[ field ] ) {
					setError( __( 'Please complete your shipping address.', 'vulocart' ) );
					return;
				}
			}
		}

		if ( vulocartFrontendData.requireTermsAcceptance && ! termsAccepted ) {
			setError( __( 'Please accept the terms & conditions.', 'vulocart' ) );
			return;
		}

		setError( null );
		goNext();
	};

	return (
		<div className="vulocart-checkout-step vulocart-checkout-step-address">
			<h4>{ __( 'Billing address', 'vulocart' ) }</h4>
			{ /* Address Autocomplete (vulocart-pro) injects a lookup field here — registerCheckoutStepExtension()'s own docblock in registry.ts. */ }
			{ getCheckoutStepExtensions( 'address' ).map( ( extension, index ) => (
				<div key={ index } className="vulocart-checkout-step-extension">
					{ extension( props ) }
				</div>
			) ) }
			{ renderAddressFields( billing, ( next ) => update( { billingAddress: next } ) ) }

			<label className="vulocart-checkout-checkbox-row">
				<input
					type="checkbox"
					checked={ shippingSameAsBilling }
					onChange={ ( event ) => update( { shippingSameAsBilling: event.target.checked } ) }
				/>
				{ __( 'Shipping address is the same as billing', 'vulocart' ) }
			</label>

			{ ! shippingSameAsBilling && (
				<>
					<h4>{ __( 'Shipping address', 'vulocart' ) }</h4>
					{ renderAddressFields( shipping, ( next ) => update( { shippingAddress: next } ) ) }
				</>
			) }

			{ vulocartFrontendData.requireTermsAcceptance && (
				<label className="vulocart-checkout-checkbox-row">
					<input
						type="checkbox"
						checked={ termsAccepted }
						onChange={ ( event ) => update( { termsAccepted: event.target.checked } ) }
					/>
					{ vulocartFrontendData.checkoutTermsUrl ? (
						<span>
							{ __( 'I agree to the', 'vulocart' ) }{ ' ' }
							<a href={ vulocartFrontendData.checkoutTermsUrl } target="_blank" rel="noreferrer">
								{ __( 'terms & conditions', 'vulocart' ) }
							</a>
						</span>
					) : (
						<span>{ __( 'I agree to the terms & conditions', 'vulocart' ) }</span>
					) }
				</label>
			) }

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
