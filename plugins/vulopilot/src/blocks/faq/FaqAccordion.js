/**
 * The one real shared presentation component both JS-rendered surfaces of this block use - the
 * editor canvas (index.js, with editable `RichText` content) and the sidebar's own "Live style
 * preview" (also index.js, with fixed sample content) - so neither can visually drift from the
 * other. FaqRenderer.php's own PHP output can't literally share this component across languages,
 * but it builds the exact same DOM shape/class names by hand (see that file's own docblock) and
 * reads the exact same `--faq-*` CSS custom properties this component's caller supplies via
 * `styleVars`.
 *
 * Render-prop shaped (`renderQuestion`/`renderAnswer`) rather than taking plain strings, so the
 * editor can pass real `RichText` fields here while the preview/frontend pass plain read-only
 * text, without this component needing to know which.
 */

const ICON_GLYPH = {
	'plus-minus': { closed: '+', open: '−' },
	chevron: { closed: '⌃', open: '⌄' },
	arrow: { closed: '→', open: '↓' },
};

export default function FaqAccordion( {
	items,
	renderQuestion,
	renderAnswer,
	renderItemControls,
	renderItemFooter,
	settings,
	styleVars,
	groupName,
	className = '',
	emptyMessage,
} ) {
	const {
		layoutMode = 'accordion',
		allowMultipleOpen = true,
		initialOpenIndex = null,
		iconStyle = 'plus-minus',
		iconPosition = 'right',
		headingLevel = 0,
		animationEnabled = true,
	} = settings || {};

	const isExpanded = 'expanded' === layoutMode;
	const HeadingTag =
		headingLevel >= 2 && headingLevel <= 6 ? `h${ headingLevel }` : null;
	const glyph = ICON_GLYPH[ iconStyle ] || ICON_GLYPH[ 'plus-minus' ];

	const wrapperClassName = [
		'vulopilot-faq',
		className,
		`vulopilot-faq--icon-${ iconPosition }`,
		isExpanded ? 'vulopilot-faq--expanded' : '',
		false === animationEnabled ? 'vulopilot-faq--no-animation' : '',
	]
		.filter( Boolean )
		.join( ' ' );

	if ( 0 === items.length && emptyMessage ) {
		return (
			<div className={ wrapperClassName } style={ styleVars }>
				<p className="vulopilot-faq__empty">{ emptyMessage }</p>
			</div>
		);
	}

	return (
		<div className={ wrapperClassName } style={ styleVars }>
			{ items.map( ( item, index ) => {
				if ( isExpanded ) {
					return (
						<div className="vulopilot-faq__item vulopilot-faq__item--static" key={ index }>
							<div className="vulopilot-faq__question vulopilot-faq__question--static">
								{ HeadingTag ? (
									<HeadingTag className="vulopilot-faq__question-text">
										{ renderQuestion( item, index ) }
									</HeadingTag>
								) : (
									renderQuestion( item, index )
								) }
								{ renderItemControls && renderItemControls( item, index ) }
							</div>
							<div className="vulopilot-faq__answer">
								{ renderAnswer( item, index ) }
							</div>
							{ renderItemFooter && renderItemFooter( item, index ) }
						</div>
					);
				}

				return (
					<details
						className="vulopilot-faq__item"
						name={ allowMultipleOpen ? undefined : groupName }
						open={ index === initialOpenIndex }
						key={ index }
					>
						<summary className="vulopilot-faq__question">
							{ HeadingTag ? (
								<HeadingTag className="vulopilot-faq__question-text">
									{ renderQuestion( item, index ) }
								</HeadingTag>
							) : (
								renderQuestion( item, index )
							) }
							<span
								className="vulopilot-faq__icon"
								aria-hidden="true"
							>
								<span className="vulopilot-faq__icon-closed">
									{ glyph.closed }
								</span>
								<span className="vulopilot-faq__icon-open">
									{ glyph.open }
								</span>
							</span>
							{ renderItemControls && renderItemControls( item, index ) }
						</summary>
						<div className="vulopilot-faq__answer">
							{ renderAnswer( item, index ) }
						</div>
					</details>
				);
			} ) }
		</div>
	);
}
