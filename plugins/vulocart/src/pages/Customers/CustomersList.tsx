/* global vulocartLocalizer */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { AvatarComponent, ContainerComponent, ColumnComponent, EntityCellComponent, NavigatorHeaderComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableRow, QueryProps, CategoryCount } from '@zyra/table';
import { TableCard } from '../../components/TableCard/TableCard';
import { downloadCSV } from '../../lib/utils';
import { formatWpDate } from '../../services/formatWpDate';
import ConfirmPopup from '../../components/ConfirmPopup/ConfirmPopup';
import { formatMoney } from '../../blocks/shared/money';
import './customers-page.scss';
import { ViewsMenu, useViewsConfig } from '../../components/ViewsMenu/ViewsMenu';
import '../Products/products-page.scss';

/** Built-in views: each is a server-side filter (`view` on GET /customers). */
const BUILT_IN_VIEWS: { id: string; label: string; hint: string }[] = [
	{ id: '', label: __( 'All', 'vulocart' ), hint: __( 'Every customer', 'vulocart' ) },
	{ id: 'new', label: __( 'New', 'vulocart' ), hint: __( 'Joined in the last 30 days', 'vulocart' ) },
	{ id: 'repeat', label: __( 'Repeat buyers', 'vulocart' ), hint: __( 'Two or more orders', 'vulocart' ) },
	{ id: 'high_value', label: __( 'High value', 'vulocart' ), hint: __( 'Spent 500 or more', 'vulocart' ) },
	{ id: 'inactive', label: __( 'Inactive', 'vulocart' ), hint: __( 'Ordered before, but not in 90 days', 'vulocart' ) },
	{ id: 'never_ordered', label: __( 'No orders', 'vulocart' ), hint: __( 'Have never placed an order', 'vulocart' ) },
	{ id: 'registered', label: __( 'Registered', 'vulocart' ), hint: __( 'Have a site account', 'vulocart' ) },
	{ id: 'guest', label: __( 'Guests', 'vulocart' ), hint: __( 'Checked out without an account', 'vulocart' ) },
];

interface SavedView {
	name: string;
	params: { view: string; search: string };
}

const SAVED_VIEWS_STORAGE_KEY = 'vulocart_customers_saved_views';

/** A saved view is a bookmark of this admin's own view + search, kept in their browser (same as the Products list). */
function loadSavedViews(): SavedView[] {
	try {
		const raw = window.localStorage.getItem( SAVED_VIEWS_STORAGE_KEY );

		return raw ? JSON.parse( raw ) : [];
	} catch {
		return [];
	}
}

/**
 * Saves the customer list's saved filters in this browser; silently skipped when storage is unavailable.
 */
function persistSavedViews( views: SavedView[] ) {
	try {
		window.localStorage.setItem( SAVED_VIEWS_STORAGE_KEY, JSON.stringify( views ) );
	} catch {
		// Storage unavailable - saved views just do not persist; not worth an error for a convenience.
	}
}

/** Names the current view + search as a saved view. */
function SavedViewName( { onClose, onSave }: { onClose: () => void; onSave: ( name: string ) => void } ) {
	const [ name, setName ] = useState( '' );
	const trimmed = name.trim();

	return (
		<PopupComponent
			open
			onClose={ onClose }
			width={ 26 }
			height="auto"
			position="lightbox"
			header={ { icon: 'plus', title: __( 'Save view', 'vulocart' ), description: __( 'Keeps the current view and search.', 'vulocart' ) } }
			footer={
				<ButtonInput
					buttons={ [
						{ text: __( 'Cancel', 'vulocart' ), color: 'purple', onClick: onClose },
						{ text: __( 'Save view', 'vulocart' ), icon: 'check', onClick: () => onSave( trimmed ), disabled: ! trimmed },
					] }
				/>
			}
		>
			<div className="vulocart-qe">
				<label className="vulocart-qe-field">
					<span>{ __( 'View name', 'vulocart' ) }</span>
					<input
						type="text"
						autoFocus
						value={ name }
						onChange={ ( event ) => setName( event.target.value ) }
						onKeyDown={ ( event ) => {
							if ( 'Enter' === event.key && trimmed ) {
								onSave( trimmed );
							}
						} }
					/>
				</label>
			</div>
		</PopupComponent>
	);
}

