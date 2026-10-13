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

export function showErrorToast( message: string ) {
	const toast = document.createElement( 'div' );
	toast.className = 'vulocart-toast is-error';
	toast.setAttribute( 'role', 'alert' );
	toast.textContent = message;
	document.body.appendChild( toast );
	window.setTimeout( () => toast.remove(), TOAST_MS );
}

/** The server's own message for a failed request, for a page that catches the error itself. */
export function errorMessageOf( error: unknown ): string {
	return messageOf( error ) ?? __( 'The request failed.', 'vulocart' );
}

export function registerRestErrorToasts() {
	window.addEventListener( 'unhandledrejection', ( event ) => {
		const message = messageOf( event.reason );

		if ( ! message ) {
			return;
		}

		showErrorToast( message );
	} );
}
