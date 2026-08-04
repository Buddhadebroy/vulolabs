/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { CardComponent } from '@zyra/components';
import './customers-page.scss';

const client = axios.create( {
	baseURL: `${ vulocartLocalizer.apiUrl }/${ vulocartLocalizer.restUrl }`,
	headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
} );

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

/**
 * The full single-customer admin view — profile, lifetime analytics,
 * address book, order history, and internal notes. `vulocart_customer_
 * detail_sections` is the "Pro extends Free via filters" extension point
 * `vulocart-pro`'s own CustomerGrowth module renders Wishlist/Saved
 * Carts/Groups/Segments/Loyalty-Credits-Wallet/Communication
 * History/Timeline into, same compose-many shape
 * `vulocart_offering_edit_sections` already establishes for the Offering
 * edit page.
 */
export function CustomerDetail( { id }: { id: number } ) {
	const [ customer, setCustomer ] = useState< Customer | null >( null );
	const [ addresses, setAddresses ] = useState< Address[] >( [] );
	const [ notes, setNotes ] = useState< Note[] >( [] );
	const [ orders, setOrders ] = useState< Order[] >( [] );
	const [ profileForm, setProfileForm ] = useState( { name: '', phone: '' } );
	const [ addressForm, setAddressForm ] = useState( EMPTY_ADDRESS );
	const [ noteText, setNoteText ] = useState( '' );

	const load = () => {
		client.get< Customer >( `/customers/${ id }` ).then( ( response ) => {
			setCustomer( response.data );
			setProfileForm( { name: response.data.name || '', phone: response.data.phone || '' } );
		} );
		client.get< Address[] >( `/customers/${ id }/addresses` ).then( ( response ) => setAddresses( response.data ) );
		client.get< Note[] >( `/customers/${ id }/notes` ).then( ( response ) => setNotes( response.data ) );
		client.get< Order[] >( `/customers/${ id }/orders` ).then( ( response ) => setOrders( response.data ) );
	};

	useEffect( load, [ id ] );

	if ( ! customer ) {
		return <p>{ __( 'Loading…', 'vulocart' ) }</p>;
	}

	const saveProfile = () => client.patch( `/customers/${ id }`, profileForm ).then( load );

	const addAddress = () => {
		if ( ! addressForm.full_name && ! addressForm.address_1 ) {
			return;
		}

		client.post( `/customers/${ id }/addresses`, addressForm ).then( () => {
			setAddressForm( EMPTY_ADDRESS );
			load();
		} );
	};

	const deleteAddress = ( addressId: number ) => client.delete( `/customers/${ id }/addresses/${ addressId }` ).then( load );

	const addNote = () => {
		if ( ! noteText.trim() ) {
			return;
		}

		client.post( `/customers/${ id }/notes`, { note: noteText } ).then( () => {
			setNoteText( '' );
			load();
		} );
	};

	const deleteNote = ( noteId: number ) => client.delete( `/customers/${ id }/notes/${ noteId }` ).then( load );

	return (
		<div className="vulocart-customer-detail">
			<a href="admin.php?page=vulocart-customers" className="vulocart-customer-back">
				{ __( '← All customers', 'vulocart' ) }
			</a>

			<h1>{ customer.name || customer.email }</h1>

			<div className="vulocart-customer-detail-grid">
				<div className="vulocart-customer-detail-main">
					<CardComponent title={ __( 'Profile', 'vulocart' ) }>
						<div className="vulocart-customer-field-grid">
							<label>
								{ __( 'Email', 'vulocart' ) }
								<input type="text" value={ customer.email } disabled />
							</label>
							<label>
								{ __( 'Name', 'vulocart' ) }
								<input type="text" value={ profileForm.name } onChange={ ( e ) => setProfileForm( { ...profileForm, name: e.target.value } ) } />
							</label>
							<label>
								{ __( 'Phone', 'vulocart' ) }
								<input type="text" value={ profileForm.phone } onChange={ ( e ) => setProfileForm( { ...profileForm, phone: e.target.value } ) } />
							</label>
						</div>
						<button type="button" onClick={ saveProfile }>{ __( 'Save', 'vulocart' ) }</button>
					</CardComponent>

					<CardComponent title={ __( 'Addresses', 'vulocart' ) }>
						{ addresses.map( ( address ) => (
							<div key={ address.id } className="vulocart-customer-address-row">
								<div>
									<strong>{ address.label || __( 'Address', 'vulocart' ) }</strong>
									{ !! address.is_default_billing && <span className="vulocart-customer-badge">{ __( 'default billing', 'vulocart' ) }</span> }
									{ !! address.is_default_shipping && <span className="vulocart-customer-badge">{ __( 'default shipping', 'vulocart' ) }</span> }
									<p>{ address.full_name }</p>
									<p>{ [ address.address_1, address.city, address.state, address.postcode, address.country ].filter( Boolean ).join( ', ' ) }</p>
								</div>
								<a href="#delete" onClick={ ( e ) => { e.preventDefault(); deleteAddress( address.id ); } }>
									{ __( 'Delete', 'vulocart' ) }
								</a>
							</div>
						) ) }
						{ 0 === addresses.length && <p>{ __( 'No saved addresses.', 'vulocart' ) }</p> }

						<div className="vulocart-customer-address-form">
							<h4>{ __( 'Add address', 'vulocart' ) }</h4>
							<div className="vulocart-customer-field-grid">
								<input type="text" placeholder={ __( 'Label', 'vulocart' ) } value={ addressForm.label } onChange={ ( e ) => setAddressForm( { ...addressForm, label: e.target.value } ) } />
								<input type="text" placeholder={ __( 'Full name', 'vulocart' ) } value={ addressForm.full_name } onChange={ ( e ) => setAddressForm( { ...addressForm, full_name: e.target.value } ) } />
								<input type="text" placeholder={ __( 'Address line 1', 'vulocart' ) } value={ addressForm.address_1 } onChange={ ( e ) => setAddressForm( { ...addressForm, address_1: e.target.value } ) } />
								<input type="text" placeholder={ __( 'City', 'vulocart' ) } value={ addressForm.city } onChange={ ( e ) => setAddressForm( { ...addressForm, city: e.target.value } ) } />
								<input type="text" placeholder={ __( 'State', 'vulocart' ) } value={ addressForm.state } onChange={ ( e ) => setAddressForm( { ...addressForm, state: e.target.value } ) } />
								<input type="text" placeholder={ __( 'Postcode', 'vulocart' ) } value={ addressForm.postcode } onChange={ ( e ) => setAddressForm( { ...addressForm, postcode: e.target.value } ) } />
								<input type="text" placeholder={ __( 'Country', 'vulocart' ) } value={ addressForm.country } onChange={ ( e ) => setAddressForm( { ...addressForm, country: e.target.value } ) } />
							</div>
							<button type="button" onClick={ addAddress }>{ __( 'Add address', 'vulocart' ) }</button>
						</div>
					</CardComponent>

					<CardComponent title={ __( 'Order history', 'vulocart' ) }>
						{ 0 === orders.length ? (
							<p>{ __( 'No orders yet.', 'vulocart' ) }</p>
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
											<td><a href={ `admin.php?page=vulocart-orders&action=edit&id=${ order.id }` }>{ order.order_number }</a></td>
											<td>{ order.total } { order.currency }</td>
											<td>{ order.payment_status }</td>
											<td>{ order.fulfillment_status }</td>
											<td>{ order.created_at }</td>
										</tr>
									) ) }
								</tbody>
							</table>
						) }
					</CardComponent>

					{ applyFilters( 'vulocart_customer_detail_sections', null, { id, customer } ) }
				</div>

				<div className="vulocart-customer-detail-side">
					<CardComponent title={ __( 'Lifetime value', 'vulocart' ) }>
						<div className="vulocart-customer-stat">
							<span className="vulocart-customer-stat-value">{ customer.analytics.total_orders }</span>
							<span className="vulocart-customer-stat-label">{ __( 'orders', 'vulocart' ) }</span>
						</div>
						<div className="vulocart-customer-stat">
							<span className="vulocart-customer-stat-value">{ customer.analytics.total_spent.toFixed( 2 ) }</span>
							<span className="vulocart-customer-stat-label">{ __( 'total spent', 'vulocart' ) }</span>
						</div>
						<div className="vulocart-customer-stat">
							<span className="vulocart-customer-stat-value">{ customer.analytics.average_order_value.toFixed( 2 ) }</span>
							<span className="vulocart-customer-stat-label">{ __( 'avg order value', 'vulocart' ) }</span>
						</div>
						<p className="vulocart-customer-last-order">
							{ __( 'Last order:', 'vulocart' ) } { customer.analytics.last_order_at || __( 'never', 'vulocart' ) }
						</p>
					</CardComponent>

					<CardComponent title={ __( 'Notes', 'vulocart' ) }>
						<textarea value={ noteText } onChange={ ( e ) => setNoteText( e.target.value ) } placeholder={ __( 'Add an internal note…', 'vulocart' ) } />
						<button type="button" onClick={ addNote }>{ __( 'Add note', 'vulocart' ) }</button>

						<ul className="vulocart-customer-notes">
							{ notes.map( ( note ) => (
								<li key={ note.id }>
									<p>{ note.note }</p>
									<span>{ note.created_at }</span>
									<a href="#delete" onClick={ ( e ) => { e.preventDefault(); deleteNote( note.id ); } }>{ __( 'Delete', 'vulocart' ) }</a>
								</li>
							) ) }
						</ul>
					</CardComponent>
				</div>
			</div>
		</div>
	);
}

export default CustomerDetail;
