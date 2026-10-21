import { render } from '../../lib/render';
import { Checkout } from './Checkout';

/** A list the block saved as `a,b,c`; `null` when the attribute is missing (follow the site's Settings). */
const list = ( value ) => ( null === value ? undefined : value.split( ',' ).filter( Boolean ) );

window.addEventListener( 'DOMContentLoaded', () => {
	document.querySelectorAll( '.vulocart-checkout-block' ).forEach( ( placeholder ) => {
		const container = document.createElement( 'div' );
		placeholder.appendChild( container );

		render(
			<Checkout
				layout={ placeholder.getAttribute( 'data-layout' ) || undefined }
				steps={ list( placeholder.getAttribute( 'data-steps' ) ) }
				fields={ list( placeholder.getAttribute( 'data-fields' ) ) }
			/>,
			container
		);
	} );
} );
