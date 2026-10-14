import { render } from '@wordpress/element';
import { Products } from './Products';

window.addEventListener( 'DOMContentLoaded', () => {
	document.querySelectorAll( '.vulocart-products-block' ).forEach( ( placeholder ) => {
		const container = document.createElement( 'div' );
		placeholder.appendChild( container );

		// A page can override the site-wide listing template/columns from the block settings.
		render(
			<Products
				template={ placeholder.dataset.template || undefined }
				columns={ placeholder.dataset.columns ? Number( placeholder.dataset.columns ) : undefined }
			/>,
			container
		);
	} );
} );
