/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { ContainerComponent, ColumnComponent, InformationItemComponent, NavigatorHeaderComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard, TableRow, CategoryCount, QueryProps } from '@zyra/table';
import { downloadCSV } from '../../lib/utils';
import { formatWpDateTime } from '../../services/formatWpDate';
import { authHeaders, fetchInventory, type InventoryItem } from './inventory';
import './inventory-page.scss';
import '../Products/products-page.scss';

const STOCK_STATUS_OPTIONS = [
	{ label: __( 'In stock', 'vulocart' ), value: 'in_stock' },
	{ label: __( 'Out of stock', 'vulocart' ), value: 'out_of_stock' },
	{ label: __( 'On backorder', 'vulocart' ), value: 'backorder' },
];

/** `Inventory::STOCK_TRACKED_TYPES` (classes/RestAPI/Controllers/Inventory.php) - the types this page lists. */
const TRACKED_TYPE_OPTIONS = [ 'physical', 'rental', 'bundle', 'gift_card' ].map( ( type ) => ( { label: type.replace( '_', ' ' ), value: type } ) );

const STATUS_BADGE: Record< string, string > = { in_stock: 'badge-active', out_of_stock: 'badge-inactive', backorder: 'badge-info' };

const DEFAULT_PER_PAGE = 20;

/** Returns the display label of a stock status value. */
const statusLabel = ( value: string ) => STOCK_STATUS_OPTIONS.find( ( option ) => option.value === value )?.label ?? value;

/** Saves a new stock quantity or stock status for one product. */
const patchStock = ( id: number, body: { stock_quantity?: number; stock_status?: string } ) =>
	axios.patch< InventoryItem >( getApiLink( vulocartLocalizer, `inventory/${ id }` ), body, { headers: authHeaders() } );

interface StockMovement {
	id: number;
	type: string;
	quantity_change: number;
	balance_after: number;
	reference: string | null;
	note: string | null;
	created_at: string;
}

/**
 * "Stock history" - every stock movement of one product, newest first, in a popup. The ledger belongs to vulocart-pro's
 * Inventory module (`/inventory/history`); without it the popup says so instead of showing an empty list.
 */
function StockHistory( { item, onClose }: { item: InventoryItem; onClose: () => void } ) {
	const [ rows, setRows ] = useState< StockMovement[] | null >( null );
	const [ unavailable, setUnavailable ] = useState( false );

	useEffect( () => {
		axios
			.get< StockMovement[] >( getApiLink( vulocartLocalizer, 'inventory/history' ), { headers: authHeaders(), params: { product_id: item.id } } )
			.then( ( response ) => setRows( Array.isArray( response.data ) ? response.data : [] ) )
			.catch( () => setUnavailable( true ) );
	}, [ item.id ] );

	return (
		<PopupComponent
			open
			onClose={ onClose }
			width={ 36 }
			height="auto"
			position="lightbox"
			header={ { icon: 'store-inventory', title: __( 'Stock history', 'vulocart' ) } }
			footer={ <ButtonInput buttons={ [ { text: __( 'Close', 'vulocart' ), color: 'purple', onClick: onClose } ] } /> }
		>
			<div className="vulocart-inv-history">
				<div className="vulocart-inv-adjust-product">
					<strong>{ item.title }</strong>
					{ item.sku ? <span className="desc">{ `${ __( 'SKU', 'vulocart' ) }: ${ item.sku }` }</span> : null }
				</div>

				{ unavailable ? (
					<p className="vulocart-inv-history-empty">{ __( 'Stock history is recorded by the Inventory module - turn it on under Settings → Modules to see every movement here.', 'vulocart' ) }</p>
				) : null === rows ? (
					<p className="vulocart-inv-history-empty">{ __( 'Loading…', 'vulocart' ) }</p>
				) : rows.length ? (
					<ul className="vulocart-inv-history-list">
						{ rows.map( ( row ) => {
							const change = Number( row.quantity_change );

							return (
								<li key={ row.id }>
									<span className={ `admin-badge ${ change >= 0 ? 'badge-active' : 'badge-inactive' }` }>{ `${ change >= 0 ? '+' : '' }${ change }` }</span>
									<span className="vulocart-inv-history-main">
										<strong>{ row.type.replace( /_/g, ' ' ) }</strong>
										<span className="desc">{ [ formatWpDateTime( row.created_at ), row.reference, row.note ].filter( Boolean ).join( ' · ' ) }</span>
									</span>
									<span className="vulocart-inv-history-balance">
										{ sprintf( /* translators: %s: units in stock after the movement. */ __( '%s in stock', 'vulocart' ), row.balance_after ) }
									</span>
								</li>
							);
						} ) }
					</ul>
				) : (
					<p className="vulocart-inv-history-empty">{ __( 'No stock movements recorded for this product yet.', 'vulocart' ) }</p>
				) }
			</div>
		</PopupComponent>
	);
}

