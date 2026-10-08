/**
 * Builds the real CSS custom properties `public/styles/blocks.scss`'s own `.vulopilot-toc` rules
 * read (`var(--toc-*, <fallback>)`) from this block's style attributes - shared between the editor
 * preview (index.js) and the frontend render (TableOfContentsRenderer.php's own PHP mirror of this
 * same mapping), so both read from exactly one source of truth for which attribute maps to which
 * CSS variable.
 *
 * @param {Object} attributes Real block attributes.
 * @return {Object} CSS custom-property map, e.g. `{ '--toc-title-color': '#111' }` - entries for an
 *                   empty/unset attribute are omitted so the stylesheet's own fallback applies.
 */
export function buildTocStyleVars( attributes ) {
	const {
		contentFontSize,
		contentColor,
		contentLineHeight,
		contentListStyle,
		contentGap,
		titleFontSize,
		titleColor,
		titleLineHeight,
		titlePadding = {},
		titleMargin = {},
		sectionBackground,
		sectionPadding = {},
		sectionMargin = {},
	} = attributes;

	const vars = {};

	const set = ( name, value ) => {
		if ( value || 0 === value ) {
			vars[ name ] = value;
		}
	};

	const setBox = ( prefix, box ) => {
		[ 'top', 'right', 'bottom', 'left' ].forEach( ( side ) => {
			set( `${ prefix }-${ side }`, box?.[ side ] );
		} );
	};

	set( '--toc-content-font-size', contentFontSize );
	set( '--toc-content-color', contentColor );
	set( '--toc-content-line-height', contentLineHeight );
	set( '--toc-content-list-style', contentListStyle );
	set( '--toc-content-gap', contentGap );

	set( '--toc-title-font-size', titleFontSize );
	set( '--toc-title-color', titleColor );
	set( '--toc-title-line-height', titleLineHeight );
	setBox( '--toc-title-padding', titlePadding );
	setBox( '--toc-title-margin', titleMargin );

	set( '--toc-section-background', sectionBackground );
	setBox( '--toc-section-padding', sectionPadding );
	setBox( '--toc-section-margin', sectionMargin );

	return vars;
}
