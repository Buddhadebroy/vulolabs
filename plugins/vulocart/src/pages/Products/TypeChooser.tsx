/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { showToast } from '../../lib/rest-errors';
import { TYPE_PROFILES, lockedSubtypeModule, type TypeProfile } from './typeProfiles';

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
 * The first screen of "Add Product": what are you selling? One card per type with a line of help. Types the store has
 * switched off (Products → Product Types), or that need Pro or a module that is off, are shown greyed out with the
 * reason, so the choice is clear without hiding what exists. Picking an available one opens the editor with that type
 * (and its first kind) already chosen. "Skip" opens the editor with the first available type.
 */
export function TypeChooser( { onChoose, onSkip }: { onChoose: ( type: string, subtype?: string ) => void; onSkip: ( type: string ) => void } ) {
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
		const off = rows ? reasonOff( rows.find( ( row ) => row.type === profile.value ) ) : null;

		all.push( { key: profile.value, profile, off, needs: null } );

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
	// Types that can be picked come first, in their usual order; the unavailable ones follow.
	const states = [ ...all.filter( ( state ) => ! isOff( state ) ), ...all.filter( isOff ) ];
	const firstAvailable = states.find( ( state ) => ! isOff( state ) )?.profile;
	const offCount = states.filter( isOff ).length;

	// The Variable product card switches Product Variants on in place, as the editor's module hints do.
	const [ activating, setActivating ] = useState( false );
	const activate = ( module: string ) => {
		setActivating( true );

		axios
			.post( `${ vulocartLocalizer.apiUrl }/${ vulocartLocalizer.restUrl }/modules`, { id: module, action: 'activate' }, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( () => window.location.reload() )
			.catch( () => {
				setActivating( false );
				showToast( 'error', __( 'Could not turn the module on. Try again from Modules.', 'vulocart' ) );
			} );
	};

	return (
		<div className="vulocart-product-edit-page vulocart-type-chooser">
			<nav className="vulocart-breadcrumbs" aria-label={ __( 'Breadcrumb', 'vulocart' ) }>
				<a href="admin.php?page=products">{ __( 'Products', 'vulocart' ) }</a>
				<i className="adminfont-pagination-next-arrow" aria-hidden="true" />
				<span aria-current="page">{ __( 'Add Product', 'vulocart' ) }</span>
			</nav>

			<header>
				<h1 className="vulocart-edit-page-title">{ __( 'What are you selling?', 'vulocart' ) }</h1>
				<p className="vulocart-product-edit-subtitle">
					{ __( 'Pick the closest match. It sets up the right fields, and you can change it later.', 'vulocart' ) }
					{ offCount > 0 && (
						<>
							{ ' ' }
							{ __( 'Greyed-out types are not enabled for this store.', 'vulocart' ) }{ ' ' }
							<a href="admin.php?page=products&view=product-types">{ __( 'Manage product types', 'vulocart' ) }</a>
						</>
					) }
				</p>
			</header>

			<ul className="vulocart-type-grid">
				{ states.map( ( { key, kind: startKind, profile, off, needs } ) => (
					<li key={ key } className={ off || needs ? 'is-off' : undefined }>
						{ needs ? (
							<div className="vulocart-type-card-off">
								<span className="vulocart-type-icon">
									<i className={ `adminfont-${ profile.icon }` } aria-hidden="true" />
								</span>
								<strong>{ profile.label }</strong>
								<small>{ profile.hint }</small>
								<button type="button" className="vulocart-type-enable" disabled={ activating } onClick={ () => activate( needs.module ) }>
									{ activating
										? __( 'Turning on…', 'vulocart' )
										: sprintf( /* translators: %s: module name, e.g. Product Variants. */ __( 'Turn on %s', 'vulocart' ), needs.name ) }
									<i className="adminfont-pagination-next-arrow" aria-hidden="true" />
								</button>
							</div>
						) : off ? (
							<div className="vulocart-type-card-off">
								<span className="vulocart-type-icon">
									<i className={ `adminfont-${ profile.icon }` } aria-hidden="true" />
								</span>
								<strong>{ profile.label }</strong>
								<small>{ profile.hint }</small>
								{ ! canEnable( off ) && <span className="vulocart-type-off">{ off }</span> }
								{ canEnable( off ) && (
									<a className="vulocart-type-enable" href="admin.php?page=products&view=product-types">
										{ __( 'Enable in Product Types', 'vulocart' ) }
										<i className="adminfont-pagination-next-arrow" aria-hidden="true" />
									</a>
								) }
							</div>
						) : (
							<div className="vulocart-type-card">
								<button type="button" className="vulocart-type-card-main" onClick={ () => onChoose( profile.value, startKind ) }>
									<span className="vulocart-type-icon">
										<i className={ `adminfont-${ profile.icon }` } aria-hidden="true" />
									</span>
									<strong>{ profile.label }</strong>
									<small>{ profile.hint }</small>
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
							</div>
						) }
					</li>
				) ) }
			</ul>

			<div className="vulocart-type-skip">
				{ firstAvailable && (
					<button type="button" className="vulocart-type-skip-button" onClick={ () => onSkip( firstAvailable.value ) }>
						{ sprintf(
							/* translators: %s: product type, e.g. "Physical". */
							__( 'Skip - start with %s', 'vulocart' ),
							firstAvailable.label
						) }
						<i className="adminfont-pagination-next-arrow" aria-hidden="true" />
					</button>
				) }
				<label className="vulocart-type-skip-remember">
					<input type="checkbox" checked={ skipNext } onChange={ ( event ) => rememberChoice( event.target.checked ) } />
					{ __( 'Don\'t show this step again - I\'ll pick the type on the product page', 'vulocart' ) }
				</label>
			</div>
		</div>
	);
}
