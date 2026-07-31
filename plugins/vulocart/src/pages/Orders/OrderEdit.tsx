/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { CardComponent, FormGroupWrapperComponent, FormGroupComponent } from '@zyra/components';
import { SelectInput, ButtonInput, TextInput } from '@zyra/inputs';
import './orders-page.scss';

/**
 * Order\Domain\FulfillmentStatus::all() (modules/Order/Domain/FulfillmentStatus.php).
 */
const FULFILLMENT_STATUS_OPTIONS = [
	{ label: 'draft', value: 'draft' },
	{ label: 'pending', value: 'pending' },
	{ label: 'processing', value: 'processing' },
	{ label: 'shipped', value: 'shipped' },
	{ label: 'completed', value: 'completed' },
	{ label: 'cancelled', value: 'cancelled' },
];

/**
 * Order\Domain\PaymentStatus::all() (modules/Order/Domain/PaymentStatus.php)
 * — deliberately excludes 'refunded' from this dropdown's own options;
 * refunding goes through the dedicated "Issue refund" action below
 * instead, since a real refund needs an amount, not just a status flip.
 */
const PAYMENT_STATUS_OPTIONS = [
	{ label: 'pending', value: 'pending' },
	{ label: 'paid', value: 'paid' },
	{ label: 'failed', value: 'failed' },
];

interface OrderItem {
	id: number;
	title: string;
	quantity: number;
	unit_price: number;
	currency: string | null;
	subtotal: number;
}

/**
 * Address\Application\AddressService::FIELDS (modules/Address/Application/
 * AddressService.php) — the same open-shape bag snapshotted onto an order,
 * not a reusable address-book entry.
 */
interface AddressBag {
	full_name: string;
	phone: string;
	address_1: string;
	address_2: string;
	city: string;
	state: string;
	postcode: string;
	country: string;
}

interface OrderDetail {
	id: number;
	order_number: string;
	customer_email: string | null;
	customer_name: string | null;
	customer_phone: string | null;
	payment_status: string;
	fulfillment_status: string;
	refunded_amount: number | null;
	currency: string | null;
	subtotal: number;
	shipping_method: string | null;
	shipping_cost: number;
	tax_amount: number;
	payment_method: string | null;
	total: number;
	billing_address: AddressBag | null;
	shipping_address: AddressBag | null;
	item_count: number;
	items: OrderItem[];
	created_at: string;
}

interface OrderEditProps {
	id: number;
}

/**
 * Renders a snapshotted billing/shipping AddressBag as plain read-only
 * text — an order's address is historical (Order::$billing_address's own
 * docblock), never edited from this screen.
 */
function AddressDisplay( { address }: { address: AddressBag } ) {
	return (
		<div className="vulocart-order-address">
			<p>{ address.full_name }</p>
			<p>
				{ address.address_1 }
				{ address.address_2 ? `, ${ address.address_2 }` : '' }
			</p>
			<p>
				{ address.city }, { address.state } { address.postcode }
			</p>
			<p>{ address.country }</p>
			{ address.phone && <p>{ address.phone }</p> }
		</div>
	);
}

/**
 * A dedicated full page for viewing/updating one order — the real
 * WooCommerce order-edit-screen pattern (per this plugin's admin-UX
 * brief), replacing the popup this page used to open from the list.
 * Fetches `GET /orders/{id}` (modules/Order/Rest.php's `get_item()`,
 * admin-only) on mount, since a direct page load/bookmark/back-button
 * visit to `admin.php?page=vulocart-orders&action=edit&id=123` has no
 * in-memory row to seed from.
 *
 * Payment Status and Fulfillment Status are two independent fields now
 * (PaymentStatus.php's/FulfillmentStatus.php's own docblocks) — both save
 * together via one `PATCH /orders/{id}` call. Refunding is a separate
 * action (not just another payment-status option) since a real refund
 * needs an amount recorded (`refunded_amount`), not just a status flip —
 * `POST /orders/{id}/refund`.
 *
 * Saving stays on the page and shows an inline "Order updated." notice,
 * mirroring WooCommerce's own "Update" behavior (it never redirects you
 * away from the order you're looking at).
 *
 * Card-based layout (its own page wrapper rather than the generic
 * `ContainerComponent`/`ColumnComponent` shell — same opt-out
 * OfferingEdit.tsx makes for the same reason: a custom multi-card layout,
 * not a plain form). Billing/shipping address, shipping method+cost, tax,
 * and payment method (Customer/Address/Shipping/Taxes/Payment modules) are
 * real order fields now and rendered when present — still no shipment
 * tracking, order notes, or commission fields, since none of those exist
 * in the Order domain.
 */
