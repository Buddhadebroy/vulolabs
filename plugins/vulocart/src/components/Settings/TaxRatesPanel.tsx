/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import type { ReactNode } from 'react';
import { NoticeManager } from '@zyra/components';
import { showErrorToast, errorMessageOf } from '../../lib/rest-errors';
import { getCountries, getStates } from '../../blocks/shared/geo';
import './tax-rates-panel.scss';

interface TaxClass {
	slug: string;
	name: string;
}

interface Rate {
	id: number;
	tax_class: string;
	country: string;
	state: string;
	postcode: string;
	rate: number;
	name: string;
	priority: number;
	shipping: boolean;
}

interface Preset {
	id: string;
	label: string;
	note: string;
	needs_state?: boolean;
}

const client = axios.create( {
	baseURL: `${ vulocartLocalizer.apiUrl }/${ vulocartLocalizer.restUrl }`,
	headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
} );

const GST_SLABS = [ '5', '12', '18', '28' ];

/**
 * The Tax rates card on Settings → Shipping & Tax → Tax: a preset picker, the tax classes and the rate table for the chosen class, with a flat-rate fallback while the table is empty.
 * Every change saves straight away and confirms with the same floating notice the other settings tabs use.
 */
function TaxRatesEditor() {
	const [ classes, setClasses ] = useState< TaxClass[] >( [] );
	const [ current, setCurrent ] = useState( 'standard' );
	const [ rates, setRates ] = useState< Rate[] >( [] );
	const [ presets, setPresets ] = useState< Preset[] >( [] );
	const [ preset, setPreset ] = useState( '' );
	const [ presetState, setPresetState ] = useState( '' );
	const [ presetSlab, setPresetSlab ] = useState( '18' );
	const [ newClass, setNewClass ] = useState( '' );
	const [ flatRate, setFlatRate ] = useState( '0' );
	const [ showClasses, setShowClasses ] = useState( false );
	const countries = getCountries();

	const saved = ( message = __( 'Settings saved.', 'vulocart' ) ) => NoticeManager.add( { title: __( 'Great!', 'vulocart' ), message, type: 'success', position: 'float' } );
	const failed = ( error: unknown ) => showErrorToast( errorMessageOf( error ) );

	const loadRates = ( taxClass: string ) => client.get< Rate[] >( '/taxes/rates', { params: { tax_class: taxClass } } ).then( ( response ) => setRates( response.data ) ).catch( failed );
	const loadClasses = () => client.get< TaxClass[] >( '/taxes/classes' ).then( ( response ) => setClasses( response.data ) ).catch( failed );

	useEffect( () => {
		client.get< Record< string, unknown > >( '/settings' ).then( ( response ) => setFlatRate( String( response.data.default_tax_rate_percent ?? 0 ) ) ).catch( failed );
		loadClasses();
		client.get< Preset[] >( '/taxes/presets' ).then( ( response ) => setPresets( response.data ) ).catch( failed );
	}, [] );

	useEffect( () => {
		loadRates( current );
	}, [ current ] );

	const patch = ( id: number, fields: Partial< Rate > ) =>
		client
			.patch( `/taxes/rates/${ id }`, fields )
			.then( () => saved() )
			.catch( ( error ) => {
				failed( error );

				// The row is gone (deleted elsewhere): show what is really stored instead of a stale table.
				if ( 404 === ( error as { response?: { status?: number } } )?.response?.status ) {
					loadRates( current );
				}
			} );

	/** Edits a row on screen right away; `commit` saves it (on blur, or at once for a select / checkbox). */
	const edit = ( id: number, fields: Partial< Rate >, commit = false ) => {
		setRates( ( rows ) => rows.map( ( row ) => ( row.id === id ? { ...row, ...fields } : row ) ) );

		if ( commit ) {
			patch( id, fields );
		}
	};

	const addRate = () =>
		client
			.post< Rate >( '/taxes/rates', { tax_class: current, country: '', rate: 0, name: __( 'Tax', 'vulocart' ), priority: 1, shipping: true } )
			.then( ( response ) => setRates( ( rows ) => [ ...rows, response.data ] ) )
			.catch( failed );

	const removeRate = ( id: number ) =>
		client
			.delete( `/taxes/rates/${ id }` )
			.then( () => {
				setRates( ( rows ) => rows.filter( ( row ) => row.id !== id ) );
				saved();
			} )
			.catch( failed );

	const addClass = () => {
		if ( '' === newClass.trim() ) {
			return;
		}

		client
			.post< TaxClass >( '/taxes/classes', { name: newClass.trim() } )
			.then( ( response ) => {
				setNewClass( '' );
				setCurrent( response.data.slug );
				loadClasses();
				saved();
			} )
			.catch( failed );
	};

	const removeClass = ( slug: string ) => {
		// eslint-disable-next-line no-alert -- a destructive action on stored rates deserves a native confirm.
		if ( ! window.confirm( __( 'Delete this tax class and all its rates? Products using it fall back to the standard class.', 'vulocart' ) ) ) {
			return;
		}

		client
			.delete( `/taxes/classes/${ slug }` )
			.then( () => {
				setCurrent( 'standard' );
				loadClasses();
				saved();
			} )
			.catch( failed );
	};

	const applyPreset = () => {
		const chosen = presets.find( ( item ) => item.id === preset );

		if ( ! chosen ) {
			return;
		}

		// eslint-disable-next-line no-alert -- replaces the standard rates; confirm first.
		if ( ! window.confirm( __( 'This replaces your standard-class rates with this set. Continue?', 'vulocart' ) ) ) {
			return;
		}

		client
			.post( '/taxes/presets', { preset, state: presetState, slab: presetSlab } )
			.then( () => {
				setCurrent( 'standard' );
				loadRates( 'standard' );
				saved( __( 'Tax rates applied.', 'vulocart' ) );
			} )
			.catch( failed );
	};

	const saveFlatRate = () =>
		client
			.post( '/settings', { default_tax_rate_percent: Number( flatRate ) || 0 } )
			.then( () => saved() )
			.catch( failed );

	// One field row, laid out like the declarative settings: title and hint on the left, the control on the right.
	const row = ( label: string, hint: string, control: ReactNode ) => (
		<div className="form-group row">
			<label className="settings-form-label">
				<div className="typography typography-title">{ label }</div>
				<div className="settings-metabox-description">{ hint }</div>
			</label>
			<div className="settings-input-content">{ control }</div>
		</div>
	);

	const chosenPreset = presets.find( ( item ) => item.id === preset );
	const currentName = classes.find( ( item ) => item.slug === current )?.name ?? current;

	return (
		<div className="vulocart-taxrates form-group-wrapper">
			<div className="settings-section-group">
				<div className="settings-left-section">
					<div className="divider-section">
						<div className="title-wrapper">
							<div className="typography typography-title">
								<i className="adminfont-tax-compliance" />
								<span>{ __( 'Tax rates', 'vulocart' ) }</span>
							</div>
						</div>
						<span className="typography typography-desc">{ __( 'What you charge in each place. The buyer\'s address decides which rate applies.', 'vulocart' ) }</span>
					</div>
				</div>
				<div className="settings-right-section">
				<div className="vulocart-taxrates-body">
				{ row(
					__( 'Start from a preset', 'vulocart' ),
					chosenPreset ? chosenPreset.note : __( 'A ready-made rate set replaces your standard rates. Rates change, so check them with your tax adviser.', 'vulocart' ),
					<div className="vulocart-taxrates-preset">
						<select value={ preset } onChange={ ( event ) => setPreset( event.target.value ) } aria-label={ __( 'Start from a preset', 'vulocart' ) }>
							<option value="">{ __( 'Choose a rate set…', 'vulocart' ) }</option>
							{ presets.map( ( item ) => (
								<option key={ item.id } value={ item.id }>
									{ item.label }
								</option>
							) ) }
						</select>
						{ chosenPreset?.needs_state && (
							<>
								<input type="text" placeholder={ __( 'Your state code, e.g. KA', 'vulocart' ) } value={ presetState } onChange={ ( event ) => setPresetState( event.target.value.toUpperCase() ) } aria-label={ __( 'Your state code', 'vulocart' ) } />
								<select value={ presetSlab } onChange={ ( event ) => setPresetSlab( event.target.value ) } aria-label={ __( 'GST slab', 'vulocart' ) }>
									{ GST_SLABS.map( ( slab ) => (
										<option key={ slab } value={ slab }>
											{ slab }% GST
										</option>
									) ) }
								</select>
							</>
						) }
						<button type="button" className="admin-btn btn-purple" disabled={ ! preset } onClick={ applyPreset }>
							{ __( 'Apply', 'vulocart' ) }
						</button>
					</div>
				) }

				{ row(
					showClasses ? sprintf( /* translators: %s: tax class name. */ __( 'Rates: %s', 'vulocart' ), currentName ) : __( 'Rates', 'vulocart' ),
					__( 'Add a rate for each place you charge tax: a country, optionally a state or postcode. Where rates overlap, the most specific one wins.', 'vulocart' ),
					<div className="vulocart-taxrates-actions">
						<button type="button" className="admin-btn btn-purple" onClick={ addRate }>
							{ __( '+ Add rate', 'vulocart' ) }
						</button>
						{ 'standard' !== current && (
							<button type="button" className="admin-btn btn-text-red" onClick={ () => removeClass( current ) }>
								{ __( 'Delete class', 'vulocart' ) }
							</button>
						) }
						{ ! showClasses && (
							<button type="button" className="vulocart-taxrates-link" onClick={ () => setShowClasses( true ) }>
								{ __( 'Some products taxed differently?', 'vulocart' ) }
							</button>
						) }
					</div>
				) }

				{ showClasses && row(
					__( 'Tax classes', 'vulocart' ),
					__( 'For products taxed at a different rate, like food or books. Pick a class, set its rates below, then choose it on the product\'s edit page. Products with no class use Standard.', 'vulocart' ),
					<div className="vulocart-taxrates-classes">
						<div className="vulocart-taxrates-chips" role="tablist" aria-label={ __( 'Tax classes', 'vulocart' ) }>
							{ classes.map( ( item ) => (
								<button key={ item.slug } type="button" role="tab" aria-selected={ item.slug === current } className={ item.slug === current ? 'is-active' : '' } onClick={ () => setCurrent( item.slug ) }>
									{ item.name }
								</button>
							) ) }
						</div>
						<div className="vulocart-taxrates-newclass">
							<input type="text" placeholder={ __( 'New class, e.g. Digital goods', 'vulocart' ) } value={ newClass } onChange={ ( event ) => setNewClass( event.target.value ) } onKeyDown={ ( event ) => 'Enter' === event.key && addClass() } />
							<button type="button" className="admin-btn btn-purple" onClick={ addClass } disabled={ '' === newClass.trim() }>
								{ __( 'Add class', 'vulocart' ) }
							</button>
						</div>
					</div>
				) }

				{ 0 === rates.length ? (
					<>
						<p className="vulocart-taxrates-empty">{ __( 'No rates for this class yet. Add one, or start from a preset above.', 'vulocart' ) }</p>
						{ 'standard' === current &&
							row(
								__( 'Flat rate (%)', 'vulocart' ),
								__( 'Charged on every order until you add a rate; replaced as soon as you do. Leave at 0 to charge no tax.', 'vulocart' ),
								<input type="number" min="0" max="100" step="0.01" value={ flatRate } onChange={ ( event ) => setFlatRate( event.target.value ) } onBlur={ saveFlatRate } aria-label={ __( 'Flat rate', 'vulocart' ) } />
							) }
					</>
				) : (
					<div className="vulocart-taxrates-scroll">
						<table>
							<thead>
								<tr>
									<th>{ __( 'Country', 'vulocart' ) }</th>
									<th>{ __( 'State', 'vulocart' ) }</th>
									<th>{ __( 'Postcode', 'vulocart' ) }</th>
									<th>{ __( 'Rate %', 'vulocart' ) }</th>
									<th>{ __( 'Name', 'vulocart' ) }</th>
									<th>{ __( 'Priority', 'vulocart' ) }</th>
									<th title={ __( 'Applies to shipping', 'vulocart' ) }>{ __( 'Ship', 'vulocart' ) }</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{ rates.map( ( row ) => (
									<tr key={ row.id }>
										<td>
											<select value={ row.country } onChange={ ( event ) => edit( row.id, { country: event.target.value, state: '' }, true ) } aria-label={ __( 'Country', 'vulocart' ) }>
												<option value="">{ __( 'Any country', 'vulocart' ) }</option>
												{ countries.map( ( country ) => (
													<option key={ country.value } value={ country.value }>
														{ country.label }
													</option>
												) ) }
											</select>
										</td>
										<td>
											{ getStates( row.country ) ? (
												<select value={ row.state } onChange={ ( event ) => edit( row.id, { state: event.target.value }, true ) } aria-label={ __( 'State', 'vulocart' ) }>
													<option value="">{ __( 'Any', 'vulocart' ) }</option>
													{ ( getStates( row.country ) ?? [] ).map( ( state ) => (
														<option key={ state.value } value={ state.value }>
															{ state.label }
														</option>
													) ) }
												</select>
											) : (
												<input type="text" value={ row.state } placeholder="*" onChange={ ( event ) => edit( row.id, { state: event.target.value.toUpperCase() } ) } onBlur={ () => patch( row.id, { state: row.state } ) } aria-label={ __( 'State', 'vulocart' ) } />
											) }
										</td>
										<td>
											<input type="text" value={ row.postcode } placeholder="*" onChange={ ( event ) => edit( row.id, { postcode: event.target.value } ) } onBlur={ () => patch( row.id, { postcode: row.postcode } ) } aria-label={ __( 'Postcode', 'vulocart' ) } />
										</td>
										<td>
											<input type="number" min="0" max="100" step="0.01" value={ row.rate } onChange={ ( event ) => edit( row.id, { rate: Number( event.target.value ) } ) } onBlur={ () => patch( row.id, { rate: row.rate } ) } aria-label={ __( 'Rate', 'vulocart' ) } />
										</td>
										<td>
											<input type="text" value={ row.name } onChange={ ( event ) => edit( row.id, { name: event.target.value } ) } onBlur={ () => patch( row.id, { name: row.name } ) } aria-label={ __( 'Name', 'vulocart' ) } />
										</td>
										<td>
											<input type="number" min="1" step="1" value={ row.priority } onChange={ ( event ) => edit( row.id, { priority: Number( event.target.value ) } ) } onBlur={ () => patch( row.id, { priority: row.priority } ) } aria-label={ __( 'Priority', 'vulocart' ) } />
										</td>
										<td>
											<input type="checkbox" checked={ row.shipping } onChange={ ( event ) => edit( row.id, { shipping: event.target.checked }, true ) } aria-label={ __( 'Applies to shipping', 'vulocart' ) } />
										</td>
										<td>
											<button type="button" className="vulocart-taxrates-remove" onClick={ () => removeRate( row.id ) } aria-label={ __( 'Delete rate', 'vulocart' ) }>
												<i className="adminfont-delete" />
											</button>
										</td>
									</tr>
								) ) }
							</tbody>
						</table>
					</div>
				) }
				</div>
				</div>
			</div>
		</div>
	);
}

/**
 * The tax rate routes only exist while the Taxes module is on, so with it off this tab explains that and offers the
 * switch instead of calling routes that are not there.
 */
export default function TaxRatesPanel() {
	if ( ! vulocartLocalizer.active_modules.includes( 'taxes' ) ) {
		return (
			<div className="vulocart-taxrates">
				<div className="vulocart-taxrates-card">
					<p className="vulocart-taxrates-empty">
						<strong>{ __( 'The Taxes module is off.', 'vulocart' ) }</strong>
						<br />
						{ __( 'Turn it on to charge tax and set tax rates and classes. Your stored rates are kept.', 'vulocart' ) }
					</p>
					<p className="vulocart-taxrates-empty">
						<a className="admin-btn btn-purple" href={ `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart#&tab=settings&subtab=modules&module=taxes` }>
							{ __( 'Enable Now', 'vulocart' ) }
						</a>
					</p>
				</div>
			</div>
		);
	}

	return <TaxRatesEditor />;
}
