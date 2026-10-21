/* global vulocartFrontendData */
import axios from 'axios';

/**
 * Shared across every public storefront block (`src/blocks/checkout/`,
 * `src/blocks/products/`) - extracted so "add to cart" from the
 * Products detail page and the Checkout block's own cart review use the
 * exact same client-held cart identity, not two independently-generated
 * tokens that would each see an empty cart. Not under `src/blocks/{name}/`
 * itself, so `tools/webpack/create-config.js`'s block-entry scanner
 * (which only looks for `index.js`/`view.js`) skips this folder - it's a
 * plain shared module, not a block.
 */
export const CART_TOKEN_STORAGE_KEY = 'vulocart_cart_token';

export const client = axios.create( {
	baseURL: `${ vulocartFrontendData.apiUrl }/${ vulocartFrontendData.restUrl }`,
} );

/**
 * Returns the shopper's cart token from localStorage, creating and saving a new one on first use. The token identifies
 * the guest cart on the server.
 */
export function getOrCreateCartToken(): string {
	const existing = window.localStorage.getItem( CART_TOKEN_STORAGE_KEY );

	if ( existing ) {
		return existing;
	}

	const token =
		typeof window.crypto?.randomUUID === 'function'
			? window.crypto.randomUUID()
			: `vulocart-${ Date.now() }-${ Math.random().toString( 16 ).slice( 2 ) }`;

	window.localStorage.setItem( CART_TOKEN_STORAGE_KEY, token );

	return token;
}

export interface CartItem {
	id: number;
	product_id: number;
	title: string;
	type: string;
	/** Small product photo, null when it has none. */
	image?: string | null;
	quantity: number;
	unit_price: number;
	currency: string | null;
	subtotal: number;
	/** Which price the line was bought at (null for a line from before products had several prices). */
	price?: {
		id: string;
		label: string;
		type: string;
		interval: string;
		interval_count: number;
		payments: number | null;
		trial_days: number;
	} | null;
}

export interface CartResponse {
	token: string;
	currency: string | null;
	item_count: number;
	items: CartItem[];
	totals: { currency: string | null; item_count: number; subtotal: number; total: number };
}
