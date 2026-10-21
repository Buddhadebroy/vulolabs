/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { ContainerComponent, ColumnComponent, NavigatorHeaderComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard, TableRow, QueryProps, CategoryCount } from '@zyra/table';
import { downloadCSV } from '../../lib/utils';
import { formatWpDate } from '../../services/formatWpDate';
import ConfirmPopup from '../../components/ConfirmPopup/ConfirmPopup';
import '../Products/products-page.scss';

interface ReviewRow {
	id: number;
	product_id: number;
	product_title: string | null;
	customer_name: string | null;
	customer_email: string | null;
	rating: number;
	title: string | null;
	content: string | null;
	status: string;
	created_at: string;
}

const STATUS_OPTIONS = [
	{ label: __( 'Pending', 'vulocart' ), value: 'pending' },
	{ label: __( 'Approved', 'vulocart' ), value: 'approved' },
	{ label: __( 'Rejected', 'vulocart' ), value: 'rejected' },
];

const STATUS_BADGE: Record< string, string > = { approved: 'badge-active', pending: 'badge-pending', rejected: 'badge-inactive' };

const CSV_HEADERS = {
	product_title: { label: __( 'Product', 'vulocart' ) },
	customer_name: { label: __( 'From', 'vulocart' ) },
	customer_email: { label: __( 'Email', 'vulocart' ) },
	rating: { label: __( 'Rating', 'vulocart' ) },
	title: { label: __( 'Title', 'vulocart' ) },
	content: { label: __( 'Review', 'vulocart' ) },
	status: { label: __( 'Status', 'vulocart' ) },
	created_at: { label: __( 'Submitted', 'vulocart' ) },
};

/**
 * The Products menu's "Reviews" admin page - moderation queue for
 * customer reviews (`GET/PATCH/DELETE /reviews`, admin-only;
 * `POST /reviews` - submission - is public, not used from this page).
 * Same `TableCard` + real per-status `categoryCounts` pattern
 * `src/pages/Orders/OrdersList.tsx` already establishes.
 */
