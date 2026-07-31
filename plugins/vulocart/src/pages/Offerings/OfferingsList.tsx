/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { ContainerComponent, ColumnComponent, NavigatorHeaderComponent } from '@zyra/components';
import { TableCard, TableRow, QueryProps, CategoryCount } from '@zyra/table';
import { downloadCSV } from '../../lib/utils';
import './offerings-page.scss';

/**
 * OfferingType::all() (classes/Domain/Offering/OfferingType.php), same
 * duplicated-not-fetched tradeoff OfferingEdit.tsx's own copy of this list
 * already accepts.
 */
const OFFERING_TYPE_OPTIONS = [
	'physical',
	'digital',
	'subscription',
	'course',
	'service',
	'membership',
	'booking',
	'rental',
	'bundle',
	'donation',
	'gift_card',
	'license',
].map( ( type ) => ( { label: type, value: type } ) );

const STOCK_STATUS_OPTIONS = [
	{ label: __( 'In stock', 'vulocart' ), value: 'in_stock' },
	{ label: __( 'Out of stock', 'vulocart' ), value: 'out_of_stock' },
	{ label: __( 'On backorder', 'vulocart' ), value: 'backorder' },
];

const STATUS_OPTIONS = [
	{ label: __( 'Draft', 'vulocart' ), value: 'draft' },
	{ label: __( 'Published', 'vulocart' ), value: 'published' },
	{ label: __( 'Archived', 'vulocart' ), value: 'archived' },
];

interface CategoryOption {
	id: number;
	name: string;
	slug: string;
}

interface OfferingMeta {
	sale_price?: number | null;
	stock_status?: string;
	stock_quantity?: number | null;
}

/**
 * Deliberately not `extends TableRow` — `TableRow`'s index signature is
 * `string | number | boolean | React.ReactNode`, which `meta` (a nested
 * object) doesn't satisfy. Every row this app hands to `OfferingQuickEdit`
 * is cast `as unknown as QuickEditRow` (same pattern TermsPage.tsx already
 * uses for its own `row as unknown as Term` cast) rather than structurally
 * typed against `TableRow`.
 */
interface QuickEditRow {
	id: number;
	title: string;
	status: string;
	price: number | null;
	meta?: OfferingMeta;
}

interface SavedView {
	name: string;
	params: { status: string; type: string; category: string; search: string };
}

const SAVED_VIEWS_STORAGE_KEY = 'vulocart_offerings_saved_views';

/**
 * Reads/writes named filter presets to `localStorage` — deliberately not a
 * new DB table/REST endpoint: a "saved view" here is just a bookmark of
 * this admin's own status/type/category/search combo, scoped to their own
 * browser, the same low-stakes tradeoff a browser bookmark already is. If
 * cross-device/shared saved views are ever wanted, that's a real new
 * entity (Suppliers/Pricing-Rules-shaped, `classes/Domain/...` + REST),
 * not this.
 */
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
		// localStorage unavailable (private browsing, quota) — saved views
		// just don't persist across reloads; not worth surfacing an error
		// for a convenience feature.
	}
}

/**
 * A small centered modal for editing an offering's price/sale price/
 * status/stock without leaving the list — "Quick Edit". Deliberately not
 * built on zyra `TableCard`'s own `isEditable`/`onCellEdit` inline-cell-edit
 * mechanism: the installed `@multivendorx/zyra` build hardcodes
 * `isEditing: false` in its `TableEditable` renderer (packages/table/src/
 * Table.tsx), so that mechanism never actually enters edit mode — a real
 * upstream gap, not something to work around by forking zyra (external
 * dependency, "maintained elsewhere" per CLAUDE.md).
 *
 * Sends the full existing `meta` bag back on save, not just the fields this
 * modal edits — `update_item()`'s own `$data['meta']` handling replaces
 * `Offering::$meta` wholesale rather than merging (Controllers/Offerings.php),
 * the same contract OfferingEdit.tsx's full save already relies on. A
 * partial-meta PATCH here would silently wipe every other field (categories,
 * tags, description, ...) if this modal didn't preserve them itself.
 */
