import type { SdkConfig } from './types';

/**
 * The SDK's own runtime state — set once by `init()` (index.ts), read by
 * every widget/client call after that. A module-level singleton rather
 * than a class instance: this package is meant to back a single
 * `window.VuloCart` per page (or a single `import`ed instance per app),
 * never multiple stores on one page — a real limitation, not an
 * oversight, flagged in the package README rather than silently assumed.
 */
interface SdkState {
	storeUrl: string;
	config: SdkConfig | null;
	configPromise: Promise< SdkConfig > | null;
}

const state: SdkState = {
	storeUrl: '',
	config: null,
	configPromise: null,
};

export class VuloCartSdkError extends Error {
	status: number;
	code: string;

	constructor( message: string, status: number, code: string ) {
		super( message );
		this.name = 'VuloCartSdkError';
		this.status = status;
		this.code = code;
	}
}

/**
 * Sets the store this SDK instance talks to. Called once by `init()`.
 * Trailing slashes stripped so every call site can safely concatenate
 * `${storeUrl}/wp-json/...` without a double slash.
 *
 * @param storeUrl Origin of the WordPress site running VuloCart (e.g. `https://mystore.com`).
 */
export function setStoreUrl( storeUrl: string ): void {
	state.storeUrl = storeUrl.replace( /\/+$/, '' );
	state.config = null;
	state.configPromise = null;
}

export function getStoreUrl(): string {
	return state.storeUrl;
}

/**
 * Fetches (and caches for the lifetime of this page load) `/sdk/config` —
 * every widget calls this before its first real request, since it's what
 * tells them whether a given delivery mode is even available on this
 * store (Sdk.php's own docblock on why per-feature flags exist).
 */
export function getConfig(): Promise< SdkConfig > {
	if ( state.config ) {
		return Promise.resolve( state.config );
	}

	if ( ! state.configPromise ) {
		state.configPromise = request< SdkConfig >( 'GET', '/sdk/config' ).then( ( config ) => {
			state.config = config;
			return config;
		} );
	}

	return state.configPromise;
}

/**
 * The one HTTP call primitive every widget/client function in this
 * package goes through — plain `fetch`, no dependency, since this code
 * has to run on a page that may not have ANY other library loaded
 * (plain-HTML's own requirement in the SDK's own scope). Cross-origin by
 * design (Cors.php's own docblock on why VuloCart's REST API allows any
 * origin) — this is the whole reason Phase 4 exists.
 *
 * @param method  HTTP method.
 * @param path    Path under `vulocart/v1`, e.g. `/cart/items`.
 * @param body    JSON body, if any.
 * @param headers Extra headers (e.g. `X-Cart-Token`).
 */
export async function request< T >(
	method: string,
	path: string,
	body?: unknown,
	headers: Record< string, string > = {}
): Promise< T > {
	if ( ! state.storeUrl ) {
		throw new VuloCartSdkError(
			'VuloCart SDK not initialized — call VuloCart.init({ storeUrl }) first.',
			0,
			'vulocart_sdk_not_initialized'
		);
	}

	const response = await fetch( `${ state.storeUrl }/wp-json/vulocart/v1${ path }`, {
		method,
		headers: {
			...( body ? { 'Content-Type': 'application/json' } : {} ),
			...headers,
		},
		body: body ? JSON.stringify( body ) : undefined,
	} );

	const data = await response.json().catch( () => null );

	if ( ! response.ok ) {
		throw new VuloCartSdkError(
			( data && typeof data === 'object' && 'message' in data && String( data.message ) ) || response.statusText,
			response.status,
			( data && typeof data === 'object' && 'code' in data && String( data.code ) ) || 'vulocart_sdk_request_failed'
		);
	}

	return data as T;
}
