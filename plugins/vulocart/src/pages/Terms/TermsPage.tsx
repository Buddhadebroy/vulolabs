/* global vulocartLocalizer */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	FormGroupComponent,
	FormGroupWrapperComponent,
	NavigatorHeaderComponent,
	NoticeManager,
} from '@zyra/components';
import { TableCard, TableRow, CategoryCount } from '@zyra/table';
import { TextInput, TextAreaInput, SelectInput, ButtonInput } from '@zyra/inputs';
import ConfirmPopup from '../../components/ConfirmPopup/ConfirmPopup';
import '../Products/products-page.scss';
import './terms-page.scss';

interface Term extends TableRow {
	id: number;
	taxonomy: string;
	name: string;
	slug: string;
	parent_id: number | null;
	description: string | null;
	product_count: number;
}

interface TermsPageProps {
	/** REST segment under the plugin namespace: `categories`, `collections`, `brands`, `tags`. */
	routeSegment: string;
	headerTitle: string;
	headerDescription: string;
	headerIcon: string;
	/** Singular label for popup titles and notices, e.g. "Category". */
	itemLabel: string;
	/** Only categories nest. */
	hierarchical?: boolean;
}

const DEFAULT_PER_PAGE = 10;

const nonceHeaders = { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } };

/**
 * One list-and-edit screen for every taxonomy (Categories, Collections, Brands, Tags), laid out
 * like VuloPilot's list screens: a header, one card holding a searchable table, Add/Edit in a
 * popup, and a lightbox confirm before deleting.
 */
