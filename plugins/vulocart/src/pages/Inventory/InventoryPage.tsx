/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { ContainerComponent, ColumnComponent, NavigatorHeaderComponent } from '@zyra/components';
import { TableCard, TableRow, CategoryCount } from '@zyra/table';
import { downloadCSV } from '../../lib/utils';
import { SelectInput } from '@zyra/inputs';
import './inventory-page.scss';
import '../Products/products-page.scss';

interface InventoryItem {
	id: number;
	title: string;
	type: string;
	sku: string | null;
	stock_management: boolean;
	stock_status: string;
	stock_quantity: number | null;
	low_stock: boolean;
}

const STOCK_STATUS_OPTIONS = [
	{ label: __( 'In stock', 'vulocart' ), value: 'in_stock' },
	{ label: __( 'Out of stock', 'vulocart' ), value: 'out_of_stock' },
	{ label: __( 'Backorder', 'vulocart' ), value: 'backorder' },
];

const DEFAULT_PER_PAGE = 20;

/**
 * The Products menu's "Inventory" page - a specialized view over
 * products of a stock-trackable type (Inventory.php's own
 * `STOCK_TRACKED_TYPES`), with inline quantity/status editing. A zyra
 * `TableCard` whose quantity and status cells render real `<input>`/
 * `<select>` controls - not `TableCard`'s own `onCellEdit`/`isEditable`,
 * which don't work in the current `@zyra/table` build (`Table.tsx`
 * hardcodes `isEditing: false`, so a cell never enters edit mode).
 * Status tabs (with counts) and the search run on the loaded rows.
 */