export function OrderEdit( { id }: OrderEditProps ) {
	const [ order, setOrder ] = useState< OrderDetail | null >( null );
	const [ paymentStatus, setPaymentStatus ] = useState( 'pending' );
	const [ fulfillmentStatus, setFulfillmentStatus ] = useState( 'pending' );
	const [ notFound, setNotFound ] = useState( false );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ savedNotice, setSavedNotice ] = useState( false );
	const [ refundAmount, setRefundAmount ] = useState( '' );
	const [ isRefunding, setIsRefunding ] = useState( false );
	const [ showRefundForm, setShowRefundForm ] = useState( false );

	const loadOrder = () => {
		axios
			.get< OrderDetail >( getApiLink( vulocartLocalizer, `orders/${ id }` ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			} )
			.then( ( response ) => {
				setOrder( response.data );
				setPaymentStatus( response.data.payment_status );
				setFulfillmentStatus( response.data.fulfillment_status );
				setRefundAmount( String( response.data.total ) );
			} )
			.catch( () => setNotFound( true ) );
	};

	useEffect( loadOrder, [] ); // eslint-disable-line react-hooks/exhaustive-deps -- id is fixed for this page's lifetime (a new id means a new page load, not a re-render).

	const handleSave = () => {
		setIsSaving( true );
		setSavedNotice( false );

		axios
			.patch< OrderDetail >(
				getApiLink( vulocartLocalizer, `orders/${ id }` ),
				{ payment_status: paymentStatus, fulfillment_status: fulfillmentStatus },
				{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
			)
			.then( ( response ) => {
				setOrder( response.data );
				setIsSaving( false );
				setSavedNotice( true );
			} )
			.catch( () => setIsSaving( false ) );
	};

	const handleRefund = () => {
		const amount = parseFloat( refundAmount );

		if ( ! amount || amount <= 0 ) {
			return;
		}

		setIsRefunding( true );

		axios
			.post< OrderDetail >(
				getApiLink( vulocartLocalizer, `orders/${ id }/refund` ),
				{ amount },
				{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
			)
			.then( ( response ) => {
				setOrder( response.data );
				setPaymentStatus( response.data.payment_status );
				setIsRefunding( false );
				setShowRefundForm( false );
				setSavedNotice( true );
			} )
			.catch( () => setIsRefunding( false ) );
	};

	if ( notFound ) {
		return (
			<div className="vulocart-order-edit-page">
				<a className="vulocart-back-link" href="admin.php?page=vulocart-orders">
					{ __( '← Back to Orders', 'vulocart' ) }
				</a>
				<p>{ __( 'No order exists with this id.', 'vulocart' ) }</p>
			</div>
		);
	}

	if ( ! order ) {
		return (
			<div className="vulocart-order-edit-page">
				<p>{ __( 'Loading…', 'vulocart' ) }</p>
			</div>
		);
	}

	return (
		<div className="vulocart-order-edit-page">
			<div className="vulocart-order-edit-topbar">
				<div>
					<a className="vulocart-back-link" href="admin.php?page=vulocart-orders">
						{ __( '← Back to Orders', 'vulocart' ) }
					</a>
					<div className="vulocart-order-edit-heading">
						<h1 className="vulocart-edit-page-title">
							{ __( 'Order', 'vulocart' ) } #{ order.order_number }
						</h1>
						<span className={ `vulocart-status-pill vulocart-status-pill--${ order.fulfillment_status }` }>
							{ order.fulfillment_status }
						</span>
					</div>
					<p className="vulocart-order-edit-placed">
						{ __( 'Placed:', 'vulocart' ) } { order.created_at }
					</p>
				</div>

				<ButtonInput
					buttons={ [
						{
							icon: 'save',
							text: isSaving ? __( 'Saving…', 'vulocart' ) : __( 'Update', 'vulocart' ),
							onClick: handleSave,
							disabled: isSaving,
						},
					] }
				/>
			</div>

			{ savedNotice && (
				<div className="vulocart-saved-notice">{ __( 'Order updated.', 'vulocart' ) }</div>
			) }

			<div className="vulocart-order-edit-grid">
				<div className="vulocart-order-edit-col vulocart-order-edit-col--main">
					<CardComponent
						title={ __( 'Items', 'vulocart' ) }
						desc={ sprintf(
							/* translators: %d: number of items on the order. */
							__( '%d item(s) on this order.', 'vulocart' ),
							order.item_count
						) }
					>
						{ order.items.length === 0 ? (
							<p>{ __( 'No line items.', 'vulocart' ) }</p>
						) : (
							<table className="vulocart-order-items-table">
								<thead>
									<tr>
										<th>{ __( 'Item', 'vulocart' ) }</th>
										<th>{ __( 'Cost', 'vulocart' ) }</th>
										<th>{ __( 'Qty', 'vulocart' ) }</th>
										<th>{ __( 'Total', 'vulocart' ) }</th>
									</tr>
								</thead>
								<tbody>
									{ order.items.map( ( item ) => (
										<tr key={ item.id }>
											<td className="vulocart-order-item-cell">
												<span className="vulocart-order-item-avatar" aria-hidden="true">
													{ item.title.charAt( 0 ).toUpperCase() }
												</span>
												<span>{ item.title }</span>
											</td>
											<td>
												{ item.unit_price } { item.currency }
											</td>
											<td>x{ item.quantity }</td>
											<td>
												{ item.subtotal } { item.currency }
											</td>
										</tr>
									) ) }
								</tbody>
							</table>
						) }

						<div className="vulocart-order-summary-rows">
							<div className="vulocart-order-summary-row">
								<span>{ __( 'Subtotal', 'vulocart' ) }</span>
								<span>
									{ order.subtotal } { order.currency }
								</span>
							</div>
							{ order.shipping_method && (
								<div className="vulocart-order-summary-row">
									<span>
										{ __( 'Shipping', 'vulocart' ) } ({ order.shipping_method })
									</span>
									<span>
										{ order.shipping_cost } { order.currency }
									</span>
								</div>
							) }
							{ order.tax_amount > 0 && (
								<div className="vulocart-order-summary-row">
									<span>{ __( 'Tax', 'vulocart' ) }</span>
									<span>
										{ order.tax_amount } { order.currency }
									</span>
								</div>
							) }
							{ order.refunded_amount !== null && (
								<div className="vulocart-order-summary-row">
									<span>{ __( 'Refunded', 'vulocart' ) }</span>
									<span>
										{ order.refunded_amount } { order.currency }
									</span>
								</div>
							) }
							<div className="vulocart-order-summary-row vulocart-order-summary-row--total">
								<strong>{ __( 'Total', 'vulocart' ) }</strong>
								<strong>
									{ order.total } { order.currency }
								</strong>
							</div>
						</div>
					</CardComponent>
				</div>

				<div className="vulocart-order-edit-col vulocart-order-edit-col--side">
					<CardComponent title={ __( 'Customer details', 'vulocart' ) }>
						<p className="vulocart-order-customer-name">
							{ order.customer_name || __( 'Guest Customer', 'vulocart' ) }
						</p>
						{ order.customer_email ? (
							<p className="vulocart-order-customer-email">{ order.customer_email }</p>
						) : (
							<p className="vulocart-field-hint">{ __( 'No email on file.', 'vulocart' ) }</p>
						) }
						{ order.customer_phone && (
							<p className="vulocart-order-customer-email">{ order.customer_phone }</p>
						) }
					</CardComponent>

					{ order.billing_address && (
						<CardComponent title={ __( 'Billing address', 'vulocart' ) }>
							<AddressDisplay address={ order.billing_address } />
						</CardComponent>
					) }

					{ order.shipping_address && (
						<CardComponent title={ __( 'Shipping address', 'vulocart' ) }>
							<AddressDisplay address={ order.shipping_address } />
						</CardComponent>
					) }

					{ order.payment_method && (
						<CardComponent title={ __( 'Payment', 'vulocart' ) }>
							<p className="vulocart-order-customer-name">{ order.payment_method }</p>
						</CardComponent>
					) }

					<CardComponent title={ __( 'Status', 'vulocart' ) }>
						<FormGroupWrapperComponent>
							<FormGroupComponent label={ __( 'Fulfillment status', 'vulocart' ) } htmlFor="vulocart-order-fulfillment-status">
								<SelectInput
									name="fulfillment_status"
									type="single-select"
									options={ FULFILLMENT_STATUS_OPTIONS }
									value={ fulfillmentStatus }
									onChange={ ( value ) => setFulfillmentStatus( value as string ) }
								/>
							</FormGroupComponent>
							<FormGroupComponent label={ __( 'Payment status', 'vulocart' ) } htmlFor="vulocart-order-payment-status">
								<SelectInput
									name="payment_status"
									type="single-select"
									options={ PAYMENT_STATUS_OPTIONS }
									value={ 'refunded' === paymentStatus ? 'paid' : paymentStatus }
									onChange={ ( value ) => setPaymentStatus( value as string ) }
								/>
							</FormGroupComponent>
						</FormGroupWrapperComponent>
					</CardComponent>

					{ 'refunded' !== order.payment_status && (
						<CardComponent title={ __( 'Refund', 'vulocart' ) }>
							{ ! showRefundForm ? (
								<ButtonInput
									buttons={ [
										{
											icon: 'refund',
											text: __( 'Issue refund', 'vulocart' ),
											onClick: () => setShowRefundForm( true ),
										},
									] }
								/>
							) : (
								<FormGroupWrapperComponent>
									<FormGroupComponent label={ __( 'Refund amount', 'vulocart' ) } htmlFor="vulocart-order-refund-amount">
										<TextInput
											name="refund_amount"
											type="number"
											value={ refundAmount }
											onChange={ ( value ) => setRefundAmount( value as string ) }
										/>
									</FormGroupComponent>
									<ButtonInput
										buttons={ [
											{
												icon: 'refund',
												text: isRefunding ? __( 'Refunding…', 'vulocart' ) : __( 'Confirm refund', 'vulocart' ),
												onClick: handleRefund,
												disabled: isRefunding,
											},
										] }
									/>
								</FormGroupWrapperComponent>
							) }
						</CardComponent>
					) }

					{ applyFilters( 'vulocart_order_edit_sections', null, { id: order.id } ) }
				</div>
			</div>
		</div>
	);
}

export default OrderEdit;
