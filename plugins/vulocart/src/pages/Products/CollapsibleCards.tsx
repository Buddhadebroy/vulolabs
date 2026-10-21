import { useEffect } from '@wordpress/element';

const COLUMNS = '.vulocart-product-edit-col';
const STORE = 'vulocart_collapsed_cards';

/** Reads the titles of the cards the user folded from localStorage. */
const read = (): string[] => {
	try {
		return JSON.parse( window.localStorage.getItem( STORE ) ?? '[]' );
	} catch ( error ) {
		return [];
	}
};

/** Remembers which cards are folded; failures are ignored because it is only a convenience. */
const write = ( titles: string[] ) => {
	try {
		window.localStorage.setItem( STORE, JSON.stringify( titles ) );
	} catch ( error ) {
		// Remembering is optional.
	}
};

/** Reads a card's title text from its header. */
const titleOf = ( card: Element ): string => {
	const title = card.querySelector( '.card-header .typography-title' );

	return ( title?.firstChild?.textContent ?? '' ).replace( /Featured$/, '' ).trim();
};

/**
 * Lets every card of the product form fold up: click its header and the body slides away, leaving just the title. Works
 * on the page's own markup, so cards added by Pro modules fold the same way. Which cards are folded is remembered in
 * this browser. Clicks on the header's buttons and inputs (type picker, AI, save…) are left alone.
 */
export function CollapsibleCards() {
	useEffect( () => {
		const page = document.querySelector( '.vulocart-product-edit-page' );

		if ( ! page ) {
			return undefined;
		}

		const apply = () => {
			const folded = read();

			page.querySelectorAll( `${ COLUMNS } .card-content` ).forEach( ( card ) => {
				const title = titleOf( card );

				if ( title ) {
					card.classList.toggle( 'is-collapsed', folded.includes( title ) );
					card.classList.add( 'is-foldable' );
				}
			} );
		};

		const onClick = ( event: Event ) => {
			const target = event.target as HTMLElement;
			const header = target.closest( '.card-header' );

			if ( ! header || target.closest( 'button, a, input, select, textarea, label, .right' ) ) {
				return;
			}

			const card = header.closest( '.card-content' );
			const title = card ? titleOf( card ) : '';

			if ( ! card || ! title ) {
				return;
			}

			const collapsed = card.classList.toggle( 'is-collapsed' );
			const folded = read().filter( ( entry ) => entry !== title );

			write( collapsed ? [ ...folded, title ] : folded );
		};

		apply();
		page.addEventListener( 'click', onClick );
		// Cards arrive late (module chunks, data) and when the type changes.
		const mutations = new MutationObserver( apply );
		mutations.observe( page, { childList: true, subtree: true } );

		return () => {
			page.removeEventListener( 'click', onClick );
			mutations.disconnect();
		};
	}, [] );

	return null;
}