function OfferingQuickEdit( { row, onClose, onSaved }: { row: QuickEditRow; onClose: () => void; onSaved: () => void } ) {
	const [ title, setTitle ] = useState( row.title );
	const [ price, setPrice ] = useState( row.price !== null && row.price !== undefined ? String( row.price ) : '' );
	const [ salePrice, setSalePrice ] = useState(
		row.meta?.sale_price !== null && row.meta?.sale_price !== undefined ? String( row.meta.sale_price ) : ''
	);
	const [ status, setStatus ] = useState( row.status );
	const [ stockStatus, setStockStatus ] = useState( row.meta?.stock_status || 'in_stock' );
	const [ stockQuantity, setStockQuantity ] = useState(
		row.meta?.stock_quantity !== null && row.meta?.stock_quantity !== undefined ? String( row.meta.stock_quantity ) : ''
	);
	const [ isSaving, setIsSaving ] = useState( false );

	const save = () => {
		setIsSaving( true );

		axios
			.patch(
				getApiLink( vulocartLocalizer, `offerings/${ row.id }` ),
				{
					title,
					status,
					price: '' === price ? undefined : Number( price ),
					meta: {
						...( row.meta || {} ),
						sale_price: '' === salePrice ? null : Number( salePrice ),
						stock_status: stockStatus,
						stock_quantity: '' === stockQuantity ? null : Number( stockQuantity ),
					},
				},
				{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
			)
			.then( () => {
				onSaved();
				onClose();
			} )
			.finally( () => setIsSaving( false ) );
	};

	return (
		<div className="vulocart-quick-edit-overlay" onClick={ onClose }>
			<div className="vulocart-quick-edit-modal" onClick={ ( event ) => event.stopPropagation() }>
				<h2>{ __( 'Quick Edit', 'vulocart' ) }</h2>

				<label>
					{ __( 'Title', 'vulocart' ) }
					<input type="text" value={ title } onChange={ ( event ) => setTitle( event.target.value ) } />
				</label>

				<div className="vulocart-quick-edit-row">
					<label>
						{ __( 'Price', 'vulocart' ) }
						<input type="number" value={ price } onChange={ ( event ) => setPrice( event.target.value ) } />
					</label>
					<label>
						{ __( 'Sale price', 'vulocart' ) }
						<input type="number" value={ salePrice } onChange={ ( event ) => setSalePrice( event.target.value ) } />
					</label>
				</div>

				<div className="vulocart-quick-edit-row">
					<label>
						{ __( 'Status', 'vulocart' ) }
						<select value={ status } onChange={ ( event ) => setStatus( event.target.value ) }>
							{ STATUS_OPTIONS.map( ( option ) => (
								<option key={ option.value } value={ option.value }>
									{ option.label }
								</option>
							) ) }
						</select>
					</label>
					<label>
						{ __( 'Stock status', 'vulocart' ) }
						<select value={ stockStatus } onChange={ ( event ) => setStockStatus( event.target.value ) }>
							{ STOCK_STATUS_OPTIONS.map( ( option ) => (
								<option key={ option.value } value={ option.value }>
									{ option.label }
								</option>
							) ) }
						</select>
					</label>
				</div>

				<label>
					{ __( 'Stock quantity', 'vulocart' ) }
					<input
						type="number"
						value={ stockQuantity }
						onChange={ ( event ) => setStockQuantity( event.target.value ) }
					/>
				</label>

				<div className="vulocart-quick-edit-actions">
					<button type="button" className="vulocart-quick-edit-save" disabled={ isSaving } onClick={ save }>
						{ isSaving ? __( 'Saving…', 'vulocart' ) : __( 'Save', 'vulocart' ) }
					</button>
					<button type="button" className="vulocart-quick-edit-cancel" onClick={ onClose }>
						{ __( 'Cancel', 'vulocart' ) }
					</button>
				</div>
			</div>
		</div>
	);
}

/**
 * The listing half of Offerings — DB (vulocart_offerings) → WPDBOfferingRepository
 * → OfferingService → REST (`GET /offerings`) → this zyra `TableCard`. "Add
 * Offering" and per-row "Edit" are real navigations to
 * `admin.php?page=vulocart-offerings&action=add`/`...&action=edit&id={id}`
 * (plain `<a href>`, full page load) rather than a popup — matching
 * WooCommerce's real Products/Orders admin screens, per this plugin's
 * admin-UX brief ("when edit click this open to another page like
 * woocommerce orders edit page"). Offerings.tsx is what routes between
 * this component and OfferingEdit.tsx based on the URL's `action`/`id`.
 *
 * Status (draft/published/archived) is the `categoryCounts`/`activeCategory`
 * tab axis, same "saved-view-style tabs from real per-status counts"
 * pattern OrdersList.tsx already establishes for fulfillment status; Type
 * and Category are `TableCard`'s own `filters`. Bulk actions cover status,
 * price/sale price (prompted, since a bulk-actions dropdown's value is a
 * fixed string, not a free-form input — `window.prompt()` for the same
 * reason TermsPage.tsx already uses `window.confirm()` for delete: a real,
 * unobtrusive native browser primitive rather than a bespoke modal for
 * something this occasional), stock status/quantity, and delete.
 */
export function OfferingsList() {
	const [ isLoading, setIsLoading ] = useState( false );
	const [ rowIds, setRowIds ] = useState< number[] >( [] );
	const [ rows, setRows ] = useState< TableRow[] >( [] );
	const [ totalRows, setTotalRows ] = useState( 0 );
	const [ categoryCounts, setCategoryCounts ] = useState< CategoryCount[] >( [] );
	const [ categoryFilterOptions, setCategoryFilterOptions ] = useState< { label: string; value: string }[] >( [] );
	const [ quickEditRow, setQuickEditRow ] = useState< QuickEditRow | null >( null );
	const [ savedViews, setSavedViews ] = useState< SavedView[] >( loadSavedViews() );
	const [ activeSavedView, setActiveSavedView ] = useState< string | null >( null );
	const [ lastQuery, setLastQuery ] = useState< QueryProps >( {} );

	useEffect( () => {
		axios
			.get< CategoryOption[] >( getApiLink( vulocartLocalizer, 'categories' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			} )
			.then( ( response ) =>
				setCategoryFilterOptions( response.data.map( ( term ) => ( { label: term.name, value: term.slug } ) ) )
			);
	}, [] );

	/**
	 * `override` lets a saved view force its own status/type/category/
	 * search regardless of what TableCard's own controls currently show —
	 * see the "Saved views" section render below for why those two can
	 * legitimately disagree (TableCard has no prop to push filter values
	 * back into its own internal query state).
	 */
	const buildQueryParams = ( query: QueryProps, includePagination: boolean, override?: SavedView[ 'params' ] ) => {
		const params: Record< string, unknown > = {
			status: override ? override.status : query.categoryFilter && 'all' !== query.categoryFilter ? query.categoryFilter : '',
			type: override ? override.type : query.filter?.type || '',
			category: override ? override.category : query.filter?.category || '',
			search: override ? override.search : query.searchValue || '',
		};

		if ( includePagination ) {
			params.page = query.paged || 1;
			params.per_page = query.per_page || 20;
		}

		return params;
	};

	const doRefreshTableData = ( query: QueryProps, override?: SavedView[ 'params' ] ) => {
		setLastQuery( query );
		setIsLoading( true );

		axios
			.get( getApiLink( vulocartLocalizer, 'offerings' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
				params: buildQueryParams( query, true, override ),
			} )
			.then( ( response ) => {
				const items: TableRow[] = response.data || [];
				const total = Number( response.headers[ 'x-wp-total' ] ) || 0;

				setRowIds( items.map( ( item ) => Number( item.id ) ) );
				setRows( items );
				setTotalRows( total );
				setIsLoading( false );
			} )
			.catch( () => {
				setRows( [] );
				setTotalRows( 0 );
				setIsLoading( false );
			} );

		// Status tab counts — one lightweight extra request per status,
		// mirroring OrdersList.tsx's own `X-WP-Count-{status}` header
		// approach conceptually, except Offerings' `get_items()` doesn't
		// emit per-status count headers (it wasn't built to), so this
		// fetches the same list with `per_page=1` per status purely to
		// read `X-WP-Total` cheaply rather than adding four new response
		// headers server-side for four numbers only this tab bar needs.
		Promise.all(
			[ 'all', ...STATUS_OPTIONS.map( ( option ) => option.value ) ].map( ( status ) =>
				axios
					.get( getApiLink( vulocartLocalizer, 'offerings' ), {
						headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
						params: { status: 'all' === status ? '' : status, per_page: 1 },
					} )
					.then( ( response ) => Number( response.headers[ 'x-wp-total' ] ) || 0 )
			)
		).then( ( counts ) => {
			setCategoryCounts( [
				{ value: 'all', label: __( 'All', 'vulocart' ), count: counts[ 0 ] },
				...STATUS_OPTIONS.map( ( option, index ) => ( {
					value: option.value,
					label: option.label,
					count: counts[ index + 1 ],
				} ) ),
			] );
		} );
	};

	const handleBulkAction = ( action: string, selectedIds: number[] ) => {
		if ( ! action || ! selectedIds.length ) {
			return;
		}

		const refresh = () => doRefreshTableData( lastQuery );
		const [ field, value ] = action.split( ':' );
		const headers = { 'X-WP-Nonce': vulocartLocalizer.nonce };

		if ( 'status' === field ) {
			axios
				.patch( getApiLink( vulocartLocalizer, 'offerings/bulk-status' ), { ids: selectedIds, status: value }, { headers } )
				.then( refresh );
			return;
		}

		if ( 'price' === field && 'prompt' === value ) {
			const input = window.prompt( __( 'New price for the selected offerings:', 'vulocart' ) );
			if ( null === input || '' === input.trim() || isNaN( Number( input ) ) ) {
				return;
			}
			axios
				.patch( getApiLink( vulocartLocalizer, 'offerings/bulk-price' ), { ids: selectedIds, price: Number( input ) }, { headers } )
				.then( refresh );
			return;
		}

		if ( 'sale_price' === field && 'prompt' === value ) {
			const input = window.prompt( __( 'New sale price for the selected offerings:', 'vulocart' ) );
			if ( null === input || '' === input.trim() || isNaN( Number( input ) ) ) {
				return;
			}
			axios
				.patch(
					getApiLink( vulocartLocalizer, 'offerings/bulk-price' ),
					{ ids: selectedIds, sale_price: Number( input ) },
					{ headers }
				)
				.then( refresh );
			return;
		}

		if ( 'stock_status' === field ) {
			axios
				.patch(
					getApiLink( vulocartLocalizer, 'offerings/bulk-stock' ),
					{ ids: selectedIds, stock_status: value },
					{ headers }
				)
				.then( refresh );
			return;
		}

		if ( 'stock_quantity' === field && 'prompt' === value ) {
			const input = window.prompt( __( 'New stock quantity for the selected offerings:', 'vulocart' ) );
			if ( null === input || '' === input.trim() || isNaN( Number( input ) ) ) {
				return;
			}
			axios
				.patch(
					getApiLink( vulocartLocalizer, 'offerings/bulk-stock' ),
					{ ids: selectedIds, stock_quantity: Number( input ) },
					{ headers }
				)
				.then( refresh );
			return;
		}

		if ( 'delete' === field ) {
			if (
				! window.confirm(
					__( 'Delete the selected offerings? This cannot be undone.', 'vulocart' )
				)
			) {
				return;
			}
			axios.delete( getApiLink( vulocartLocalizer, 'offerings/bulk-delete' ), { headers, data: { ids: selectedIds } } ).then( refresh );
		}
	};

	const headers = {
		title: {
			label: __( 'Title', 'vulocart' ),
			isSortable: true,
			required: true,
			render: ( row?: TableRow ) =>
				row && (
					<a href={ `admin.php?page=vulocart-offerings&action=edit&id=${ row.id }` }>
						{ row.title as string }
					</a>
				),
		},
		type: {
			label: __( 'Type', 'vulocart' ),
		},
		sku: {
			label: __( 'SKU', 'vulocart' ),
			render: ( row?: TableRow ) => ( row?.sku as string ) || '—',
		},
		status: {
			label: __( 'Status', 'vulocart' ),
			type: 'status' as const,
			statusClass: ( row: TableRow ) => `${ row.status }`,
		},
		price: {
			label: __( 'Price', 'vulocart' ),
			isNumeric: true,
			render: ( row?: TableRow ) =>
				row?.price !== null && row?.price !== undefined
					? `${ row.price } ${ row.currency ?? '' }`
					: '—',
		},
		actions: {
			label: __( 'Actions', 'vulocart' ),
			csvDisplay: false,
			render: ( row?: TableRow ) =>
				row && (
					<div className="vulocart-offering-row-actions">
						<a
							className="vulocart-offering-edit-action"
							aria-label={ __( 'Edit offering', 'vulocart' ) }
							href={ `admin.php?page=vulocart-offerings&action=edit&id=${ row.id }` }
						>
							{ __( 'Edit', 'vulocart' ) }
						</a>
						<a
							className="vulocart-offering-edit-action"
							aria-label={ __( 'Quick edit offering', 'vulocart' ) }
							href="#quick-edit"
							onClick={ ( event ) => {
								event.preventDefault();
								setQuickEditRow( row as unknown as QuickEditRow );
							} }
						>
							{ __( 'Quick Edit', 'vulocart' ) }
						</a>
						<a
							className="vulocart-offering-edit-action"
							aria-label={ __( 'Delete offering', 'vulocart' ) }
							href="#delete"
							onClick={ ( event ) => {
								event.preventDefault();
								if ( ! window.confirm( __( 'Delete this offering? This cannot be undone.', 'vulocart' ) ) ) {
									return;
								}
								axios
									.delete( getApiLink( vulocartLocalizer, `offerings/${ row.id }` ), {
										headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
									} )
									.then( () => doRefreshTableData( lastQuery ) );
							} }
						>
							{ __( 'Delete', 'vulocart' ) }
						</a>
						{
							/**
							 * `vulocart_offering_row_actions` — the extension point
							 * vulocart-pro's Passport module registers into
							 * (modules/Passport/src/index.tsx), same "Pro extends Free
							 * via @wordpress/hooks filters" pattern react-frontend.md
							 * documents. Renders nothing
							 * when Passport isn't active.
							 */
							applyFilters( 'vulocart_offering_row_actions', null, row )
						}
					</div>
				),
		},
	};

	const downloadSelectedCSV = ( selectedIds: number[] ) => {
		const selectedRows = rows.filter( ( row ) => selectedIds.includes( Number( row.id ) ) );
		downloadCSV( headers, selectedRows, `vulocart-offerings-selected-${ new Date().toISOString().slice( 0, 10 ) }.csv` );
	};

	const downloadAllCSV = ( query: QueryProps ) => {
		axios
			.get( getApiLink( vulocartLocalizer, 'offerings' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
				params: { ...buildQueryParams( query, false ), per_page: 1000 },
			} )
			.then( ( response ) => {
				downloadCSV( headers, response.data || [], `vulocart-offerings-${ new Date().toISOString().slice( 0, 10 ) }.csv` );
			} );
	};

	const saveCurrentView = () => {
		const name = window.prompt( __( 'Name this view:', 'vulocart' ) );
		if ( ! name || ! name.trim() ) {
			return;
		}

		const params = buildQueryParams( lastQuery, false ) as unknown as SavedView[ 'params' ];
		const next = [ ...savedViews.filter( ( view ) => view.name !== name ), { name, params } ];
		setSavedViews( next );
		persistSavedViews( next );
		setActiveSavedView( name );
	};

	const applySavedView = ( view: SavedView ) => {
		setActiveSavedView( view.name );
		doRefreshTableData( lastQuery, view.params );
	};

	const deleteSavedView = ( name: string ) => {
		const next = savedViews.filter( ( view ) => view.name !== name );
		setSavedViews( next );
		persistSavedViews( next );
		if ( activeSavedView === name ) {
			setActiveSavedView( null );
		}
	};

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent
					headerIcon="product"
					headerTitle={ __( 'Offerings', 'vulocart' ) }
					headerDescription={ __(
						'Manage every offering — physical, digital, or service-based — from one place.',
						'vulocart'
					) }
					buttons={ [
						{
							label: __( 'Add Offering', 'vulocart' ),
							icon: 'plus',
							color: '',
							onClick: () => {
								window.location.href = 'admin.php?page=vulocart-offerings&action=add';
							},
						},
					] }
				/>

				{
					/**
					 * Saved views — bookmarked status/type/category/search
					 * combos, `localStorage`-backed (loadSavedViews()' own
					 * docblock explains why). Deliberately rendered as its
					 * own strip rather than synced into TableCard's built-in
					 * search/filter controls: `TableCard` has no prop to push
					 * filter values back into its own internal query state
					 * once mounted, so applying a saved view can change what
					 * the table shows but can't also make the filter
					 * dropdowns visually reflect it — showing the active
					 * view's name here, plainly, is honest about that rather
					 * than leaving the controls looking stale/wrong.
					 */
				}
				<div className="vulocart-saved-views">
					<span className="vulocart-saved-views-label">{ __( 'Saved views:', 'vulocart' ) }</span>
					{ savedViews.map( ( view ) => (
						<span
							key={ view.name }
							className={ `vulocart-saved-view-chip${ activeSavedView === view.name ? ' is-active' : '' }` }
						>
							<button type="button" onClick={ () => applySavedView( view ) }>
								{ view.name }
							</button>
							<i
								className="adminfont-close-delete"
								aria-label={ __( 'Delete saved view', 'vulocart' ) }
								onClick={ () => deleteSavedView( view.name ) }
							/>
						</span>
					) ) }
					<button type="button" className="vulocart-save-view-button" onClick={ saveCurrentView }>
						+ { __( 'Save current filters as a view', 'vulocart' ) }
					</button>
				</div>

				<TableCard
					title={ __( 'Offerings', 'vulocart' ) }
					headers={ headers }
					rows={ rows }
					totalRows={ totalRows }
					isLoading={ isLoading }
					onQueryUpdate={ doRefreshTableData }
					ids={ rowIds }
					categoryCounts={ categoryCounts }
					activeCategory="all"
					search={ {
						placeholder: __( 'Search title or SKU…', 'vulocart' ),
					} }
					filters={ [
						{
							key: 'type',
							label: __( 'Type', 'vulocart' ),
							type: 'select',
							size: 4,
							options: OFFERING_TYPE_OPTIONS,
						},
						{
							key: 'category',
							label: __( 'Category', 'vulocart' ),
							type: 'select',
							size: 4,
							options: categoryFilterOptions,
						},
					] }
					bulkActions={ [
						...STATUS_OPTIONS.map( ( option ) => ( {
							label: __( 'Status:', 'vulocart' ) + ' ' + option.label,
							value: `status:${ option.value }`,
						} ) ),
						{ label: __( 'Set price…', 'vulocart' ), value: 'price:prompt' },
						{ label: __( 'Set sale price…', 'vulocart' ), value: 'sale_price:prompt' },
						...STOCK_STATUS_OPTIONS.map( ( option ) => ( {
							label: __( 'Stock:', 'vulocart' ) + ' ' + option.label,
							value: `stock_status:${ option.value }`,
						} ) ),
						{ label: __( 'Set stock quantity…', 'vulocart' ), value: 'stock_quantity:prompt' },
						{ label: __( 'Delete', 'vulocart' ), value: 'delete:confirm' },
					] }
					onBulkActionApply={ ( action: string, selectedIds: number[] ) => handleBulkAction( action, selectedIds ) }
					buttonActions={ [
						{
							label: __( 'Export CSV', 'vulocart' ),
							icon: 'download',
							onClickWithQuery: downloadAllCSV,
						},
					] }
					onSelectCsvDownloadApply={ downloadSelectedCSV }
				/>
			</ColumnComponent>

			{ quickEditRow && (
				<OfferingQuickEdit
					row={ quickEditRow }
					onClose={ () => setQuickEditRow( null ) }
					onSaved={ () => doRefreshTableData( lastQuery ) }
				/>
			) }
		</ContainerComponent>
	);
}

export default OfferingsList;
