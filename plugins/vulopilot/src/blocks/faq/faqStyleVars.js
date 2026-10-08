/**
 * Builds the real CSS custom properties `public/styles/blocks.scss`'s own `.vulopilot-faq` rules
 * read (`var(--faq-*, <fallback>)`) from this block's `style` attribute - shared between the
 * editor (index.js, both the real canvas and the sidebar's own live style preview) and the
 * frontend render (FaqRenderer.php's own PHP mirror of this exact mapping), so a style change
 * looks identical everywhere it's rendered.
 *
 * Legacy fallback: a FAQ block saved before this `style` object existed only ever had flat
 * `questionColor`/`questionFontSize`/`answerColor`/`answerFontSize` attributes - those are read
 * here as a fallback for `style.question.color` etc. ONLY when the new nested value is itself
 * unset, so an existing post's own saved colors/sizes keep rendering exactly as before with zero
 * migration step.
 *
 * @param {Object} attributes Real block attributes.
 * @return {Object} CSS custom-property map - an unset/default value is simply omitted so the
 *                   stylesheet's own fallback (including the theme `--color-primary` chain for
 *                   accent colors) applies.
 */
export function buildFaqStyleVars( attributes ) {
	const style = attributes.style || {};
	const layout = style.layout || {};
	const container = style.container || {};
	const item = style.item || {};
	const question = style.question || {};
	const answer = style.answer || {};
	const icon = style.icon || {};
	const states = style.states || {};
	const responsive = style.responsive || {};
	const tablet = responsive.tablet || {};
	const mobile = responsive.mobile || {};

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

	const setBorder = ( prefix, border ) => {
		set( `${ prefix }-color`, border?.color );
		set( `${ prefix }-width`, border?.width );
		set( `${ prefix }-style`, border?.style );
	};

	// Layout - `width`/`maxWidth`/the alignment margin are plain CSS properties (not read via
	// `var()` by blocks.scss), set directly in this same style object since React's `style` prop
	// accepts regular camelCase keys and `--custom-properties` side by side.
	set( '--faq-item-gap', layout.itemGap );
	set( 'width', layout.width );
	set( 'maxWidth', layout.maxWidth );
	if ( layout.maxWidth ) {
		if ( 'center' === layout.align ) {
			vars.marginLeft = 'auto';
			vars.marginRight = 'auto';
		} else if ( 'right' === layout.align ) {
			vars.marginLeft = 'auto';
		}
	}

	// Container.
	set( '--faq-container-background', container.background );
	setBox( '--faq-container-padding', container.padding );
	setBorder( '--faq-container-border', container.border );
	set( '--faq-container-radius', container.radius );
	set( '--faq-container-shadow', container.shadow );

	// FAQ item.
	set( '--faq-item-background', item.background );
	setBorder( '--faq-item-border', item.border );
	set( '--faq-item-radius', item.radius );
	set( '--faq-item-shadow', item.shadow );

	// Question - legacy `questionColor`/`questionFontSize` fallback.
	set( '--faq-question-font-family', question.fontFamily );
	set(
		'--faq-question-font-size',
		question.fontSize || attributes.questionFontSize
	);
	set( '--faq-question-font-weight', question.fontWeight );
	set( '--faq-question-line-height', question.lineHeight );
	set( '--faq-question-letter-spacing', question.letterSpacing );
	set( '--faq-question-text-align', question.textAlign );
	set( '--faq-question-color', question.color || attributes.questionColor );
	set( '--faq-question-background', question.background );
	setBox( '--faq-question-padding', question.padding );

	// Answer - legacy `answerColor`/`answerFontSize` fallback.
	set( '--faq-answer-font-family', answer.fontFamily );
	set( '--faq-answer-font-size', answer.fontSize || attributes.answerFontSize );
	set( '--faq-answer-font-weight', answer.fontWeight );
	set( '--faq-answer-line-height', answer.lineHeight );
	set( '--faq-answer-color', answer.color || attributes.answerColor );
	set( '--faq-answer-background', answer.background );
	setBox( '--faq-answer-padding', answer.padding );
	set( '--faq-answer-link-color', answer.linkColor );

	// Icon.
	set( '--faq-icon-size', icon.size );
	set( '--faq-icon-color', icon.color );
	set( '--faq-icon-spacing', icon.spacing );
	set( '--faq-icon-background', icon.background );
	set( '--faq-icon-radius', icon.radius );

	// Interaction states.
	set( '--faq-hover-border-color', states.hoverBorderColor );
	set( '--faq-expanded-border-color', states.expandedBorderColor );
	set( '--faq-expanded-background', states.expandedBackground );
	set( '--faq-expanded-shadow', states.expandedShadow );
	set( '--faq-expanded-question-color', states.expandedQuestionColor );
	set( '--faq-expanded-icon-background', states.expandedIconBackground );
	set( '--faq-expanded-icon-color', states.expandedIconColor );
	set( '--faq-focus-color', states.focusColor );

	// Responsive overrides - only the subset blocks.scss's own media queries read.
	set( '--faq-tablet-question-font-size', tablet.questionFontSize );
	set( '--faq-tablet-answer-font-size', tablet.answerFontSize );
	set( '--faq-tablet-item-gap', tablet.itemGap );
	set( '--faq-tablet-icon-size', tablet.iconSize );

	set( '--faq-mobile-question-font-size', mobile.questionFontSize );
	set( '--faq-mobile-answer-font-size', mobile.answerFontSize );
	set( '--faq-mobile-item-gap', mobile.itemGap );
	set( '--faq-mobile-icon-size', mobile.iconSize );

	// Animation.
	if ( false === attributes.animationEnabled ) {
		vars[ '--faq-animation-duration' ] = '0s';
	} else if ( attributes.animationDuration || 0 === attributes.animationDuration ) {
		vars[ '--faq-animation-duration' ] = `${ attributes.animationDuration }ms`;
	}

	return vars;
}
