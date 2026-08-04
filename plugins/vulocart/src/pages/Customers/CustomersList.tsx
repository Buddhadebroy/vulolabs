/* global vulocartLocalizer */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { ContainerComponent, ColumnComponent, NavigatorHeaderComponent } from '@zyra/components';
import { TableCard, TableRow, QueryProps } from '@zyra/table';
import './customers-page.scss';

/**
 * Admin customer list — `GET /customers` (modules/Customer/Rest.php,
 * manage_options-gated), same `NavigatorHeaderComponent` + `TableCard`
 * pattern `OrdersList.tsx` already establishes. No category tabs (a
 * customer has no fulfillment/payment-status-like dimension to filter
 * by) — just search across email/name and sortable totals, both backed
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

	const headers = {
		name: {
			label: __( 'Customer', 'vulocart' ),
			render: ( row?: TableRow ) =>
				row && (
					<a href={ `admin.php?page=vulocart-customers&action=view&id=${ row.id }` }>
						{ ( row.name as string ) || ( row.email as string ) }
					</a>
				),
		},
		email: {
			label: __( 'Email', 'vulocart' ),
			render: ( row?: TableRow ) => ( row?.email as string ) || '—',
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
			render: ( row?: TableRow ) => ( row?.last_order_at as string ) || '—',
		},
		actions: {
			label: __( 'Actions', 'vulocart' ),
			render: ( row?: TableRow ) =>
				row && (
					<a href={ `admin.php?page=vulocart-customers&action=view&id=${ row.id }` }>
						{ __( 'View', 'vulocart' ) }
					</a>
				),
		},
	};

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent
					headerIcon="groups"
					headerTitle={ __( 'Customers', 'vulocart' ) }
					headerDescription={ __(
						'Every shopper who has placed an order — profile, saved addresses, order history, and internal notes in one place.',
						'vulocart'
					) }
					buttons={ [] }
				/>

				<TableCard
					title={ __( 'Customers', 'vulocart' ) }
					headers={ headers }
					rows={ rows }
					totalRows={ totalRows }
					isLoading={ isLoading }
					onQueryUpdate={ doRefreshTableData }
					ids={ rowIds }
					search={ {
						placeholder: __( 'Search name or email…', 'vulocart' ),
					} }
				/>
			</ColumnComponent>
		</ContainerComponent>
	);
}

export default CustomersList;
