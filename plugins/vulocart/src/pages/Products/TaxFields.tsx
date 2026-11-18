/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import axios from 'axios';
import { FormGroupComponent } from '@zyra/components';
import { CollapsibleCard } from './CollapsibleCard';
import { SelectInput, TextInput } from '@zyra/inputs';

interface TaxClass {
	slug: string;
	name: string;
}

interface Props {
	status: string;
	taxClass: string;
	taxCode: string;
	onChange: ( patch: { taxStatus?: string; taxClass?: string; taxCode?: string } ) => void;
}

/**
 * The product's tax settings: whether it is taxable, and which tax class (and so which rates) it uses. Shown only
 * while the Taxes module is on, and kept out of ProductEdit.tsx's long body.
 */
export default function TaxFields( { status, taxClass, taxCode, onChange }: Props ) {
	const [ classes, setClasses ] = useState< TaxClass[] >( [ { slug: 'standard', name: __( 'Standard rate', 'vulocart' ) } ] );

	useEffect( () => {
		axios
			.get< TaxClass[] >( `${ vulocartLocalizer.apiUrl }/${ vulocartLocalizer.restUrl }/taxes/classes`, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( ( response ) => setClasses( response.data ) )
			.catch( () => undefined );
	}, [] );

	// Most products keep the store default, so the card starts closed and shows the current setting as its summary.
	const summary =
		'none' === status
			? __( 'Not taxable', 'vulocart' )
			: `${ __( 'Taxable', 'vulocart' ) } · ${ classes.find( ( item ) => item.slug === ( taxClass || 'standard' ) )?.name ?? taxClass }`;

	return (
		<CollapsibleCard titleIcon="tax-compliance" title={ __( 'Tax', 'vulocart' ) } desc={ summary }>
			<div className="vulocart-two-col-fields">
				<FormGroupComponent label={ __( 'Tax status', 'vulocart' ) } htmlFor="vulocart-product-tax-status">
					<SelectInput
						name="taxStatus"
						type="single-select"
						options={ [
							{ label: __( 'Taxable', 'vulocart' ), value: 'taxable' },
							{ label: __( 'Not taxable', 'vulocart' ), value: 'none' },
						] }
						value={ status || 'taxable' }
						onChange={ ( value ) => onChange( { taxStatus: value as string } ) }
					/>
				</FormGroupComponent>
				{ 'none' !== status && (
					<FormGroupComponent label={ __( 'Tax class', 'vulocart' ) } htmlFor="vulocart-product-tax-class">
						<SelectInput
							name="taxClass"
							type="single-select"
							options={ classes.map( ( item ) => ( { label: item.name, value: item.slug } ) ) }
							value={ taxClass || 'standard' }
							onChange={ ( value ) => onChange( { taxClass: value as string } ) }
						/>
					</FormGroupComponent>
				) }
			</div>
			{ /* Only when a tax provider (vulocart-pro's Stripe Tax) is switched on: it decides rates from this code. */ }
			{ 'none' !== status && vulocartLocalizer.active_modules.includes( 'stripe-tax' ) && (
				<FormGroupComponent label={ __( 'Stripe tax code', 'vulocart' ) } htmlFor="vulocart-product-tax-code">
					<TextInput
						id="vulocart-product-tax-code"
						name="taxCode"
						placeholder="txcd_99999999"
						value={ taxCode }
						onChange={ ( value ) => onChange( { taxCode: value } ) }
					/>
					<p className="vulocart-field-hint">{ __( 'What the product is, for Stripe Tax. Leave empty for general physical goods.', 'vulocart' ) }</p>
				</FormGroupComponent>
			) }
		</CollapsibleCard>
	);
}
