/* global vulocartLocalizer */
import { __ } from '@wordpress/i18n';

/**
 * Surfaces a failed VuloCart REST call as a dismissing toast. Pro module pages fire their axios
 * calls without a `.catch()` - a rejected one would otherwise vanish into the console and the
 * page would just look like the button did nothing. Listening for the unhandled rejection means
 * every module gets the server's own message ("A name and code are required.") with no per-page
 * wiring, while a page that does catch its own error is unaffected.
 */
const TOAST_MS = 6000;

/** Extracts the server's message from a failed VuloCart REST request; null for any other error. */
const messageOf = ( reason: unknown ): string | null => {
	const error = reason as {
		isAxiosError?: boolean;
		config?: { baseURL?: string; url?: string };
		response?: { data?: { message?: string } };
		message?: string;
	};

	if ( ! error?.isAxiosError ) {
		return null;
	}

	const target = `${ error.config?.baseURL ?? '' }${ error.config?.url ?? '' }`;

	if ( ! target.includes( `/${ vulocartLocalizer.restUrl }` ) ) {
		return null;
	}

	return error.response?.data?.message || error.message || __( 'The request failed.', 'vulocart' );
};

/** Shows a short success or error message in the corner of the screen. */
export function showToast( type: 'success' | 'error', message: string ) {
	const toast = document.createElement( 'div' );
	toast.className = `vulocart-toast is-${ type }`;
	toast.setAttribute( 'role', 'error' === type ? 'alert' : 'status' );
	toast.textContent = message;
	document.body.appendChild( toast );
	window.setTimeout( () => toast.remove(), TOAST_MS );
}

/** Shows an error toast. */
export function showErrorToast( message: string ) {
	showToast( 'error', message );
}

/** The server's own message for a failed request, for a page that catches the error itself. */
export function errorMessageOf( error: unknown ): string {
	return messageOf( error ) ?? __( 'The request failed.', 'vulocart' );
}

/**
 * Starts showing a toast for every unhandled failed VuloCart REST request, and exposes `window.vulocartToast` for Pro
 * screens.
 */
export function registerRestErrorToasts() {
	// vulocart-pro ships its own copy of zyra, so its NoticeManager is not the one this page listens to: its list pages
	// (save / delete / validation messages) toast through this instead.
	( window as unknown as { vulocartToast?: typeof showToast } ).vulocartToast = showToast;

	window.addEventListener( 'unhandledrejection', ( event ) => {
		const message = messageOf( event.reason );

		if ( ! message ) {
			return;
		}

		showErrorToast( message );
	} );
}
