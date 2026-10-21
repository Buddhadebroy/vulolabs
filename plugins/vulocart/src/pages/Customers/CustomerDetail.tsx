/* global vulocartLocalizer */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ReactNode } from 'react';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { CardComponent, FormGroupWrapperComponent, FormGroupComponent, PopupComponent } from '@zyra/components';
import { TextInput, TextAreaInput, ButtonInput } from '@zyra/inputs';
import { showErrorToast, errorMessageOf } from '../../lib/rest-errors';
import { formatWpDate, formatWpDateTime } from '../../services/formatWpDate';
import ConfirmPopup from '../../components/ConfirmPopup/ConfirmPopup';
import './customers-page.scss';
import '../Products/products-page.scss';

interface Customer {
	id: number;
	email: string;
	wp_user_id: number | null;
	name: string | null;
	phone: string | null;
	total_orders: number;
	total_spent: number;
	last_order_at: string | null;
	created_at: string;
	analytics: { total_orders: number; total_spent: number; average_order_value: number; last_order_at: string | null };
}

interface Address {
	id: number;
	label: string | null;
	is_default_billing: number;
	is_default_shipping: number;
	full_name: string | null;
	address_1: string | null;
	city: string | null;
	state: string | null;
	postcode: string | null;
	country: string | null;
}

interface Note {
	id: number;
	note: string;
	created_at: string;
}

interface Order {
	id: number;
	order_number: string;
	total: number;
	currency: string | null;
	payment_status: string;
	fulfillment_status: string;
	created_at: string;
}

const EMPTY_ADDRESS = { label: '', full_name: '', address_1: '', city: '', state: '', postcode: '', country: '' };

const ADDRESS_FIELDS: { key: keyof typeof EMPTY_ADDRESS; label: string }[] = [
	{ key: 'label', label: __( 'Label', 'vulocart' ) },
	{ key: 'full_name', label: __( 'Full name', 'vulocart' ) },
	{ key: 'address_1', label: __( 'Address line 1', 'vulocart' ) },
	{ key: 'city', label: __( 'City', 'vulocart' ) },
	{ key: 'state', label: __( 'State', 'vulocart' ) },
	{ key: 'postcode', label: __( 'Postcode', 'vulocart' ) },
	{ key: 'country', label: __( 'Country', 'vulocart' ) },
];

const FULFILLMENT_BADGE: Record< string, string > = { draft: 'badge-pending', pending: 'badge-pending', processing: 'badge-info', shipped: 'badge-info', completed: 'badge-active', cancelled: 'badge-inactive' };
const PAYMENT_BADGE: Record< string, string > = { pending: 'badge-pending', paid: 'badge-active', failed: 'badge-inactive', refunded: 'badge-info' };
const capitalize = ( value: string ) => value.charAt( 0 ).toUpperCase() + value.slice( 1 );

/** "Today", "Yesterday" or "12 days ago" for a stored UTC timestamp. */
const daysAgo = ( timestamp: string ) => {
	const days = Math.floor( ( Date.now() - Date.parse( `${ timestamp.replace( ' ', 'T' ) }Z` ) ) / 86400000 );

	if ( Number.isNaN( days ) || days < 0 ) {
		return '';
	}

	if ( 0 === days ) {
		return __( 'Today', 'vulocart' );
	}

	return 1 === days ? __( 'Yesterday', 'vulocart' ) : sprintf( /* translators: %d: number of days. */ __( '%d days ago', 'vulocart' ), days );
};

const money = ( value: number | null | undefined ) => Number( value || 0 ).toFixed( 2 );

/**
 * The single-customer admin page. Same shell as the product edit page
 * (breadcrumb + title top bar with the save action, a main column of
 * cards and a side column) so the two read as one family.
 * `vulocart_customer_detail_sections` is the "Pro extends Free via filters"
 * extension point vulocart-pro's CustomerGrowth module renders Wishlist/
 * Saved Carts/Groups/Segments/Loyalty-Credits-Wallet/Communication
 * History/Timeline into, same compose-many shape
 * `vulocart_product_edit_sections` establishes for the Product edit page.
 */
