import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, ToggleControl, SelectControl, CheckboxControl, Button, Flex, FlexItem } from '@wordpress/components';

/** Every step the block can show, in natural order. Customer and Payment cannot be turned off. */
const STEPS = [
	{ id: 'customer', label: __( 'Customer', 'vulocart' ), required: true },
	{ id: 'address', label: __( 'Address', 'vulocart' ) },
	{ id: 'shipping', label: __( 'Shipping', 'vulocart' ) },
	{ id: 'payment', label: __( 'Payment', 'vulocart' ), required: true },
	{ id: 'review', label: __( 'Review', 'vulocart' ) },
];

const FIELDS = [
	{ id: 'name', label: __( 'Name', 'vulocart' ) },
	{ id: 'phone', label: __( 'Phone number', 'vulocart' ) },
	{ id: 'address_2', label: __( 'Apartment, suite, etc.', 'vulocart' ) },
];

/** `attributes.steps` as an ordered list of every step, each flagged on or off. */
const orderedSteps = ( chosen ) => [
	...chosen.map( ( id ) => ( { ...STEPS.find( ( step ) => step.id === id ), on: true } ) ).filter( ( step ) => step.id ),
	...STEPS.filter( ( step ) => ! chosen.includes( step.id ) ).map( ( step ) => ( { ...step, on: false } ) ),
];

registerBlockType( 'vulocart/checkout', {
	edit: ( { attributes, setAttributes } ) => {
		const { customize, layout, steps, fields } = attributes;
		const blockProps = useBlockProps( {
			style: {
				border: '1px dashed #8c8f94',
				padding: '24px',
				textAlign: 'center',
				color: '#50575e',
			},
		} );
		const rows = orderedSteps( steps );

		const setRows = ( next ) => setAttributes( { steps: next.filter( ( step ) => step.on || step.required ).map( ( step ) => step.id ) } );
		const move = ( index, delta ) => {
			const next = [ ...rows ];
			const target = index + delta;

			if ( target < 0 || target >= next.length ) {
				return;
			}

			[ next[ index ], next[ target ] ] = [ next[ target ], next[ index ] ];
			setRows( next );
		};

		return (
			<>
				<InspectorControls>
					<PanelBody title={ __( 'Checkout', 'vulocart' ) } initialOpen>
						<ToggleControl
							label={ __( 'Customize this checkout', 'vulocart' ) }
							help={ customize ? __( 'This page uses the layout, steps and fields below.', 'vulocart' ) : __( 'This page follows Settings → Checkout.', 'vulocart' ) }
							checked={ customize }
							onChange={ ( value ) => setAttributes( { customize: value } ) }
						/>
					</PanelBody>
					{ customize && (
						<>
							<PanelBody title={ __( 'Layout', 'vulocart' ) } initialOpen>
								<SelectControl
									label={ __( 'Checkout layout', 'vulocart' ) }
									value={ layout }
									options={ [
										{ label: __( 'Follow Settings', 'vulocart' ), value: '' },
										{ label: __( 'Multi-step (one step at a time)', 'vulocart' ), value: 'multi_step' },
										{ label: __( 'Single page (every step at once)', 'vulocart' ), value: 'single_page' },
									] }
									onChange={ ( value ) => setAttributes( { layout: value } ) }
								/>
							</PanelBody>
							<PanelBody title={ __( 'Steps', 'vulocart' ) } initialOpen>
								{ rows.map( ( step, index ) => (
									<Flex key={ step.id } align="center" justify="space-between">
										<FlexItem>
											<CheckboxControl
												label={ step.label }
												checked={ step.on || !! step.required }
												disabled={ !! step.required }
												onChange={ ( value ) => setRows( rows.map( ( row ) => ( row.id === step.id ? { ...row, on: value } : row ) ) ) }
											/>
										</FlexItem>
										<FlexItem>
											<Button icon="arrow-up-alt2" label={ __( 'Move up', 'vulocart' ) } size="small" disabled={ 0 === index } onClick={ () => move( index, -1 ) } />
											<Button icon="arrow-down-alt2" label={ __( 'Move down', 'vulocart' ) } size="small" disabled={ index === rows.length - 1 } onClick={ () => move( index, 1 ) } />
										</FlexItem>
									</Flex>
								) ) }
							</PanelBody>
							<PanelBody title={ __( 'Fields', 'vulocart' ) } initialOpen>
								{ FIELDS.map( ( field ) => (
									<CheckboxControl
										key={ field.id }
										label={ field.label }
										checked={ fields.includes( field.id ) }
										onChange={ ( value ) => setAttributes( { fields: FIELDS.map( ( item ) => item.id ).filter( ( id ) => ( id === field.id ? value : fields.includes( id ) ) ) } ) }
									/>
								) ) }
							</PanelBody>
						</>
					) }
				</InspectorControls>
				<div { ...blockProps }>
					{ __( 'VuloCart Checkout - renders the real cart/order flow on the published page.', 'vulocart' ) }
					<div style={ { marginTop: 8, fontSize: 12 } }>
						{ customize
							? rows
									.filter( ( step ) => step.on || step.required )
									.map( ( step ) => step.label )
									.join( ' → ' )
							: __( 'Following Settings → Checkout', 'vulocart' ) }
					</div>
				</div>
			</>
		);
	},

	save: ( { attributes } ) => {
		const { customize, layout, steps, fields } = attributes;
		const blockProps = useBlockProps.save();

		// Only a customized block carries its own choices; otherwise the page follows Settings → Checkout (and the
		// saved markup is what it always was).
		const data = customize ? { 'data-layout': layout || undefined, 'data-steps': steps.join( ',' ), 'data-fields': fields.join( ',' ) } : {};

		return (
			<div { ...blockProps }>
				<div className="vulocart-checkout-block" { ...data }></div>
			</div>
		);
	},
} );
