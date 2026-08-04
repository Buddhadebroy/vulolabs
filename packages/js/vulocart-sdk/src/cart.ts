import { request } from './client';
import type { Cart } from './types';

const CART_TOKEN_STORAGE_KEY = 'vulocart_cart_token';

/**
 * KNOWN LIMITATION: `localStorage` is scoped to the EMBEDDING page's own
 * origin, not the store's — on a true cross-domain embed (SDK loaded on
 * `merchant-landing-page.com`, store is `mystore.com`), the cart token
 * lives in `merchant-landing-page.com`'s own storage. That's fine for the
 * common case (one storefront embedded on one external domain), but the
 * SAME store embedded on two different third-party domains won't share a
 * cart between them — there's no cross-origin storage bridge (a hidden
 * first-party iframe + postMessage relay) built here. Documented rather
 * than silently assumed, same posture as every other scoped-out gap this
 * codebase has flagged (Address Autocomplete's NullProvider, Embedded
 * Checkout's same-site-only note).
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

/**
 * Starts a brand-new, throwaway cart token — used by Buy Button, which is
 * always "buy just this one thing right now," not an addition to whatever
 * the visitor's ambient cart already holds.
 */
export function createEphemeralCartToken(): string {
	return typeof window.crypto?.randomUUID === 'function'
		? window.crypto.randomUUID()
		: `vulocart-${ Date.now() }-${ Math.random().toString( 16 ).slice( 2 ) }`;
}

export function clearStoredCartToken(): void {
	window.localStorage.removeItem( CART_TOKEN_STORAGE_KEY );
}

export function getCart( cartToken: string ): Promise< Cart > {
	return request< Cart >( 'GET', '/cart', undefined, { 'X-Cart-Token': cartToken } );
}

export function addItem( cartToken: string, offeringId: number, quantity = 1 ): Promise< Cart > {
	return request< Cart >( 'POST', '/cart/items', { offering_id: offeringId, quantity }, { 'X-Cart-Token': cartToken } );
}

export function updateItem( cartToken: string, itemId: number, quantity: number ): Promise< Cart > {
	return request< Cart >( 'PATCH', `/cart/items/${ itemId }`, { quantity }, { 'X-Cart-Token': cartToken } );
}

export function removeItem( cartToken: string, itemId: number ): Promise< Cart > {
	return request< Cart >( 'DELETE', `/cart/items/${ itemId }`, undefined, { 'X-Cart-Token': cartToken } );
}
