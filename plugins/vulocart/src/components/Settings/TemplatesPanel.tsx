/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import axios from 'axios';
import { ContainerComponent } from '@zyra/components';
import { showErrorToast, errorMessageOf } from '../../lib/rest-errors';
import './templates-panel.scss';

type Template = 'grid' | 'compact' | 'list' | 'showcase';

const TEMPLATES: { id: Template; label: string; desc: string }[] = [
	{ id: 'grid', label: __( 'Grid', 'vulocart' ), desc: __( 'Image cards in a tidy grid. A good default for most catalogs.', 'vulocart' ) },
	{ id: 'compact', label: __( 'Compact', 'vulocart' ), desc: __( 'Small tiles, more per row. Best for large catalogs.', 'vulocart' ) },
	{ id: 'list', label: __( 'List', 'vulocart' ), desc: __( 'One row per product with a short description.', 'vulocart' ) },
	{ id: 'showcase', label: __( 'Showcase', 'vulocart' ), desc: __( 'Large image-first cards with a soft shadow.', 'vulocart' ) },
];

const COLUMNS = [ '2', '3', '4', '5' ];

const client = axios.create( {
	baseURL: `${ vulocartLocalizer.apiUrl }/${ vulocartLocalizer.restUrl }`,
	headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
} );

/** A small drawing of what each layout looks like, so the choice is visual. */
function Preview( { template }: { template: Template } ) {
	const count = { grid: 6, compact: 12, list: 3, showcase: 2 }[ template ];

	return (
		<div className={ `vulocart-tpl-preview is-${ template }` } aria-hidden="true">
			{ Array.from( { length: count } ).map( ( _, index ) => (
				<span key={ index }>
					<i />
					<b />
					<em />
				</span>
			) ) }
		</div>
	);
}

/**
 * Settings → Templates ("Start from a template"): picks how the public products catalog looks.
 * Saves on every change, like the other settings screens, and the storefront block reads the same
 * two settings (`listing_template`, `listing_columns`) unless a page overrides them in the editor.
 */
export default function TemplatesPanel() {
	const [ template, setTemplate ] = useState< Template >( 'grid' );
	const [ columns, setColumns ] = useState( '4' );
	const [ status, setStatus ] = useState< 'idle' | 'saving' | 'saved' >( 'idle' );

	useEffect( () => {
		client
			.get< Record< string, unknown > >( '/settings' )
			.then( ( response ) => {
				const stored = response.data.listing_template as Template | undefined;
				setTemplate( stored && TEMPLATES.some( ( item ) => item.id === stored ) ? stored : 'grid' );
				setColumns( COLUMNS.includes( String( response.data.listing_columns ) ) ? String( response.data.listing_columns ) : '4' );
			} )
			.catch( ( error ) => showErrorToast( errorMessageOf( error ) ) );
	}, [] );

	const save = ( patch: { listing_template?: Template; listing_columns?: string } ) => {
		setStatus( 'saving' );

		client
			.post( '/settings', patch )
			.then( () => setStatus( 'saved' ) )
			.catch( ( error ) => {
				setStatus( 'idle' );
				showErrorToast( errorMessageOf( error ) );
			} );
	};

	return (
		<>
			<ContainerComponent general>
				<div className="vulocart-tpl-panel">
					<div className="vulocart-tpl-grid" role="radiogroup" aria-label={ __( 'Listing template', 'vulocart' ) }>
						{ TEMPLATES.map( ( item ) => (
							<button
								type="button"
								role="radio"
								key={ item.id }
								aria-checked={ item.id === template }
								className={ `vulocart-tpl-card${ item.id === template ? ' is-active' : '' }` }
								onClick={ () => {
									setTemplate( item.id );
									save( { listing_template: item.id } );
								} }
							>
								<Preview template={ item.id } />
								<strong>{ item.label }</strong>
								<span>{ item.desc }</span>
							</button>
						) ) }
					</div>

					{ 'list' !== template && (
						<div className="vulocart-tpl-columns">
							<span className="vulocart-tpl-label">{ __( 'Columns on wide screens', 'vulocart' ) }</span>
							<div className="vulocart-segmented" role="radiogroup" aria-label={ __( 'Columns', 'vulocart' ) }>
								{ COLUMNS.map( ( value ) => (
									<button
										type="button"
										role="radio"
										key={ value }
										aria-checked={ value === columns }
										className={ value === columns ? 'is-active' : '' }
										onClick={ () => {
											setColumns( value );
											save( { listing_columns: value } );
										} }
									>
										{ value }
									</button>
								) ) }
							</div>
						</div>
					) }

					<p className="vulocart-tpl-status" aria-live="polite">
						{ 'saving' === status && __( 'Saving…', 'vulocart' ) }
						{ 'saved' === status && __( 'Saved', 'vulocart' ) }
					</p>
				</div>
			</ContainerComponent>
		</>
	);
}
