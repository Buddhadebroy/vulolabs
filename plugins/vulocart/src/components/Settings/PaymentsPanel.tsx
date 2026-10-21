/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	BadgeComponent,
	CardComponent,
	FormGroupComponent,
	FormGroupWrapperComponent,
	NoticeManager,
	PopupComponent,
	SectionComponent,
	SettingRowComponent,
} from '@zyra/components';
import { ButtonInput, MultiCheckboxInput, SelectInput, TextAreaInput, TextInput } from '@zyra/inputs';
import paymentsFields, { type PaymentField } from './paymentsFields';
import './payments-panel.scss';

type Values = Record< string, unknown >;

interface Group {
	key: string;
	icon: string;
	title: string;
	desc: string;
	fields: PaymentField[];
}

const nonceHeaders = { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } };

/** Whether a payment field is an on/off toggle that enables a payment method. */
const isToggle = ( field: PaymentField ) => 'checkbox' === field.type && 'toggle' === field.look;

/** Splits the flat field list into its `section` groups. */
const toGroups = ( fields: PaymentField[] ): Group[] => {
	const groups: Group[] = [];

	fields.forEach( ( field ) => {
		if ( 'section' === field.type ) {
			groups.push( {
				key: field.key,
				icon: field.icon ?? 'payment',
				title: field.title ?? '',
				desc: field.desc ?? '',
				fields: [],
			} );
		} else if ( groups.length ) {
			groups[ groups.length - 1 ].fields.push( field );
		}
	} );

	return groups;
};

/** Whether a stored setting value counts as switched on. */
const isOn = ( value: unknown ) => Array.isArray( value ) ? value.length > 0 : !! value && 'false' !== value && '0' !== value;

/**
 * Settings → Commerce → Payments, laid out like VuloMail's Connections: a section on the left, and
 * on the right a list of payment methods with Enable/Configure buttons. Each method's own fields open
 * in a popup. Writes go straight to the Settings REST endpoint, so there is no Save button.
 */
