/**
 * `@vulocart/sdk` — the public API surface. `import "@vulocart/sdk"` (a
 * React/Next.js app, a hand-written bundle) gets this file; requires an
 * explicit `VuloCart.init({ storeUrl })` call, since there's no
 * `<script src>` tag here for `init()` to auto-discover a store URL from
 * (`auto.ts`'s own docblock on that trick). Plain-HTML/WordPress
 * consumers use `auto.ts` instead (the `./auto` export / `vulocart-sdk.js`
 * build), which wraps this file and calls `init()` for them.
 */

import { getConfig, getStoreUrl, request, setStoreUrl } from './client';
import { getCart, getOrCreateCartToken } from './cart';
import { loadProSdk } from './pro-loader';
import { registerWidget, scanAll } from './registry';
import { mountBuyButton } from './widgets/buy-button';
import { mountEmbeddedCart } from './widgets/embedded-cart';
import { mountEmbeddedCheckout } from './widgets/embedded-checkout';

export type { SdkConfig, Cart, CartItem, AddressFields, Order, ShippingMethod } from './types';
export { getOrCreateCartToken, createEphemeralCartToken, getCart, addItem, updateItem, removeItem } from './cart';
export { mountBuyButton, mountEmbeddedCart, mountEmbeddedCheckout };
export { registerWidget } from './registry';
export { getConfig, getStoreUrl, request, VuloCartSdkError } from './client';

export interface InitOptions {
	/** Origin of the WordPress site running VuloCart, e.g. `https://mystore.com`. Required — this package can back more than one store, but only one at a time per `init()` call. */
	storeUrl: string;
	/** Skip scanning the DOM for `data-vulocart-*` elements — for consumers (e.g. `@vulocart/react`) that only ever mount widgets imperatively. Defaults to false. */
	skipAutoScan?: boolean;
}

let initialized = false;

/**
 * Boots the SDK against one store: points every subsequent call at
 * `storeUrl`, registers the three free-tier widgets so `data-vulocart-*`
 * elements already on the page light up, fetches `/sdk/config`, and — if
 * this site has vulocart-pro licensed with at least one SDK-facing module
 * active — lazy-loads its companion bundle (`pro-loader.ts`'s own
 * docblock).
 *
 * Safe to call more than once (e.g. hot-reload in a dev environment) —
 * later calls just repoint `storeUrl` and re-scan.
 */
export function init( options: InitOptions ): void {
	setStoreUrl( options.storeUrl );

	if ( ! initialized ) {
		initialized = true;

		registerWidget( 'buy-button', ( el ) => {
			const offeringId = parseInt( el.dataset.offeringId || '', 10 );

			if ( ! offeringId ) {
				return;
			}

			const quantity = parseInt( el.dataset.quantity || '1', 10 ) || 1;
			const target = el.dataset.target ? ( document.querySelector( el.dataset.target ) as HTMLElement | null ) : null;

			mountBuyButton( el, { offeringId, quantity, target: target || undefined } );
		} );

		registerWidget( 'embedded-cart', ( el ) => {
			const checkoutTarget = el.dataset.checkoutTarget
				? ( document.querySelector( el.dataset.checkoutTarget ) as HTMLElement | null )
				: null;

			mountEmbeddedCart( el, { checkoutTarget: checkoutTarget || undefined } );
		} );

		registerWidget( 'embedded-checkout', ( el ) => {
			const cartToken = el.dataset.cartToken || getOrCreateCartToken();
			mountEmbeddedCheckout( el, { cartToken } );
		} );
	}

	if ( ! options.skipAutoScan ) {
		scanAll();
	}

	// `window.VuloCart` is the ONLY channel a dynamically `<script>`-injected
	// vulocart-pro bundle (`pro-loader.ts`) has back into this module — it's
	// a separate network request/script evaluation, so it can't `import`
	// this file directly (the same cross-bundle boundary the WordPress-side
	// `window.vulocartCheckoutEngine` global already exists to cross,
	// registry.ts's own docblock in the checkout-engine). Set here, inside
	// `init()` itself, rather than only in `auto.ts` — `@vulocart/react`'s
	// `VuloCartProvider` calls `init()` directly with no `<script>` tag/
	// `auto.ts` involved at all, and Pro widgets need this global to exist
	// regardless of which entry point booted the SDK.
	if ( 'undefined' !== typeof window ) {
		window.VuloCart = VuloCart;
	}

	getConfig()
		.then( ( config ) => {
			if ( config.proActive && config.proSdkUrl ) {
				return loadProSdk( config.proSdkUrl ).catch( () => undefined );
			}
			return undefined;
		} )
		.catch( () => undefined );
}

export const VuloCart = {
	init,
	registerWidget,
	getConfig,
	getStoreUrl,
	mountBuyButton,
	mountEmbeddedCart,
	mountEmbeddedCheckout,
	// Exposed here (not just as named ES exports) specifically so
	// vulocart-pro's own `sdk-pro.js` — a fully separate bundle that
	// reaches this module ONLY through `window.VuloCart`, never an
	// `import` (this file's own docblock on that boundary) — has what it
	// needs to build Popup/Drawer/Checkout-Link widgets on the ambient
	// cart without duplicating this package's own request/state machinery.
	getOrCreateCartToken,
	getCart,
	request,
};

declare global {
	interface Window {
		VuloCart: typeof VuloCart;
	}
}

export default VuloCart;
