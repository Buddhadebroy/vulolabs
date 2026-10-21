/* global vulocartLocalizer */
import { useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { ContainerComponent, ColumnComponent, NavigatorHeaderComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard, TableRow, QueryProps, CategoryCount } from '@zyra/table';
import { downloadCSV } from '../../lib/utils';
import './orders-page.scss';
import '../Products/products-page.scss';
import { formatWpDate } from '../../services/formatWpDate';
import ConfirmPopup from '../../components/ConfirmPopup/ConfirmPopup';

/**
 * The 6 statuses Order\Domain\FulfillmentStatus::all() declares
 * (modules/Order/Domain/FulfillmentStatus.php) - duplicated here the same
 * way ProductEdit.tsx duplicates VuloCart\Domain\Product\ProductType's list
 * rather than fetching it: small, stable, hand-maintained.
 */
const FULFILLMENT_STATUS_OPTIONS = [
	{ label: __( 'Draft', 'vulocart' ), value: 'draft' },
	{ label: __( 'Pending', 'vulocart' ), value: 'pending' },
	{ label: __( 'Processing', 'vulocart' ), value: 'processing' },
	{ label: __( 'Shipped', 'vulocart' ), value: 'shipped' },
	{ label: __( 'Completed', 'vulocart' ), value: 'completed' },
	{ label: __( 'Cancelled', 'vulocart' ), value: 'cancelled' },
];

/**
 * Order\Domain\PaymentStatus::all() (modules/Order/Domain/PaymentStatus.php).
 */
const PAYMENT_STATUS_OPTIONS = [
	{ label: __( 'Pending', 'vulocart' ), value: 'pending' },
	{ label: __( 'Paid', 'vulocart' ), value: 'paid' },
	{ label: __( 'Failed', 'vulocart' ), value: 'failed' },
	{ label: __( 'Refunded', 'vulocart' ), value: 'refunded' },
];


const FULFILLMENT_BADGE: Record< string, string > = {
	draft: 'badge-pending',
	pending: 'badge-pending',
	processing: 'badge-info',
	shipped: 'badge-info',
	completed: 'badge-active',
	cancelled: 'badge-inactive',
};

const PAYMENT_BADGE: Record< string, string > = { pending: 'badge-pending', paid: 'badge-active', failed: 'badge-inactive', refunded: 'badge-info' };

const optionLabel = ( options: { label: string; value: string }[], value: string ) => options.find( ( option ) => option.value === value )?.label ?? value;

const formatMoney = ( row: TableRow ) => ( null !== row.total && undefined !== row.total ? `${ row.total } ${ row.currency ?? '' }`.trim() : '-' );

interface OrderRow {
	id: number;
	order_number: string;
	payment_status: string;
	fulfillment_status: string;
}

/**
 * "Update status" - fulfillment and payment status for one order in a popup over the list, the same shape as the
 * Products list's quick edit. Uses the bulk status endpoints with a single id; only what changed is sent.
 */
function OrderStatusPopup( { order, onClose, onSaved }: { order: OrderRow; onClose: () => void; onSaved: () => void } ) {
	const [ fulfillment, setFulfillment ] = useState( order.fulfillment_status );
	const [ payment, setPayment ] = useState( order.payment_status );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ error, setError ] = useState( '' );

	const changed = fulfillment !== order.fulfillment_status || payment !== order.payment_status;

	const save = () => {
		const headers = { 'X-WP-Nonce': vulocartLocalizer.nonce };
		const calls: Promise< unknown >[] = [];

		if ( fulfillment !== order.fulfillment_status ) {
			calls.push( axios.patch( getApiLink( vulocartLocalizer, 'orders/bulk-fulfillment-status' ), { ids: [ order.id ], status: fulfillment }, { headers } ) );
		}

		if ( payment !== order.payment_status ) {
			calls.push( axios.patch( getApiLink( vulocartLocalizer, 'orders/bulk-payment-status' ), { ids: [ order.id ], status: payment }, { headers } ) );
		}

		setIsSaving( true );
		setError( '' );

		Promise.all( calls )
			.then( () => {
				onSaved();
				onClose();
			} )
			.catch( ( reason ) => setError( reason?.response?.data?.message || __( 'Could not update this order.', 'vulocart' ) ) )
			.finally( () => setIsSaving( false ) );
	};

	return (
		<PopupComponent
			open
			onClose={ onClose }
			width={ 30 }
			height="auto"
			position="lightbox"
			header={ { icon: 'cart', title: `${ __( 'Update order', 'vulocart' ) } #${ order.order_number }` } }
			footer={
				<div className="vulocart-qe-footer">
					<a href={ `admin.php?page=orders&action=edit&id=${ order.id }` }>
						{ __( 'Open full order', 'vulocart' ) } <i className="adminfont-pagination-next-arrow" aria-hidden="true" />
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
					<span>{ __( 'Fulfillment', 'vulocart' ) }</span>
					<select value={ fulfillment } onChange={ ( event ) => setFulfillment( event.target.value ) }>
						{ FULFILLMENT_STATUS_OPTIONS.map( ( option ) => (
							<option key={ option.value } value={ option.value }>{ option.label }</option>
						) ) }
					</select>
				</label>

				<label className="vulocart-qe-field">
					<span>{ __( 'Payment', 'vulocart' ) }</span>
					<select value={ payment } onChange={ ( event ) => setPayment( event.target.value ) }>
						{ PAYMENT_STATUS_OPTIONS.map( ( option ) => (
							<option key={ option.value } value={ option.value }>{ option.label }</option>
						) ) }
					</select>
				</label>

				{ error && <p className="vulocart-qe-error" role="alert">{ error }</p> }
			</div>
		</PopupComponent>
	);
}

interface OrdersListProps {
	/**
	 * `draft`/`refunds`, from the "Draft Orders"/"Refunds" submenus
	 * (classes/Admin/Menu.php's `add_orders_menu()`) - seeds the initial
	 * "saved view" tab rather than the user having to click it after the
	 * page loads.
	 */
	filter: string | null;
}

/**
 * Admin order list - `GET /orders` (modules/Order/Rest.php, manage_options-
 * gated) rendered on the same `NavigatorHeaderComponent` + `TableCard`
 * pattern this plugin's other admin screens use. "View" is a real
 * navigation to `admin.php?page=orders&action=edit&id={id}`
 * (plain `<a href>`, full page load) rather than a popup - matching the
 * real WooCommerce order edit screen, per this plugin's admin-UX brief.
 * Orders.tsx is what routes between this component and OrderEdit.tsx/
 * OrderAdd.tsx based on the URL's `action`/`id`/`filter`.
 *
 * Payment Status and Fulfillment Status are two independent columns/
 * filters (PaymentStatus.php's/FulfillmentStatus.php's own docblocks
 * explain why an old single flat `status` couldn't render this way
 * honestly). The "saved view" tabs (TableCard's `categoryCounts`) use
 * real per-status counts from `GET /orders`'s `X-WP-Count-{status}`
 * response headers, not guessed/hardcoded numbers.
 */
export function OrdersList( { filter }: OrdersListProps ) {
	const [ isLoading, setIsLoading ] = useState( false );
	const [ rowIds, setRowIds ] = useState< number[] >( [] );
	const [ rows, setRows ] = useState< TableRow[] >( [] );
	const [ totalRows, setTotalRows ] = useState( 0 );
	const [ categoryCounts, setCategoryCounts ] = useState< CategoryCount[] >( [] );
	const [ statusOrder, setStatusOrder ] = useState< OrderRow | null >( null );
	const [ deleteIds, setDeleteIds ] = useState< number[] >( [] );
	const lastQuery = useRef< QueryProps >( {} );

	const buildQueryParams = ( query: QueryProps, includePagination: boolean = true ) => {
		const category = query.categoryFilter ?? ( 'draft' === filter ? 'draft' : 'refunds' === filter ? 'refunded' : 'all' );

		const params: Record< string, unknown > = {
			fulfillment_status:
				'all' === category || 'refunded' === category
					? query.filter?.fulfillment_status || ''
					: category,
			payment_status:
				'refunded' === category ? 'refunded' : query.filter?.payment_status || '',
			search: query.searchValue || '',
			date_from: query.filter?.created_at?.startDate
				? new Date( query.filter.created_at.startDate ).toISOString().slice( 0, 10 )
				: '',
			date_to: query.filter?.created_at?.endDate
				? new Date( query.filter.created_at.endDate ).toISOString().slice( 0, 10 )
				: '',
		};

		if ( includePagination ) {
			params.page = query.paged || 1;
			params.per_page = query.per_page || 20;
		}

		return params;
	};

	const doRefreshTableData = ( query: QueryProps ) => {
		lastQuery.current = query;
		setIsLoading( true );
		axios
			.get( getApiLink( vulocartLocalizer, 'orders' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
				params: buildQueryParams( query ),
			} )
			.then( ( response ) => {
				const items: TableRow[] = response.data || [];

				setRowIds( items.map( ( item ) => Number( item.id ) ) );
				setRows( items );
				setTotalRows( Number( response.headers[ 'x-wp-total' ] ) || 0 );

				const total = Number( response.headers[ 'x-wp-total' ] ) || 0;
				const refunded = Number( response.headers[ 'x-wp-count-refunded' ] ) || 0;

				setCategoryCounts( [
					{ value: 'all', label: __( 'All', 'vulocart' ), count: total },
					...FULFILLMENT_STATUS_OPTIONS.map( ( option ) => ( {
						value: option.value,
						label: option.label,
						count: Number( response.headers[ `x-wp-count-${ option.value }` ] ) || 0,
					} ) ),
					{ value: 'refunded', label: __( 'Refunded', 'vulocart' ), count: refunded },
				] );

				setIsLoading( false );
			} )
			.catch( () => {
				setRows( [] );
				setTotalRows( 0 );
				setIsLoading( false );
			} );
	};

	const handleBulkAction = ( action: string, selectedIds: number[] ) => {
		if ( ! action || ! selectedIds.length ) {
			return;
		}

		const [ field, status ] = action.split( ':' );

		if ( 'delete' === field ) {
			setDeleteIds( selectedIds );
			return;
		}

		const endpoint = 'payment' === field ? 'orders/bulk-payment-status' : 'orders/bulk-fulfillment-status';

		axios
			.patch(
				getApiLink( vulocartLocalizer, endpoint ),
				{ ids: selectedIds, status },
				{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
			)
			.then( () => doRefreshTableData( lastQuery.current ) );
	};

	const confirmDelete = () => {
		const ids = deleteIds;
		setDeleteIds( [] );

		const headers = { 'X-WP-Nonce': vulocartLocalizer.nonce };
		const request =
			1 === ids.length
				? axios.delete( getApiLink( vulocartLocalizer, `orders/${ ids[ 0 ] }` ), { headers } )
				: axios.delete( getApiLink( vulocartLocalizer, 'orders/bulk-delete' ), { headers, data: { ids } } );

		request.then( () => doRefreshTableData( lastQuery.current ) );
	};

	/** What a CSV export holds, in plain columns - the table below merges several of these into one cell. */
	const csvHeaders = {
		order_number: { label: __( 'Order', 'vulocart' ) },
		customer_name: { label: __( 'Customer', 'vulocart' ) },
		customer_email: { label: __( 'Email', 'vulocart' ) },
		item_count: { label: __( 'Items', 'vulocart' ) },
		payment_status: { label: __( 'Payment status', 'vulocart' ) },
		fulfillment_status: { label: __( 'Fulfillment status', 'vulocart' ) },
		total: { label: __( 'Total', 'vulocart' ) },
		currency: { label: __( 'Currency', 'vulocart' ) },
		created_at: { label: __( 'Created', 'vulocart' ) },
	};

	const headers = {
		order_number: {
			label: __( 'Order', 'vulocart' ),
			required: true,
			render: ( row?: TableRow ) => {
				if ( ! row ) {
					return null;
				}

				const name = ( row.customer_name as string ) || '';
				const email = ( row.customer_email as string ) || '';
				const who = name || email;

				// Left: who the order is for, as an avatar. Right: order number and date on one line, the customer's
				// name and email under it, then the badges - each says what it is, so "Pending" can't be mistaken.
				return (
					<div className="vulocart-order-cell">
						<span className="vulocart-order-avatar" aria-hidden="true">
							{ ( who.trim().charAt( 0 ) || '#' ).toUpperCase() }
						</span>
						<div className="vulocart-order-main">
							<div className="vulocart-order-head">
								<a className="vulocart-product-cell-title" href={ `admin.php?page=orders&action=edit&id=${ row.id }` }>
									#{ row.order_number as string }
								</a>
								{ row.created_at && <span className="desc">{ formatWpDate( row.created_at as string ) }</span> }
							</div>
							{ who && (
								<div className="vulocart-order-customer">
									<strong>{ who }</strong>
									{ name && email ? <span className="desc">{ email }</span> : null }
								</div>
							) }
							<div className="vulocart-product-cell-tags">
								<span className={ `admin-badge ${ FULFILLMENT_BADGE[ String( row.fulfillment_status ) ] ?? 'badge-info' }` }>
									{ optionLabel( FULFILLMENT_STATUS_OPTIONS, String( row.fulfillment_status ) ) }
								</span>
								<span className={ `admin-badge ${ PAYMENT_BADGE[ String( row.payment_status ) ] ?? 'badge-info' }` }>
									{ __( 'Payment:', 'vulocart' ) } { optionLabel( PAYMENT_STATUS_OPTIONS, String( row.payment_status ) ).toLowerCase() }
								</span>
							</div>
						</div>
					</div>
				);
			},
		},
		total: {
			label: __( 'Total', 'vulocart' ),
			isNumeric: true,
			render: ( row?: TableRow ) =>
				row && (
					<div className="vulocart-product-cell">
						<span className="vulocart-product-cell-title">{ formatMoney( row ) }</span>
						<span className="desc">
							{ sprintf( /* translators: %d: number of items. */ _n( '%d item', '%d items', Number( row.item_count ) || 0, 'vulocart' ), Number( row.item_count ) || 0 ) }
						</span>
					</div>
				),
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
						window.location.href = `admin.php?page=orders&action=edit&id=${ row.id }`;
					},
				},
				{
					label: __( 'Update status', 'vulocart' ),
					icon: 'bulk-action',
					type: 'button' as const,
					color: 'text-blue',
					onClick: ( row: Record< string, unknown > ) => setStatusOrder( row as unknown as OrderRow ),
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

	const downloadSelectedCSV = ( selectedIds: number[] ) => {
		const selectedRows = rows.filter( ( row ) => selectedIds.includes( Number( row.id ) ) );
		downloadCSV( csvHeaders, selectedRows, `vulocart-orders-selected-${ new Date().toISOString().slice( 0, 10 ) }.csv` );
	};

	const downloadAllCSV = ( query: QueryProps ) => {
		axios
			.get( getApiLink( vulocartLocalizer, 'orders' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
				params: { ...buildQueryParams( query, false ), per_page: 1000 },
			} )
			.then( ( response ) => {
				downloadCSV(
					csvHeaders,
					response.data || [],
					`vulocart-orders-${ new Date().toISOString().slice( 0, 10 ) }.csv`
				);
			} );
	};

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent
					headerIcon="cart"
					headerTitle={ __( 'Orders', 'vulocart' ) }
					headerDescription={ __(
						'Every order placed through the storefront checkout - update status as you fulfil, cancel, or refund each one.',
						'vulocart'
					) }
					buttons={ [
						{
							label: __( 'Export', 'vulocart' ),
							icon: 'download',
							color: 'purple',
							onClick: () => downloadAllCSV( lastQuery.current ),
						},
						{
							label: __( 'Add Order', 'vulocart' ),
							icon: 'plus',
							color: '',
							onClick: () => {
								window.location.href = 'admin.php?page=orders&action=add';
							},
						},
					] }
				/>

				<TableCard
					headers={ headers }
					rows={ rows }
					totalRows={ totalRows }
					isLoading={ isLoading }
					onQueryUpdate={ doRefreshTableData }
					ids={ rowIds }
					categoryCounts={ categoryCounts }
					activeCategory={ 'draft' === filter ? 'draft' : 'refunds' === filter ? 'refunded' : 'all' }
					search={ {
						placeholder: __( 'Search order #, email, or name…', 'vulocart' ),
					} }
					filters={ [
						{
							key: 'fulfillment_status',
							label: __( 'Fulfillment status', 'vulocart' ),
							type: 'select',
							size: 4,
							options: FULFILLMENT_STATUS_OPTIONS,
						},
						{
							key: 'payment_status',
							label: __( 'Payment status', 'vulocart' ),
							type: 'select',
							size: 4,
							options: PAYMENT_STATUS_OPTIONS,
						},
						{
							key: 'created_at',
							label: __( 'Created date', 'vulocart' ),
							type: 'date',
							size: 4,
						},
					] }
					bulkActions={ [
						...FULFILLMENT_STATUS_OPTIONS.map( ( option ) => ( {
							label: __( 'Fulfillment:', 'vulocart' ) + ' ' + option.label,
							value: `fulfillment:${ option.value }`,
						} ) ),
						...PAYMENT_STATUS_OPTIONS.map( ( option ) => ( {
							label: __( 'Payment:', 'vulocart' ) + ' ' + option.label,
							value: `payment:${ option.value }`,
						} ) ),
						{ label: __( 'Delete', 'vulocart' ), value: 'delete:confirm' },
					] }
					onBulkActionApply={ ( action: string, selectedIds: number[] ) =>
						handleBulkAction( action, selectedIds )
					}
					onSelectCsvDownloadApply={ downloadSelectedCSV }
				/>
			</ColumnComponent>

			{ statusOrder && (
				<OrderStatusPopup order={ statusOrder } onClose={ () => setStatusOrder( null ) } onSaved={ () => doRefreshTableData( lastQuery.current ) } />
			) }

			<ConfirmPopup
				open={ deleteIds.length > 0 }
				title={ 1 === deleteIds.length ? __( 'Delete order', 'vulocart' ) : __( 'Delete orders', 'vulocart' ) }
				message={ sprintf(
					/* translators: %d: number of orders. */
					_n(
						'Permanently delete this order and its items? This cannot be undone.',
						'Permanently delete %d orders and their items? This cannot be undone.',
						deleteIds.length,
						'vulocart'
					),
					deleteIds.length
				) }
				onConfirm={ confirmDelete }
				onCancel={ () => setDeleteIds( [] ) }
			/>
		</ContainerComponent>
	);
}

export default OrdersList;