export function TermsPage( { routeSegment, headerTitle, headerDescription, headerIcon, itemLabel, hierarchical }: TermsPageProps ) {
	const [ terms, setTerms ] = useState< Term[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ searchTerm, setSearchTerm ] = useState( '' );
	const [ paged, setPaged ] = useState( 1 );
	const [ perPage, setPerPage ] = useState( DEFAULT_PER_PAGE );
	const [ usage, setUsage ] = useState( 'all' );

	const [ editingId, setEditingId ] = useState< number | null >( null );
	const [ name, setName ] = useState( '' );
	const [ slug, setSlug ] = useState( '' );
	const [ nameError, setNameError ] = useState( false );
	const formRef = useRef< HTMLDivElement >( null );
	const [ description, setDescription ] = useState( '' );
	const [ parentId, setParentId ] = useState( '' );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ deleteTarget, setDeleteTarget ] = useState< Term | null >( null );
	const [ bulkDeleteIds, setBulkDeleteIds ] = useState< number[] >( [] );

	const load = () => {
		setIsLoading( true );

		getApiResponse< Term[] >( getApiLink( vulocartLocalizer, routeSegment ), nonceHeaders )
			.then( ( response ) => setTerms( response ?? [] ) )
			.finally( () => setIsLoading( false ) );
	};

	useEffect( load, [ routeSegment ] );

	useEffect( () => {
		setPaged( 1 );
	}, [ searchTerm, usage ] );

	const resetForm = () => {
		setEditingId( null );
		setName( '' );
		setSlug( '' );
		setDescription( '' );
		setParentId( '' );
		setNameError( false );
	};

	const openEditForm = ( term: Term ) => {
		setEditingId( term.id );
		setName( term.name );
		setSlug( term.slug );
		setDescription( term.description || '' );
		setParentId( term.parent_id ? String( term.parent_id ) : '' );
		setNameError( false );
		formRef.current?.scrollIntoView( { behavior: 'smooth', block: 'nearest' } );
	};

	const closeForm = resetForm;

	const handleSave = () => {
		if ( ! name.trim() ) {
			setNameError( true );
			return;
		}

		setIsSaving( true );

		// POST to `/{id}` is an update (the route accepts any editable method).
		const endpoint = editingId ? `${ routeSegment }/${ editingId }` : routeSegment;

		sendApiResponse( vulocartLocalizer, getApiLink( vulocartLocalizer, endpoint ), {
			name,
			slug: slug.trim() || undefined,
			description: editingId ? description : description || undefined,
			// 0 clears the parent when editing; a new term simply has none.
			parent_id: hierarchical ? ( parentId ? Number( parentId ) : editingId ? 0 : undefined ) : undefined,
		} )
			.then( ( response ) => {
				NoticeManager.add( {
					uniqueKey: `vulocart-${ routeSegment }-save`,
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? /* translators: %s: item label, e.g. Category. */ sprintf( __( '%s saved.', 'vulocart' ), itemLabel )
						: /* translators: %s: item label, e.g. Category. */ sprintf( __( 'Could not save this %s.', 'vulocart' ), itemLabel.toLowerCase() ),
				} );

				if ( response ) {
					closeForm();
					load();
				}
			} )
			.finally( () => setIsSaving( false ) );
	};

	const handleConfirmDelete = () => {
		if ( ! deleteTarget ) {
			return;
		}

		const term = deleteTarget;
		setDeleteTarget( null );

		axios
			.delete( getApiLink( vulocartLocalizer, `${ routeSegment }/${ term.id }` ), nonceHeaders )
			.then( () => {
				NoticeManager.add( {
					uniqueKey: `vulocart-${ routeSegment }-delete`,
					type: 'success',
					position: 'float',
					/* translators: %s: item label, e.g. Category. */
					message: sprintf( __( '%s deleted.', 'vulocart' ), itemLabel ),
				} );
				load();
			} )
			.catch( () => {
				NoticeManager.add( {
					uniqueKey: `vulocart-${ routeSegment }-delete`,
					type: 'error',
					position: 'float',
					/* translators: %s: item label, e.g. Category. */
					message: sprintf( __( 'Could not delete this %s.', 'vulocart' ), itemLabel.toLowerCase() ),
				} );
			} );
	};

	const confirmBulkDelete = () => {
		const ids = bulkDeleteIds;
		setBulkDeleteIds( [] );

		Promise.all( ids.map( ( id ) => axios.delete( getApiLink( vulocartLocalizer, `${ routeSegment }/${ id }` ), nonceHeaders ) ) )
			.then( () =>
				NoticeManager.add( {
					uniqueKey: `vulocart-${ routeSegment }-delete`,
					type: 'success',
					position: 'float',
					message: __( 'Selected entries deleted.', 'vulocart' ),
				} )
			)
			.finally( load );
	};

	const parentName = ( term: Term ): string | null =>
		term.parent_id ? terms.find( ( candidate ) => candidate.id === term.parent_id )?.name ?? null : null;

	/** Parents first, each followed by its children at any depth, so a category tree reads as a tree. */
	const depths = new Map< number, number >();
	const ordered = ( () => {
		const byName = ( a: Term, b: Term ) => a.name.localeCompare( b.name );
		const known = new Set( terms.map( ( term ) => term.id ) );
		const out: Term[] = [];

		const walk = ( parent: number | null, depth: number, seen: Set< number > ) =>
			terms
				.filter( ( term ) => ( parent === null ? ! term.parent_id || ! known.has( term.parent_id ) : term.parent_id === parent ) && ! seen.has( term.id ) )
				.sort( byName )
				.forEach( ( term ) => {
					seen.add( term.id );
					depths.set( term.id, depth );
					out.push( term );
					walk( term.id, depth + 1, seen );
				} );

		walk( null, 0, new Set() );

		return out;
	} )();

	const inUse = terms.filter( ( term ) => ( term.product_count ?? 0 ) > 0 ).length;

	const categoryCounts: CategoryCount[] = [
		{ value: 'all', label: __( 'All', 'vulocart' ), count: terms.length },
		{ value: 'used', label: __( 'In use', 'vulocart' ), count: inUse },
		{ value: 'empty', label: __( 'Empty', 'vulocart' ), count: terms.length - inUse },
	];

	const visibleTerms = ordered.filter( ( term ) => {
		const query = searchTerm.trim().toLowerCase();
		const count = term.product_count ?? 0;

		if ( ( 'used' === usage && 0 === count ) || ( 'empty' === usage && count > 0 ) ) {
			return false;
		}

		return ! query || term.name.toLowerCase().includes( query ) || term.slug.toLowerCase().includes( query );
	} );

	const pageRows = visibleTerms.slice( ( paged - 1 ) * perPage, paged * perPage );

	const descendantsOfEditing = new Set< number >();

	if ( editingId ) {
		descendantsOfEditing.add( editingId );
		ordered.forEach( ( term ) => term.parent_id && descendantsOfEditing.has( term.parent_id ) && descendantsOfEditing.add( term.id ) );
	}

	const parentOptions = ordered
		.filter( ( term ) => ! descendantsOfEditing.has( term.id ) )
		.map( ( term ) => ( { label: `${ '\u00A0\u00A0'.repeat( depths.get( term.id ) ?? 0 ) }${ term.name }`, value: String( term.id ) } ) );

	const headers = {
		name: {
			label: itemLabel,
			required: true,
			render: ( row: Term ) => {
				const parent = parentName( row );

				return (
					<div className={ `vulocart-product-cell${ parent ? ' is-child' : '' }` } style={ { paddingLeft: `${ ( depths.get( row.id ) ?? 0 ) * 1.25 }rem` } }>
						<a
							className="vulocart-product-cell-title"
							href="#edit"
							onClick={ ( event ) => {
								event.preventDefault();
								openEditForm( row );
							} }
						>
							{ row.name }
						</a>
						{ row.description ? <div className="desc">{ row.description }</div> : null }
						<div className="vulocart-product-cell-tags">
							<span className={ `admin-badge ${ ( row.product_count ?? 0 ) > 0 ? 'badge-active' : 'badge-inactive' }` }>
								{ sprintf(
									/* translators: %d: number of products. */
									_n( '%d product', '%d products', row.product_count ?? 0, 'vulocart' ),
									row.product_count ?? 0
								) }
							</span>
							<span className="desc">{ row.slug }</span>
							{ parent ? (
								<span className="admin-badge badge-pending">
									{ /* translators: %s: parent category name. */ sprintf( __( 'In %s', 'vulocart' ), parent ) }
								</span>
							) : null }
						</div>
					</div>
				);
			},
		},
		actions: {
			label: __( 'Actions', 'vulocart' ),
			type: 'action',
			actions: [
				{
					label: __( 'Edit', 'vulocart' ),
					icon: 'edit',
					type: 'button',
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => openEditForm( row as unknown as Term ),
				},
				{
					label: __( 'Delete', 'vulocart' ),
					icon: 'delete',
					type: 'button',
					color: 'text-red',
					onClick: ( row: Record< string, unknown > ) => setDeleteTarget( row as unknown as Term ),
				},
			],
		},
	};

	const lowerItem = itemLabel.toLowerCase();

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent headerIcon={ headerIcon } headerTitle={ headerTitle } headerDescription={ headerDescription } />

				<div className="vulocart-terms-layout">
					<div className="vulocart-terms-form" ref={ formRef }>
						<CardComponent
							titleIcon={ editingId ? 'edit' : 'plus' }
							title={ editingId
								? /* translators: %s: item label, e.g. Category. */ sprintf( __( 'Edit %s', 'vulocart' ), lowerItem )
								: /* translators: %s: item label, e.g. Category. */ sprintf( __( 'Add new %s', 'vulocart' ), lowerItem ) }
						>
							<FormGroupWrapperComponent>
								<FormGroupComponent label={ __( 'Name', 'vulocart' ) } htmlFor="vulocart-term-name">
									<TextInput
										id="vulocart-term-name"
										name="name"
										type="text"
										inputClass={ nameError ? 'has-error' : '' }
										value={ name }
										onChange={ ( value ) => {
											setName( value as string );
											setNameError( false );
										} }
									/>
									{ nameError
										? <p className="vulocart-field-error" role="alert">{ __( 'A name is required.', 'vulocart' ) }</p>
										: <p className="vulocart-field-hint">{ __( 'How it appears across your store.', 'vulocart' ) }</p> }
								</FormGroupComponent>
								<FormGroupComponent label={ __( 'Slug', 'vulocart' ) } htmlFor="vulocart-term-slug">
									<TextInput id="vulocart-term-slug" name="slug" type="text" value={ slug } onChange={ ( value ) => setSlug( value as string ) } />
									<p className="vulocart-field-hint">{ __( 'The URL-friendly version. Leave blank to create it from the name.', 'vulocart' ) }</p>
								</FormGroupComponent>
								{ hierarchical && (
									<FormGroupComponent label={ __( 'Parent', 'vulocart' ) } htmlFor="vulocart-term-parent">
										<SelectInput
											name="parent_id"
											type="single-select"
											options={ [ { label: __( 'None (top level)', 'vulocart' ), value: '' }, ...parentOptions ] }
											value={ parentId }
											onChange={ ( value ) => setParentId( value as string ) }
										/>
										<p className="vulocart-field-hint">{ __( 'Nest this under another category to build a hierarchy.', 'vulocart' ) }</p>
									</FormGroupComponent>
								) }
								<FormGroupComponent label={ __( 'Description', 'vulocart' ) } htmlFor="vulocart-term-description">
									<TextAreaInput name="description" rowNumber={ 3 } value={ description } onChange={ ( value ) => setDescription( value as string ) } />
									<p className="vulocart-field-hint">{ __( 'Optional. Shown on some storefront layouts.', 'vulocart' ) }</p>
								</FormGroupComponent>
							</FormGroupWrapperComponent>

							<div className="vulocart-terms-form-actions">
								<ButtonInput
									buttons={ {
										text: isSaving
											? __( 'Saving…', 'vulocart' )
											: editingId
											? /* translators: %s: item label, e.g. Category. */ sprintf( __( 'Update %s', 'vulocart' ), lowerItem )
											: /* translators: %s: item label, e.g. Category. */ sprintf( __( 'Add new %s', 'vulocart' ), lowerItem ),
										icon: editingId ? 'save' : 'plus',
										onClick: handleSave,
										disabled: isSaving,
									} }
								/>
								{ editingId && (
									<button type="button" className="vulocart-term-more" onClick={ closeForm }>
										{ __( 'Cancel', 'vulocart' ) }
									</button>
								) }
							</div>
						</CardComponent>
					</div>

					<div className="vulocart-terms-list">
						<CardComponent>
							<TableCard
								showMenu={ false }
								variant="transparent"
								hideHeader={ true }
								headerHide={ true }
								headers={ headers }
								rows={ pageRows }
								ids={ pageRows.map( ( row ) => row.id ) }
								totalRows={ visibleTerms.length }
								isLoading={ isLoading }
								categoryCounts={ categoryCounts }
								activeCategory="all"
								search={ { placeholder: __( 'Search by name or slug…', 'vulocart' ) } }
								bulkActions={ [ { label: __( 'Delete', 'vulocart' ), value: 'delete' } ] }
								onBulkActionApply={ ( action: string, ids: number[] ) => 'delete' === action && ids.length && setBulkDeleteIds( ids ) }
								onQueryUpdate={ ( query: { paged?: number | string; per_page?: number | string; searchValue?: string; categoryFilter?: string } ) => {
									setUsage( query.categoryFilter || 'all' );
									setPaged( Number( query.paged ) || 1 );
									setPerPage( Number( query.per_page ) || DEFAULT_PER_PAGE );
									setSearchTerm( query.searchValue ?? '' );
								} }
								emptyMessage={ sprintf(
									/* translators: %s: plural title, e.g. Categories. */
									__( 'No %s yet - add the first one.', 'vulocart' ),
									headerTitle.toLowerCase()
								) }
							/>
						</CardComponent>
					</div>
				</div>

				<ConfirmPopup
					open={ !! deleteTarget }
					/* translators: %s: item label, e.g. Category. */
					title={ sprintf( __( 'Delete %s', 'vulocart' ), itemLabel ) }
					message={
						( deleteTarget?.product_count ?? 0 ) > 0
							? sprintf(
									/* translators: %d: number of products. */
									_n( 'This is used by %d product, which will lose it. Delete anyway?', 'This is used by %d products, which will lose it. Delete anyway?', deleteTarget?.product_count ?? 0, 'vulocart' ),
									deleteTarget?.product_count ?? 0
							  )
							: __( 'Delete this entry? This cannot be undone.', 'vulocart' )
					}
					onConfirm={ handleConfirmDelete }
					onCancel={ () => setDeleteTarget( null ) }
				/>

				<ConfirmPopup
					open={ bulkDeleteIds.length > 0 }
					title={ __( 'Delete selected', 'vulocart' ) }
					message={ __( 'Delete the selected entries? This cannot be undone.', 'vulocart' ) }
					onConfirm={ confirmBulkDelete }
					onCancel={ () => setBulkDeleteIds( [] ) }
				/>
			</ColumnComponent>
		</ContainerComponent>
	);
}

export default TermsPage;
