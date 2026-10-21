import type { ComponentType } from 'react';

/**
 * Registry of the admin tabs: a global array plus a register function. Pages add themselves to it, and the `Route`
 * component in App.tsx reads it back, keyed on the `tab` parameter of `location.hash`.
 */
declare global {
	interface Window {
		VULOCART_ROUTES: Array< { tab: string; component: ComponentType } >;
	}
}

window.VULOCART_ROUTES = window.VULOCART_ROUTES || [];

export const registerVuloCartRoute = ( route: {
	tab: string;
	component: ComponentType;
} ) => {
	window.VULOCART_ROUTES.push( route );
	window.dispatchEvent( new Event( 'vulocart-routes' ) );
};
