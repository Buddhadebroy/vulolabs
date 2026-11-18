/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { ReactNode } from 'react';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { showToast } from '../../lib/rest-errors';
import { TYPE_PROFILES, lockedSubtypeModule, type TypeProfile } from './typeProfiles';
import UpgradeToPro from '../../components/Popup/UpgradeToPro';

interface StoreType {
	type: string;
	enabled: boolean;
	/** Every type but Physical needs VuloCart Pro. */
	pro_only?: boolean;
	/** Set when the type only works with a vulocart-pro module. */
	pro: { module: string; label: string } | null;
}

/** Why a type cannot be picked right now, or null when it can. */
/** Only a type switched off in Product Types can be enabled from there. */
interface ChooserCard {
	key: string;
	/** The kind the card starts with; the type's first kind when omitted. */
	kind?: string;
	profile: TypeProfile;
	/** Why the type cannot be picked here (not enabled, needs Pro), or null. */
	off: string | null;
	/** The module the card needs that is switched off, offered as a one-click switch. */
	needs: { module: string; name: string } | null;
}

/** Physical's Variable kind has its own card, so the Physical card does not list it again. */
const kindsShown = ( profile: TypeProfile ) => ( 'physical' === profile.value ? profile.subtypes.filter( ( kind ) => 'variable' !== kind.value ) : profile.subtypes );

const canEnable = ( reason: string ) => reason === __( 'Turned off for this store', 'vulocart' );

/** Why a product type cannot be chosen (for example its module is off), or null when it can. */
const reasonOff = ( row: StoreType | undefined ): string | null => {
	if ( ! row ) {
		return null;
	}

	if ( row.pro_only && ! vulocartLocalizer.khali_dabba ) {
		return __( 'Needs VuloCart Pro', 'vulocart' );
	}

	if ( ! row.enabled ) {
		return __( 'Turned off for this store', 'vulocart' );
	}

	if ( row.pro && ! vulocartLocalizer.khali_dabba ) {
		return __( 'Needs VuloCart Pro', 'vulocart' );
	}

	if ( row.pro && ! vulocartLocalizer.active_modules.includes( row.pro.module ) ) {
		return sprintf(
			/* translators: %s: module name, e.g. Subscriptions. */
			__( 'Turn on %s first', 'vulocart' ),
			row.pro.label
		);
	}

	return null;
};

/**
 * The first screen of "Add Product": what are you selling? A card for each type that can be started now; picking one
 * opens the editor with that type (and its first kind, or the kind chip clicked) already chosen. Types that cannot be
 * started yet are listed below as small tiles, grouped by what unlocks them (a module, Product Types, VuloCart Pro),
 * each group with its one way forward - so they stay visible without crowding out the real choices.
 */
