/* global vulocartLocalizer */
import { billingText } from '../../lib/priceText';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ReactNode } from 'react';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { CardComponent, FormGroupWrapperComponent, FormGroupComponent } from '@zyra/components';
import { SelectInput, ButtonInput, TextInput } from '@zyra/inputs';
import { showErrorToast, errorMessageOf } from '../../lib/rest-errors';
import './orders-page.scss';
import '../Products/products-page.scss';
import { formatWpDate, formatWpDateTime } from '../../services/formatWpDate';

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
 * - deliberately excludes 'refunded' from this dropdown's own options;
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
	price?: { id: string; label: string; type: string; interval: string; interval_count: number; payments: number | null } | null;
}

/**
 * Address\Application\AddressService::FIELDS (modules/Address/Application/
 * AddressService.php) - the same open-shape bag snapshotted onto an order,
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
	gateway_transaction_id: string | null;
	total: number;
	billing_address: AddressBag | null;
	shipping_address: AddressBag | null;
	item_count: number;
	items: OrderItem[];
	discount_total: number;
	tags: string[];
	payment_requests: string[];
	customer_user_id: number | null;
	customer: { id: number; is_registered: boolean; total_orders: number; total_spent: number; last_order_at: string | null; since: string } | null;
	created_at: string;
}

interface TimelineEvent {
	type: string;
	title: string;
	detail?: string;
	at: string;
	amount?: number;
	currency?: string | null;
}

interface PaymentTransaction {
	id: number;
	gateway: string;
	type: string;
	gateway_transaction_id: string | null;
	status: string;
	amount: number | string;
	currency: string | null;
	created_at: string;
}

interface OrderEditProps {
	id: number;
}

/**
 * Renders a snapshotted billing/shipping AddressBag as plain read-only
 * text - an order's address is historical (Order::$billing_address's own
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

/** Order status => the product page's status-tag colour (is-published green, is-draft amber) or ours below. */
const STATUS_TAG_CLASS: Record< string, string > = {
	paid: 'is-published',
	completed: 'is-published',
	pending: 'is-draft',
	draft: 'is-draft',
	processing: 'is-info',
	shipped: 'is-info',
	failed: 'is-danger',
	cancelled: 'is-danger',
	refunded: 'is-archived',
};

const money = ( value: number | string | null | undefined ) => Number( value || 0 ).toFixed( 2 );

const settingsUrl = ( subtab: string ) => `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart#&tab=settings&subtab=${ subtab }`;

/** An empty field: a link that goes where it can be filled in, instead of a bare dash. */
function MissingLink( { href, children }: { href?: string; children: string } ) {
	if ( ! href ) {
		return <span className="vulocart-order-missing is-plain">—</span>;
	}

	return (
		<a className="vulocart-order-missing" href={ href }>
			<i className="adminfont-plus" aria-hidden="true" />
			{ children }
		</a>
	);
}

/**
 * A missing value you can fill in on the spot: a "+ Add" link that turns into one input (or a select) with Save and
 * Cancel. `onSave` returns the request so the field can stay open, with the error shown, if it fails.
 */
function InlineAdd( { label, placeholder, type = 'text', options, onSave }: { label: string; placeholder?: string; type?: string; options?: { label: string; value: string }[]; onSave: ( value: string ) => Promise< unknown > } ) {
	const [ open, setOpen ] = useState( false );
	const [ value, setValue ] = useState( '' );
	const [ saving, setSaving ] = useState( false );

	const save = () => {
		if ( ! value.trim() ) {
			return;
		}

		setSaving( true );
		onSave( value.trim() )
			.then( () => setOpen( false ) )
			.catch( () => undefined )
			.finally( () => setSaving( false ) );
	};

	if ( ! open ) {
		return (
			<button type="button" className="vulocart-order-missing" onClick={ () => setOpen( true ) }>
				<i className="adminfont-plus" aria-hidden="true" />
				{ label }
			</button>
		);
	}

	return (
		<span className="vulocart-order-inline">
			{ options ? (
				<select autoFocus value={ value } onChange={ ( e ) => setValue( e.target.value ) }>
					<option value="">{ __( 'Choose…', 'vulocart' ) }</option>
					{ options.map( ( option ) => (
						<option key={ option.value } value={ option.value }>
							{ option.label }
						</option>
					) ) }
				</select>
			) : (
				<input
					autoFocus
					type={ type }
					value={ value }
					placeholder={ placeholder }
					onChange={ ( e ) => setValue( e.target.value ) }
					onKeyDown={ ( e ) => {
						if ( 'Enter' === e.key ) {
							e.preventDefault();
							save();
						} else if ( 'Escape' === e.key ) {
							setOpen( false );
						}
					} }
				/>
			) }
			<button type="button" className="vulocart-order-inline-save" disabled={ saving || ! value.trim() } onClick={ save }>
				{ saving ? '…' : __( 'Save', 'vulocart' ) }
			</button>
			<button type="button" className="vulocart-order-inline-cancel" onClick={ () => setOpen( false ) }>
				{ __( 'Cancel', 'vulocart' ) }
			</button>
		</span>
	);
}