export function CustomerDetail( { id }: { id: number } ) {
	const [ customer, setCustomer ] = useState< Customer | null >( null );
	const [ notFound, setNotFound ] = useState( false );
	const [ addresses, setAddresses ] = useState< Address[] >( [] );
	const [ notes, setNotes ] = useState< Note[] >( [] );
	const [ orders, setOrders ] = useState< Order[] >( [] );
	const [ profileForm, setProfileForm ] = useState( { name: '', phone: '' } );
	const [ addressForm, setAddressForm ] = useState( EMPTY_ADDRESS );
	const [ showAddressForm, setShowAddressForm ] = useState( false );
	const [ noteText, setNoteText ] = useState( '' );
	const [ deleteTarget, setDeleteTarget ] = useState< { kind: 'address' | 'note'; id: number } | null >( null );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ savedNotice, setSavedNotice ] = useState( false );

	// What the profile looked like when it was last loaded or saved - anything different is an unsaved change.
	const savedProfile = useRef( '' );
	const isDirty = JSON.stringify( profileForm ) !== savedProfile.current;

	const request = ( method: 'get' | 'post' | 'patch' | 'delete', path: string, data?: unknown ) =>
		axios.request( {
			method,
			url: getApiLink( vulocartLocalizer, `customers/${ id }${ path }` ),
			headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			data,
		} );

	const fail = ( error: unknown ) => showErrorToast( errorMessageOf( error ) );

	const loadCustomer = () =>
		request( 'get', '' )
			.then( ( response ) => {
				const data = response.data as Customer;
				const next = { name: data.name || '', phone: data.phone || '' };

				setCustomer( data );
				setProfileForm( next );
				savedProfile.current = JSON.stringify( next );
			} )
			.catch( ( error ) => {
				if ( 404 === error?.response?.status ) {
					setNotFound( true );
				} else {
					fail( error );
				}
			} );
	const loadAddresses = () => request( 'get', '/addresses' ).then( ( response ) => setAddresses( response.data ) ).catch( fail );
	const loadNotes = () => request( 'get', '/notes' ).then( ( response ) => setNotes( response.data ) ).catch( fail );
	const loadOrders = () => request( 'get', '/orders' ).then( ( response ) => setOrders( response.data ) ).catch( fail );

	useEffect( () => {
		loadCustomer();
		loadAddresses();
		loadNotes();
		loadOrders();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the customer changes.
	}, [ id ] );

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

	if ( notFound ) {
		return (
			<div className="vulocart-product-edit-page">
				<nav className="vulocart-breadcrumbs" aria-label={ __( 'Breadcrumb', 'vulocart' ) }>
					<a href="admin.php?page=customers">{ __( 'Customers', 'vulocart' ) }</a>
					<i className="adminfont-pagination-next-arrow" aria-hidden="true" />
					<span aria-current="page">{ __( 'Customer', 'vulocart' ) }</span>
				</nav>
				<p>{ __( 'No customer exists with this id.', 'vulocart' ) }</p>
			</div>
		);
	}

	if ( ! customer ) {
		return <p className="vulocart-product-loading">{ __( 'Loading…', 'vulocart' ) }</p>;
	}

	const saveProfile = () => {
		setIsSaving( true );
		setSavedNotice( false );

		request( 'patch', '', profileForm )
			.then( () => {
				setSavedNotice( true );
				window.setTimeout( () => setSavedNotice( false ), 3000 );

				return loadCustomer();
			} )
			.catch( fail )
			.finally( () => setIsSaving( false ) );
	};

	const addAddress = () => {
		if ( ! addressForm.full_name && ! addressForm.address_1 ) {
			showErrorToast( __( 'Enter at least a name or an address line.', 'vulocart' ) );

			return;
		}

		request( 'post', '/addresses', addressForm )
			.then( () => {
				setAddressForm( EMPTY_ADDRESS );
				setShowAddressForm( false );

				return loadAddresses();
			} )
			.catch( fail );
	};

	const confirmDelete = () => {
		const target = deleteTarget;
		setDeleteTarget( null );

		if ( ! target ) {
			return;
		}

		if ( 'address' === target.kind ) {
			request( 'delete', `/addresses/${ target.id }` ).then( loadAddresses ).catch( fail );
		} else {
			request( 'delete', `/notes/${ target.id }` ).then( loadNotes ).catch( fail );
		}
	};

	const addNote = () => {
		if ( ! noteText.trim() ) {
			return;
		}

		request( 'post', '/notes', { note: noteText } )
			.then( () => {
				setNoteText( '' );

				return loadNotes();
			} )
			.catch( fail );
	};

	const title = customer.name || customer.email;
	const analytics = customer.analytics;

	return (
		<div className="vulocart-product-edit-page vulocart-customer-detail">
			<div className="vulocart-product-edit-topbar">
				<div>
					<nav className="vulocart-breadcrumbs" aria-label={ __( 'Breadcrumb', 'vulocart' ) }>
						<a href="admin.php?page=customers">{ __( 'Customers', 'vulocart' ) }</a>
						<i className="adminfont-pagination-next-arrow" aria-hidden="true" />
						<span aria-current="page">{ __( 'Customer', 'vulocart' ) }</span>
					</nav>
					<h1 className="vulocart-edit-page-title">{ title }</h1>
					<div className="vulocart-title-meta">
						{ customer.name && <span className="vulocart-pill is-kind">{ customer.email }</span> }
						<span className="vulocart-pill is-type">
							{ customer.wp_user_id ? __( 'Registered', 'vulocart' ) : __( 'Guest', 'vulocart' ) }
						</span>
						<span className="vulocart-pill is-sku">
							<small>{ __( 'Since', 'vulocart' ) }</small>
							{ formatWpDate( customer.created_at ) }
						</span>
					</div>
				</div>

				<div className="vulocart-topbar-actions">
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
								onClick: saveProfile,
								disabled: isSaving || ! isDirty,
							},
						] }
					/>
				</div>
			</div>

			{ savedNotice && <div className="vulocart-saved-notice">{ __( 'Customer updated.', 'vulocart' ) }</div> }

			<div className="vulocart-cust-summary">
				{ [
					{ label: __( 'Orders', 'vulocart' ), value: String( analytics?.total_orders ?? 0 ), hint: __( 'Placed to date', 'vulocart' ) },
					{ label: __( 'Total spent', 'vulocart' ), value: money( analytics?.total_spent ), hint: __( 'Lifetime value', 'vulocart' ) },
					{ label: __( 'Average order', 'vulocart' ), value: money( analytics?.average_order_value ), hint: __( 'Per order', 'vulocart' ) },
					{
						label: __( 'Last order', 'vulocart' ),
						value: analytics?.last_order_at ? formatWpDate( analytics.last_order_at ) : __( 'Never', 'vulocart' ),
						hint: analytics?.last_order_at ? daysAgo( analytics.last_order_at ) : __( 'No orders yet', 'vulocart' ),
					},
				].map( ( item ) => (
					<div key={ item.label } className="vulocart-cust-summary-item">
						<span className="vulocart-cust-summary-label">{ item.label }</span>
						<span className="vulocart-cust-summary-value">{ item.value }</span>
						<span className="vulocart-cust-summary-hint">{ item.hint }</span>
					</div>
				) ) }
			</div>

			<div className="vulocart-product-edit-grid">
				<div className="vulocart-product-edit-col vulocart-product-edit-col--center">
					<CardComponent
						titleIcon="cart"
						title={ __( 'Order history', 'vulocart' ) }
						desc={ sprintf( /* translators: %d: number of orders. */ __( '%d orders placed.', 'vulocart' ), orders.length ) }
					>
						{ 0 === orders.length ? (
							<p className="vulocart-field-hint">{ __( 'No orders yet.', 'vulocart' ) }</p>
						) : (
							<table className="vulocart-customer-orders-table">
								<thead>
									<tr>
										<th>{ __( 'Order', 'vulocart' ) }</th>
										<th>{ __( 'Total', 'vulocart' ) }</th>
										<th>{ __( 'Payment', 'vulocart' ) }</th>
										<th>{ __( 'Fulfillment', 'vulocart' ) }</th>
										<th>{ __( 'Date', 'vulocart' ) }</th>
									</tr>
								</thead>
								<tbody>
									{ orders.map( ( order ) => (
										<tr key={ order.id }>
											<td><a href={ `admin.php?page=orders&action=edit&id=${ order.id }` }>#{ order.order_number }</a></td>
											<td><strong>{ money( order.total ) }</strong> { order.currency }</td>
											<td><span className={ `admin-badge ${ PAYMENT_BADGE[ order.payment_status ] ?? 'badge-info' }` }>{ capitalize( order.payment_status ) }</span></td>
											<td><span className={ `admin-badge ${ FULFILLMENT_BADGE[ order.fulfillment_status ] ?? 'badge-info' }` }>{ capitalize( order.fulfillment_status ) }</span></td>
											<td>{ formatWpDate( order.created_at ) }</td>
										</tr>
									) ) }
								</tbody>
							</table>
						) }
					</CardComponent>

					{ applyFilters( 'vulocart_customer_detail_sections', null, { id, customer } ) as ReactNode }
				</div>

				<div className="vulocart-product-edit-col vulocart-product-edit-col--right">
					<CardComponent titleIcon="user" title={ __( 'Profile', 'vulocart' ) } desc={ __( 'Contact details for this customer.', 'vulocart' ) }>
						<FormGroupWrapperComponent>
							<FormGroupComponent label={ __( 'Email', 'vulocart' ) } htmlFor="vulocart-customer-email">
								<TextInput id="vulocart-customer-email" name="email" value={ customer.email } onChange={ () => undefined } readOnly />
							</FormGroupComponent>
							<FormGroupComponent label={ __( 'Name', 'vulocart' ) } htmlFor="vulocart-customer-name">
								<TextInput
									id="vulocart-customer-name"
									name="name"
									value={ profileForm.name }
									onChange={ ( value ) => setProfileForm( { ...profileForm, name: String( value ) } ) }
								/>
							</FormGroupComponent>
							<FormGroupComponent label={ __( 'Phone', 'vulocart' ) } htmlFor="vulocart-customer-phone">
								<TextInput
									id="vulocart-customer-phone"
									name="phone"
									value={ profileForm.phone }
									onChange={ ( value ) => setProfileForm( { ...profileForm, phone: String( value ) } ) }
								/>
							</FormGroupComponent>
						</FormGroupWrapperComponent>
					</CardComponent>

					<CardComponent
						titleIcon="location"
						title={ __( 'Addresses', 'vulocart' ) }
						desc={ __( 'Saved billing and shipping addresses.', 'vulocart' ) }
						action={
							<ButtonInput
								buttons={ [
									{
										icon: 'plus',
										text: __( 'Add address', 'vulocart' ),
										onClick: () => setShowAddressForm( true ),
									},
								] }
							/>
						}
					>
						<div className="vulocart-cust-addresses">
							{ addresses.map( ( address ) => (
								<div key={ address.id } className="vulocart-cust-address">
									<div className="vulocart-cust-address-head">
										<strong>{ address.label || __( 'Address', 'vulocart' ) }</strong>
										<button
											type="button"
											className="vulocart-cust-icon-button"
											aria-label={ __( 'Delete address', 'vulocart' ) }
											onClick={ () => setDeleteTarget( { kind: 'address', id: address.id } ) }
										>
											<i className="adminfont-delete" aria-hidden="true" />
										</button>
									</div>
									<div className="vulocart-product-cell-tags">
										{ !! address.is_default_billing && <span className="admin-badge badge-info">{ __( 'Default billing', 'vulocart' ) }</span> }
										{ !! address.is_default_shipping && <span className="admin-badge badge-info">{ __( 'Default shipping', 'vulocart' ) }</span> }
									</div>
									{ address.full_name && <p>{ address.full_name }</p> }
									<p className="desc">{ [ address.address_1, address.city, address.state, address.postcode, address.country ].filter( Boolean ).join( ', ' ) }</p>
								</div>
							) ) }
						</div>
						{ 0 === addresses.length && <p className="vulocart-field-hint">{ __( 'No saved addresses.', 'vulocart' ) }</p> }
					</CardComponent>

					<CardComponent titleIcon="note" title={ __( 'Notes', 'vulocart' ) } desc={ __( 'Internal only - customers never see these.', 'vulocart' ) }>
						<TextAreaInput name="note" value={ noteText } onChange={ ( value ) => setNoteText( String( value ) ) } />
						<ButtonInput buttons={ [ { icon: 'plus', text: __( 'Add note', 'vulocart' ), onClick: addNote } ] } />

						<ul className="vulocart-customer-notes">
							{ notes.map( ( note ) => (
								<li key={ note.id }>
									<p>{ note.note }</p>
									<div className="vulocart-cust-note-meta">
										<span>{ formatWpDateTime( note.created_at ) }</span>
										<button
											type="button"
											className="vulocart-cust-icon-button"
											aria-label={ __( 'Delete note', 'vulocart' ) }
											onClick={ () => setDeleteTarget( { kind: 'note', id: note.id } ) }
										>
											<i className="adminfont-delete" aria-hidden="true" />
										</button>
									</div>
								</li>
							) ) }
						</ul>
					</CardComponent>
				</div>
			</div>

			{ showAddressForm && (
				<PopupComponent
					open
					onClose={ () => setShowAddressForm( false ) }
					width={ 34 }
					height="auto"
					position="lightbox"
					header={ { icon: 'location', title: __( 'Add address', 'vulocart' ), description: __( 'Saved to this customer; they can pick it at checkout.', 'vulocart' ) } }
					footer={
						<ButtonInput
							buttons={ [
								{ text: __( 'Cancel', 'vulocart' ), color: 'purple', onClick: () => setShowAddressForm( false ) },
								{ text: __( 'Save address', 'vulocart' ), icon: 'check', onClick: addAddress },
							] }
						/>
					}
				>
					<div className="vulocart-qe">
						<div className="vulocart-qe-grid">
							{ ADDRESS_FIELDS.map( ( field ) => (
								<label key={ field.key } className={ 'address_1' === field.key ? 'vulocart-qe-field vulocart-cust-wide' : 'vulocart-qe-field' }>
									<span>{ field.label }</span>
									<input type="text" value={ addressForm[ field.key ] } onChange={ ( event ) => setAddressForm( { ...addressForm, [ field.key ]: event.target.value } ) } />
								</label>
							) ) }
						</div>
					</div>
				</PopupComponent>
			) }

			<ConfirmPopup
				open={ !! deleteTarget }
				title={ 'address' === deleteTarget?.kind ? __( 'Delete address', 'vulocart' ) : __( 'Delete note', 'vulocart' ) }
				message={ 'address' === deleteTarget?.kind ? __( 'Delete this saved address? This cannot be undone.', 'vulocart' ) : __( 'Delete this note? This cannot be undone.', 'vulocart' ) }
				onConfirm={ confirmDelete }
				onCancel={ () => setDeleteTarget( null ) }
			/>
		</div>
	);
}

export default CustomerDetail;
