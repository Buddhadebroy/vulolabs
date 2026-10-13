import { render } from '@wordpress/element';
import { Offerings } from './Offerings';

window.addEventListener( 'DOMContentLoaded', () => {
	document.querySelectorAll( '.vulocart-offerings-block' ).forEach( ( placeholder ) => {
		const container = document.createElement( 'div' );
		placeholder.appendChild( container );

		// A page can override the site-wide listing template/columns from the block settings.
		render(
			<Offerings
				template={ placeholder.dataset.template || undefined }
				columns={ placeholder.dataset.columns ? Number( placeholder.dataset.columns ) : undefined }
			/>,
			container
		);
	} );
} );