export function ReviewsPage() {
	const [ isLoading, setIsLoading ] = useState( false );
	const [ rowIds, setRowIds ] = useState< number[] >( [] );
	const [ rows, setRows ] = useState< TableRow[] >( [] );
	const [ totalRows, setTotalRows ] = useState( 0 );
	const [ categoryCounts, setCategoryCounts ] = useState< CategoryCount[] >( [] );
	const [ lastQuery, setLastQuery ] = useState< QueryProps >( {} );
	const [ deleteIds, setDeleteIds ] = useState< number[] >( [] );
	const [ productOptions, setProductOptions ] = useState< { label: string; value: string }[] >( [] );

	// Options for the Product filter - every product, by title.
	useEffect( () => {
		axios
			.get< { id: number; title: string }[] >( getApiLink( vulocartLocalizer, 'products' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
				params: { per_page: 100 },
			} )
			.then( ( response ) => setProductOptions( ( response.data || [] ).map( ( product ) => ( { label: product.title, value: String( product.id ) } ) ) ) )
			.catch( () => setProductOptions( [] ) );
	}, [] );

	const doRefreshTableData = ( query: QueryProps ) => {
		setLastQuery( query );
		setIsLoading( true );
		axios
			.get( getApiLink( vulocartLocalizer, 'reviews' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
				params: {
					page: query.paged || 1,
					per_page: query.per_page || 20,
					status: 'all' === query.categoryFilter || ! query.categoryFilter ? '' : query.categoryFilter,
					product_id: query.filter?.product_id || '',
					search: query.searchValue || '',
				},
			} )
			.then( ( response ) => {
				const items: TableRow[] = response.data || [];

				setRowIds( items.map( ( item ) => Number( item.id ) ) );
				setRows( items );
				setTotalRows( Number( response.headers[ 'x-wp-total' ] ) || 0 );

				setCategoryCounts( [
					{ value: 'all', label: __( 'All', 'vulocart' ), count: Number( response.headers[ 'x-wp-total' ] ) || 0 },
					...STATUS_OPTIONS.map( ( option ) => ( {
						value: option.value,
						label: option.label,
						count: Number( response.headers[ `x-wp-count-${ option.value }` ] ) || 0,
					} ) ),
				] );

				setIsLoading( false );
			} )
			.catch( () => {
				setRows( [] );
				setTotalRows( 0 );
				setIsLoading( false );
			} );
	};

	const moderate = ( id: number, status: string ) => {
		axios
			.patch(
				getApiLink( vulocartLocalizer, `reviews/${ id }` ),
				{ status },
				{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
			)
			.then( () => doRefreshTableData( lastQuery ) );
	};

	const headersAuth = { 'X-WP-Nonce': vulocartLocalizer.nonce };

	const confirmDelete = () => {
		const ids = deleteIds;
		setDeleteIds( [] );

		Promise.all( ids.map( ( id ) => axios.delete( getApiLink( vulocartLocalizer, `reviews/${ id }` ), { headers: headersAuth } ) ) ).finally( () =>
			doRefreshTableData( lastQuery )
		);
	};

	const handleBulkAction = ( action: string, selectedIds: number[] ) => {
		if ( ! selectedIds.length ) {
			return;
		}

		if ( 'delete' === action ) {
			setDeleteIds( selectedIds );
			return;
		}

		const [ , status ] = action.split( ':' );
		Promise.all(
			selectedIds.map( ( id ) => axios.patch( getApiLink( vulocartLocalizer, `reviews/${ id }` ), { status }, { headers: headersAuth } ) )
		).finally( () => doRefreshTableData( lastQuery ) );
	};

	const downloadSelectedCSV = ( selectedIds: number[] ) =>
		downloadCSV( CSV_HEADERS, rows.filter( ( row ) => selectedIds.includes( Number( row.id ) ) ), `vulocart-reviews-selected-${ new Date().toISOString().slice( 0, 10 ) }.csv` );

	const downloadAllCSV = ( query: QueryProps ) => {
		axios
			.get( getApiLink( vulocartLocalizer, 'reviews' ), {
				headers: headersAuth,
				params: {
					per_page: 1000,
					search: query.searchValue || '',
					status: 'all' === query.categoryFilter || ! query.categoryFilter ? '' : query.categoryFilter,
					product_id: query.filter?.product_id || '',
				},
			} )
			.then( ( response ) => downloadCSV( CSV_HEADERS, response.data || [], `vulocart-reviews-${ new Date().toISOString().slice( 0, 10 ) }.csv` ) );
	};

	const headers = {
		review: {
			label: __( 'Review', 'vulocart' ),
			required: true,
			render: ( row?: TableRow ) => {
				if ( ! row ) {
					return null;
				}

				const rating = ( row.rating as number ) || 0;
				const from = ( row.customer_name as string ) || ( row.customer_email as string ) || __( 'Anonymous', 'vulocart' );

				return (
					<div className="vulocart-product-cell">
						{ row.title ? <span className="vulocart-product-cell-title">{ row.title as string }</span> : null }
						<div className="desc">{ ( row.content as string )?.slice( 0, 120 ) }</div>
						<div className="desc">
							<a href={ `admin.php?page=products&action=edit&id=${ row.product_id }` }>
								{ ( row.product_title as string ) || __( '(deleted product)', 'vulocart' ) }
							</a>
							{ ' · ' }
							{ from }
						</div>
						<div className="vulocart-product-cell-tags">
							<span className="admin-badge badge-info">{ '★'.repeat( rating ) + '☆'.repeat( 5 - rating ) }</span>
							<span className={ `admin-badge ${ STATUS_BADGE[ String( row.status ) ] ?? 'badge-info' }` }>{ String( row.status ) }</span>
							{ row.created_at && <span className="desc">{ formatWpDate( row.created_at as string ) }</span> }
						</div>
					</div>
				);
			},
		},
		actions: {
			label: __( 'Actions', 'vulocart' ),
			type: 'action' as const,
			actions: [
				{
					label: __( 'Approve', 'vulocart' ),
					icon: 'check',
					type: 'button' as const,
					color: 'text-blue',
					hidden: ( row: Record< string, unknown > ) => 'approved' === row.status,
					onClick: ( row: Record< string, unknown > ) => moderate( row.id as number, 'approved' ),
				},
				{
					label: __( 'Reject', 'vulocart' ),
					icon: 'close',
					type: 'button' as const,
					color: 'text-blue',
					hidden: ( row: Record< string, unknown > ) => 'rejected' === row.status,
					onClick: ( row: Record< string, unknown > ) => moderate( row.id as number, 'rejected' ),
				},
				{
					label: __( 'Delete', 'vulocart' ),
					icon: 'delete',
					type: 'button' as const,
					color: 'text-red',
					onClick: ( row: Record< string, unknown > ) => setDeleteIds( [ row.id as number ] ),
				},
			],
		},
	};

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent
					headerIcon="review"
					headerTitle={ __( 'Reviews', 'vulocart' ) }
					headerDescription={ __( 'Customer ratings and comments on your products - approve or reject before they show on the storefront.', 'vulocart' ) }
					// Export in the header, like the Products list; it follows the table's current search and status.
					headerCustomContent={
						<ButtonInput buttons={ [ { text: __( 'Export', 'vulocart' ), icon: 'download', color: 'purple', onClick: () => downloadAllCSV( lastQuery ) } ] } />
					}
				/>

				<TableCard
					headers={ headers }
					rows={ rows }
					totalRows={ totalRows }
					isLoading={ isLoading }
					onQueryUpdate={ doRefreshTableData }
					ids={ rowIds }
					categoryCounts={ categoryCounts }
					activeCategory="all"
					search={ { placeholder: __( 'Search reviews…', 'vulocart' ) } }
					filters={ [ { key: 'product_id', label: __( 'Product', 'vulocart' ), type: 'select', size: 4, options: productOptions } ] }
					bulkActions={ [
						...STATUS_OPTIONS.filter( ( option ) => 'pending' !== option.value ).map( ( option ) => ( {
							label: __( 'Mark as', 'vulocart' ) + ' ' + option.label.toLowerCase(),
							value: `status:${ option.value }`,
						} ) ),
						{ label: __( 'Delete', 'vulocart' ), value: 'delete' },
					] }
					onBulkActionApply={ ( action: string, selectedIds: number[] ) => handleBulkAction( action, selectedIds ) }
					onSelectCsvDownloadApply={ downloadSelectedCSV }
				/>
			</ColumnComponent>

			<ConfirmPopup
				open={ deleteIds.length > 0 }
				title={ __( 'Delete review', 'vulocart' ) }
				message={ __( 'Delete the selected review(s)? This cannot be undone.', 'vulocart' ) }
				onConfirm={ confirmDelete }
				onCancel={ () => setDeleteIds( [] ) }
			/>
		</ContainerComponent>
	);
}

export default ReviewsPage;
