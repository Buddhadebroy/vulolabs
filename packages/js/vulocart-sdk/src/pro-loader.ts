let loadPromise: Promise< void > | null = null;

/**
 * Injects vulocart-pro's own `sdk-pro.js` bundle via a plain `<script>`
 * tag (not a dynamic `import()`) — classic script injection works
 * identically regardless of which module format that bundle was built in
 * (it's vulocart-pro's own IIFE build, same as this package's own
 * `auto.ts` entry), and is the same mechanism the WordPress-side
 * `enqueue_storefront_script()` already relies on for loading a second,
 * license-gated bundle after a first one. `sdk-pro.js` is responsible for
 * calling `VuloCart.registerWidget()` (registry.ts) for each Pro widget
 * it implements once it finishes loading — this function only gets it
 * onto the page, it doesn't know what's inside it.
 *
 * @param url `proSdkUrl` from `GET /sdk/config` (Sdk.php).
 */
export function loadProSdk( url: string ): Promise< void > {
	if ( loadPromise ) {
		return loadPromise;
	}

	loadPromise = new Promise( ( resolve, reject ) => {
		const script = document.createElement( 'script' );
		script.src = url;
		script.async = true;
		script.addEventListener( 'load', () => resolve() );
		script.addEventListener( 'error', () => reject( new Error( `Could not load VuloCart Pro SDK bundle from ${ url }` ) ) );
		document.head.append( script );
	} );

	return loadPromise;
}