/**
 * "Adjust stock" - quantity (with a stepper) and availability for one product, in a popup over the list, the same
 * shape as the Products list's own quick edit. Only fields that changed are sent.
 */
function StockAdjust( { item, onClose, onSaved }: { item: InventoryItem; onClose: () => void; onSaved: ( updated: InventoryItem ) => void } ) {
	const [ quantity, setQuantity ] = useState( null === item.stock_quantity ? '' : String( item.stock_quantity ) );
	const [ status, setStatus ] = useState( item.stock_status );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ error, setError ] = useState( '' );

	const original = null === item.stock_quantity ? '' : String( item.stock_quantity );
	const changed = quantity !== original || status !== item.stock_status;
	const step = ( delta: number ) => setQuantity( String( Math.max( 0, ( Number( quantity ) || 0 ) + delta ) ) );

	const save = () => {
		setIsSaving( true );
		setError( '' );

		patchStock( item.id, {
			...( quantity !== original && '' !== quantity ? { stock_quantity: Number( quantity ) } : {} ),
			...( status !== item.stock_status ? { stock_status: status } : {} ),
		} )
			.then( ( response ) => {
				onSaved( response.data );
				onClose();
			} )
			.catch( ( reason ) => setError( reason?.response?.data?.message || __( 'Could not save this stock level.', 'vulocart' ) ) )
			.finally( () => setIsSaving( false ) );
	};

	return (
		<PopupComponent
			open
			onClose={ onClose }
			width={ 30 }
			height="auto"
			position="lightbox"
			header={ { icon: 'store-inventory', title: __( 'Adjust stock', 'vulocart' ) } }
			footer={
				<div className="vulocart-qe-footer">
					<a href={ `admin.php?page=products&action=edit&id=${ item.id }` }>
						{ __( 'Open product', 'vulocart' ) } <i className="adminfont-pagination-next-arrow" aria-hidden="true" />
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
				<div className="vulocart-inv-adjust-product">
					<strong>{ item.title }</strong>
					{ item.sku ? <span className="desc">{ `${ __( 'SKU', 'vulocart' ) }: ${ item.sku }` }</span> : null }
				</div>

				<div className="vulocart-qe-field">
					<span>{ __( 'Units in stock', 'vulocart' ) }</span>
					<div className="vulocart-inv-stepper">
						<button type="button" aria-label={ __( 'Decrease', 'vulocart' ) } onClick={ () => step( -1 ) } disabled={ '' === quantity || Number( quantity ) <= 0 }>
							−
						</button>
						<input type="number" min={ 0 } value={ quantity } placeholder="0" onChange={ ( event ) => setQuantity( event.target.value ) } />
						<button type="button" aria-label={ __( 'Increase', 'vulocart' ) } onClick={ () => step( 1 ) }>
							+
						</button>
					</div>
				</div>

				<div className="vulocart-qe-field">
					<span>{ __( 'Availability', 'vulocart' ) }</span>
					<div className="vulocart-qe-segment" role="radiogroup" aria-label={ __( 'Availability', 'vulocart' ) }>
						{ STOCK_STATUS_OPTIONS.map( ( option ) => (
							<button
								key={ option.value }
								type="button"
								role="radio"
								aria-checked={ status === option.value }
								className={ status === option.value ? 'is-active' : '' }
								onClick={ () => setStatus( option.value ) }
							>
								{ option.label }
							</button>
						) ) }
					</div>
				</div>

				{ error && (
					<p className="vulocart-qe-error" role="alert">
						{ error }
					</p>
				) }
			</div>
		</PopupComponent>
	);
}

/**
 * The Inventory menu's stock-level screen - a view over products of a stock-trackable type (Inventory.php's own
 * `STOCK_TRACKED_TYPES`). Laid out like the Products list: a zyra `TableCard`
 * with a merged product cell, status tabs with counts, a type filter, row actions and a bulk availability change,
 * and an "Adjust stock" popup instead of editable cells (the installed zyra build never enters cell edit mode).
 *
 * `embedded` renders just the table, for the Inventory page's Stock Levels tab (the page supplies the
 * header and container); the Export button then goes into that page's header.
 *
 * The REST list is fetched in full and the tabs, search, filter and paging all run on the loaded rows, so counts
 * always match what the table can show.
 */
