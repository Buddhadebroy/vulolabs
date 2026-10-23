import { render } from '../../lib/render';
import { OrderTracking } from './OrderTracking';

window.addEventListener( 'DOMContentLoaded', () => {
	document.querySelectorAll( '.vulocart-order-tracking-block' ).forEach( ( placeholder ) => {
		const container = document.createElement( 'div' );
		placeholder.appendChild( container );

		render( <OrderTracking />, container );
	} );
} );