export function TypeChooser( { onChoose }: { onChoose: ( type: string, subtype?: string ) => void } ) {
	const [ rows, setRows ] = useState< StoreType[] | null >( null );
	const [ skipNext, setSkipNext ] = useState( false );

	useEffect( () => {
		axios
			.get< StoreType[] >( getApiLink( vulocartLocalizer, 'product-types' ), { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( ( response ) => setRows( response.data ) )
			// If the list cannot be read, offer every type rather than none.
			.catch( () => setRows( [] ) );
	}, [] );

	// "Don't show this again" saves straight away, like the other settings; it can be turned back on in Settings → General.
	const rememberChoice = ( stop: boolean ) => {
		setSkipNext( stop );

		axios
			.post( getApiLink( vulocartLocalizer, 'settings' ), { ask_product_type: stop ? [] : [ 'ask_product_type' ] }, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( () =>
				showToast(
					'success',
					stop
						? __( 'Got it - new products will open straight on the product page. You can turn this back on in Settings → General.', 'vulocart' )
						: __( 'This step will show again when you add a product.', 'vulocart' )
				)
			)
			.catch( () => setSkipNext( ! stop ) );
	};

	const profiles = TYPE_PROFILES.filter( ( profile ) => 'license' !== profile.value );
	const all: ChooserCard[] = [];

	profiles.forEach( ( profile ) => {
		const row = rows?.find( ( item ) => item.type === profile.value );
		// A licensed store whose type only waits on a Pro module gets a one-click switch instead of a reason.
		const moduleOff =
			!! row?.pro && row.enabled && !! vulocartLocalizer.khali_dabba && ! vulocartLocalizer.active_modules.includes( row.pro.module );
		const off = moduleOff ? null : reasonOff( row );

		all.push( { key: profile.value, profile, off, needs: moduleOff && row?.pro ? { module: row.pro.module, name: row.pro.label } : null } );

		// A physical product with options gets its own card, so "Variable product" is a first-class choice. It is
		// a Physical product of kind Variable, so it follows Physical's availability and Product Variants'.
		if ( 'physical' === profile.value ) {
			const variable = profile.subtypes.find( ( kind ) => 'variable' === kind.value );

			if ( variable ) {
				const needs = lockedSubtypeModule( 'physical', 'variable', vulocartLocalizer.active_modules );

				all.push( {
					key: 'physical-variable',
					kind: 'variable',
					profile: {
						...profile,
						icon: 'variable',
						label: __( 'Variable product', 'vulocart' ),
						hint: __( 'One product in several options, like size or colour, each with its own price and stock.', 'vulocart' ),
						subtypes: [],
					},
					off: off ?? ( needs && ! vulocartLocalizer.khali_dabba ? __( 'Needs VuloCart Pro', 'vulocart' ) : null ),
					// Offered as a one-click switch only when Pro is there to provide the module.
					needs: off || ! vulocartLocalizer.khali_dabba ? null : needs,
				} );
			}
		}
	} );

	const isOff = ( card: ChooserCard ) => !! card.off || !! card.needs;
	const available = all.filter( ( card ) => ! isOff( card ) );
	const unavailable = all.filter( isOff );

	// The Variable product card switches Product Variants on in place, as the editor's module hints do.
	const [ activating, setActivating ] = useState< string | null >( null );
	const activate = ( module: string ) => {
		setActivating( module );

		axios
			.post( `${ vulocartLocalizer.apiUrl }/${ vulocartLocalizer.restUrl }/modules`, { id: module, action: 'activate' }, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( () => window.location.reload() )
			.catch( () => {
				setActivating( null );
				showToast( 'error', __( 'Could not turn the module on. Try again from Modules.', 'vulocart' ) );
			} );
	};

	// Unavailable types are grouped by what it takes to use them, so each group needs only one way forward.
	const needsPro = unavailable.filter( ( card ) => card.off === __( 'Needs VuloCart Pro', 'vulocart' ) );
	const turnedOff = unavailable.filter( ( card ) => card.off && canEnable( card.off ) );
	const needsModule = unavailable.filter( ( card ) => ! needsPro.includes( card ) && ! turnedOff.includes( card ) );

	const tile = ( { key, profile, off, needs }: ChooserCard, action?: ReactNode ) => (
		<li key={ key } className="vulocart-type-tile" title={ profile.hint }>
			<span className="vulocart-type-tile-icon">
				<i className={ `adminfont-${ profile.icon }` } aria-hidden="true" />
			</span>
			<span className="vulocart-type-tile-text">
				<strong>{ profile.label }</strong>
				{ action ?? ( off && ! needs && needsModule.some( ( card ) => card.key === key ) ? <small>{ off }</small> : null ) }
			</span>
		</li>
	);

	return (
		<div className="vulocart-product-edit-page vulocart-type-chooser">
			<nav className="vulocart-breadcrumbs" aria-label={ __( 'Breadcrumb', 'vulocart' ) }>
				<a href="admin.php?page=products">{ __( 'Products', 'vulocart' ) }</a>
				<i className="adminfont-pagination-next-arrow" aria-hidden="true" />
				<span aria-current="page">{ __( 'Add Product', 'vulocart' ) }</span>
			</nav>

			<header className="vulocart-type-head">
				<h1 className="vulocart-edit-page-title">{ __( 'What are you selling?', 'vulocart' ) }</h1>
				<p className="vulocart-product-edit-subtitle">{ __( 'It sets up the right fields. You can change it later.', 'vulocart' ) }</p>
			</header>

			{ /* Types that can be started now: the whole card starts the type; the chips start a specific kind of it. */ }
			<ul className="vulocart-type-grid">
				{ available.map( ( { key, kind: startKind, profile } ) => (
					<li key={ key } className="vulocart-type-card">
						<button type="button" className="vulocart-type-card-main" onClick={ () => onChoose( profile.value, startKind ) }>
							<span className="vulocart-type-icon">
								<i className={ `adminfont-${ profile.icon }` } aria-hidden="true" />
							</span>
							<span className="vulocart-type-card-text">
								<strong>{ profile.label }</strong>
								<small>{ profile.hint }</small>
							</span>
							<i className="adminfont-pagination-next-arrow vulocart-type-go" aria-hidden="true" />
						</button>
						{ kindsShown( profile ).length > 1 && (
							<div
								className="vulocart-type-kinds"
								role="group"
								aria-label={ sprintf( /* translators: %s: product type, e.g. "Physical". */ __( 'Start a %s product as', 'vulocart' ), profile.label ) }
							>
								{ kindsShown( profile ).map( ( kind ) => {
									const locked = lockedSubtypeModule( profile.value, kind.value, vulocartLocalizer.active_modules );
									const lockedText = locked
										? sprintf( /* translators: %s: module name. */ __( 'Turn on %s in Modules to use this.', 'vulocart' ), locked.name )
										: '';

									return (
										<button
											key={ kind.value }
											type="button"
											className={ `vulocart-type-kind${ locked ? ' is-locked' : '' }` }
											disabled={ !! locked }
											title={ locked ? lockedText : kind.hint }
											aria-label={ locked ? `${ kind.label }: ${ lockedText }` : `${ kind.label }: ${ kind.hint }` }
											onClick={ () => onChoose( profile.value, kind.value ) }
										>
											{ locked && <i className="adminfont-lock" aria-hidden="true" /> }
											{ kind.label }
										</button>
									);
								} ) }
							</div>
						) }
					</li>
				) ) }
			</ul>

			{ needsModule.length > 0 && (
				<section className="vulocart-type-more">
					<h2>{ __( 'Needs a module', 'vulocart' ) }</h2>
					<ul className="vulocart-type-tiles">
						{ needsModule.map( ( card ) =>
							tile(
								card,
								card.needs ? (
									<button type="button" className="vulocart-type-enable" disabled={ null !== activating } onClick={ () => activate( card.needs!.module ) }>
										{ activating === card.needs.module
											? __( 'Turning on…', 'vulocart' )
											: sprintf( /* translators: %s: module name, e.g. Product Variants. */ __( 'Turn on %s', 'vulocart' ), card.needs.name ) }
									</button>
								) : undefined
							)
						) }
					</ul>
				</section>
			) }

			{ turnedOff.length > 0 && (
				<section className="vulocart-type-more">
					<h2>
						{ __( 'Turned off for this store', 'vulocart' ) }
						<a href="admin.php?page=products&view=product-types">{ __( 'Manage product types', 'vulocart' ) }</a>
					</h2>
					<ul className="vulocart-type-tiles">{ turnedOff.map( ( card ) => tile( card ) ) }</ul>
				</section>
			) }

			{ needsPro.length > 0 && (
				<section className="vulocart-type-more is-pro">
					<h2>
						<span>
							<i className="adminfont-pro-tag" aria-hidden="true" />
							{ sprintf( /* translators: %d: number of product types. */ _n( '%d more type with VuloCart Pro', '%d more types with VuloCart Pro', needsPro.length, 'vulocart' ), needsPro.length ) }
						</span>
						<UpgradeToPro className="" />
					</h2>
					<ul className="vulocart-type-tiles">{ needsPro.map( ( card ) => tile( card ) ) }</ul>
				</section>
			) }

			<label className="vulocart-type-remember">
				<input type="checkbox" checked={ skipNext } onChange={ ( event ) => rememberChoice( event.target.checked ) } />
				{ __( 'Skip this step next time', 'vulocart' ) }
			</label>
		</div>
	);
}