const ADDRESS_FIELD_LABELS: [ keyof AddressBag, string ][] = [
	[ 'full_name', __( 'Full name', 'vulocart' ) ],
	[ 'phone', __( 'Phone', 'vulocart' ) ],
	[ 'address_1', __( 'Address line 1', 'vulocart' ) ],
	[ 'address_2', __( 'Address line 2', 'vulocart' ) ],
	[ 'city', __( 'City', 'vulocart' ) ],
	[ 'state', __( 'State', 'vulocart' ) ],
	[ 'postcode', __( 'Postcode', 'vulocart' ) ],
	[ 'country', __( 'Country', 'vulocart' ) ],
];

/** The same idea for a whole address: a link that opens a compact form in place. `prefill` offers a one-click copy. */
function InlineAddress( { label, prefill, prefillLabel, onSave }: { label: string; prefill?: AddressBag | null; prefillLabel?: string; onSave: ( address: AddressBag ) => Promise< unknown > } ) {
	const empty: AddressBag = { full_name: '', phone: '', address_1: '', address_2: '', city: '', state: '', postcode: '', country: '' };
	const [ open, setOpen ] = useState( false );
	const [ address, setAddress ] = useState< AddressBag >( empty );
	const [ saving, setSaving ] = useState( false );

	const save = () => {
		if ( ! address.address_1.trim() && ! address.full_name.trim() ) {
			return;
		}

		setSaving( true );
		onSave( address )
			.then( () => {
				setOpen( false );
				setAddress( empty );
			} )
			.catch( () => undefined )
			.finally( () => setSaving( false ) );
	};

	if ( ! open ) {
		return (
			<button type="button" className="vulocart-order-missing" onClick={ () => setOpen( true ) }>
				<i className="adminfont-plus" aria-hidden="true" />
				{ label }
			</button>
		);
	}

	return (
		<div className="vulocart-order-inline-address">
			{ prefill && (
				<button type="button" className="vulocart-order-missing" onClick={ () => setAddress( { ...prefill } ) }>
					{ prefillLabel }
				</button>
			) }
			<div className="vulocart-order-inline-grid">
				{ ADDRESS_FIELD_LABELS.map( ( [ key, text ] ) => (
					<label key={ key }>
						{ text }
						<input type="text" value={ address[ key ] } onChange={ ( e ) => setAddress( { ...address, [ key ]: e.target.value } ) } />
					</label>
				) ) }
			</div>
			<span className="vulocart-order-inline">
				<button type="button" className="vulocart-order-inline-save" disabled={ saving } onClick={ save }>
					{ saving ? '…' : __( 'Save address', 'vulocart' ) }
				</button>
				<button type="button" className="vulocart-order-inline-cancel" onClick={ () => setOpen( false ) }>
					{ __( 'Cancel', 'vulocart' ) }
				</button>
			</span>
		</div>
	);
}

const labelOf = ( status: string ) => status.charAt( 0 ).toUpperCase() + status.slice( 1 );

/**
 * One status shown in the top bar with a pencil that opens a menu of the other choices - the same
 * control the product page uses for its publish status.
 */
function StatusPicker( { caption, value, options, onSelect, locked }: { caption: string; value: string; options: { label: string; value: string }[]; onSelect: ( value: string ) => void; locked?: boolean } ) {
	const [ open, setOpen ] = useState( false );
	const ref = useRef< HTMLDivElement >( null );

	useEffect( () => {
		if ( ! open ) {
			return undefined;
		}

		const onPointerDown = ( event: MouseEvent ) => {
			if ( ref.current && ! ref.current.contains( event.target as Node ) ) {
				setOpen( false );
			}
		};
		const onKeyDown = ( event: KeyboardEvent ) => {
			if ( 'Escape' === event.key ) {
				setOpen( false );
			}
		};

		document.addEventListener( 'mousedown', onPointerDown );
		document.addEventListener( 'keydown', onKeyDown );

		return () => {
			document.removeEventListener( 'mousedown', onPointerDown );
			document.removeEventListener( 'keydown', onKeyDown );
		};
	}, [ open ] );

	return (
		<div className="vulocart-topbar-status" ref={ ref }>
			<div className="vulocart-status-row">
				<span className={ `vulocart-status-tag ${ STATUS_TAG_CLASS[ value ] ?? '' }` }>
					<i aria-hidden="true" />
					{ labelOf( value ) }
				</span>
				{ ! locked && (
					<button
						type="button"
						className="vulocart-status-edit"
						aria-haspopup="menu"
						aria-expanded={ open }
						aria-label={ caption }
						title={ caption }
						onClick={ () => setOpen( ! open ) }
					>
						<i className="adminfont-edit" aria-hidden="true" />
					</button>
				) }
			</div>
			<span className="vulocart-topbar-published">{ caption }</span>
			{ open && (
				<ul className="vulocart-status-menu" role="menu">
					{ options.map( ( option ) => (
						<li key={ option.value }>
							<button
								type="button"
								role="menuitemradio"
								aria-checked={ option.value === value }
								className={ option.value === value ? 'is-active' : '' }
								onClick={ () => {
									onSelect( option.value );
									setOpen( false );
								} }
							>
								<span className={ `vulocart-status-tag ${ STATUS_TAG_CLASS[ option.value ] ?? '' }` }>
									<i aria-hidden="true" />
									{ labelOf( option.value ) }
								</span>
								{ option.value === value && <i className="adminfont-check" aria-hidden="true" /> }
							</button>
						</li>
					) ) }
				</ul>
			) }
		</div>
	);
}