interface CustomerRow {
	id: number;
	email: string;
	name: string | null;
	phone: string | null;
}

/** Quick edit - name and phone for one customer in a popup over the list, like the Products list's quick edit. */
function CustomerQuickEdit( { customer, onClose, onSaved }: { customer: CustomerRow; onClose: () => void; onSaved: () => void } ) {
	const [ name, setName ] = useState( customer.name ?? '' );
	const [ phone, setPhone ] = useState( customer.phone ?? '' );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ error, setError ] = useState( '' );

	const changed = name !== ( customer.name ?? '' ) || phone !== ( customer.phone ?? '' );

	const save = () => {
		setIsSaving( true );
		setError( '' );

		axios
			.patch( getApiLink( vulocartLocalizer, `customers/${ customer.id }` ), { name, phone }, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( () => {
				onSaved();
				onClose();
			} )
			.catch( ( reason ) => setError( reason?.response?.data?.message || __( 'Could not save this customer.', 'vulocart' ) ) )
			.finally( () => setIsSaving( false ) );
	};

	return (
		<PopupComponent
			open
			onClose={ onClose }
			width={ 30 }
			height="auto"
			position="lightbox"
			header={ { icon: 'membership', title: __( 'Quick edit', 'vulocart' ), description: customer.email } }
			footer={
				<div className="vulocart-qe-footer">
					<a href={ `admin.php?page=customers&action=view&id=${ customer.id }` }>
						{ __( 'Open full profile', 'vulocart' ) } <i className="adminfont-pagination-next-arrow" aria-hidden="true" />
					</a>
					<ButtonInput
						buttons={ [
							{ text: __( 'Cancel', 'vulocart' ), color: 'purple', onClick: onClose },
							{ text: isSaving ? __( 'Saving…', 'vulocart' ) : __( 'Save changes', 'vulocart' ), icon: 'check', onClick: save, disabled: isSaving || ! changed },
						] }
					/>
				</div>
			}
		>
			<div className="vulocart-qe">
				<label className="vulocart-qe-field">
					<span>{ __( 'Name', 'vulocart' ) }</span>
					<input type="text" value={ name } onChange={ ( event ) => setName( event.target.value ) } />
				</label>
				<label className="vulocart-qe-field">
					<span>{ __( 'Phone', 'vulocart' ) }</span>
					<input type="text" value={ phone } onChange={ ( event ) => setPhone( event.target.value ) } />
				</label>
				{ error && <p className="vulocart-qe-error" role="alert">{ error }</p> }
			</div>
		</PopupComponent>
	);
}

/**
 * Add a customer by hand (Customers → Add New, or the header's Add Customer): email, which is the customer's identity,
 * plus name and phone. Saving opens the new customer's profile; an email that already has a customer says so and links
 * to that profile instead of creating a second one.
 */
