/* global vulocartLocalizer */
import { useEffect, useRef, useState } from '@wordpress/element';
import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { ContainerComponent, ColumnComponent, NavigatorHeaderComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard, TableRow, QueryProps, CategoryCount } from '@zyra/table';
import { downloadCSV } from '../../lib/utils';
import { formatWpDate } from '../../services/formatWpDate';
import ConfirmPopup from '../../components/ConfirmPopup/ConfirmPopup';
import './products-page.scss';

/**
 * ProductType::all() (classes/Domain/Product/ProductType.php), same
 * duplicated-not-fetched tradeoff ProductEdit.tsx's own copy of this list
 * already accepts.
 */
const PRODUCT_TYPE_OPTIONS = [
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

interface ProductMeta {
	sale_price?: number | null;
	stock_status?: string;
	stock_quantity?: number | null;
}

/**
 * Deliberately not `extends TableRow` - `TableRow`'s index signature is
 * `string | number | boolean | React.ReactNode`, which `meta` (a nested
 * object) doesn't satisfy. Every row this app hands to `ProductQuickEdit`
 * is cast `as unknown as QuickEditRow` (same pattern TermsPage.tsx already
 * uses for its own `row as unknown as Term` cast) rather than structurally
 * typed against `TableRow`.
 */
interface QuickEditRow {
	id: number;
	title: string;
	sku?: string | null;
	status: string;
	price: number | null;
	meta?: ProductMeta;
}

interface SavedView {
	name: string;
	params: { status: string; type: string; category: string; search: string };
}

const SAVED_VIEWS_STORAGE_KEY = 'vulocart_products_saved_views';

/**
 * Reads/writes named filter presets to `localStorage` - deliberately not a
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
		// localStorage unavailable (private browsing, quota) - saved views
		// just don't persist across reloads; not worth surfacing an error
		// for a convenience feature.
	}
}

/**
 * "Quick edit" - the handful of things changed most often, in a popup over the list: name, status, SKU, price and sale
 * price, stock, featured and catalog visibility. "Open full editor" is one click away for everything else.
 *
 * Not built on the table's own inline cell editing: the installed zyra build never enters edit mode there. And it sends
 * the product's whole existing `meta` back, because the API replaces meta wholesale - sending only the changed keys
 * would wipe categories, descriptions and everything else the popup doesn't show.
 */
function ProductQuickEdit( { row, onClose, onSaved }: { row: QuickEditRow; onClose: () => void; onSaved: () => void } ) {
	const meta = ( row.meta || {} ) as Record< string, unknown >;
	const tracked = !! meta.stock_management;
	const text = ( value: unknown ) => ( null === value || undefined === value ? '' : String( value ) );

	const [ title, setTitle ] = useState( row.title );
	const [ sku, setSku ] = useState( text( row.sku ) );
	const [ price, setPrice ] = useState( text( row.price ) );
	const [ salePrice, setSalePrice ] = useState( text( meta.sale_price ) );
	const [ status, setStatus ] = useState( row.status );
	const [ stockStatus, setStockStatus ] = useState( text( meta.stock_status ) || 'in_stock' );
	const [ stockQuantity, setStockQuantity ] = useState( text( meta.stock_quantity ) );
	const [ featured, setFeatured ] = useState( !! meta.featured );
	const [ visibility, setVisibility ] = useState( text( meta.catalog_visibility ) || 'shop_and_search' );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ error, setError ] = useState( '' );

	const onSale = '' !== salePrice && '' !== price && Number( salePrice ) < Number( price );
	const saleTooHigh = '' !== salePrice && '' !== price && Number( salePrice ) >= Number( price );
	const canSave = title.trim() && ! saleTooHigh;

	const save = () => {
		if ( ! canSave ) {
			return;
		}

		setIsSaving( true );
		setError( '' );

		axios
			.patch(
				getApiLink( vulocartLocalizer, `products/${ row.id }` ),
				{
					title: title.trim(),
					status,
					sku,
					price: '' === price ? undefined : Number( price ),
					meta: {
						...meta,
						sale_price: '' === salePrice ? null : Number( salePrice ),
						featured,
						catalog_visibility: visibility,
						...( tracked
							? { stock_status: stockStatus, stock_quantity: '' === stockQuantity ? null : Number( stockQuantity ) }
							: { stock_status: stockStatus } ),
					},
				},
				{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
			)
			.then( () => {
				onSaved();
				onClose();
			} )
			.catch( ( reason ) => setError( reason?.response?.data?.message || __( 'Could not save this product.', 'vulocart' ) ) )
			.finally( () => setIsSaving( false ) );
	};

	return (
		<PopupComponent
			open
			onClose={ onClose }
			width={ 34 }
			height="auto"
			position="lightbox"
			header={ { icon: 'edit', title: __( 'Quick edit', 'vulocart' ) } }
			footer={
				<div className="vulocart-qe-footer">
					<a href={ `admin.php?page=vulocart-products&action=edit&id=${ row.id }` }>
						{ __( 'Open full editor', 'vulocart' ) } <i className="adminfont-pagination-next-arrow" aria-hidden="true" />
					</a>
					<ButtonInput
						buttons={ [
							{ text: __( 'Cancel', 'vulocart' ), color: 'purple', onClick: onClose },
							{ text: isSaving ? __( 'Saving…', 'vulocart' ) : __( 'Save changes', 'vulocart' ), icon: 'check', onClick: save, disabled: isSaving || ! canSave },
						] }
					/>
				</div>
			}
		>
			<div className="vulocart-qe">
				<label className="vulocart-qe-field">
					<span>{ __( 'Name', 'vulocart' ) }</span>
					<input type="text" value={ title } onChange={ ( event ) => setTitle( event.target.value ) } />
				</label>

				<div className="vulocart-qe-field">
					<span>{ __( 'Status', 'vulocart' ) }</span>
					<div className="vulocart-qe-segment" role="radiogroup" aria-label={ __( 'Status', 'vulocart' ) }>
						{ STATUS_OPTIONS.map( ( option ) => (
							<button
								key={ option.value }
								type="button"
								role="radio"
								aria-checked={ status === option.value }
								className={ status === option.value ? `is-active is-${ option.value }` : '' }
								onClick={ () => setStatus( option.value ) }
							>
								{ option.label }
							</button>
						) ) }
					</div>
				</div>

				<div className="vulocart-qe-grid">
					<label className="vulocart-qe-field">
						<span>{ __( 'SKU', 'vulocart' ) }</span>
						<input type="text" value={ sku } onChange={ ( event ) => setSku( event.target.value ) } />
					</label>
					<label className="vulocart-qe-field">
						<span>{ __( 'Catalog visibility', 'vulocart' ) }</span>
						<select value={ visibility } onChange={ ( event ) => setVisibility( event.target.value ) }>
							<option value="shop_and_search">{ __( 'Shop and search', 'vulocart' ) }</option>
							<option value="shop_only">{ __( 'Shop only', 'vulocart' ) }</option>
							<option value="search_only">{ __( 'Search only', 'vulocart' ) }</option>
							<option value="hidden">{ __( 'Hidden', 'vulocart' ) }</option>
						</select>
					</label>
				</div>

				<div className="vulocart-qe-grid">
					<label className="vulocart-qe-field">
						<span>{ __( 'Regular price', 'vulocart' ) }</span>
						<input type="number" min={ 0 } step="any" value={ price } onChange={ ( event ) => setPrice( event.target.value ) } />
					</label>
					<label className="vulocart-qe-field">
						<span>
							{ __( 'Sale price', 'vulocart' ) }
							{ onSale && <em>{ `-${ Math.round( ( 1 - Number( salePrice ) / Number( price ) ) * 100 ) }%` }</em> }
						</span>
						<input type="number" min={ 0 } step="any" className={ saleTooHigh ? 'has-error' : '' } value={ salePrice } onChange={ ( event ) => setSalePrice( event.target.value ) } />
						{ saleTooHigh && <small className="vulocart-qe-error">{ __( 'Must be lower than the regular price.', 'vulocart' ) }</small> }
					</label>
				</div>

				<div className="vulocart-qe-grid">
					<label className="vulocart-qe-field">
						<span>{ __( 'Availability', 'vulocart' ) }</span>
						<select value={ stockStatus } onChange={ ( event ) => setStockStatus( event.target.value ) }>
							{ STOCK_STATUS_OPTIONS.map( ( option ) => (
								<option key={ option.value } value={ option.value }>{ option.label }</option>
							) ) }
						</select>
					</label>
					{ tracked ? (
						<label className="vulocart-qe-field">
							<span>{ __( 'Units in stock', 'vulocart' ) }</span>
							<input type="number" min={ 0 } value={ stockQuantity } onChange={ ( event ) => setStockQuantity( event.target.value ) } />
						</label>
					) : (
						<div className="vulocart-qe-field">
							<span>{ __( 'Units in stock', 'vulocart' ) }</span>
							<p className="vulocart-qe-note">{ __( 'Stock tracking is off.', 'vulocart' ) }</p>
						</div>
					) }
				</div>

				<label className="vulocart-qe-switch">
					<button
						type="button"
						role="switch"
						aria-checked={ featured }
						className={ `vulocart-switch${ featured ? ' is-on' : '' }` }
						onClick={ () => setFeatured( ! featured ) }
					>
						<span aria-hidden="true" />
					</button>
					<div>
						<strong>{ __( 'Featured', 'vulocart' ) }</strong>
						<small>{ __( 'Highlight it in featured sections of your store.', 'vulocart' ) }</small>
					</div>
				</label>

				{ error && <p className="vulocart-qe-error" role="alert">{ error }</p> }
			</div>
		</PopupComponent>
	);
}

/**
 * Bulk edit: one popup for the selected products. Every field starts as "No change" - only what you fill in is
 * applied, through the same bulk endpoints the list always used (status / price / stock), so nothing else is touched.
 */
function ProductBulkEdit( { ids, onClose, onDone }: { ids: number[]; onClose: () => void; onDone: () => void } ) {
	const [ status, setStatus ] = useState( '' );
	const [ price, setPrice ] = useState( '' );
	const [ salePrice, setSalePrice ] = useState( '' );
	const [ stockStatus, setStockStatus ] = useState( '' );
	const [ stockQuantity, setStockQuantity ] = useState( '' );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ error, setError ] = useState( '' );

	const changes = [ status, price, salePrice, stockStatus, stockQuantity ].filter( ( value ) => '' !== value ).length;
	const salePriceTooHigh = '' !== price && '' !== salePrice && Number( salePrice ) >= Number( price );

	const apply = () => {
		const headers = { 'X-WP-Nonce': vulocartLocalizer.nonce };
		const calls: Promise< unknown >[] = [];

		if ( '' !== status ) {
			calls.push( axios.patch( getApiLink( vulocartLocalizer, 'products/bulk-status' ), { ids, status }, { headers } ) );
		}

		if ( '' !== price || '' !== salePrice ) {
			calls.push(
				axios.patch(
					getApiLink( vulocartLocalizer, 'products/bulk-price' ),
					{ ids, ...( '' !== price ? { price: Number( price ) } : {} ), ...( '' !== salePrice ? { sale_price: Number( salePrice ) } : {} ) },
					{ headers }
				)
			);
		}

		if ( '' !== stockStatus || '' !== stockQuantity ) {
			calls.push(
				axios.patch(
					getApiLink( vulocartLocalizer, 'products/bulk-stock' ),
					{ ids, ...( '' !== stockStatus ? { stock_status: stockStatus } : {} ), ...( '' !== stockQuantity ? { stock_quantity: Number( stockQuantity ) } : {} ) },
					{ headers }
				)
			);
		}

		setIsSaving( true );
		setError( '' );

		Promise.all( calls )
			.then( () => {
				onDone();
				onClose();
			} )
			.catch( ( reason ) => setError( reason?.response?.data?.message || __( 'Could not update the selected products.', 'vulocart' ) ) )
			.finally( () => setIsSaving( false ) );
	};

	return (
		<PopupComponent
			open
			onClose={ onClose }
			width={ 30 }
			height="auto"
			position="lightbox"
			header={ {
				icon: 'bulk-action',
				title: sprintf( /* translators: %d: number of products. */ _n( 'Edit %d product', 'Edit %d products', ids.length, 'vulocart' ), ids.length ),
			} }
			footer={
				<div className="vulocart-qe-footer">
					<span className="vulocart-qe-note">
						{ 0 === changes
							? __( 'Fill in only what you want to change.', 'vulocart' )
							: sprintf( /* translators: %d: number of fields. */ _n( '%d change will be applied.', '%d changes will be applied.', changes, 'vulocart' ), changes ) }
					</span>
					<ButtonInput
						buttons={ [
							{ text: __( 'Cancel', 'vulocart' ), color: 'purple', onClick: onClose },
							{ text: isSaving ? __( 'Applying…', 'vulocart' ) : __( 'Apply to selected', 'vulocart' ), icon: 'check', onClick: apply, disabled: isSaving || 0 === changes || salePriceTooHigh },
						] }
					/>
				</div>
			}
		>
			<div className="vulocart-qe">
				<div className="vulocart-qe-field">
					<span>{ __( 'Status', 'vulocart' ) }</span>
					<div className="vulocart-qe-segment" role="radiogroup" aria-label={ __( 'Status', 'vulocart' ) }>
						{ [ { label: __( 'No change', 'vulocart' ), value: '' }, ...STATUS_OPTIONS ].map( ( option ) => (
							<button
								key={ option.value || 'none' }
								type="button"
								role="radio"
								aria-checked={ status === option.value }
								className={ status === option.value ? `is-active${ option.value ? ` is-${ option.value }` : '' }` : '' }
								onClick={ () => setStatus( option.value ) }
							>
								{ option.label }
							</button>
						) ) }
					</div>
				</div>

				<div className="vulocart-qe-grid">
					<label className="vulocart-qe-field">
						<span>{ __( 'Regular price', 'vulocart' ) }</span>
						<input type="number" min={ 0 } step="any" placeholder={ __( 'No change', 'vulocart' ) } value={ price } onChange={ ( event ) => setPrice( event.target.value ) } />
					</label>
					<label className="vulocart-qe-field">
						<span>{ __( 'Sale price', 'vulocart' ) }</span>
						<input type="number" min={ 0 } step="any" className={ salePriceTooHigh ? 'has-error' : '' } placeholder={ __( 'No change', 'vulocart' ) } value={ salePrice } onChange={ ( event ) => setSalePrice( event.target.value ) } />
						{ salePriceTooHigh && <small className="vulocart-qe-error">{ __( 'Must be lower than the regular price.', 'vulocart' ) }</small> }
					</label>
				</div>

				<div className="vulocart-qe-grid">
					<label className="vulocart-qe-field">
						<span>{ __( 'Availability', 'vulocart' ) }</span>
						<select value={ stockStatus } onChange={ ( event ) => setStockStatus( event.target.value ) }>
							<option value="">{ __( 'No change', 'vulocart' ) }</option>
							{ STOCK_STATUS_OPTIONS.map( ( option ) => (
								<option key={ option.value } value={ option.value }>{ option.label }</option>
							) ) }
						</select>
					</label>
					<label className="vulocart-qe-field">
						<span>{ __( 'Units in stock', 'vulocart' ) }</span>
						<input type="number" min={ 0 } placeholder={ __( 'No change', 'vulocart' ) } value={ stockQuantity } onChange={ ( event ) => setStockQuantity( event.target.value ) } />
					</label>
				</div>

				{ error && <p className="vulocart-qe-error" role="alert">{ error }</p> }
			</div>
		</PopupComponent>
	);
}

