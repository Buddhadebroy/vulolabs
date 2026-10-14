/* global vulocartLocalizer */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { ContainerComponent, ColumnComponent, NavigatorHeaderComponent } from '@zyra/components';
import { TableCard, TableRow, QueryProps } from '@zyra/table';
import { downloadCSV } from '../../lib/utils';
import { formatWpDate } from '../../services/formatWpDate';
import './customers-page.scss';
import '../Products/products-page.scss';

/**
 * Admin customer list - `GET /customers` (modules/Customer/Rest.php,
 * manage_options-gated), same `NavigatorHeaderComponent` + `TableCard`
 * pattern `OrdersList.tsx` already establishes. No category tabs (a
 * customer has no fulfillment/payment-status-like dimension to filter
 * by) - just search across email/name and sortable totals, both backed
 * by real columns on the `Customer` entity (`total_orders`/
 * `total_spent`/`last_order_at`), not computed per-row on the client.
 */
export function CustomersList() {
	const [ isLoading, setIsLoading ] = useState( false );
	const [ rowIds, setRowIds ] = useState< number[] >( [] );
	const [ rows, setRows ] = useState< TableRow[] >( [] );
	const [ totalRows, setTotalRows ] = useState( 0 );

	const doRefreshTableData = ( query: QueryProps ) => {
		setIsLoading( true );
		axios
			.get( getApiLink( vulocartLocalizer, 'customers' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
				params: {
					search: query.searchValue || '',
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
				params: { search: query.searchValue || '', per_page: 1000 },
			} )
			.then( ( response ) => downloadCSV( csvHeaders, response.data || [], `vulocart-customers-${ new Date().toISOString().slice( 0, 10 ) }.csv` ) );
	};

	const headers = {
		name: {
			label: __( 'Customer', 'vulocart' ),
			required: true,
			render: ( row?: TableRow ) =>
				row && (
					<div className="vulocart-product-cell">
						<a className="vulocart-product-cell-title" href={ `admin.php?page=vulocart-customers&action=view&id=${ row.id }` }>
							{ ( row.name as string ) || ( row.email as string ) }
						</a>
						{ row.name && row.email ? <div className="desc">{ row.email as string }</div> : null }
					</div>
				),
		},
		total_orders: {
			label: __( 'Orders', 'vulocart' ),
			isSortable: true,
			isNumeric: true,
			render: ( row?: TableRow ) => ( row?.total_orders as number ) ?? 0,
		},
		total_spent: {
			label: __( 'Total spent', 'vulocart' ),
			isSortable: true,
			isNumeric: true,
			render: ( row?: TableRow ) => ( row?.total_spent as number )?.toFixed( 2 ) ?? '0.00',
		},
		last_order_at: {
			label: __( 'Last order', 'vulocart' ),
			isSortable: true,
			render: ( row?: TableRow ) => ( row?.last_order_at ? formatWpDate( row.last_order_at as string ) : '-' ),
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
			],
		},
	};

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent
					headerIcon="membership"
					headerTitle={ __( 'Customers', 'vulocart' ) }
					headerDescription={ __(
						'Every shopper who has placed an order - profile, saved addresses, order history, and internal notes in one place.',
						'vulocart'
					) }
					buttons={ [] }
				/>

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
					buttonActions={ [ { label: __( 'Export CSV', 'vulocart' ), icon: 'download', onClickWithQuery: downloadAllCSV } ] }
					onSelectCsvDownloadApply={ downloadSelectedCSV }
				/>
			</ColumnComponent>
		</ContainerComponent>
	);
}

export default CustomersList;