const PaymentsPanel = () => {
	const [ values, setValues ] = useState< Values | null >( null );
	const [ editing, setEditing ] = useState< Group | null >( null );
	const [ draft, setDraft ] = useState< Values >( {} );
	const [ isSaving, setIsSaving ] = useState( false );

	// Pro adds its gateways through this filter; applied at render so late-loaded bundles are included.
	const groups = toGroups( applyFilters( 'vulocart_settings_fields', paymentsFields, { settingId: 'payments' } ) as PaymentField[] );
	const methodGroups = groups.filter( ( group ) => group.fields.some( isToggle ) );
	const generalGroups = groups.filter( ( group ) => ! group.fields.some( isToggle ) );

	useEffect( () => {
		getApiResponse< Values >( getApiLink( vulocartLocalizer, 'settings' ), nonceHeaders ).then( ( response ) => setValues( response ?? {} ) );
	}, [] );

	const save = ( changes: Values, message?: string ): Promise< boolean > =>
		sendApiResponse( vulocartLocalizer, getApiLink( vulocartLocalizer, 'settings' ), changes ).then( ( response ) => {
			if ( response ) {
				setValues( ( current ) => ( { ...( current ?? {} ), ...changes } ) );
			}

			NoticeManager.add( {
				uniqueKey: 'vulocart-payments-save',
				type: response ? 'success' : 'error',
				position: 'float',
				message: response ? message ?? __( 'Settings saved.', 'vulocart' ) : __( 'Could not save settings.', 'vulocart' ),
			} );

			return !! response;
		} );

	if ( ! values ) {
		return <CardComponent title={ __( 'Payments', 'vulocart' ) } titleIcon="payment" isLoading />;
	}

	const toggleField = ( group: Group ) => group.fields.find( isToggle ) as PaymentField;
	// Everything but the method's own enable switch - a second toggle (e.g. sandbox mode) is a setting.
	const configFields = ( group: Group ) => group.fields.filter( ( field ) => field !== toggleField( group ) );

	const toggleMethod = ( group: Group ) => {
		const field = toggleField( group );
		const next = isOn( values[ field.key ] ) ? [] : [ field.key ];

		save( { [ field.key ]: next }, next.length ? __( 'Payment method enabled.', 'vulocart' ) : __( 'Payment method disabled.', 'vulocart' ) );
	};

	const openConfigure = ( group: Group ) => {
		const initial: Values = {};

		configFields( group ).forEach( ( field ) => {
			initial[ field.key ] = values[ field.key ] ?? '';
		} );

		setDraft( initial );
		setEditing( group );
	};

	const saveDraft = () => {
		setIsSaving( true );
		save( draft, __( 'Payment method saved.', 'vulocart' ) )
			.then( ( ok ) => ok && setEditing( null ) )
			.finally( () => setIsSaving( false ) );
	};

	/** One field's control. `onChange` receives the new value; the caller decides when it is saved. */
	const renderControl = ( field: PaymentField, value: unknown, onChange: ( next: unknown ) => void ) => {
		if ( isToggle( field ) ) {
			return (
				<MultiCheckboxInput
					look="toggle"
					type="checkbox"
					value={ isOn( value ) ? [ field.key ] : [] }
					onChange={ ( event: unknown ) => onChange( Array.isArray( event ) ? event : [] ) }
					options={ [ { key: field.key, value: field.key } ] }
				/>
			);
		}

		if ( 'select' === field.type ) {
			return (
				<SelectInput
					type="single-select"
					name={ field.key }
					options={ field.options ?? [] }
					value={ String( value ?? '' ) }
					isClearable={ false }
					onChange={ ( next ) => onChange( next as string ) }
				/>
			);
		}

		if ( 'textarea' === field.type ) {
			return <TextAreaInput name={ field.key } value={ String( value ?? '' ) } onChange={ ( next ) => onChange( next as string ) } />;
		}

		return (
			<TextInput
				name={ field.key }
				type={ 'password' === field.type ? 'password' : 'text' }
				value={ String( value ?? '' ) }
				onChange={ ( next ) => onChange( String( next ) ) }
			/>
		);
	};

	const renderField = ( field: PaymentField, value: unknown, onChange: ( next: unknown ) => void ) => (
		<FormGroupComponent key={ field.key } label={ field.label } htmlFor={ field.key }>
			{ renderControl( field, value, onChange ) }
			{ field.settingDescription && <div className="settings-metabox-description">{ field.settingDescription }</div> }
		</FormGroupComponent>
	);

	const rows = methodGroups.map( ( group ) => {
		const on = isOn( values[ toggleField( group ).key ] );
		const hasConfig = configFields( group ).length > 0;

		return {
			icon: `${ group.icon } ${ on ? 'green' : 'blue' }`,
			title: (
				<span style={ { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' } }>
					{ group.title }
					<BadgeComponent color={ on ? 'green' : 'yellow' } text={ on ? __( 'Enabled', 'vulocart' ) : __( 'Disabled', 'vulocart' ) } />
				</span>
			),
			desc: group.desc,
			control: (
				<ButtonInput
					buttons={ [
						{
							text: on ? __( 'Disable', 'vulocart' ) : __( 'Enable', 'vulocart' ),
							icon: on ? 'cross' : 'check',
							color: 'purple',
							onClick: () => toggleMethod( group ),
						},
						...( hasConfig
							? [ { text: __( 'Configure', 'vulocart' ), icon: 'edit', color: 'purple', onClick: () => openConfigure( group ) } ]
							: [] ),
					] }
				/>
			),
		};
	} );

	return (
		<>
			{ generalGroups.map( ( group ) => (
				<div className="settings-section-group" key={ group.key }>
					<div className="settings-left-section">
						<SectionComponent icon={ group.icon } title={ group.title } desc={ group.desc } />
					</div>
					<div className="settings-right-section">
						<FormGroupWrapperComponent>
							{ group.fields.map( ( field ) =>
								renderField( field, values[ field.key ], ( next ) => save( { [ field.key ]: next } ) )
							) }
						</FormGroupWrapperComponent>
					</div>
				</div>
			) ) }

			<div className="settings-section-group">
				<div className="settings-left-section">
					<SectionComponent
						icon="payment"
						title={ __( 'Payment methods', 'vulocart' ) }
						desc={ __( 'Turn on the ways buyers can pay. Card gateways from Pro appear here once their module is active.', 'vulocart' ) }
					/>
				</div>
				<div className="settings-right-section">
					<FormGroupWrapperComponent>
						<FormGroupComponent>
							<SettingRowComponent rows={ rows } />
						</FormGroupComponent>
					</FormGroupWrapperComponent>
				</div>
			</div>

			<PopupComponent
				open={ !! editing }
				onClose={ () => setEditing( null ) }
				width={ 36 }
				height="auto"
				position="lightbox"
				header={ {
					icon: editing?.icon ?? 'payment',
					title: sprintf(
						/* translators: %s: payment method name. */
						__( 'Configure %s', 'vulocart' ),
						editing?.title ?? ''
					),
					description: editing?.desc,
				} }
				footer={
					<ButtonInput
						buttons={ [
							{ text: __( 'Cancel', 'vulocart' ), color: 'purple', onClick: () => setEditing( null ), disabled: isSaving },
							{
								text: isSaving ? __( 'Saving…', 'vulocart' ) : __( 'Save', 'vulocart' ),
								icon: 'check',
								onClick: saveDraft,
								disabled: isSaving,
							},
						] }
					/>
				}
			>
				<div className="vulocart-pay-form">
					{ editing &&
						configFields( editing ).map( ( field ) => {
							const onChange = ( next: unknown ) => setDraft( ( current ) => ( { ...current, [ field.key ]: next } ) );

							// A switch (e.g. sandbox mode) reads as a row: the text on the left, the switch on the right.
							if ( isToggle( field ) ) {
								return (
									<div className="vulocart-pay-form-switch" key={ field.key }>
										<div>
											<div className="vulocart-pay-form-label">{ field.label }</div>
											{ field.settingDescription && <div className="settings-metabox-description">{ field.settingDescription }</div> }
										</div>
										{ renderControl( field, draft[ field.key ], onChange ) }
									</div>
								);
							}

							return renderField( field, draft[ field.key ], onChange );
						} ) }
				</div>
			</PopupComponent>
		</>
	);
};

export default PaymentsPanel;