function CustomerAdd( { onClose }: { onClose: () => void } ) {
	const [ email, setEmail ] = useState( '' );
	const [ name, setName ] = useState( '' );
	const [ phone, setPhone ] = useState( '' );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ error, setError ] = useState( '' );
	const [ existingId, setExistingId ] = useState< number | null >( null );

	const save = () => {
		setIsSaving( true );
		setError( '' );
		setExistingId( null );

		axios
			.post( getApiLink( vulocartLocalizer, 'customers' ), { email: email.trim(), name, phone }, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( ( { data } ) => {
				window.location.href = `admin.php?page=customers&action=view&id=${ data.id }`;
			} )
			.catch( ( reason ) => {
				setIsSaving( false );
				setError( reason?.response?.data?.message || __( 'Could not add this customer.', 'vulocart' ) );
				setExistingId( reason?.response?.data?.data?.id ?? null );
			} );
	};

	return (
		<PopupComponent
			open
			onClose={ onClose }
			width={ 30 }
			height="auto"
			position="lightbox"
			header={ { icon: 'membership', title: __( 'Add customer', 'vulocart' ), description: __( 'Their orders join this profile when they buy with the same email.', 'vulocart' ) } }
			footer={
				<div className="vulocart-qe-footer">
					<span />
					<ButtonInput
						buttons={ [
							{ text: __( 'Cancel', 'vulocart' ), color: 'purple', onClick: onClose },
							{ text: isSaving ? __( 'Adding…', 'vulocart' ) : __( 'Add customer', 'vulocart' ), icon: 'plus', onClick: save, disabled: isSaving || ! email.trim() },
						] }
					/>
				</div>
			}
		>
			<form
				className="vulocart-qe"
				onSubmit={ ( event ) => {
					event.preventDefault();

					if ( ! isSaving && email.trim() ) {
						save();
					}
				} }
			>
				<label className="vulocart-qe-field">
					<span>{ __( 'Email', 'vulocart' ) } *</span>
					{ /* eslint-disable-next-line jsx-a11y/no-autofocus -- the popup opens for this one field. */ }
					<input type="email" value={ email } autoFocus required onChange={ ( event ) => setEmail( event.target.value ) } />
				</label>
				<label className="vulocart-qe-field">
					<span>{ __( 'Name', 'vulocart' ) }</span>
					<input type="text" value={ name } onChange={ ( event ) => setName( event.target.value ) } />
				</label>
				<label className="vulocart-qe-field">
					<span>{ __( 'Phone', 'vulocart' ) }</span>
					<input type="tel" value={ phone } onChange={ ( event ) => setPhone( event.target.value ) } />
				</label>
				{ error && (
					<p className="vulocart-qe-error" role="alert">
						{ error }{ ' ' }
						{ existingId && <a href={ `admin.php?page=customers&action=view&id=${ existingId }` }>{ __( 'Open their profile', 'vulocart' ) }</a> }
					</p>
				) }
				<button type="submit" hidden />
			</form>
		</PopupComponent>
	);
}

/**
 * Admin customer list - `GET /customers` (modules/Customer/Rest.php,
 * manage_options-gated), same `NavigatorHeaderComponent` + `TableCard`
 * pattern `OrdersList.tsx` already establishes. The built-in views (New,
 * Repeat buyers, ...) are the status pills with counts, like Products and
 * Orders; saved views sit in the row above the table. Search across email/name and sortable totals, both backed
 * by real columns on the `Customer` entity (`total_orders`/
 * `total_spent`/`last_order_at`), not computed per-row on the client.
 * The API has no sorting, so no column offers it.
 */
