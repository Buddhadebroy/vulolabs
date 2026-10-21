/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { showToast } from '../../lib/rest-errors';
import { TYPE_PROFILES } from './typeProfiles';

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
const canEnable = ( reason: string ) => reason === __( 'Turned off for this store', 'vulocart' );

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
export function TypeChooser( { onChoose, onSkip }: { onChoose: ( type: string ) => void; onSkip: ( type: string ) => void } ) {
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
	// Types that can be picked come first, in their usual order; the unavailable ones follow.
	const all = profiles.map( ( profile ) => ( {
		profile,
		off: rows ? reasonOff( rows.find( ( row ) => row.type === profile.value ) ) : null,
	} ) );
	const states = [ ...all.filter( ( state ) => ! state.off ), ...all.filter( ( state ) => state.off ) ];
	const firstAvailable = states.find( ( state ) => ! state.off )?.profile;
	const offCount = states.filter( ( state ) => state.off ).length;

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
				{ states.map( ( { profile, off } ) => (
					<li key={ profile.value } className={ off ? 'is-off' : undefined }>
						{ off ? (
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
							<button type="button" onClick={ () => onChoose( profile.value ) }>
								<span className="vulocart-type-icon">
									<i className={ `adminfont-${ profile.icon }` } aria-hidden="true" />
								</span>
								<strong>{ profile.label }</strong>
								<small>{ profile.hint }</small>
								{ profile.subtypes.length > 1 && <em>{ profile.subtypes.map( ( subtype ) => subtype.label ).join( ' · ' ) }</em> }
							</button>
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
