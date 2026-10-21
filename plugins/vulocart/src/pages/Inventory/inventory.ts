/* global vulocartLocalizer */
import axios from 'axios';
import { getApiLink } from '@zyra/core';

/** A product of a stock-trackable type, as `Inventory.php` lists it. */
export interface InventoryItem {
	id: number;
	title: string;
	type: string;
	sku: string | null;
	stock_management: boolean;
	stock_status: string;
	stock_quantity: number | null;
	low_stock: boolean;
}

export const authHeaders = () => ( { 'X-WP-Nonce': vulocartLocalizer.nonce } );

/** Every page of the stock list (the screens filter, sort and page it on the client, so counts match what they show). */
export function fetchInventory(): Promise< InventoryItem[] > {
	const url = getApiLink( vulocartLocalizer, 'inventory' );
	const page = ( number: number ) => axios.get< InventoryItem[] >( url, { headers: authHeaders(), params: { per_page: 100, page: number } } );

	return page( 1 ).then( ( first ) => {
		const pages = Math.min( Number( first.headers[ 'x-wp-totalpages' ] ) || 1, 50 );

		return Promise.all( Array.from( { length: Math.max( 0, pages - 1 ) }, ( _, index ) => page( index + 2 ) ) ).then( ( rest ) =>
			rest.reduce< InventoryItem[] >( ( all, response ) => all.concat( response.data ), first.data )
		);
	} );
}

/** Tab-switch request: the Inventory page's tabs listen for it, so a link inside a tab opens another without a reload. */
export const openInventoryTab = ( view: string ) => window.dispatchEvent( new CustomEvent( 'vulocart-engine-tab', { detail: view } ) );