/**
 * A dedicated full page for viewing/updating one order - the real
 * WooCommerce order-edit-screen pattern (per this plugin's admin-UX
 * brief), replacing the popup this page used to open from the list.
 * Fetches `GET /orders/{id}` (modules/Order/Rest.php's `get_item()`,
 * admin-only) on mount, since a direct page load/bookmark/back-button
 * visit to `admin.php?page=orders&action=edit&id=123` has no
 * in-memory row to seed from.
 *
 * Payment Status and Fulfillment Status are two independent fields now
 * (PaymentStatus.php's/FulfillmentStatus.php's own docblocks) - both save
 * together via one `PATCH /orders/{id}` call. Refunding is a separate
 * action (not just another payment-status option) since a real refund
 * needs an amount recorded (`refunded_amount`), not just a status flip -
 * `POST /orders/{id}/refund`.
 *
 * Saving stays on the page and shows an inline "Order updated." notice,
 * mirroring WooCommerce's own "Update" behavior (it never redirects you
 * away from the order you're looking at).
 *
 * Card-based layout (its own page wrapper rather than the generic
 * `ContainerComponent`/`ColumnComponent` shell - same opt-out
 * ProductEdit.tsx makes for the same reason: a custom multi-card layout,
 * not a plain form). Billing/shipping address, shipping method+cost, tax,
 * and payment method (Customer/Address/Shipping/Taxes/Payment modules) are
 * real order fields now and rendered when present - still no shipment
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
	const [ transactions, setTransactions ] = useState< PaymentTransaction[] >( [] );
	const [ timeline, setTimeline ] = useState< TimelineEvent[] >( [] );
	const [ tagDraft, setTagDraft ] = useState( '' );
	const [ activeModules, setActiveModules ] = useState< string[] | null >( null );
	const [ activating, setActivating ] = useState( false );
	const [ methodLabels, setMethodLabels ] = useState< Record< string, string > >( {} );

	// What the statuses were when last loaded or saved - anything different is an unsaved change.
	const savedStatuses = useRef( '' );
	const isDirty = null !== order && JSON.stringify( [ paymentStatus, fulfillmentStatus ] ) !== savedStatuses.current;

	useEffect( () => {
		if ( ! isDirty ) {
			return undefined;
		}

		const warn = ( event: BeforeUnloadEvent ) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener( 'beforeunload', warn );

		return () => window.removeEventListener( 'beforeunload', warn );
	}, [ isDirty ] );

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
				savedStatuses.current = JSON.stringify( [ response.data.payment_status, response.data.fulfillment_status ] );
			} )
			.catch( () => setNotFound( true ) );
	};

	const loadTransactions = () => {
		const headers = { 'X-WP-Nonce': vulocartLocalizer.nonce };

		axios
			.get< TimelineEvent[] >( getApiLink( vulocartLocalizer, `orders/${ id }/timeline` ), { headers } )
			.then( ( response ) => setTimeline( Array.isArray( response.data ) ? response.data : [] ) )
			.catch( () => setTimeline( [] ) );

		// The Payment module may be inactive - then there is simply no history to show.
		axios
			.get< PaymentTransaction[] >( getApiLink( vulocartLocalizer, `orders/${ id }/payment-transactions` ), { headers } )
			.then( ( response ) => setTransactions( Array.isArray( response.data ) ? response.data : [] ) )
			.catch( () => setTransactions( [] ) );
		axios
			.get< { id: string; label: string }[] >( getApiLink( vulocartLocalizer, 'payment/methods' ), { headers } )
			.then( ( response ) => setMethodLabels( Object.fromEntries( ( response.data || [] ).map( ( method ) => [ method.id, method.label ] ) ) ) )
			.catch( () => undefined );
	};

	useEffect( () => {
		axios
			.get< string[] >( getApiLink( vulocartLocalizer, 'modules' ), { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( ( response ) => setActiveModules( Array.isArray( response.data ) ? response.data : [] ) )
			.catch( () => setActiveModules( [] ) );
	}, [] );

	useEffect( () => {
		loadOrder();
		loadTransactions();
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps -- id is fixed for this page's lifetime (a new id means a new page load, not a re-render).

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
				savedStatuses.current = JSON.stringify( [ response.data.payment_status, response.data.fulfillment_status ] );
				setIsSaving( false );
				loadTransactions();
				setSavedNotice( true );
				window.setTimeout( () => setSavedNotice( false ), 3000 );
			} )
			.catch( ( error ) => {
				setIsSaving( false );
				showErrorToast( errorMessageOf( error ) );
			} );
	};

	/** Saves one or more order details in place; rejects (after a toast) so an inline field can stay open. */
	const saveDetails = ( payload: Record< string, unknown > ) =>
		axios
			.patch< OrderDetail >( getApiLink( vulocartLocalizer, `orders/${ id }` ), payload, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( ( response ) => setOrder( response.data ) )
			.catch( ( error ) => {
				showErrorToast( errorMessageOf( error ) );
				throw error;
			} );

	const [ isRequesting, setIsRequesting ] = useState( false );

	const askToPay = () => {
		setIsRequesting( true );

		axios
			.post< OrderDetail >( getApiLink( vulocartLocalizer, `orders/${ id }/request-payment` ), {}, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( ( response ) => {
				setOrder( response.data );
				loadTransactions();
				setSavedNotice( true );
				window.setTimeout( () => setSavedNotice( false ), 3000 );
			} )
			.catch( ( error ) => showErrorToast( errorMessageOf( error ) ) )
			.finally( () => setIsRequesting( false ) );
	};

	const activateDocuments = () => {
		setActivating( true );

		axios
			.post( getApiLink( vulocartLocalizer, 'modules' ), { id: 'pdf-invoices', action: 'activate' }, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( () => window.location.reload() )
			.catch( ( error ) => {
				showErrorToast( errorMessageOf( error ) );
				setActivating( false );
			} );
	};

	const saveTags = ( tags: string[] ) => {
		axios
			.patch< OrderDetail >(
				getApiLink( vulocartLocalizer, `orders/${ id }` ),
				{ tags },
				{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
			)
			.then( ( response ) => setOrder( ( current ) => ( current ? { ...current, tags: response.data.tags } : current ) ) )
			.catch( ( error ) => showErrorToast( errorMessageOf( error ) ) );
	};

	const handleRefund = () => {
		const amount = parseFloat( refundAmount );

		if ( ! amount || amount <= 0 ) {
			showErrorToast( __( 'Enter a refund amount greater than zero.', 'vulocart' ) );

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
				savedStatuses.current = JSON.stringify( [ response.data.payment_status, fulfillmentStatus ] );
				setIsRefunding( false );
				setShowRefundForm( false );
				loadTransactions();
				setSavedNotice( true );
				window.setTimeout( () => setSavedNotice( false ), 3000 );
			} )
			.catch( ( error ) => {
				setIsRefunding( false );
				showErrorToast( errorMessageOf( error ) );
			} );
	};

	if ( notFound ) {
		return (
			<div className="vulocart-product-edit-page vulocart-order-edit-page">
				<a className="vulocart-back-link" href="admin.php?page=orders">
					{ __( '← Back to Orders', 'vulocart' ) }
				</a>
				<p>{ __( 'No order exists with this id.', 'vulocart' ) }</p>
			</div>
		);
	}

	if ( ! order ) {
		return (
			<div className="vulocart-product-edit-page vulocart-order-edit-page">
				<p>{ __( 'Loading…', 'vulocart' ) }</p>
			</div>
		);
	}

	const profileUrl = order.customer?.id ? `admin.php?page=customers&action=view&id=${ order.customer.id }` : undefined;

	const paidAmount = 'paid' === order.payment_status || 'refunded' === order.payment_status ? Number( order.total ) : 0;
	const balanceDue = Math.max( 0, Number( order.total ) - paidAmount );
	const sameAddress =
		!! order.shipping_address &&
		!! order.billing_address &&
		JSON.stringify( order.shipping_address ) === JSON.stringify( order.billing_address );

	return (
		<div className="vulocart-product-edit-page vulocart-order-edit-page">
			<div className="vulocart-product-edit-topbar">
				<div>
					<nav className="vulocart-breadcrumbs" aria-label={ __( 'Breadcrumb', 'vulocart' ) }>
						<a href="admin.php?page=orders">{ __( 'Orders', 'vulocart' ) }</a>
						<i className="adminfont-pagination-next-arrow" aria-hidden="true" />
						<span aria-current="page">{ __( 'Edit Order', 'vulocart' ) }</span>
					</nav>
					<h1 className="vulocart-edit-page-title">
						{ __( 'Order', 'vulocart' ) } #{ order.order_number }
					</h1>
					<div className="vulocart-title-meta">
						<span className="vulocart-pill is-kind">
							<small>{ __( 'Placed', 'vulocart' ) }</small>
							{ formatWpDateTime( order.created_at ) }
						</span>
					</div>
				</div>

				<div className="vulocart-topbar-actions">
					<StatusPicker
						caption={ __( 'Fulfillment', 'vulocart' ) }
						value={ fulfillmentStatus }
						options={ FULFILLMENT_STATUS_OPTIONS }
						onSelect={ setFulfillmentStatus }
					/>
					<StatusPicker
						caption={ __( 'Payment', 'vulocart' ) }
						value={ paymentStatus }
						options={ PAYMENT_STATUS_OPTIONS }
						onSelect={ setPaymentStatus }
						locked={ 'refunded' === paymentStatus }
					/>
					{ isDirty && (
						<span className="vulocart-unsaved" role="status">
							<i aria-hidden="true" />
							{ __( 'Unsaved changes', 'vulocart' ) }
						</span>
					) }
					<ButtonInput
						buttons={ [
							{
								icon: 'save',
								text: isSaving ? __( 'Saving…', 'vulocart' ) : __( 'Update', 'vulocart' ),
								onClick: handleSave,
								disabled: isSaving || ! isDirty,
							},
						] }
					/>
				</div>
			</div>

			{ [ 'shipped', 'completed' ].includes( fulfillmentStatus ) && [ 'pending', 'failed' ].includes( paymentStatus ) && (
				<div className="vulocart-order-warning" role="status">
					<i className="adminfont-warning" aria-hidden="true" />
					<span>
						{ sprintf(
							/* translators: 1: fulfillment status, 2: payment status. */
							__( 'This order is %1$s but payment is still %2$s.', 'vulocart' ),
							fulfillmentStatus,
							paymentStatus
						) }
					</span>
					<a href="#payment" onClick={ ( e ) => { e.preventDefault(); document.getElementById( 'vulocart-order-payment' )?.scrollIntoView( { behavior: 'smooth', block: 'center' } ); } }>
						{ __( 'Go to payment', 'vulocart' ) }
					</a>
				</div>
			) }

			{ savedNotice && (
				<div className="vulocart-saved-notice">{ __( 'Order updated.', 'vulocart' ) }</div>
			) }

			<div className="vulocart-product-edit-grid">
				<div className="vulocart-product-edit-col vulocart-product-edit-col--center">
					<CardComponent
						titleIcon="catalog"
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
												<span>
													{ item.title }
													{ item.price && ( item.price.label || billingText( item.price ) ) && (
														<small style={ { display: 'block', color: '#6b7280', fontSize: '12px' } }>
															{ [ item.price.label, billingText( item.price ) ].filter( Boolean ).join( ' · ' ) }
														</small>
													) }
												</span>
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
							{ order.discount_total > 0 && (
								<div className="vulocart-order-summary-row">
									<span>{ __( 'Discount', 'vulocart' ) }</span>
									<span>
										-{ order.discount_total } { order.currency }
									</span>
								</div>
							) }
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
							<div className="vulocart-order-summary-row vulocart-order-summary-row--total">
								<strong>{ __( 'Total', 'vulocart' ) }</strong>
								<strong>
									{ order.total } { order.currency }
								</strong>
							</div>
							<div className="vulocart-order-summary-row">
								<span>{ __( 'Paid', 'vulocart' ) }</span>
								<span>
									{ money( paidAmount ) } { order.currency }
								</span>
							</div>
							{ order.refunded_amount !== null && (
								<div className="vulocart-order-summary-row">
									<span>{ __( 'Refunded', 'vulocart' ) }</span>
									<span>
										-{ order.refunded_amount } { order.currency }
									</span>
								</div>
							) }
							<div className="vulocart-order-summary-row vulocart-order-summary-row--balance">
								<strong>{ __( 'Balance due', 'vulocart' ) }</strong>
								<strong>
									{ money( balanceDue ) } { order.currency }
								</strong>
							</div>
						</div>
						{ 'paid' === order.payment_status && (
							<div className="vulocart-order-refund">
								<div className="vulocart-order-refund-head">
									<strong>{ __( 'Refund', 'vulocart' ) }</strong>
									<span>{ __( 'Return money for this order.', 'vulocart' ) }</span>
								</div>
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
							</div>
						) }
					</CardComponent>

					<CardComponent
						titleIcon="shipping"
						title={ __( 'Fulfillment', 'vulocart' ) }
						desc={ __( 'Where this order is going and how.', 'vulocart' ) }
					>
						<div className="vulocart-order-facts">
							<div>
								<small>{ __( 'Status', 'vulocart' ) }</small>
								<span className={ `vulocart-status-tag ${ STATUS_TAG_CLASS[ order.fulfillment_status ] ?? '' }` }>
									<i aria-hidden="true" />
									{ labelOf( order.fulfillment_status ) }
								</span>
							</div>
							<div>
								<small>{ __( 'Method', 'vulocart' ) }</small>
								{ order.shipping_method ? <span>{ order.shipping_method }</span> : <InlineAdd label={ __( 'Add shipping method', 'vulocart' ) } placeholder={ __( 'e.g. Standard delivery', 'vulocart' ) } onSave={ ( value ) => saveDetails( { shipping_method: value } ) } /> }
							</div>
							<div>
								<small>{ __( 'Shipping cost', 'vulocart' ) }</small>
								<span>
									{ money( order.shipping_cost ) } { order.currency }
								</span>
							</div>
							<div>
								<small>{ __( 'Ship to', 'vulocart' ) }</small>
								{ order.shipping_address ? (
									<span>{ [ order.shipping_address.city, order.shipping_address.country ].filter( Boolean ).join( ', ' ) }</span>
								) : (
									<InlineAddress label={ __( 'Add address', 'vulocart' ) } prefill={ order.billing_address } prefillLabel={ __( 'Copy billing address', 'vulocart' ) } onSave={ ( address ) => saveDetails( { shipping_address: address } ) } />
								) }
							</div>
						</div>
					</CardComponent>

					{
						/**
						 * `vulocart_order_edit_main_sections` - same compose-many filter as
						 * `vulocart_order_edit_sections`, but rendered in the wide left column
						 * for panels that need the room (shipments, tracking).
						 */
						applyFilters( 'vulocart_order_edit_main_sections', null, { id: order.id } ) as ReactNode
					}

					<CardComponent titleIcon="clock" title={ __( 'Timeline', 'vulocart' ) } desc={ __( 'Everything that has happened to this order.', 'vulocart' ) }>
						{ 0 === timeline.length ? (
							<p className="vulocart-field-hint">{ __( 'No events yet.', 'vulocart' ) }</p>
						) : (
							<ol className="vulocart-order-timeline">
								{ [ ...timeline ].reverse().map( ( event, index ) => (
									<li key={ `${ event.type }-${ event.at }-${ index }` } className={ `is-${ event.type }` }>
										<i aria-hidden="true" />
										<div>
											<strong>
												{ event.title }
												{ undefined !== event.amount && Number( event.amount ) > 0 && (
													<em>
														{ money( event.amount ) } { event.currency }
													</em>
												) }
											</strong>
											{ event.detail && <span>{ event.detail }</span> }
										</div>
										<time>{ formatWpDateTime( event.at ) }</time>
									</li>
								) ) }
							</ol>
						) }
					</CardComponent>
				</div>

				<div className="vulocart-product-edit-col vulocart-product-edit-col--right">
					<CardComponent titleIcon="user" title={ __( 'Customer', 'vulocart' ) }>
						<div className="vulocart-order-customer-head">
							<span className="vulocart-order-avatar" aria-hidden="true">
								{ ( order.customer_name || order.customer_email || '?' ).charAt( 0 ).toUpperCase() }
							</span>
							<div>
								<p className="vulocart-order-customer-name">
									{ order.customer?.id ? (
										<a href={ `admin.php?page=customers&action=view&id=${ order.customer.id }` }>{ order.customer_name || order.customer_email }</a>
									) : (
										order.customer_name || __( 'Guest Customer', 'vulocart' )
									) }
								</p>
								<span className="vulocart-pill is-kind">
									{ order.customer_user_id || order.customer?.is_registered ? __( 'Registered', 'vulocart' ) : __( 'Guest', 'vulocart' ) }
								</span>
							</div>
						</div>
						<div className="vulocart-order-facts is-stacked">
							<div>
								<small>{ __( 'Email', 'vulocart' ) }</small>
								{ order.customer_email ? <span>{ order.customer_email }</span> : <InlineAdd label={ __( 'Add email', 'vulocart' ) } type="email" onSave={ ( value ) => saveDetails( { customer_email: value } ) } /> }
							</div>
							<div>
								<small>{ __( 'Phone', 'vulocart' ) }</small>
								{ order.customer_phone ? <span>{ order.customer_phone }</span> : <InlineAdd label={ __( 'Add phone', 'vulocart' ) } onSave={ ( value ) => saveDetails( { customer_phone: value } ) } /> }
							</div>
						</div>
						{ order.customer && (
							<div className="vulocart-order-customer-stats">
								<div>
									<strong>{ order.customer.total_orders }</strong>
									<small>{ __( 'Orders', 'vulocart' ) }</small>
								</div>
								<div>
									<strong>{ money( order.customer.total_spent ) }</strong>
									<small>{ __( 'Lifetime spend', 'vulocart' ) }</small>
								</div>
								<div>
									<strong>{ formatWpDate( order.customer.since ) }</strong>
									<small>{ __( 'Customer since', 'vulocart' ) }</small>
								</div>
							</div>
						) }
						<div className="vulocart-order-addresses">
							<div className="vulocart-order-address-block">
								<small>{ __( 'Shipping', 'vulocart' ) }</small>
								{ order.shipping_address ? (
									<AddressDisplay address={ order.shipping_address } />
								) : (
									<InlineAddress label={ __( 'Add shipping address', 'vulocart' ) } prefill={ order.billing_address } prefillLabel={ __( 'Copy billing address', 'vulocart' ) } onSave={ ( address ) => saveDetails( { shipping_address: address } ) } />
								) }
							</div>
							<div className="vulocart-order-address-block">
								<small>{ __( 'Billing', 'vulocart' ) }</small>
								{ order.billing_address ? (
									sameAddress ? (
										<p className="vulocart-field-hint">{ __( 'Same as shipping.', 'vulocart' ) }</p>
									) : (
										<AddressDisplay address={ order.billing_address } />
									)
								) : (
									<InlineAddress label={ __( 'Add billing address', 'vulocart' ) } prefill={ order.shipping_address } prefillLabel={ __( 'Copy shipping address', 'vulocart' ) } onSave={ ( address ) => saveDetails( { billing_address: address } ) } />
								) }
							</div>
						</div>
					</CardComponent>

					<div id="vulocart-order-payment">
					<CardComponent titleIcon="cart" title={ __( 'Payment', 'vulocart' ) } desc={ __( 'How and when this order was paid.', 'vulocart' ) }>
						<div className="vulocart-order-summary-rows">
							<div className="vulocart-order-summary-row">
								<span>{ __( 'Method', 'vulocart' ) }</span>
								<span>
									{ order.payment_method ? (
										methodLabels[ order.payment_method ] || order.payment_method
									) : (
										Object.keys( methodLabels ).length > 0 ? (
											<InlineAdd
												label={ __( 'Choose method', 'vulocart' ) }
												options={ Object.entries( methodLabels ).map( ( [ value, text ] ) => ( { value, label: text } ) ) }
												onSave={ ( value ) => saveDetails( { payment_method: value } ) }
											/>
										) : (
											<MissingLink href={ settingsUrl( 'payments' ) }>{ __( 'Set up payments', 'vulocart' ) }</MissingLink>
										)
									) }
								</span>
							</div>
							<div className="vulocart-order-summary-row">
								<span>{ __( 'Status', 'vulocart' ) }</span>
								<span className={ `vulocart-status-pill vulocart-status-pill--${ order.payment_status }` }>{ order.payment_status }</span>
							</div>
							<div className="vulocart-order-summary-row">
								<span>{ __( 'Amount', 'vulocart' ) }</span>
								<span>
									{ order.total } { order.currency }
								</span>
							</div>
							{ order.refunded_amount !== null && (
								<div className="vulocart-order-summary-row">
									<span>{ __( 'Refunded', 'vulocart' ) }</span>
									<span>
										{ order.refunded_amount } { order.currency }
									</span>
								</div>
							) }
							{ order.gateway_transaction_id && (
								<div className="vulocart-order-summary-row">
									<span>{ __( 'Transaction ID', 'vulocart' ) }</span>
									<code>{ order.gateway_transaction_id }</code>
								</div>
							) }
						</div>

						{ 0 === transactions.length && ( 'paid' === order.payment_status || 'refunded' === order.payment_status ) && (
							<p className="vulocart-field-hint">{ __( 'Marked as paid manually - no gateway events were recorded.', 'vulocart' ) }</p>
						) }

						{ 0 === transactions.length && 'paid' !== order.payment_status && 'refunded' !== order.payment_status && (
							<div className="vulocart-order-ask">
								<strong>{ __( 'Waiting for payment', 'vulocart' ) }</strong>
								<p>
									{ order.customer_email
										? sprintf( /* translators: %s: customer email. */ __( 'Email %s the amount due and how to pay.', 'vulocart' ), order.customer_email )
										: __( 'Add the customer\'s email so you can send them a payment request.', 'vulocart' ) }
								</p>
								{ order.customer_email ? (
									<button type="button" className="vulocart-order-inline-save" disabled={ isRequesting } onClick={ askToPay }>
										{ isRequesting ? __( 'Sending…', 'vulocart' ) : order.payment_requests.length > 0 ? __( 'Ask again', 'vulocart' ) : __( 'Ask your customer to pay', 'vulocart' ) }
									</button>
								) : (
									<InlineAdd label={ __( 'Add email', 'vulocart' ) } type="email" onSave={ ( value ) => saveDetails( { customer_email: value } ) } />
								) }
								{ order.payment_requests.length > 0 && (
									<small>
										{ sprintf( /* translators: %s: date and time. */ __( 'Last asked %s', 'vulocart' ), formatWpDateTime( order.payment_requests[ order.payment_requests.length - 1 ] ) ) }
									</small>
								) }
							</div>
						) }

						{ transactions.length > 0 && (
							<>
								<h4 className="vulocart-subsection-title">{ __( 'Transaction history', 'vulocart' ) }</h4>
								<table className="vulocart-order-items-table">
									<thead>
										<tr>
											<th>{ __( 'Event', 'vulocart' ) }</th>
											<th>{ __( 'Amount', 'vulocart' ) }</th>
											<th>{ __( 'Status', 'vulocart' ) }</th>
											<th>{ __( 'Date', 'vulocart' ) }</th>
										</tr>
									</thead>
									<tbody>
										{ transactions.map( ( transaction ) => (
											<tr key={ transaction.id }>
												<td style={ { textTransform: 'capitalize' } }>
													{ transaction.type }
													<small style={ { display: 'block', color: '#6b7280' } }>
														{ methodLabels[ transaction.gateway ] || transaction.gateway }
													</small>
												</td>
												<td>
													{ transaction.amount } { transaction.currency }
												</td>
												<td>
													<span className={ `vulocart-status-pill vulocart-status-pill--${ transaction.status }` }>{ transaction.status }</span>
												</td>
												<td>{ formatWpDateTime( transaction.created_at ) }</td>
											</tr>
										) ) }
									</tbody>
								</table>
							</>
						) }
					</CardComponent>
					</div>

					<CardComponent titleIcon="tag" title={ __( 'Tags', 'vulocart' ) }>
						{ 0 === order.tags.length && <p className="vulocart-field-hint">{ __( 'No tags yet - use them to group orders, e.g. "wholesale" or "gift".', 'vulocart' ) }</p> }
						<div className="vulocart-order-tags">
							{ order.tags.map( ( tag ) => (
								<span key={ tag } className="vulocart-order-tag">
									{ tag }
									<button type="button" aria-label={ sprintf( /* translators: %s: tag. */ __( 'Remove %s', 'vulocart' ), tag ) } onClick={ () => saveTags( order.tags.filter( ( t ) => t !== tag ) ) }>
										×
									</button>
								</span>
							) ) }
						</div>
						<input
							type="text"
							className="vulocart-order-tag-input"
							value={ tagDraft }
							placeholder={ __( 'Add a tag and press Enter', 'vulocart' ) }
							onChange={ ( event ) => setTagDraft( event.target.value ) }
							onKeyDown={ ( event ) => {
								if ( 'Enter' === event.key && tagDraft.trim() ) {
									event.preventDefault();
									saveTags( [ ...order.tags, tagDraft.trim() ] );
									setTagDraft( '' );
								}
							} }
						/>
					</CardComponent>

					{ null !== activeModules && ! activeModules.includes( 'pdf-invoices' ) && (
						<CardComponent titleIcon="document" title={ __( 'Documents', 'vulocart' ) } desc={ __( 'Invoice, packing slip and credit note as PDF.', 'vulocart' ) }>
							{ ! vulocartLocalizer.pro_version ? (
								<>
									<p className="vulocart-field-hint">{ __( 'PDF invoices and packing slips are part of VuloCart Pro.', 'vulocart' ) }</p>
									<a className="vulocart-order-inline-save" href={ vulocartLocalizer.shop_url } target="_blank" rel="noreferrer">
										{ __( 'Upgrade to Pro', 'vulocart' ) }
									</a>
								</>
							) : ! vulocartLocalizer.khali_dabba ? (
								<>
									<p className="vulocart-field-hint">{ __( 'Activate your VuloCart Pro license to use order documents.', 'vulocart' ) }</p>
									<a className="vulocart-order-inline-save" href={ settingsUrl( 'licensing' ) }>
										{ __( 'Activate license', 'vulocart' ) }
									</a>
								</>
							) : (
								<>
									<p className="vulocart-field-hint">{ __( 'Turn on the PDF Invoices & Packing Slips module to print invoices and packing slips from this screen.', 'vulocart' ) }</p>
									<button type="button" className="vulocart-order-inline-save" disabled={ activating } onClick={ activateDocuments }>
										{ activating ? __( 'Turning on…', 'vulocart' ) : __( 'Turn on PDF Invoices & Packing Slips', 'vulocart' ) }
									</button>
								</>
							) }
						</CardComponent>
					) }

					{ applyFilters( 'vulocart_order_edit_sections', null, { id: order.id } ) as ReactNode }
				</div>
			</div>
		</div>
	);
}

export default OrderEdit;
