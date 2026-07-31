import { render } from '@wordpress/element';
import { CheckoutEngine } from './CheckoutEngine';
import type { CartResponse } from '../shared/cart';
import './steps'; // side-effect only — registers Free's 5 interactive steps, same as Checkout.tsx's own import.

export interface MountCheckoutEngineOptions {
	cartToken: string;
	cart: CartResponse | null;
	mode: 'single_page' | 'multi_step';
	onBackToCart?: () => void;
}

/**
 * The imperative half of the Checkout Engine's page-independence — the
 * declarative `<CheckoutEngine>` component (CheckoutEngine.tsx's own
 * docblock) already has no WordPress-page concept anywhere in it; this is
 * what lets something OTHER than the `vulocart/checkout` Gutenberg block
 * actually put it on screen. Exposed on `window.vulocartCheckoutEngine`
 * (registry.ts's own docblock on why that global exists at all) as
 * `mount()`/`unmount()` so vulocart-pro's Popup/Embedded/Hosted delivery
 * modes can render the exact same engine into a DOM node THEY create
 * (a modal overlay, a container on any page, a standalone route's own
 * shell) without needing to `import` this module directly (separate
 * webpack build — same reasoning every other cross-plugin JS boundary in
 * this codebase already has).
 *
 * @param container DOM node to render into.
 * @param options   Same props CheckoutEngine.tsx's own component takes, minus what has a sensible default here.
 */
export function mountCheckoutEngine( container: HTMLElement, options: MountCheckoutEngineOptions ): void {
	render(
		<CheckoutEngine
			cartToken={ options.cartToken }
			cart={ options.cart }
			mode={ options.mode }
			onBackToCart={ options.onBackToCart || ( () => undefined ) }
		/>,
		container
	);
}

/**
 * Unmounts whatever `mountCheckoutEngine()` rendered into `container` —
 * `render( null, container )` is `@wordpress/element`'s own documented
 * way to unmount (it wraps React 18/19's `root.unmount()` either way,
 * same as every other call site in this codebase that mounts via
 * `render()` already relies on implicitly).
 *
 * @param container The same DOM node passed to `mountCheckoutEngine()`.
 */
export function unmountCheckoutEngine( container: HTMLElement ): void {
	render( null, container );
}

if ( window.vulocartCheckoutEngine ) {
	window.vulocartCheckoutEngine.mount = ( container, options ) =>
		mountCheckoutEngine( container, options as unknown as MountCheckoutEngineOptions );
	window.vulocartCheckoutEngine.unmount = unmountCheckoutEngine;
}
