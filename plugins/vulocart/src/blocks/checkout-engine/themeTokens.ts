/**
 * Reads the active theme's own button look (the `wp-element-button` styles from theme.json / Global Styles) and
 * hands it to the checkout as CSS variables, so the primary button and every control's corner radius follow the
 * theme without the checkout knowing which theme it is. Anything the theme doesn't define (a classic theme with no
 * button styles reads as transparent) is left alone, and checkout-engine.scss's own values stay in force.
 */
export function applyThemeTokens( root: HTMLElement | null ): void {
	if ( ! root ) {
		return;
	}

	const probe = document.createElement( 'a' );

	probe.className = 'wp-element-button';
	probe.setAttribute( 'aria-hidden', 'true' );
	probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
	root.appendChild( probe );

	const styles = window.getComputedStyle( probe );
	const background = styles.backgroundColor;
	const color = styles.color;
	const radius = styles.borderTopLeftRadius;

	root.removeChild( probe );

	const isSet = ( value: string ) => '' !== value && 'transparent' !== value && ! /^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test( value );

	if ( isSet( background ) && isSet( color ) ) {
		root.style.setProperty( '--vc-accent', background );
		root.style.setProperty( '--vc-on-accent', color );
	}

	if ( radius && '' !== radius ) {
		root.style.setProperty( '--vc-ctl', radius );
	}
}
