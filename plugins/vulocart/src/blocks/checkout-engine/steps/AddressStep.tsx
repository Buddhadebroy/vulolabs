/* global vulocartFrontendData */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { registerCheckoutStep, getCheckoutStepExtensions } from '../registry';
import type { CheckoutStepContext } from '../registry';
import { getCountries, getStates } from '../../shared/geo';
import { SelectField, TextField } from '../Field';
import { hasCheckoutField } from '../options';

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

/**
 * Renders the shared address form fields (country, state, city, postal code and so on) for either the billing or the
 * shipping address.
 */
export function renderAddressFields( value: AddressFields, onChange: ( next: AddressFields ) => void ) {
	const states = getStates( value.country );

	return (
		<div className="vulocart-checkout-field-group">
			<SelectField
				label={ __( 'Country / region', 'vulocart' ) }
				autoComplete="country"
				value={ value.country }
				// Changing country invalidates the region, so clear it.
				onChange={ ( country ) => onChange( { ...value, country, state: '' } ) }
			>
				<option value="">{ __( 'Select a country…', 'vulocart' ) }</option>
				{ getCountries().map( ( country ) => (
					<option key={ country.value } value={ country.value }>
						{ country.label }
					</option>
				) ) }
			</SelectField>
			<TextField label={ __( 'Full name', 'vulocart' ) } autoComplete="name" value={ value.full_name } onChange={ ( full_name ) => onChange( { ...value, full_name } ) } />
			<TextField label={ __( 'Address', 'vulocart' ) } autoComplete="address-line1" value={ value.address_1 } onChange={ ( address_1 ) => onChange( { ...value, address_1 } ) } />
			{ hasCheckoutField( 'address_2' ) && <TextField label={ __( 'Apartment, suite, etc. (optional)', 'vulocart' ) } autoComplete="address-line2" value={ value.address_2 } onChange={ ( address_2 ) => onChange( { ...value, address_2 } ) } /> }
			<div className="vulocart-checkout-field-row is-thirds">
				<TextField label={ __( 'City', 'vulocart' ) } autoComplete="address-level2" value={ value.city } onChange={ ( city ) => onChange( { ...value, city } ) } />
				{ states ? (
					<SelectField label={ __( 'State / region', 'vulocart' ) } autoComplete="address-level1" value={ value.state } onChange={ ( state ) => onChange( { ...value, state } ) }>
						<option value="" />
						{ states.map( ( state ) => (
							<option key={ state.value } value={ state.value }>
								{ state.label }
							</option>
						) ) }
					</SelectField>
				) : (
					<TextField label={ __( 'State / region', 'vulocart' ) } autoComplete="address-level1" value={ value.state } onChange={ ( state ) => onChange( { ...value, state } ) } />
				) }
				<TextField label={ __( 'Postcode', 'vulocart' ) } autoComplete="postal-code" value={ value.postcode } onChange={ ( postcode ) => onChange( { ...value, postcode } ) } />
			</div>
		</div>
	);
}

/**
 * The Address step - billing address, optional separate shipping address,
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

/**
 * Address step: collects the billing address and, when needed, a separate shipping address, and validates them before
 * continuing.
 */
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
			{ /* Address Autocomplete (vulocart-pro) injects a lookup field here - registerCheckoutStepExtension()'s own docblock in registry.ts. */ }
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