export function InventoryPage( { embedded = false }: { embedded?: boolean } ) {
	const [ items, setItems ] = useState< InventoryItem[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ query, setQuery ] = useState< QueryProps >( {} );
	const [ bulkError, setBulkError ] = useState( '' );
	const [ adjusting, setAdjusting ] = useState< InventoryItem | null >( null );
	const [ historyOf, setHistoryOf ] = useState< InventoryItem | null >( null );

	const load = () => {
		setIsLoading( true );
		fetchInventory()
			.then( setItems )
			.finally( () => setIsLoading( false ) );
	};

	useEffect( load, [] );

	const replaceItem = ( updated: InventoryItem ) => setItems( ( current ) => current.map( ( item ) => ( item.id === updated.id ? updated : item ) ) );

	const applyBulk = ( action: string, ids: number[] ) => {
		const [ , status ] = action.split( ':' );

		if ( ! ids.length || ! status ) {
			return;
		}

		setIsLoading( true );
		Promise.allSettled( ids.map( ( id ) => patchStock( id, { stock_status: status } ) ) ).then( ( results ) => {
			const failed = results.filter( ( result ) => 'rejected' === result.status ).length;

			setBulkError( failed ? sprintf( /* translators: %d: number of products. */ _n( '%d product could not be updated.', '%d products could not be updated.', failed, 'vulocart' ), failed ) : '' );
			load();
		} );
	};

	const search = ( query.searchValue ?? '' ).trim().toLowerCase();
	const typeFilter = query.filter?.type;
	const tab = query.categoryFilter && 'all' !== query.categoryFilter ? query.categoryFilter : '';

	const matching = items.filter(
		( item ) =>
			( ! search || item.title.toLowerCase().includes( search ) || ( item.sku ?? '' ).toLowerCase().includes( search ) ) &&
			( ! typeFilter || item.type === typeFilter ) &&
			( ! tab || ( 'low_stock' === tab ? item.low_stock : item.stock_status === tab ) )
	);

	// Sorts the matching rows before paging, so a sorted column orders the whole list, not just one page.
	// Stock orders by units on hand, with products that don't track a quantity always last.
	const direction = 'asc' === query.order ? 1 : -1;
	const sorted = query.orderby
		? [ ...matching ].sort( ( a, b ) => {
				if ( 'stock' === query.orderby ) {
					if ( a.stock_quantity === b.stock_quantity ) {
						return a.title.localeCompare( b.title );
					}

					if ( null === a.stock_quantity ) {
						return 1;
					}

					if ( null === b.stock_quantity ) {
						return -1;
					}

					return ( a.stock_quantity - b.stock_quantity ) * direction;
				}

				return a.title.localeCompare( b.title ) * direction;
		  } )
		: matching;

	const perPage = Number( query.per_page ) || DEFAULT_PER_PAGE;
	const paged = Number( query.paged ) || 1;
	const pageRows = sorted.slice( ( paged - 1 ) * perPage, paged * perPage );

	const countBy = ( status: string ) => items.filter( ( item ) => item.stock_status === status ).length;
	const lowStock = items.filter( ( item ) => item.low_stock ).length;

	const categoryCounts: CategoryCount[] = [
		{ value: 'all', label: __( 'All', 'vulocart' ), count: items.length },
		...STOCK_STATUS_OPTIONS.map( ( option ) => ( { value: option.value, label: option.label, count: countBy( option.value ) } ) ),
		{ value: 'low_stock', label: __( 'Low stock', 'vulocart' ), count: lowStock },
	];

	const csvHeaders = {
		title: { label: __( 'Product', 'vulocart' ) },
		type: { label: __( 'Type', 'vulocart' ) },
		sku: { label: __( 'SKU', 'vulocart' ) },
		stock_quantity: { label: __( 'Quantity', 'vulocart' ) },
		stock_status: { label: __( 'Status', 'vulocart' ) },
	};

	const today = () => new Date().toISOString().slice( 0, 10 );
	const exportAll = () => downloadCSV( csvHeaders, matching as unknown as Record< string, unknown >[], `vulocart-inventory-${ today() }.csv` );

	// Embedded, the header belongs to the Inventory page's frame (EngineScreen): Export goes into its top-right
	// through the same channel Pro's pages use, like the Products list's header, and is removed with the tab.
	useEffect( () => {
		// eslint-disable-next-line no-unused-vars -- a parameter name in a type, not a variable.
		const channel = embedded ? ( window as unknown as { vulocartEngineHeader?: { set: ( node: ReactNode ) => void } } ).vulocartEngineHeader : undefined;

		if ( ! channel ) {
			return undefined;
		}

		channel.set( <ButtonInput buttons={ [ { text: __( 'Export', 'vulocart' ), icon: 'download', color: 'purple', onClick: exportAll } ] } /> );

		return () => channel.set( null );
	} );

	const headers = {
		product: {
			label: __( 'Product', 'vulocart' ),
			isSortable: true,
			required: true,
			render: ( row?: TableRow ) => {
				if ( ! row ) {
					return null;
				}

				return (
					<InformationItemComponent
						title={ row.title as string }
						badges={ [ { text: String( row.type ).replace( '_', ' ' ), className: 'badge-info' } ] }
						descriptions={ row.sku ? [ { label: __( 'SKU', 'vulocart' ), value: String( row.sku ) } ] : [] }
					/>
				);
			},
		},
		stock: {
			label: __( 'Stock', 'vulocart' ),
			isSortable: true,
			defaultOrder: 'asc' as const,
			render: ( row?: TableRow ) => {
				if ( ! row ) {
					return null;
				}

				const quantity = row.stock_quantity as number | null;

				return (
					<InformationItemComponent
						title={ null === quantity ? '—' : sprintf( /* translators: %s: number of units. */ _n( '%s unit', '%s units', quantity, 'vulocart' ), quantity ) }
						badges={ [
							{ text: statusLabel( String( row.stock_status ) ), className: STATUS_BADGE[ String( row.stock_status ) ] ?? 'badge-info' },
							...( row.low_stock ? [ { text: __( 'Low stock', 'vulocart' ), className: 'badge-pending' } ] : [] ),
						] }
					/>
				);
			},
		},
		actions: {
			label: __( 'Actions', 'vulocart' ),
			type: 'action' as const,
			actions: [
				{
					label: __( 'Adjust stock', 'vulocart' ),
					icon: 'edit',
					type: 'button' as const,
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => setAdjusting( row as unknown as InventoryItem ),
				},
				{
					label: __( 'History', 'vulocart' ),
					icon: 'clock',
					type: 'button' as const,
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => setHistoryOf( row as unknown as InventoryItem ),
				},
				{
					label: __( 'Edit product', 'vulocart' ),
					icon: 'eye',
					type: 'button' as const,
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => {
						window.location.href = `admin.php?page=products&action=edit&id=${ row.id }`;
					},
				},
			],
		},
	};

	const content = (
		<>
			{ bulkError && (
				<p className="vulocart-qe-error" role="alert">
					{ bulkError }
				</p>
			) }

			<TableCard
				showMenu={ false }
				headers={ headers }
				rows={ pageRows as unknown as TableRow[] }
				ids={ pageRows.map( ( item ) => item.id ) }
				totalRows={ matching.length }
				isLoading={ isLoading }
				onQueryUpdate={ setQuery }
				categoryCounts={ categoryCounts }
				activeCategory="all"
				search={ { placeholder: __( 'Search title or SKU…', 'vulocart' ) } }
				filters={ [ { key: 'type', label: __( 'Type', 'vulocart' ), type: 'select', size: 4, options: TRACKED_TYPE_OPTIONS } ] }
				bulkActions={ STOCK_STATUS_OPTIONS.map( ( option ) => ( {
					label: __( 'Mark as', 'vulocart' ) + ' ' + option.label.toLowerCase(),
					value: `stock_status:${ option.value }`,
				} ) ) }
				onBulkActionApply={ applyBulk }
				onSelectCsvDownloadApply={ ( ids: number[] ) =>
					downloadCSV( csvHeaders, items.filter( ( item ) => ids.includes( item.id ) ) as unknown as Record< string, unknown >[], `vulocart-inventory-selected-${ today() }.csv` )
				}
				emptyMessage={ __( 'No stock-tracked products yet.', 'vulocart' ) }
			/>
		</>
	);

	if ( embedded ) {
		return (
			<>
				{ content }
				{ adjusting && <StockAdjust item={ adjusting } onClose={ () => setAdjusting( null ) } onSaved={ replaceItem } /> }
				{ historyOf && <StockHistory item={ historyOf } onClose={ () => setHistoryOf( null ) } /> }
			</>
		);
	}

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent
					headerIcon="store-inventory"
					headerTitle={ __( 'Inventory', 'vulocart' ) }
					headerDescription={ __( 'Stock levels for every physical, rental, bundle, and gift card product.', 'vulocart' ) }
					buttons={ [
						{ label: __( 'Export', 'vulocart' ), icon: 'download', color: 'purple', onClick: exportAll },
						{
							label: __( 'All products', 'vulocart' ),
							icon: 'product',
							color: '',
							onClick: () => {
								window.location.href = 'admin.php?page=products';
							},
						},
					] }
				/>

				{ content }
			</ColumnComponent>

			{ adjusting && <StockAdjust item={ adjusting } onClose={ () => setAdjusting( null ) } onSaved={ replaceItem } /> }
			{ historyOf && <StockHistory item={ historyOf } onClose={ () => setHistoryOf( null ) } /> }
		</ContainerComponent>
	);
}

export default InventoryPage;