export function InventoryPage() {
	const [ items, setItems ] = useState< InventoryItem[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ query, setQuery ] = useState< { paged?: number | string; per_page?: number | string; searchValue?: string; categoryFilter?: string } >( {} );
	const [ drafts, setDrafts ] = useState< Record< number, { quantity: string; status: string } > >( {} );

	const nonce = { 'X-WP-Nonce': vulocartLocalizer.nonce };

	const load = () => {
		setIsLoading( true );
		const url = getApiLink( vulocartLocalizer, 'inventory' );
		const page = ( number: number ) => axios.get< InventoryItem[] >( url, { headers: nonce, params: { per_page: 100, page: number } } );

		// Every page: the search below filters these rows on the screen, so a first page alone would hide the rest.
		page( 1 )
			.then( ( first ) => {
				const pages = Math.min( Number( first.headers[ 'x-wp-totalpages' ] ) || 1, 50 );

				return Promise.all( Array.from( { length: Math.max( 0, pages - 1 ) }, ( _, index ) => page( index + 2 ) ) ).then( ( rest ) =>
					rest.reduce< InventoryItem[] >( ( all, response ) => all.concat( response.data ), first.data )
				);
			} )
			.then( ( data ) => {
				setItems( data );
				const nextDrafts: Record< number, { quantity: string; status: string } > = {};
				data.forEach( ( item ) => {
					nextDrafts[ item.id ] = {
						quantity: null === item.stock_quantity ? '' : String( item.stock_quantity ),
						status: item.stock_status,
					};
				} );
				setDrafts( nextDrafts );
			} )
			.finally( () => setIsLoading( false ) );
	};

	useEffect( load, [] );

	const saveRow = ( id: number, override?: { status?: string } ) => {
		const draft = drafts[ id ];

		if ( ! draft ) {
			return Promise.resolve();
		}

		return axios
			.patch< InventoryItem >(
				getApiLink( vulocartLocalizer, `inventory/${ id }` ),
				{
					stock_quantity: '' === draft.quantity ? null : Number( draft.quantity ),
					stock_status: override?.status ?? draft.status,
				},
				{ headers: nonce }
			)
			.then( ( response ) => setItems( ( current ) => current.map( ( item ) => ( item.id === id ? response.data : item ) ) ) );
	};

	const applyBulk = ( action: string, ids: number[] ) => {
		const [ , status ] = action.split( ':' );

		if ( ! ids.length || ! status ) {
			return;
		}

		setDrafts( ( current ) => Object.fromEntries( Object.entries( current ).map( ( [ id, draft ] ) => [ id, ids.includes( Number( id ) ) ? { ...draft, status } : draft ] ) ) );
		Promise.all( ids.map( ( id ) => saveRow( id, { status } ) ) ).finally( load );
	};

	const search = ( query.searchValue ?? '' ).trim().toLowerCase();
	const matching = items.filter(
		( item ) =>
			( ! search || item.title.toLowerCase().includes( search ) || ( item.sku ?? '' ).toLowerCase().includes( search ) ) &&
			( ! query.categoryFilter || 'all' === query.categoryFilter || ( 'low_stock' === query.categoryFilter ? item.low_stock : item.stock_status === query.categoryFilter ) )
	);

	const perPage = Number( query.per_page ) || DEFAULT_PER_PAGE;
	const paged = Number( query.paged ) || 1;
	const pageRows = matching.slice( ( paged - 1 ) * perPage, paged * perPage );

	const categoryCounts: CategoryCount[] = [
		{ value: 'all', label: __( 'All', 'vulocart' ), count: items.length },
		...STOCK_STATUS_OPTIONS.map( ( option ) => ( {
			value: option.value,
			label: option.label,
			count: items.filter( ( item ) => item.stock_status === option.value ).length,
		} ) ),
		{ value: 'low_stock', label: __( 'Low stock', 'vulocart' ), count: items.filter( ( item ) => item.low_stock ).length },
	];

	const csvHeaders = {
		title: { label: __( 'Product', 'vulocart' ) },
		sku: { label: __( 'SKU', 'vulocart' ) },
		stock_quantity: { label: __( 'Quantity', 'vulocart' ) },
		stock_status: { label: __( 'Status', 'vulocart' ) },
	};

	const headers = {
		product: {
			label: __( 'Product', 'vulocart' ),
			required: true,
			render: ( row?: TableRow ) => {
				if ( ! row ) {
					return null;
				}

				return (
					<div className="vulocart-product-cell">
						<a className="vulocart-product-cell-title" href={ `admin.php?page=vulocart-products&action=edit&id=${ row.id }` }>
							{ row.title as string }
						</a>
						{ row.sku ? <div className="desc">{ `${ __( 'SKU', 'vulocart' ) }: ${ row.sku }` }</div> : null }
						<div className="vulocart-product-cell-tags">
							<span className="admin-badge badge-info">{ String( row.type ).replace( '_', ' ' ) }</span>
							{ row.low_stock ? <span className="admin-badge badge-pending">{ __( 'Low stock', 'vulocart' ) }</span> : null }
						</div>
					</div>
				);
			},
		},
		quantity: {
			label: __( 'Quantity', 'vulocart' ),
			isNumeric: true,
			render: ( row?: TableRow ) =>
				row && (
					<input
						type="number"
						min={ 0 }
						value={ drafts[ row.id as number ]?.quantity ?? '' }
						onChange={ ( event ) =>
							setDrafts( ( current ) => ( { ...current, [ row.id as number ]: { ...current[ row.id as number ], quantity: event.target.value } } ) )
						}
						style={ { width: '80px' } }
					/>
				),
		},
		status: {
			label: __( 'Stock status', 'vulocart' ),
			render: ( row?: TableRow ) =>
				row && (
					<SelectInput
						name={ `stock_status_${ row.id }` }
						type="single-select"
						options={ STOCK_STATUS_OPTIONS }
						value={ drafts[ row.id as number ]?.status ?? 'in_stock' }
						onChange={ ( value ) =>
							setDrafts( ( current ) => ( { ...current, [ row.id as number ]: { ...current[ row.id as number ], status: value as string } } ) )
						}
					/>
				),
		},
		actions: {
			label: __( 'Actions', 'vulocart' ),
			type: 'action' as const,
			actions: [
				{
					label: __( 'Save', 'vulocart' ),
					icon: 'save',
					type: 'button' as const,
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => {
						saveRow( row.id as number );
					},
				},
				{
					label: __( 'Edit product', 'vulocart' ),
					icon: 'edit',
					type: 'button' as const,
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => {
						window.location.href = `admin.php?page=vulocart-products&action=edit&id=${ row.id }`;
					},
				},
			],
		},
	};

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent
					headerIcon="store-inventory"
					headerTitle={ __( 'Inventory', 'vulocart' ) }
					headerDescription={ __(
						'Stock levels for every physical, rental, bundle, and gift card product.',
						'vulocart'
					) }
				/>

				<TableCard
					headers={ headers }
					rows={ pageRows as unknown as TableRow[] }
					ids={ pageRows.map( ( item ) => item.id ) }
					totalRows={ matching.length }
					isLoading={ isLoading }
					onQueryUpdate={ setQuery }
					categoryCounts={ categoryCounts }
					activeCategory="all"
					search={ { placeholder: __( 'Search title or SKU…', 'vulocart' ) } }
					bulkActions={ STOCK_STATUS_OPTIONS.map( ( option ) => ( {
						label: __( 'Stock:', 'vulocart' ) + ' ' + option.label,
						value: `stock_status:${ option.value }`,
					} ) ) }
					onBulkActionApply={ applyBulk }
					buttonActions={ [
						{
							label: __( 'Export CSV', 'vulocart' ),
							icon: 'download',
							onClick: () => downloadCSV( csvHeaders, matching as unknown as Record< string, unknown >[], `vulocart-inventory-${ new Date().toISOString().slice( 0, 10 ) }.csv` ),
						},
					] }
					onSelectCsvDownloadApply={ ( ids: number[] ) =>
						downloadCSV(
							csvHeaders,
							items.filter( ( item ) => ids.includes( item.id ) ) as unknown as Record< string, unknown >[],
							`vulocart-inventory-selected-${ new Date().toISOString().slice( 0, 10 ) }.csv`
						)
					}
					emptyMessage={ __( 'No stock-tracked products yet.', 'vulocart' ) }
				/>
			</ColumnComponent>
		</ContainerComponent>
	);
}

export default InventoryPage;