export function CustomersList( { adding = false }: { adding?: boolean } ) {
	// Customers → Add New lands here with the add popup open.
	const [ isAdding, setIsAdding ] = useState( adding );
	const [ isLoading, setIsLoading ] = useState( false );
	const [ rowIds, setRowIds ] = useState< number[] >( [] );
	const [ rows, setRows ] = useState< TableRow[] >( [] );
	const [ totalRows, setTotalRows ] = useState( 0 );
	const [ editing, setEditing ] = useState< CustomerRow | null >( null );
	const [ deleteIds, setDeleteIds ] = useState< number[] >( [] );
	const lastQuery = useRef< QueryProps >( {} );
	// Whether a view or search narrows the list - only then is there something to save as a view.
	const [ hasCriteria, setHasCriteria ] = useState( false );
	const [ activeView, setActiveView ] = useState( '' );
	const [ viewsConfig, setViewsConfig, restoreViews ] = useViewsConfig( 'vulocart_customers_views_config' );
	const [ savedViews, setSavedViews ] = useState< SavedView[] >( loadSavedViews() );
	const [ activeSaved, setActiveSaved ] = useState< string | null >( null );
	const [ isNamingView, setIsNamingView ] = useState( false );
	const [ searchOverride, setSearchOverride ] = useState< string | null >( null );
	const [ categoryCounts, setCategoryCounts ] = useState< CategoryCount[] >( [] );
	const viewRef = useRef( '' );
	const searchRef = useRef< string | null >( null );

	const doRefreshTableData = ( query: QueryProps ) => {
		// Typing a new search replaces whatever search a saved view was carrying.
		if ( null !== searchRef.current && ( query.searchValue || '' ) !== ( lastQuery.current.searchValue || '' ) ) {
			searchRef.current = null;
			setSearchOverride( null );
		}

		// A status pill is a built-in view; picking one clears any saved view.
		if ( query.categoryFilter ) {
			const picked = 'all' === query.categoryFilter ? '' : query.categoryFilter;

			if ( picked !== viewRef.current ) {
				viewRef.current = picked;
				searchRef.current = null;
				setActiveView( picked );
				setActiveSaved( null );
				setSearchOverride( null );
			}
		}

		lastQuery.current = query;
		setHasCriteria( Boolean( viewRef.current || ( null !== searchRef.current ? searchRef.current : query.searchValue ) ) );
		setIsLoading( true );
		axios
			.get( getApiLink( vulocartLocalizer, 'customers' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
				params: {
					search: null !== searchRef.current ? searchRef.current : query.searchValue || '',
					view: viewRef.current,
					page: query.paged || 1,
					per_page: query.per_page || 20,
				},
			} )
			.then( ( response ) => {
				const items: TableRow[] = response.data || [];

				setRowIds( items.map( ( item ) => Number( item.id ) ) );
				setRows( items );
				setTotalRows( Number( response.headers[ 'x-wp-total' ] ) || 0 );
				setIsLoading( false );
			} )
			.catch( () => {
				setRows( [] );
				setTotalRows( 0 );
				setIsLoading( false );
			} );
	};

	const csvHeaders = {
		name: { label: __( 'Name', 'vulocart' ) },
		email: { label: __( 'Email', 'vulocart' ) },
		total_orders: { label: __( 'Orders', 'vulocart' ) },
		total_spent: { label: __( 'Total spent', 'vulocart' ) },
		last_order_at: { label: __( 'Last order', 'vulocart' ) },
	};

	const downloadSelectedCSV = ( selectedIds: number[] ) =>
		downloadCSV( csvHeaders, rows.filter( ( row ) => selectedIds.includes( Number( row.id ) ) ), `vulocart-customers-selected-${ new Date().toISOString().slice( 0, 10 ) }.csv` );

	const downloadAllCSV = ( query: QueryProps ) => {
		axios
			.get( getApiLink( vulocartLocalizer, 'customers' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
				params: { search: null !== searchRef.current ? searchRef.current : query.searchValue || '', view: viewRef.current, per_page: 1000 },
			} )
			.then( ( response ) => downloadCSV( csvHeaders, response.data || [], `vulocart-customers-${ new Date().toISOString().slice( 0, 10 ) }.csv` ) );
	};

	const chooseView = ( id: string, saved: SavedView | null = null ) => {
		viewRef.current = id;
		searchRef.current = saved ? saved.params.search : null;
		setActiveView( id );
		setActiveSaved( saved ? saved.name : null );
		setSearchOverride( searchRef.current );
		doRefreshTableData( lastQuery.current );
	};

	// Counts for the view pills: one cheap request per visible view, reading X-WP-Total (same approach as Products).
	const visibleViews = BUILT_IN_VIEWS.filter( ( view ) => '' === view.id || ! viewsConfig.hidden.includes( view.id ) );
	const loadCounts = () =>
		Promise.all(
			visibleViews.map( ( view ) =>
				axios
					.get( getApiLink( vulocartLocalizer, 'customers' ), { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce }, params: { view: view.id, per_page: 1 } } )
					.then( ( response ) => Number( response.headers[ 'x-wp-total' ] ) || 0 )
					.catch( () => 0 )
			)
		).then( ( counts ) => setCategoryCounts( visibleViews.map( ( view, index ) => ( { value: view.id || 'all', label: view.label, count: counts[ index ] } ) ) ) );

	useEffect( () => {
		loadCounts();
	}, [ JSON.stringify( viewsConfig.hidden ) ] );

	const saveCurrentView = ( name: string ) => {
		const params = { view: viewRef.current, search: null !== searchRef.current ? searchRef.current : lastQuery.current.searchValue || '' };
		const next = [ ...savedViews.filter( ( view ) => view.name !== name ), { name, params } ];

		setSavedViews( next );
		persistSavedViews( next );
		setActiveSaved( name );
		setIsNamingView( false );
	};

	const deleteSavedView = ( name: string ) => {
		const next = savedViews.filter( ( view ) => view.name !== name );

		setSavedViews( next );
		persistSavedViews( next );

		if ( activeSaved === name ) {
			chooseView( '' );
		}
	};

	const headers = {
		name: {
			label: __( 'Customer', 'vulocart' ),
			required: true,
			render: ( row?: TableRow ) => {
				if ( ! row ) {
					return null;
				}

				const who = ( row.name as string ) || ( row.email as string );

				// Avatar, then name and the kind of customer, then their email and when they joined.
				return (
					<div className="vulocart-cust-cell">
						<AvatarComponent name={ who } />
						<EntityCellComponent
							title={ who }
							href={ `admin.php?page=customers&action=view&id=${ row.id }` }
							badges={
								<span className={ `admin-badge ${ row.wp_user_id ? 'badge-active' : 'badge-pending' }` }>
									{ row.wp_user_id ? __( 'Registered', 'vulocart' ) : __( 'Guest', 'vulocart' ) }
								</span>
							}
							details={ [
								...( row.name && row.email ? [ { icon: 'mail', text: row.email as string } ] : [] ),
								...( row.created_at
									? [ { icon: 'calendar', text: sprintf( /* translators: %s: date. */ __( 'Since %s', 'vulocart' ), formatWpDate( row.created_at as string ) ) } ]
									: [] ),
							] }
						/>
					</div>
				);
			},
		},
		total_spent: {
			label: __( 'Spent', 'vulocart' ),
			isNumeric: true,
			render: ( row?: TableRow ) => {
				if ( ! row ) {
					return null;
				}

				const orders = Number( row.total_orders ) || 0;

				return (
					<div className="vulocart-product-cell">
						{ /* Customer rows carry no currency; the formatter falls back to USD, as the Dashboard does. */ }
						<span className="vulocart-product-cell-title">{ formatMoney( Number( row.total_spent ) || 0, row.currency as string | null ) }</span>
						<span className="desc">{ sprintf( /* translators: %d: number of orders. */ _n( '%d order', '%d orders', orders, 'vulocart' ), orders ) }</span>
					</div>
				);
			},
		},
		last_order_at: {
			label: __( 'Last order', 'vulocart' ),
			render: ( row?: TableRow ) =>
				row?.last_order_at ? formatWpDate( row.last_order_at as string ) : <span className="desc">{ __( 'No orders yet', 'vulocart' ) }</span>,
		},
		actions: {
			label: __( 'Actions', 'vulocart' ),
			type: 'action' as const,
			actions: [
				{
					label: __( 'View', 'vulocart' ),
					icon: 'eye',
					onClick: ( row: Record< string, unknown > ) => {
						window.location.href = `admin.php?page=customers&action=view&id=${ row.id }`;
					},
				},
				{
					label: __( 'Quick edit', 'vulocart' ),
					icon: 'setting',
					onClick: ( row: Record< string, unknown > ) => setEditing( row as unknown as CustomerRow ),
				},
				{
					label: __( 'Delete', 'vulocart' ),
					icon: 'delete',
					onClick: ( row: Record< string, unknown > ) => setDeleteIds( [ Number( row.id ) ] ),
				},
			],
		},
	};

	// Deletes the profile, saved addresses and notes; the customer's orders stay (CustomerService::delete_customer()).
	const confirmDelete = () => {
		const ids = deleteIds;
		setDeleteIds( [] );

		const headers = { 'X-WP-Nonce': vulocartLocalizer.nonce };
		const request =
			1 === ids.length
				? axios.delete( getApiLink( vulocartLocalizer, `customers/${ ids[ 0 ] }` ), { headers } )
				: axios.delete( getApiLink( vulocartLocalizer, 'customers/bulk-delete' ), { headers, data: { ids } } );

		request.then( () => {
			doRefreshTableData( lastQuery.current );
			loadCounts();
		} );
	};

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent
					headerIcon="membership"
					headerCustomContent={
						<>
							<ButtonInput
								buttons={ [
									{
										text: __( 'Export', 'vulocart' ),
										icon: 'download',
										color: 'purple',
										onClick: () => downloadAllCSV( lastQuery.current ),
									},
									{
										text: __( 'Add Customer', 'vulocart' ),
										icon: 'plus',
										onClick: () => setIsAdding( true ),
									},
								] }
							/>
							<ViewsMenu builtIns={ BUILT_IN_VIEWS.filter( ( view ) => '' !== view.id ) } config={ viewsConfig } onChange={ ( next ) => { setViewsConfig( next ); if ( ( activeView || activeSaved ) && ( ! next.enabled || next.hidden.includes( activeView ) ) ) { chooseView( '' ); } } } onRestore={ restoreViews } />
						</>
					}
					headerTitle={ __( 'Customers', 'vulocart' ) }
					headerDescription={ __( 'Everyone who has placed an order.', 'vulocart' ) }
				/>

				<div className="vulocart-saved-views" style={ viewsConfig.enabled ? undefined : { display: "none" } }>
					{ viewsConfig.enabled ? (
						<>
					{ savedViews.map( ( view ) => (
						<span key={ view.name } className={ `vulocart-saved-view-chip${ activeSaved === view.name ? ' is-active' : '' }` }>
							<button type="button" onClick={ () => chooseView( view.params.view, view ) }>
								{ view.name }
							</button>
							<i className="adminfont-close-delete" aria-label={ __( 'Delete saved view', 'vulocart' ) } onClick={ () => deleteSavedView( view.name ) } />
						</span>
					) ) }
					{ hasCriteria && ! activeSaved && (
						<button type="button" className="vulocart-save-view-button" onClick={ () => setIsNamingView( true ) }>
							+ { __( 'Save current filters as a view', 'vulocart' ) }
						</button>
					) }
					{ null !== searchOverride && searchOverride && (
						<span className="vulocart-saved-views-label">{ sprintf( /* translators: %s: search text. */ __( 'Searching "%s"', 'vulocart' ), searchOverride ) }</span>
					) }
						</>
										) : null }
				</div>

				<TableCard
					headers={ headers }
					rows={ rows }
					totalRows={ totalRows }
					isLoading={ isLoading }
					onQueryUpdate={ doRefreshTableData }
					ids={ rowIds }
					categoryCounts={ categoryCounts }
					activeCategory={ activeSaved ? 'all' : activeView || 'all' }
					search={ {
						placeholder: __( 'Search name or email…', 'vulocart' ),
					} }
					bulkActions={ [ { label: __( 'Delete', 'vulocart' ), value: 'delete' } ] }
					onBulkActionApply={ ( action: string, selectedIds: number[] ) => 'delete' === action && selectedIds.length && setDeleteIds( selectedIds ) }
					onSelectCsvDownloadApply={ downloadSelectedCSV }
				/>
			</ColumnComponent>

			<ConfirmPopup
				open={ deleteIds.length > 0 }
				title={ 1 === deleteIds.length ? __( 'Delete customer', 'vulocart' ) : __( 'Delete customers', 'vulocart' ) }
				message={ sprintf(
					/* translators: %d: number of customers. */
					_n(
						'Permanently delete this customer with their saved addresses and notes? Their orders are kept. This cannot be undone.',
						'Permanently delete %d customers with their saved addresses and notes? Their orders are kept. This cannot be undone.',
						deleteIds.length,
						'vulocart'
					),
					deleteIds.length
				) }
				onConfirm={ confirmDelete }
				onCancel={ () => setDeleteIds( [] ) }
			/>

			{ isAdding && (
				<CustomerAdd
					onClose={ () => {
						setIsAdding( false );

						// Leaving Add New: back to the plain list URL, so a reload doesn't reopen the popup.
						if ( new URLSearchParams( window.location.search ).get( 'action' ) === 'add' ) {
							window.history.replaceState( null, '', 'admin.php?page=customers' );
						}
					} }
				/>
			) }
			{ editing && <CustomerQuickEdit customer={ editing } onClose={ () => setEditing( null ) } onSaved={ () => doRefreshTableData( lastQuery.current ) } /> }
			{ isNamingView && <SavedViewName onClose={ () => setIsNamingView( false ) } onSave={ saveCurrentView } /> }
		</ContainerComponent>
	);
}

export default CustomersList;
