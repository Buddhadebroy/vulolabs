/**
 * The widget registry — how a `data-vulocart-{name}` attribute on any
 * element resolves to a mount function, and (critically) how Pro widgets
 * registered by a LATER-loading script (`pro-loader.ts`'s own async
 * `<script>` injection — the Pro SDK bundle isn't even requested until
 * `/sdk/config` says it exists) still get auto-initialized even though
 * the page's own initial DOM scan (`autoinit.ts`) already ran before that
 * script arrived. `registerWidget()` re-scans the DOM for its own
 * attribute immediately on registration, so a Popup Checkout trigger
 * `<div data-vulocart-popup-checkout-trigger>` already sitting in the
 * page's HTML at load time still gets wired up once the async Pro bundle
 * finishes loading and calls `registerWidget('popup-checkout-trigger', …)`
 * — no race between "DOM is ready" and "Pro script has loaded."
 */

export type WidgetFactory = ( el: HTMLElement ) => void;

const registry = new Map< string, WidgetFactory >();
const initialized = new WeakSet< HTMLElement >();

export function registerWidget( attribute: string, factory: WidgetFactory ): void {
	registry.set( attribute, factory );
	scanFor( attribute, factory );
}

export function scanAll(): void {
	for ( const [ attribute, factory ] of registry ) {
		scanFor( attribute, factory );
	}
}

function scanFor( attribute: string, factory: WidgetFactory ): void {
	const elements = document.querySelectorAll< HTMLElement >( `[data-vulocart-${ attribute }]` );

	elements.forEach( ( el ) => {
		if ( initialized.has( el ) ) {
			return;
		}

		initialized.add( el );
		factory( el );
	} );
}
