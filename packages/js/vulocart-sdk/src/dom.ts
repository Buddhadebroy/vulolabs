/**
 * A minimal DOM-builder helper — no virtual DOM, no diffing. Every widget
 * in this package is small and short-lived enough (a button, a cart
 * drawer, a handful of checkout fields) that re-rendering by clearing and
 * rebuilding a container's `innerHTML`-equivalent tree is simpler and far
 * lighter than shipping a rendering framework into a bundle whose whole
 * pitch is "one small script tag." React-based rendering is what
 * `@vulocart/react` (the separate adapter package) is for.
 */
export function h< K extends keyof HTMLElementTagNameMap >(
	tag: K,
	attrs: Record< string, string | undefined | null > = {},
	children: ( Node | string )[] = []
): HTMLElementTagNameMap[ K ] {
	const el = document.createElement( tag );

	for ( const [ key, value ] of Object.entries( attrs ) ) {
		if ( undefined === value || null === value ) {
			continue;
		}

		if ( 'class' === key ) {
			el.className = value;
		} else if ( key.startsWith( 'on' ) ) {
			// Not used — event listeners are attached directly via
			// `addEventListener` at each call site instead, so this
			// helper's attrs stay plain, JSON-serializable-shaped data.
			continue;
		} else {
			el.setAttribute( key, value );
		}
	}

	for ( const child of children ) {
		el.append( child );
	}

	return el;
}

export function clear( el: HTMLElement ): void {
	while ( el.firstChild ) {
		el.removeChild( el.firstChild );
	}
}

export function formatMoney( amount: number, currency: string ): string {
	try {
		return new Intl.NumberFormat( undefined, { style: 'currency', currency } ).format( amount );
	} catch {
		return `${ amount } ${ currency }`;
	}
}
