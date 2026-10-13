/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	FormGroupComponent,
	FormGroupWrapperComponent,
	InformationItemComponent,
	NavigatorHeaderComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import { TableCard, TableRow } from '@zyra/table';
import { TextInput, TextAreaInput, SelectInput, ButtonInput } from '@zyra/inputs';
import ConfirmPopup from '../../components/ConfirmPopup/ConfirmPopup';

interface Term extends TableRow {
	id: number;
	taxonomy: string;
	name: string;
	slug: string;
	parent_id: number | null;
	description: string | null;
	offering_count: number;
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

	const [ isFormOpen, setIsFormOpen ] = useState( false );
	const [ editingId, setEditingId ] = useState< number | null >( null );
	const [ name, setName ] = useState( '' );
	const [ description, setDescription ] = useState( '' );
	const [ parentId, setParentId ] = useState( '' );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ deleteTarget, setDeleteTarget ] = useState< Term | null >( null );

	const load = () => {
		setIsLoading( true );

		getApiResponse< Term[] >( getApiLink( vulocartLocalizer, routeSegment ), nonceHeaders )
			.then( ( response ) => setTerms( response ?? [] ) )
			.finally( () => setIsLoading( false ) );
	};

	useEffect( load, [ routeSegment ] );

	useEffect( () => {
		setPaged( 1 );
	}, [ searchTerm ] );

	const resetForm = () => {
		setEditingId( null );
		setName( '' );
		setDescription( '' );
		setParentId( '' );
	};

	const openAddForm = () => {
		resetForm();
		setIsFormOpen( true );
	};

	const openEditForm = ( term: Term ) => {
		setEditingId( term.id );
		setName( term.name );
		setDescription( term.description || '' );
		setParentId( term.parent_id ? String( term.parent_id ) : '' );
		setIsFormOpen( true );
	};

	const closeForm = () => {
		setIsFormOpen( false );
		resetForm();
	};

	const handleSave = () => {
		if ( ! name.trim() ) {
			return;
		}

		setIsSaving( true );

		// POST to `/{id}` is an update (the route accepts any editable method).
		const endpoint = editingId ? `${ routeSegment }/${ editingId }` : routeSegment;

		sendApiResponse( vulocartLocalizer, getApiLink( vulocartLocalizer, endpoint ), {
			name,
			description: description || undefined,
			parent_id: hierarchical && parentId ? Number( parentId ) : undefined,
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

	const parentName = ( term: Term ): string | null =>
		term.parent_id ? terms.find( ( candidate ) => candidate.id === term.parent_id )?.name ?? null : null;

	const visibleTerms = terms.filter( ( term ) => {
		const query = searchTerm.trim().toLowerCase();

		return ! query || term.name.toLowerCase().includes( query ) || term.slug.toLowerCase().includes( query );
	} );

	const pageRows = visibleTerms.slice( ( paged - 1 ) * perPage, paged * perPage );

	const parentOptions = terms
		.filter( ( term ) => ! term.parent_id && term.id !== editingId )
		.map( ( term ) => ( { label: term.name, value: String( term.id ) } ) );

	const headers = {
		name: {
			label: itemLabel,
			render: ( row: Term ) => {
				const parent = parentName( row );

				return (
					<InformationItemComponent
						title={ row.name }
						badges={ [
							{ text: row.slug, className: 'badge-info' },
							{
								text: sprintf(
									/* translators: %d: number of offerings. */
									_n( '%d Offering', '%d Offerings', row.offering_count ?? 0, 'vulocart' ),
									row.offering_count ?? 0
								),
								className: 'blue',
							},
						] }
						descriptions={ [
							...( parent ? [ { icon: 'category', label: __( 'Parent', 'vulocart' ), value: parent } ] : [] ),
							...( row.description ? [ { icon: 'document', label: __( 'Description', 'vulocart' ), value: row.description } ] : [] ),
						] }
					/>
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

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent headerIcon={ headerIcon } headerTitle={ headerTitle } headerDescription={ headerDescription } />

				<CardComponent title={ headerTitle } titleIcon={ headerIcon } desc={ headerDescription }>
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
						search={ { placeholder: __( 'Search by name or slug…', 'vulocart' ) } }
						buttonActions={ [
							{
								/* translators: %s: item label, e.g. Category. */
								label: sprintf( __( 'Add %s', 'vulocart' ), itemLabel ),
								icon: 'plus',
								onClick: openAddForm,
							},
						] }
						onQueryUpdate={ ( query: { paged?: number | string; per_page?: number | string; searchValue?: string } ) => {
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

				<PopupComponent
					open={ isFormOpen }
					onClose={ closeForm }
					width={ 28 }
					height="auto"
					header={ {
						title: editingId
							? /* translators: %s: item label, e.g. Category. */ sprintf( __( 'Edit %s', 'vulocart' ), itemLabel )
							: /* translators: %s: item label, e.g. Category. */ sprintf( __( 'Add %s', 'vulocart' ), itemLabel ),
						icon: editingId ? 'edit' : 'plus',
					} }
					footer={
						<ButtonInput
							buttons={ {
								text: isSaving ? __( 'Saving…', 'vulocart' ) : __( 'Save', 'vulocart' ),
								icon: 'save',
								onClick: handleSave,
								disabled: isSaving || ! name.trim(),
							} }
						/>
					}
				>
					<FormGroupWrapperComponent>
						<FormGroupComponent label={ __( 'Name', 'vulocart' ) } htmlFor="vulocart-term-name">
							<TextInput name="name" type="text" value={ name } onChange={ ( value ) => setName( value as string ) } />
						</FormGroupComponent>
						<FormGroupComponent label={ __( 'Description', 'vulocart' ) } htmlFor="vulocart-term-description">
							<TextAreaInput name="description" value={ description } onChange={ ( value ) => setDescription( value as string ) } />
						</FormGroupComponent>
						{ hierarchical && (
							<FormGroupComponent label={ __( 'Parent', 'vulocart' ) } htmlFor="vulocart-term-parent">
								<SelectInput
									name="parent_id"
									type="single-select"
									options={ [ { label: __( 'None', 'vulocart' ), value: '' }, ...parentOptions ] }
									value={ parentId }
									onChange={ ( value ) => setParentId( value as string ) }
								/>
							</FormGroupComponent>
						) }
					</FormGroupWrapperComponent>
				</PopupComponent>

				<ConfirmPopup
					open={ !! deleteTarget }
					/* translators: %s: item label, e.g. Category. */
					title={ sprintf( __( 'Delete %s', 'vulocart' ), itemLabel ) }
					message={ __( 'Delete this entry? This cannot be undone.', 'vulocart' ) }
					onConfirm={ handleConfirmDelete }
					onCancel={ () => setDeleteTarget( null ) }
				/>
			</ColumnComponent>
		</ContainerComponent>
	);
}

export default TermsPage;
