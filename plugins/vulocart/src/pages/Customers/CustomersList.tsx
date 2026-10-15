/* global vulocartLocalizer */
import { useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { ContainerComponent, ColumnComponent, NavigatorHeaderComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard, TableRow, QueryProps } from '@zyra/table';
import { downloadCSV } from '../../lib/utils';
import { formatWpDate } from '../../services/formatWpDate';
import ConfirmPopup from '../../components/ConfirmPopup/ConfirmPopup';
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
					<a href={ `admin.php?page=vulocart-customers&action=view&id=${ customer.id }` }>
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
 * Admin customer list - `GET /customers` (modules/Customer/Rest.php,
 * manage_options-gated), same `NavigatorHeaderComponent` + `TableCard`
 * pattern `OrdersList.tsx` already establishes. No category tabs (a
 * customer has no fulfillment/payment-status-like dimension to filter
 * by) - just search across email/name and sortable totals, both backed
 * by real columns on the `Customer` entity (`total_orders`/
 * `total_spent`/`last_order_at`), not computed per-row on the client.
 * The API has no sorting, so no column offers it.
 */
export function CustomersList() {
	const [ isLoading, setIsLoading ] = useState( false );
	const [ rowIds, setRowIds ] = useState< number[] >( [] );
	const [ rows, setRows ] = useState< TableRow[] >( [] );
	const [ totalRows, setTotalRows ] = useState( 0 );
	const [ editing, setEditing ] = useState< CustomerRow | null >( null );
	const [ deleteIds, setDeleteIds ] = useState< number[] >( [] );
	const lastQuery = useRef< QueryProps >( {} );
	const [ activeView, setActiveView ] = useState( '' );
	const [ viewsConfig, setViewsConfig, restoreViews ] = useViewsConfig( 'vulocart_customers_views_config' );
	const [ savedViews, setSavedViews ] = useState< SavedView[] >( loadSavedViews() );
	const [ activeSaved, setActiveSaved ] = useState< string | null >( null );
	const [ isNamingView, setIsNamingView ] = useState( false );
	const [ searchOverride, setSearchOverride ] = useState< string | null >( null );
	const viewRef = useRef( '' );
	const searchRef = useRef< string | null >( null );

	const doRefreshTableData = ( query: QueryProps ) => {
		// Typing a new search replaces whatever search a saved view was carrying.
		if ( null !== searchRef.current && ( query.searchValue || '' ) !== ( lastQuery.current.searchValue || '' ) ) {
			searchRef.current = null;
			setSearchOverride( null );
		}

		lastQuery.current = query;
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

				// Avatar, then name and email, then the kind of customer and when they joined.
				return (
					<div className="vulocart-cust-cell">
						<span className="vulocart-cust-avatar" aria-hidden="true">
							{ ( who.trim().charAt( 0 ) || '#' ).toUpperCase() }
						</span>
						<div className="vulocart-cust-main">
							<a className="vulocart-product-cell-title" href={ `admin.php?page=vulocart-customers&action=view&id=${ row.id }` }>
								{ who }
							</a>
							{ row.name && row.email ? <div className="desc">{ row.email as string }</div> : null }
							<div className="vulocart-product-cell-tags">
								<span className={ `admin-badge ${ row.wp_user_id ? 'badge-active' : 'badge-pending' }` }>
									{ row.wp_user_id ? __( 'Registered', 'vulocart' ) : __( 'Guest', 'vulocart' ) }
								</span>
								{ row.created_at && (
									<span className="desc">{ sprintf( /* translators: %s: date. */ __( 'Since %s', 'vulocart' ), formatWpDate( row.created_at as string ) ) }</span>
								) }
							</div>
						</div>
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
						<span className="vulocart-product-cell-title">{ ( Number( row.total_spent ) || 0 ).toFixed( 2 ) }</span>
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
					type: 'button' as const,
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => {
						window.location.href = `admin.php?page=vulocart-customers&action=view&id=${ row.id }`;
					},
				},
				{
					label: __( 'Quick edit', 'vulocart' ),
					icon: 'bulk-action',
					type: 'button' as const,
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => setEditing( row as unknown as CustomerRow ),
				},
				{
					label: __( 'Delete', 'vulocart' ),
					icon: 'delete',
					type: 'button' as const,
					color: 'text-red',
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

		request.then( () => doRefreshTableData( lastQuery.current ) );
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
													] }
							/>
							<ViewsMenu builtIns={ BUILT_IN_VIEWS.filter( ( view ) => '' !== view.id ) } config={ viewsConfig } onChange={ ( next ) => { setViewsConfig( next ); if ( ( activeView || activeSaved ) && ( ! next.enabled || next.hidden.includes( activeView ) ) ) { chooseView( '' ); } } } onRestore={ restoreViews } />
						</>
					}
					headerTitle={ __( 'Customers', 'vulocart' ) }
					headerDescription={ __(
						'Every shopper who has placed an order - profile, saved addresses, order history, and internal notes in one place.',
						'vulocart'
					) }
				/>

				<div className="vulocart-saved-views" style={ viewsConfig.enabled ? undefined : { display: "none" } }>
					{ viewsConfig.enabled ? (
						<>
					<span className="vulocart-saved-views-label">{ __( 'Views:', 'vulocart' ) }</span>
					{ BUILT_IN_VIEWS.filter( ( view ) => '' === view.id || ! viewsConfig.hidden.includes( view.id ) ).map( ( view ) => (
						<span key={ view.id || 'all' } className={ `vulocart-saved-view-chip${ activeView === view.id && ! activeSaved ? ' is-active' : '' }` }>
							<button type="button" title={ view.hint } onClick={ () => chooseView( view.id ) }>
								{ view.label }
							</button>
						</span>
					) ) }
					{ savedViews.map( ( view ) => (
						<span key={ view.name } className={ `vulocart-saved-view-chip${ activeSaved === view.name ? ' is-active' : '' }` }>
							<button type="button" onClick={ () => chooseView( view.params.view, view ) }>
								{ view.name }
							</button>
							<i className="adminfont-close-delete" aria-label={ __( 'Delete saved view', 'vulocart' ) } onClick={ () => deleteSavedView( view.name ) } />
						</span>
					) ) }
					<button type="button" className="vulocart-save-view-button" onClick={ () => setIsNamingView( true ) }>
						+ { __( 'Save current filters as a view', 'vulocart' ) }
					</button>
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

			{ editing && <CustomerQuickEdit customer={ editing } onClose={ () => setEditing( null ) } onSaved={ () => doRefreshTableData( lastQuery.current ) } /> }
			{ isNamingView && <SavedViewName onClose={ () => setIsNamingView( false ) } onSave={ saveCurrentView } /> }
		</ContainerComponent>
	);
}

export default CustomersList;