/**
 * The listing half of Products - DB (vulocart_products) → WPDBProductRepository
 * → ProductService → REST (`GET /products`) → this zyra `TableCard`. "Add
 * Product" and per-row "Edit" are real navigations to
 * `admin.php?page=vulocart-products&action=add`/`...&action=edit&id={id}`
 * (plain `<a href>`, full page load) rather than a popup - matching
 * WooCommerce's real Products/Orders admin screens, per this plugin's
 * admin-UX brief ("when edit click this open to another page like
 * woocommerce orders edit page"). Products.tsx is what routes between
 * this component and ProductEdit.tsx based on the URL's `action`/`id`.
 *
 * Status (draft/published/archived) is the `categoryCounts`/`activeCategory`
 * tab axis, same "saved-view-style tabs from real per-status counts"
 * pattern OrdersList.tsx already establishes for fulfillment status; Type
 * and Category are `TableCard`'s own `filters`. Bulk actions are Edit (a popup for
 * status, price / sale price and stock - see `ProductBulkEdit`) and Delete.
 */
export function ProductsList() {
	const [ isLoading, setIsLoading ] = useState( false );
	const [ rowIds, setRowIds ] = useState< number[] >( [] );
	const [ rows, setRows ] = useState< TableRow[] >( [] );
	const [ totalRows, setTotalRows ] = useState( 0 );
	const [ categoryCounts, setCategoryCounts ] = useState< CategoryCount[] >( [] );
	const [ categoryFilterOptions, setCategoryFilterOptions ] = useState< { label: string; value: string }[] >( [] );
	const [ deleteTarget, setDeleteTarget ] = useState< QuickEditRow | null >( null );
	const [ quickEditRow, setQuickEditRow ] = useState< QuickEditRow | null >( null );
	const [ bulkEditIds, setBulkEditIds ] = useState< number[] >( [] );
	const [ savedViews, setSavedViews ] = useState< SavedView[] >( loadSavedViews() );
	const [ activeSavedView, setActiveSavedView ] = useState< string | null >( null );
	const [ lastQuery, setLastQuery ] = useState< QueryProps >( {} );

	// Anything that adds products from outside the table (an import) asks the list to reload.
	const lastQueryRef = useRef( lastQuery );
	lastQueryRef.current = lastQuery;
	useEffect( () => {
		const reload = () => doRefreshTableData( lastQueryRef.current );
		window.addEventListener( 'vulocart-products-changed', reload );
		return () => window.removeEventListener( 'vulocart-products-changed', reload );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- the handler reads the latest query through the ref.
	}, [] );

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
	 * search regardless of what TableCard's own controls currently show -
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
			.get( getApiLink( vulocartLocalizer, 'products' ), {
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

		// Status tab counts - one lightweight extra request per status,
		// mirroring OrdersList.tsx's own `X-WP-Count-{status}` header
		// approach conceptually, except Products' `get_items()` doesn't
		// emit per-status count headers (it wasn't built to), so this
		// fetches the same list with `per_page=1` per status purely to
		// read `X-WP-Total` cheaply rather than adding four new response
		// headers server-side for four numbers only this tab bar needs.
		Promise.all(
			[ 'all', ...STATUS_OPTIONS.map( ( option ) => option.value ) ].map( ( status ) =>
				axios
					.get( getApiLink( vulocartLocalizer, 'products' ), {
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

		if ( 'edit' === field ) {
			setBulkEditIds( selectedIds );
			return;
		}

		if ( 'delete' === field ) {
			if (
				! window.confirm(
					__( 'Delete the selected products? This cannot be undone.', 'vulocart' )
				)
			) {
				return;
			}
			axios.delete( getApiLink( vulocartLocalizer, 'products/bulk-delete' ), { headers, data: { ids: selectedIds } } ).then( refresh );
		}
	};

	const STATUS_BADGE: Record< string, string > = { published: 'badge-active', draft: 'badge-pending', archived: 'badge-inactive' };

	/** What a CSV export holds, in plain columns - the table below merges several of these into one cell. */
	const csvHeaders = {
		title: { label: __( 'Title', 'vulocart' ) },
		type: { label: __( 'Type', 'vulocart' ) },
		sku: { label: __( 'SKU', 'vulocart' ) },
		status: { label: __( 'Status', 'vulocart' ) },
		published_at: { label: __( 'Published', 'vulocart' ) },
		price: { label: __( 'Price', 'vulocart' ) },
		currency: { label: __( 'Currency', 'vulocart' ) },
	};

	// Actions other modules add: `{ label, icon, color?, onClick( row ) }` each.
	const extraActions = (
		applyFilters( 'vulocart_product_row_action_items', [] ) as {
			label: string;
			icon: string;
			color?: string;
			onClick: ( row: Record< string, unknown > ) => void;
		}[]
	 ).map( ( action ) => ( { type: 'button' as const, color: 'text-blue', ...action } ) );

	const headers = {
		product: {
			label: __( 'Product', 'vulocart' ),
			isSortable: true,
			required: true,
			render: ( row?: TableRow ) => {
				if ( ! row ) {
					return null;
				}

				const details = [
					row.sku ? `${ __( 'SKU', 'vulocart' ) }: ${ row.sku }` : '',
				].filter( Boolean );

				// Title, then SKU, then the badges (type, status) and the published date.
				return (
					<div className="vulocart-product-cell">
						<a className="vulocart-product-cell-title" href={ `admin.php?page=vulocart-products&action=edit&id=${ row.id }` }>
							{ row.title as string }
						</a>
						{ details.length > 0 && <div className="desc">{ details.join( ', ' ) }</div> }
						<div className="vulocart-product-cell-tags">
							<span className="admin-badge badge-info">{ String( row.type ).replace( '_', ' ' ) }</span>
							<span className={ `admin-badge ${ STATUS_BADGE[ String( row.status ) ] ?? 'badge-info' }` }>{ String( row.status ) }</span>
							{ row.published_at && (
								<span className="desc">{ formatWpDate( row.published_at as string ) }</span>
							) }
						</div>
					</div>
				);
			},
		},
		price: {
			label: __( 'Price', 'vulocart' ),
			isNumeric: true,
			render: ( row?: TableRow ) =>
				row?.price !== null && row?.price !== undefined
					? `${ row.price } ${ row.currency ?? '' }`
					: '-',
		},
		actions: {
			label: __( 'Actions', 'vulocart' ),
			type: 'action' as const,
			actions: [
				{
					label: __( 'Edit', 'vulocart' ),
					icon: 'edit',
					type: 'button' as const,
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => {
						window.location.href = `admin.php?page=vulocart-products&action=edit&id=${ row.id }`;
					},
				},
				{
					label: __( 'Quick edit', 'vulocart' ),
					icon: 'bulk-action',
					type: 'button' as const,
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => setQuickEditRow( row as unknown as QuickEditRow ),
				},
				{
					label: __( 'Duplicate', 'vulocart' ),
					icon: 'copy',
					type: 'button' as const,
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => duplicateProduct( Number( row.id ) ),
				},
				...extraActions,
				{
					label: __( 'Delete', 'vulocart' ),
					icon: 'delete',
					type: 'button' as const,
					color: 'text-red',
					onClick: ( row: Record< string, unknown > ) => setDeleteTarget( row as unknown as QuickEditRow ),
				},
			],
		},
	};

	const duplicateProduct = ( id: number ) =>
		axios
			.post( getApiLink( vulocartLocalizer, `products/${ id }/duplicate` ), {}, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( () => doRefreshTableData( lastQuery ) );

	const confirmDelete = () => {
		if ( ! deleteTarget ) {
			return;
		}

		const row = deleteTarget;
		setDeleteTarget( null );

		axios
			.delete( getApiLink( vulocartLocalizer, `products/${ row.id }` ), { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( () => doRefreshTableData( lastQuery ) );
	};

	const downloadSelectedCSV = ( selectedIds: number[] ) => {
		const selectedRows = rows.filter( ( row ) => selectedIds.includes( Number( row.id ) ) );
		downloadCSV( csvHeaders, selectedRows, `vulocart-products-selected-${ new Date().toISOString().slice( 0, 10 ) }.csv` );
	};

	const downloadAllCSV = ( query: QueryProps ) => {
		axios
			.get( getApiLink( vulocartLocalizer, 'products' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
				params: { ...buildQueryParams( query, false ), per_page: 1000 },
			} )
			.then( ( response ) => {
				downloadCSV( csvHeaders, response.data || [], `vulocart-products-${ new Date().toISOString().slice( 0, 10 ) }.csv` );
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
					headerTitle={ __( 'Products', 'vulocart' ) }
					headerDescription={ __(
						'Manage every product - physical, digital, or service-based - from one place.',
						'vulocart'
					) }
					buttons={ [
						...( applyFilters( 'vulocart_product_list_buttons', [] ) as { label: string; icon?: string; color?: string; onClick: () => void }[] ),
						{
							label: __( 'Export', 'vulocart' ),
							icon: 'download',
							color: 'purple',
							onClick: () => downloadAllCSV( lastQuery ),
						},
						{
							label: __( 'Add Product', 'vulocart' ),
							icon: 'plus',
							color: '',
							onClick: () => {
								window.location.href = 'admin.php?page=vulocart-products&action=add';
							},
						},
					] }
				/>

				{
					/**
					 * Saved views - bookmarked status/type/category/search
					 * combos, `localStorage`-backed (loadSavedViews()' own
					 * docblock explains why). Deliberately rendered as its
					 * own strip rather than synced into TableCard's built-in
					 * search/filter controls: `TableCard` has no prop to push
					 * filter values back into its own internal query state
					 * once mounted, so applying a saved view can change what
					 * the table shows but can't also make the filter
					 * dropdowns visually reflect it - showing the active
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
							options: PRODUCT_TYPE_OPTIONS,
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
						{ label: __( 'Edit', 'vulocart' ), value: 'edit:popup' },
						{ label: __( 'Delete', 'vulocart' ), value: 'delete:confirm' },
					] }
					onBulkActionApply={ ( action: string, selectedIds: number[] ) => handleBulkAction( action, selectedIds ) }
					onSelectCsvDownloadApply={ downloadSelectedCSV }
				/>
			</ColumnComponent>

			<ConfirmPopup
				open={ !! deleteTarget }
				title={ __( 'Delete product', 'vulocart' ) }
				message={ __( 'Delete this product? This cannot be undone.', 'vulocart' ) }
				onConfirm={ confirmDelete }
				onCancel={ () => setDeleteTarget( null ) }
			/>

			{ applyFilters( 'vulocart_product_list_overlay', null ) as ReactNode }

			{ bulkEditIds.length > 0 && (
				<ProductBulkEdit ids={ bulkEditIds } onClose={ () => setBulkEditIds( [] ) } onDone={ () => doRefreshTableData( lastQuery ) } />
			) }

			{ quickEditRow && (
				<ProductQuickEdit
					row={ quickEditRow }
					onClose={ () => setQuickEditRow( null ) }
					onSaved={ () => doRefreshTableData( lastQuery ) }
				/>
			) }
		</ContainerComponent>
	);
}

export default ProductsList;
