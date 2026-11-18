/* global vulocartLocalizer */
import { billingText } from '../../lib/priceText';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ReactNode } from 'react';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { AvatarComponent, CardComponent } from '@zyra/components';
import { ButtonInput, SelectInput, TextInput } from '@zyra/inputs';
import { showErrorToast, errorMessageOf, showToast } from '../../lib/rest-errors';
import './orders-page.scss';
import '../Products/products-page.scss';
import { formatWpDate, formatWpDateTime } from '../../services/formatWpDate';
import { formatMoney } from '../../blocks/shared/money';
import UpgradeToPro from '../../components/Popup/UpgradeToPro';
import { countryName, getCountries, getStates } from '../../blocks/shared/geo';

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
	details?: Array< { label: string; value: string } >;
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
	const stateName = getStates( address.country )?.find( ( state ) => state.value === address.state )?.label ?? address.state;
	const street = [ address.address_1, address.address_2 ].filter( Boolean ).join( ', ' );
	const locality = [ address.city, [ stateName, address.postcode ].filter( Boolean ).join( ' ' ) ].filter( Boolean ).join( ', ' );

	return (
		<div className="vulocart-order-address">
			{ address.full_name && <p className="is-name">{ address.full_name }</p> }
			{ street && <p>{ street }</p> }
			{ locality && <p>{ locality }</p> }
			{ address.country && <p>{ countryName( address.country ) }</p> }
			{ address.phone && <p className="is-phone">{ address.phone }</p> }
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

/** Formats a number with two decimals; empty values count as 0.00. */
/** An amount in the store's money format ($40.00); the currency falls back to USD, as the Dashboard does. */
const money = ( value: number | string | null | undefined, currency?: string | null ) => formatMoney( Number( value || 0 ), currency );

/** Builds the link to a Settings sub-tab. */
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

/**
 * A whole address, filled in on the spot: a "+ Add" link that opens a form in place (Copy billing/shipping address offers
 * the other one in one click). Country comes first and is searchable, because it decides the region list: a country with
 * a fixed list (US, Canada, India...) gets a State dropdown, any other a free-text region. The store's own country is
 * preselected. Street, city and country are required; fields carry browser autofill hints.
 */
function InlineAddress( { label, prefill, prefillLabel, onSave }: { label: string; prefill?: AddressBag | null; prefillLabel?: string; onSave: ( address: AddressBag ) => Promise< unknown > } ) {
	const empty: AddressBag = { full_name: '', phone: '', address_1: '', address_2: '', city: '', state: '', postcode: '', country: vulocartLocalizer.store_country || '' };
	const [ open, setOpen ] = useState( false );
	const [ address, setAddress ] = useState< AddressBag >( empty );
	const [ saving, setSaving ] = useState( false );
	const [ tried, setTried ] = useState( false );

	const states = getStates( address.country );
	const set = ( key: keyof AddressBag, value: string ) => setAddress( ( current ) => ( { ...current, [ key ]: value } ) );
	const missing = ( [ 'address_1', 'city', 'country' ] as const ).filter( ( key ) => ! address[ key ].trim() );
	const invalid = ( key: keyof AddressBag ) => tried && ( missing as readonly string[] ).includes( key );

	const close = () => {
		setOpen( false );
		setTried( false );
		setAddress( empty );
	};

	const save = () => {
		setTried( true );

		if ( missing.length ) {
			return;
		}

		setSaving( true );
		onSave( address )
			.then( close )
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

	const field = ( key: keyof AddressBag, text: string, props: { autoComplete: string; placeholder?: string; type?: string; required?: boolean; wide?: boolean } ) => (
		<label className={ `vc-addr-field${ props.wide ? ' is-wide' : '' }${ invalid( key ) ? ' is-invalid' : '' }` }>
			<span>
				{ text }
				{ props.required && <em aria-hidden="true">*</em> }
			</span>
			<input
				type={ props.type ?? 'text' }
				value={ address[ key ] }
				autoComplete={ props.autoComplete }
				placeholder={ props.placeholder }
				required={ props.required }
				aria-invalid={ invalid( key ) || undefined }
				onChange={ ( e ) => set( key, e.target.value ) }
			/>
		</label>
	);

	return (
		<form
			className="vulocart-order-inline-address vc-addr-form"
			// Our own check below names the missing fields and outlines them; the browser's would stop at the first.
			noValidate
			onSubmit={ ( event ) => {
				event.preventDefault();
				save();
			} }
		>
			{ prefill && (
				<button type="button" className="vc-addr-copy" onClick={ () => setAddress( { ...empty, ...prefill } ) }>
					<i className="adminfont-copy" aria-hidden="true" />
					{ prefillLabel }
				</button>
			) }

			<div className="vc-addr-grid">
				{ field( 'full_name', __( 'Full name', 'vulocart' ), { autoComplete: 'name', wide: true } ) }

				<div className={ `vc-addr-field is-wide${ invalid( 'country' ) ? ' is-invalid' : '' }` }>
					<span>
						{ __( 'Country / region', 'vulocart' ) }
						<em aria-hidden="true">*</em>
					</span>
					<SelectInput
						name="country"
						type="single-select"
						options={ getCountries() }
						value={ address.country }
						placeholder={ __( 'Search countries…', 'vulocart' ) }
						isClearable={ false }
						// A new country has its own regions, so the old one no longer applies.
						onChange={ ( value ) => setAddress( ( current ) => ( { ...current, country: String( value ?? '' ), state: '' } ) ) }
					/>
				</div>

				{ field( 'address_1', __( 'Street address', 'vulocart' ), { autoComplete: 'address-line1', placeholder: __( 'House number and street', 'vulocart' ), required: true, wide: true } ) }
				{ field( 'address_2', __( 'Apartment, suite, etc.', 'vulocart' ), { autoComplete: 'address-line2', placeholder: __( 'Optional', 'vulocart' ), wide: true } ) }
				{ field( 'city', __( 'City', 'vulocart' ), { autoComplete: 'address-level2', required: true } ) }
				{ field( 'postcode', __( 'Postcode', 'vulocart' ), { autoComplete: 'postal-code' } ) }

				{ states ? (
					<div className="vc-addr-field is-wide">
						<span>{ __( 'State / province', 'vulocart' ) }</span>
						<SelectInput
							name="state"
							type="single-select"
							options={ states }
							value={ address.state }
							placeholder={ __( 'Select…', 'vulocart' ) }
							onChange={ ( value ) => set( 'state', String( value ?? '' ) ) }
						/>
					</div>
				) : (
					field( 'state', __( 'State / region', 'vulocart' ), { autoComplete: 'address-level1', placeholder: __( 'Optional', 'vulocart' ), wide: true } )
				) }

				{ field( 'phone', __( 'Phone', 'vulocart' ), { autoComplete: 'tel', type: 'tel', placeholder: __( 'For the delivery driver', 'vulocart' ), wide: true } ) }
			</div>

			{ tried && missing.length > 0 && (
				<p className="vc-addr-error" role="alert">
					{ __( 'Fill in the street address, city and country.', 'vulocart' ) }
				</p>
			) }

			<div className="vc-addr-actions">
				<button type="submit" className="vc-order-btn is-primary" disabled={ saving }>
					{ saving ? __( 'Saving…', 'vulocart' ) : __( 'Save address', 'vulocart' ) }
				</button>
				<button type="button" className="vc-order-btn" onClick={ close }>
					{ __( 'Cancel', 'vulocart' ) }
				</button>
			</div>
		</form>
	);
}

/** Upper-cases the first letter of a status to use as its label. */
const labelOf = ( status: string ) => status.charAt( 0 ).toUpperCase() + status.slice( 1 );

/**
 * One status shown in the top bar with a pencil that opens a menu of the other choices - the same
 * control the product page uses for its publish status.
 */
function StatusPicker( { caption, value, options, onSelect, locked }: { caption: string; value: string; options: { label: string; value: string }[]; onSelect: ( value: string ) => void; locked?: boolean } ) {
	const nameOf = labelOf;

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
			{ /* The status itself is the control (a dot, a word and a chevron), as on the product editor. */ }
			{ locked ? (
				<span className={ `vulocart-status-tag ${ STATUS_TAG_CLASS[ value ] ?? '' }` }>
					<i aria-hidden="true" />
					{ nameOf( value ) }
				</span>
			) : (
				<button
					type="button"
					className={ `vulocart-status-trigger vulocart-status-tag ${ STATUS_TAG_CLASS[ value ] ?? '' }` }
					aria-haspopup="menu"
					aria-expanded={ open }
					aria-label={ `${ caption }: ${ nameOf( value ) }` }
					onClick={ () => setOpen( ! open ) }
				>
					<i aria-hidden="true" />
					{ nameOf( value ) }
					<span className="adminfont-keyboard-arrow-down" aria-hidden="true" />
				</button>
			) }
			<span className="vulocart-status-since">{ caption }</span>
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
									{ nameOf( option.value ) }
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
 * Full page for viewing and updating one order, at `admin.php?page=orders&action=edit&id=123`. It loads `GET
 * /orders/{id}` (admin only) on mount, because a bookmark or back-button visit has no row to start from.
 *
 * Payment Status and Fulfillment Status are two independent fields and are saved together with one `PATCH
 * /orders/{id}`. Refunding is a separate action (`POST /orders/{id}/refund`), because a refund records an amount
 * (`refunded_amount`) and is not just a status change.
 *
 * Saving stays on the page and shows an inline "Order updated." notice.
 *
 * The page has its own card layout (not the generic `ContainerComponent` / `ColumnComponent` shell, like
 * ProductEdit.tsx). It shows the billing and shipping address, shipping method and cost, tax and payment method when
 * present. Pro modules add their own sections (such as shipments) through the `vulocart_order_edit_main_sections`
 * filter.
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

	// One-click next steps (Mark as shipped, Mark as paid...): saved straight away, with any status picked in the
	// header but not yet saved going along with it, so nothing the merchant chose is lost.
	const [ quickBusy, setQuickBusy ] = useState( '' );

	const quickStatus = ( key: string, payload: { payment_status?: string; fulfillment_status?: string } ) => {
		setQuickBusy( key );

		axios
			.patch< OrderDetail >(
				getApiLink( vulocartLocalizer, `orders/${ id }` ),
				{ payment_status: paymentStatus, fulfillment_status: fulfillmentStatus, ...payload },
				{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
			)
			.then( ( response ) => {
				setOrder( response.data );
				setPaymentStatus( response.data.payment_status );
				setFulfillmentStatus( response.data.fulfillment_status );
				savedStatuses.current = JSON.stringify( [ response.data.payment_status, response.data.fulfillment_status ] );
				loadTransactions();
				setSavedNotice( true );
				window.setTimeout( () => setSavedNotice( false ), 3000 );
			} )
			.catch( ( error ) => showErrorToast( errorMessageOf( error ) ) )
			.finally( () => setQuickBusy( '' ) );
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
	const isRegistered = !! ( order.customer_user_id || order.customer?.is_registered );

	// The customer card's copy buttons: email or phone to the clipboard, with a toast either way.
	const copy = ( value: string ) => {
		const done = () => showToast( 'success', __( 'Copied', 'vulocart' ) );

		if ( navigator.clipboard?.writeText ) {
			navigator.clipboard.writeText( value ).then( done ).catch( () => showToast( 'error', __( 'Could not copy. Select the text and copy it instead.', 'vulocart' ) ) );
			return;
		}

		showToast( 'error', __( 'Could not copy. Select the text and copy it instead.', 'vulocart' ) );
	};

	const isPaid = 'paid' === order.payment_status;
	const isRefunded = 'refunded' === order.payment_status;
	const paidAmount = isPaid || isRefunded ? Number( order.total ) : 0;
	const balanceDue = Math.max( 0, Number( order.total ) - paidAmount );
	const sameAddress =
		!! order.shipping_address &&
		!! order.billing_address &&
		JSON.stringify( order.shipping_address ) === JSON.stringify( order.billing_address );
	const methodLabel = order.payment_method ? methodLabels[ order.payment_method ] || order.payment_method : '';
	const shipTo = order.shipping_address ? [ order.shipping_address.city, order.shipping_address.state, order.shipping_address.country ].filter( Boolean ).join( ', ' ) : '';

	// The next fulfilment step, offered as one button under the items (Shopify-style), and what it says.
	const nextFulfilment: { value: string; label: string; hint: string } | null = [ 'draft', 'pending', 'processing' ].includes( order.fulfillment_status )
		? { value: 'shipped', label: __( 'Mark as shipped', 'vulocart' ), hint: __( 'Packed and handed to the carrier? Mark it shipped.', 'vulocart' ) }
		: 'shipped' === order.fulfillment_status
		? { value: 'completed', label: __( 'Mark as delivered', 'vulocart' ), hint: __( 'Once it has arrived, complete the order.', 'vulocart' ) }
		: null;

	// A card's status, captioned with what it is about (as in the top bar), since an order is both "Pending" fulfilment and "Pending" payment.
	const statusTag = ( status: string, caption: string ) => (
		<span className="vc-order-card-status">
			<span className={ `vulocart-status-tag ${ STATUS_TAG_CLASS[ status ] ?? '' }` }>
				<i aria-hidden="true" />
				{ labelOf( status ) }
			</span>
			<span className="vulocart-status-since">{ caption }</span>
		</span>
	);

	const summaryRow = ( label: ReactNode, value: ReactNode, modifier = '' ) => (
		<div className={ `vc-order-sum-row${ modifier ? ` ${ modifier }` : '' }` }>
			<span>{ label }</span>
			<span>{ value }</span>
		</div>
	);

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
					<div className="vulocart-title-meta vc-order-meta">
						<span>{ sprintf( /* translators: %s: date and time. */ __( 'Placed %s', 'vulocart' ), formatWpDateTime( order.created_at ) ) }</span>
						<span>{ sprintf( /* translators: %d: number of items. */ _n( '%d item', '%d items', order.item_count, 'vulocart' ), order.item_count ) }</span>
						<span>{ money( order.total, order.currency ) }</span>
						{ ( order.customer_name || order.customer_email ) && <span>{ order.customer_name || order.customer_email }</span> }
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
						locked={ isRefunded }
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
					<i className="adminfont-error" aria-hidden="true" />
					<span>
						{ sprintf(
							/* translators: 1: fulfillment status, 2: payment status. */
							__( 'This order is %1$s but payment is still %2$s.', 'vulocart' ),
							fulfillmentStatus,
							'failed' === paymentStatus ? __( 'failed', 'vulocart' ) : __( 'pending', 'vulocart' )
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
					{ /* Items and fulfilment in one card: what was bought, where it goes, and the next step. */ }
					<CardComponent
						titleIcon="catalog"
						title={ __( 'Items', 'vulocart' ) }
						desc={ sprintf( /* translators: %d: number of items. */ _n( '%d item on this order', '%d items on this order', order.item_count, 'vulocart' ), order.item_count ) }
						action={ statusTag( order.fulfillment_status, __( 'Fulfillment', 'vulocart' ) ) }
					>
						{ order.items.length === 0 ? (
							<p className="vulocart-field-hint">{ __( 'No line items.', 'vulocart' ) }</p>
						) : (
							<ul className="vc-order-lines">
								{ order.items.map( ( item ) => (
									<li key={ item.id }>
										<span className="vc-order-line-thumb" aria-hidden="true">
											<i className="adminfont-catalog" />
										</span>
										<div className="vc-order-line-main">
											<strong>{ item.title }</strong>
											{ item.price && ( item.price.label || billingText( item.price ) ) && (
												<small>{ [ item.price.label, billingText( item.price ) ].filter( Boolean ).join( ' · ' ) }</small>
											) }
											{ ( item.details ?? [] ).map( ( detail ) => (
												<small key={ detail.label }>
													{ detail.label }: { detail.value }
												</small>
											) ) }
										</div>
										<span className="vc-order-line-qty">
											{ formatMoney( Number( item.unit_price ), item.currency ) } × { item.quantity }
										</span>
										<strong className="vc-order-line-total">{ formatMoney( Number( item.subtotal ), item.currency ) }</strong>
									</li>
								) ) }
							</ul>
						) }

						<div className="vc-order-fulfil">
							<div>
								<small>{ __( 'Shipping method', 'vulocart' ) }</small>
								{ order.shipping_method ? <span>{ order.shipping_method }</span> : <InlineAdd label={ __( 'Add shipping method', 'vulocart' ) } placeholder={ __( 'e.g. Standard delivery', 'vulocart' ) } onSave={ ( value ) => saveDetails( { shipping_method: value } ) } /> }
							</div>
							<div>
								<small>{ __( 'Shipping cost', 'vulocart' ) }</small>
								<span>{ money( order.shipping_cost, order.currency ) }</span>
							</div>
							<div>
								<small>{ __( 'Ship to', 'vulocart' ) }</small>
								{ shipTo ? <span>{ shipTo }</span> : <span className="vc-order-muted">{ __( 'No shipping address yet', 'vulocart' ) }</span> }
							</div>
						</div>

						{ nextFulfilment && (
							<div className="vc-order-card-foot">
								<span>{ nextFulfilment.hint }</span>
								<button
									type="button"
									className="vc-order-btn is-primary"
									disabled={ !! quickBusy }
									onClick={ () => quickStatus( 'fulfil', { fulfillment_status: nextFulfilment.value } ) }
								>
									<i className="adminfont-delivery" aria-hidden="true" />
									{ 'fulfil' === quickBusy ? __( 'Saving…', 'vulocart' ) : nextFulfilment.label }
								</button>
							</div>
						) }
					</CardComponent>

					{
						/**
						 * `vulocart_order_edit_main_sections` - same compose-many filter as
						 * `vulocart_order_edit_sections`, but rendered in the wide left column
						 * for panels that need the room (shipments, tracking).
						 */
						applyFilters( 'vulocart_order_edit_main_sections', null, { id: order.id } ) as ReactNode
					}

					{ /* Payment: the money summary, how it was paid, its history, and the one next step. */ }
					<div id="vulocart-order-payment">
						<CardComponent
							titleIcon="wallet"
							title={ __( 'Payment', 'vulocart' ) }
							desc={ methodLabel || undefined }
							action={ statusTag( order.payment_status, __( 'Payment', 'vulocart' ) ) }
						>
							<div className="vc-order-sum">
								{ summaryRow( __( 'Subtotal', 'vulocart' ), formatMoney( Number( order.subtotal ), order.currency ) ) }
								{ order.discount_total > 0 && summaryRow( __( 'Discount', 'vulocart' ), `-${ formatMoney( Number( order.discount_total ), order.currency ) }` ) }
								{ order.shipping_method && summaryRow( `${ __( 'Shipping', 'vulocart' ) } · ${ order.shipping_method }`, formatMoney( Number( order.shipping_cost ), order.currency ) ) }
								{ order.tax_amount > 0 && summaryRow( __( 'Tax', 'vulocart' ), formatMoney( Number( order.tax_amount ), order.currency ) ) }
								{ summaryRow( __( 'Total', 'vulocart' ), formatMoney( Number( order.total ), order.currency ), 'is-total' ) }
							</div>
							<div className="vc-order-sum is-settlement">
								{ summaryRow( __( 'Paid by customer', 'vulocart' ), money( paidAmount, order.currency ) ) }
								{ order.refunded_amount !== null && summaryRow( __( 'Refunded', 'vulocart' ), `-${ formatMoney( Number( order.refunded_amount ), order.currency ) }` ) }
								{ summaryRow( __( 'Balance due', 'vulocart' ), money( balanceDue, order.currency ), balanceDue > 0 ? 'is-balance is-due' : 'is-balance' ) }
							</div>

							<div className="vc-order-fulfil is-two">
								<div>
									<small>{ __( 'Method', 'vulocart' ) }</small>
									{ order.payment_method ? (
										<span>{ methodLabel }</span>
									) : Object.keys( methodLabels ).length > 0 ? (
										<InlineAdd
											label={ __( 'Choose method', 'vulocart' ) }
											options={ Object.entries( methodLabels ).map( ( [ value, text ] ) => ( { value, label: text } ) ) }
											onSave={ ( value ) => saveDetails( { payment_method: value } ) }
										/>
									) : (
										<MissingLink href={ settingsUrl( 'payments' ) }>{ __( 'Set up payments', 'vulocart' ) }</MissingLink>
									) }
								</div>
								<div>
									<small>{ __( 'Transaction ID', 'vulocart' ) }</small>
									{ order.gateway_transaction_id ? <code>{ order.gateway_transaction_id }</code> : <span className="vc-order-muted">—</span> }
								</div>
							</div>

							{ 0 === transactions.length && ( isPaid || isRefunded ) && (
								<p className="vc-order-note">
									<i className="adminfont-info" aria-hidden="true" />
									{ __( 'Marked as paid by hand - no gateway events were recorded.', 'vulocart' ) }
								</p>
							) }

							{ transactions.length > 0 && (
								<>
									<h4 className="vc-order-subtitle">{ __( 'Transaction history', 'vulocart' ) }</h4>
									<ul className="vc-order-txns">
										{ transactions.map( ( transaction ) => (
											<li key={ transaction.id }>
												<div>
													<strong>{ labelOf( transaction.type ) }</strong>
													<small>
														{ methodLabels[ transaction.gateway ] || transaction.gateway } · { formatWpDateTime( transaction.created_at ) }
													</small>
												</div>
												<span className={ `vulocart-status-pill vulocart-status-pill--${ transaction.status }` }>{ transaction.status }</span>
												<strong>{ formatMoney( Number( transaction.amount ), transaction.currency ) }</strong>
											</li>
										) ) }
									</ul>
								</>
							) }

							{ showRefundForm && (
								<div className="vc-order-refund">
									<label htmlFor="vulocart-order-refund-amount">{ __( 'Refund amount', 'vulocart' ) }</label>
									<div>
										<TextInput name="refund_amount" type="number" value={ refundAmount } onChange={ ( value ) => setRefundAmount( value as string ) } />
										<button type="button" className="vc-order-btn is-danger" disabled={ isRefunding } onClick={ handleRefund }>
											{ isRefunding ? __( 'Refunding…', 'vulocart' ) : __( 'Confirm refund', 'vulocart' ) }
										</button>
										<button type="button" className="vc-order-btn" onClick={ () => setShowRefundForm( false ) }>
											{ __( 'Cancel', 'vulocart' ) }
										</button>
									</div>
								</div>
							) }

							{ isPaid && ! showRefundForm && (
								<div className="vc-order-card-foot">
									<span>{ __( 'Money back to the customer goes through the same gateway.', 'vulocart' ) }</span>
									<button type="button" className="vc-order-btn" onClick={ () => setShowRefundForm( true ) }>
										<i className="adminfont-refund" aria-hidden="true" />
										{ __( 'Issue refund', 'vulocart' ) }
									</button>
								</div>
							) }

							{ ! isPaid && ! isRefunded && (
								<div className="vc-order-card-foot">
									<span>
										{ order.payment_requests.length > 0
											? sprintf( /* translators: %s: date and time. */ __( 'Payment requested %s.', 'vulocart' ), formatWpDateTime( order.payment_requests[ order.payment_requests.length - 1 ] ) )
											: order.customer_email
											? sprintf( /* translators: %s: customer email. */ __( 'Waiting for payment. You can email %s how to pay.', 'vulocart' ), order.customer_email )
											: __( 'Waiting for payment. Add the customer\'s email to send a payment request.', 'vulocart' ) }
									</span>
									<div className="vc-order-foot-actions">
										{ order.customer_email ? (
											<button type="button" className="vc-order-btn" disabled={ isRequesting } onClick={ askToPay }>
												<i className="adminfont-mail" aria-hidden="true" />
												{ isRequesting ? __( 'Sending…', 'vulocart' ) : order.payment_requests.length > 0 ? __( 'Ask again', 'vulocart' ) : __( 'Ask to pay', 'vulocart' ) }
											</button>
										) : (
											<InlineAdd label={ __( 'Add email', 'vulocart' ) } type="email" onSave={ ( value ) => saveDetails( { customer_email: value } ) } />
										) }
										<button type="button" className="vc-order-btn is-primary" disabled={ !! quickBusy } onClick={ () => quickStatus( 'pay', { payment_status: 'paid' } ) }>
											<i className="adminfont-check" aria-hidden="true" />
											{ 'pay' === quickBusy ? __( 'Saving…', 'vulocart' ) : __( 'Mark as paid', 'vulocart' ) }
										</button>
									</div>
								</div>
							) }
						</CardComponent>
					</div>

					<CardComponent titleIcon="clock" title={ __( 'Timeline', 'vulocart' ) } desc={ __( 'Everything that happened to this order.', 'vulocart' ) }>
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
														{ money( event.amount, event.currency ) }
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
					{ /* Customer: who, how to reach them, and the two addresses, stacked so each has the full width. */ }
					<CardComponent
						titleIcon="person"
						title={ __( 'Customer', 'vulocart' ) }
						action={
							profileUrl ? (
								<a className="vc-order-card-link" href={ profileUrl }>
									{ __( 'View profile', 'vulocart' ) }
								</a>
							) : undefined
						}
					>
						{ /* Who: avatar, name (to the profile), a Guest / Registered badge and how long they have been a customer. */ }
						<div className="vc-cust-id">
							<AvatarComponent name={ order.customer_name || order.customer_email || '' } />
							<div className="vc-cust-id-text">
								<p className="vc-cust-name">
									{ profileUrl ? <a href={ profileUrl }>{ order.customer_name || order.customer_email }</a> : order.customer_name || __( 'Guest customer', 'vulocart' ) }
								</p>
								<p className="vc-cust-meta">
									<span className={ `vc-cust-badge${ isRegistered ? ' is-registered' : '' }` }>{ isRegistered ? __( 'Registered', 'vulocart' ) : __( 'Guest', 'vulocart' ) }</span>
									{ order.customer && <span>{ sprintf( /* translators: %s: date. */ __( 'Since %s', 'vulocart' ), formatWpDate( order.customer.since ) ) }</span> }
								</p>
							</div>
						</div>

						{ /* Their history in three figures, readable at a glance. */ }
						{ order.customer && (
							<dl className="vc-cust-stats">
								<div>
									<dt>{ __( 'Orders', 'vulocart' ) }</dt>
									<dd>{ order.customer.total_orders }</dd>
								</div>
								<div>
									<dt>{ __( 'Total spent', 'vulocart' ) }</dt>
									<dd>{ money( order.customer.total_spent, order.currency ) }</dd>
								</div>
								<div>
									<dt>{ __( 'Avg. order', 'vulocart' ) }</dt>
									<dd>{ order.customer.total_orders ? money( order.customer.total_spent / order.customer.total_orders, order.currency ) : '–' }</dd>
								</div>
							</dl>
						) }

						{ /* Contact: each detail on its own row with its action; a missing one is a dashed row to add it. */ }
						<div className="vc-cust-section">
							<h4>{ __( 'Contact', 'vulocart' ) }</h4>
							{ order.customer_email ? (
								<div className="vc-cust-row">
									<i className="adminfont-mail" aria-hidden="true" />
									<a href={ `mailto:${ order.customer_email }` } title={ __( 'Send an email', 'vulocart' ) }>{ order.customer_email }</a>
									<button type="button" className="vc-cust-copy" onClick={ () => copy( order.customer_email as string ) } aria-label={ __( 'Copy email address', 'vulocart' ) } title={ __( 'Copy', 'vulocart' ) }>
										<i className="adminfont-copy" aria-hidden="true" />
									</button>
								</div>
							) : (
								<InlineAdd label={ __( 'Add email', 'vulocart' ) } type="email" placeholder={ __( 'Email address', 'vulocart' ) } onSave={ ( value ) => saveDetails( { customer_email: value } ) } />
							) }
							{ order.customer_phone ? (
								<div className="vc-cust-row">
									<i className="adminfont-form-phone" aria-hidden="true" />
									<a href={ `tel:${ order.customer_phone }` } title={ __( 'Call', 'vulocart' ) }>{ order.customer_phone }</a>
									<button type="button" className="vc-cust-copy" onClick={ () => copy( order.customer_phone as string ) } aria-label={ __( 'Copy phone number', 'vulocart' ) } title={ __( 'Copy', 'vulocart' ) }>
										<i className="adminfont-copy" aria-hidden="true" />
									</button>
								</div>
							) : (
								<InlineAdd label={ __( 'Add phone', 'vulocart' ) } type="tel" placeholder={ __( 'Phone number', 'vulocart' ) } onSave={ ( value ) => saveDetails( { customer_phone: value } ) } />
							) }
						</div>

						{ /* Addresses: each titled, then the address, "Same as shipping", or a dashed button to add it. */ }
						<div className="vc-cust-section">
							<div className="vc-cust-addr">
								<h4>{ __( 'Shipping address', 'vulocart' ) }</h4>
								{ order.shipping_address ? (
									<AddressDisplay address={ order.shipping_address } />
								) : (
									<InlineAddress label={ __( 'Add shipping address', 'vulocart' ) } prefill={ order.billing_address } prefillLabel={ __( 'Copy billing address', 'vulocart' ) } onSave={ ( address ) => saveDetails( { shipping_address: address } ) } />
								) }
							</div>
							<div className="vc-cust-addr">
								<h4>{ __( 'Billing address', 'vulocart' ) }</h4>
								{ order.billing_address ? (
									sameAddress ? (
										<p className="vc-cust-same">
											<i className="adminfont-check" aria-hidden="true" />
											{ __( 'Same as shipping address', 'vulocart' ) }
										</p>
									) : (
										<AddressDisplay address={ order.billing_address } />
									)
								) : (
									<InlineAddress label={ __( 'Add billing address', 'vulocart' ) } prefill={ order.shipping_address } prefillLabel={ __( 'Copy shipping address', 'vulocart' ) } onSave={ ( address ) => saveDetails( { billing_address: address } ) } />
								) }
							</div>
						</div>
					</CardComponent>

					<CardComponent titleIcon="pro-tag" title={ __( 'Tags', 'vulocart' ) } desc={ __( 'Group and filter orders.', 'vulocart' ) }>
						{ order.tags.length > 0 && (
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
						) }
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
							{ ! vulocartLocalizer.pro_version || ! vulocartLocalizer.khali_dabba ? (
								<div className="vc-order-locked">
									<p>{ __( 'PDF invoices and packing slips are part of VuloCart Pro.', 'vulocart' ) }</p>
									<UpgradeToPro className="vc-order-btn" feature={ { title: __( 'Documents', 'vulocart' ), description: __( 'Invoice, packing slip and credit note as PDF.', 'vulocart' ), icon: 'document' } } />
								</div>
							) : (
								<div className="vc-order-locked">
									<p>{ __( 'Turn on PDF Invoices & Packing Slips to print them from this screen.', 'vulocart' ) }</p>
									<button type="button" className="vc-order-btn" disabled={ activating } onClick={ activateDocuments }>
										{ activating ? __( 'Turning on…', 'vulocart' ) : __( 'Turn on', 'vulocart' ) }
									</button>
								</div>
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
