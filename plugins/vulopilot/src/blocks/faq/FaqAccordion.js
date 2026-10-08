/**
 * The one real shared presentation component the editor canvas (index.js, with editable
 * `RichText` content) renders with - FaqRenderer.php's own PHP output can't literally share this
 * component across languages, but it builds the exact same DOM shape/class names by hand (see
 * that file's own docblock) and reads the exact same `--faq-*` CSS custom properties this
 * component's caller supplies via `styleVars`, so editor and frontend never visually drift.
 *
 * Render-prop shaped (`renderQuestion`/`renderAnswer`) rather than taking plain strings, so the
 * editor can pass real `RichText` fields here without this component needing to know that.
 */
import { __ } from '@wordpress/i18n';

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
	settings,
	styleVars,
	groupName,
	className = '',
	emptyMessage,
	// `layoutMode: 'expanded'` (the editor canvas's own always-"static"/div-based rendering,
	// needed so RichText stays reachable - a native `<details>`'s own toggle would otherwise
	// intercept clicks meant for text editing) still collapses/expands per item when these are
	// given, same real interaction the frontend's native `<details>` gives for free - just driven
	// by this component's own `isItemOpen`/`onToggleItem` instead of the `<details>` element's own
	// `open` state. Omit both to keep every item always open (e.g. a read-only summary render).
	isItemOpen,
	onToggleItem,
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
					const isOpen = ! onToggleItem || ( isItemOpen && isItemOpen( index ) );

					return (
						<div
							className="vulopilot-faq__item vulopilot-faq__item--static"
							open={ isOpen }
							key={ index }
						>
							<div className="vulopilot-faq__question vulopilot-faq__question--static">
								{ HeadingTag ? (
									<HeadingTag className="vulopilot-faq__question-text">
										{ renderQuestion( item, index ) }
									</HeadingTag>
								) : (
									renderQuestion( item, index )
								) }
								{ onToggleItem && (
									<button
										type="button"
										className="vulopilot-faq__icon"
										aria-expanded={ isOpen }
										aria-label={ __( 'Toggle answer', 'vulopilot' ) }
										onClick={ ( e ) => {
											e.preventDefault();
											onToggleItem( index );
										} }
									>
										<span className="vulopilot-faq__icon-closed">
											{ glyph.closed }
										</span>
										<span className="vulopilot-faq__icon-open">
											{ glyph.open }
										</span>
									</button>
								) }
								{ renderItemControls && renderItemControls( item, index ) }
							</div>
							{ isOpen && (
								<div className="vulopilot-faq__answer">
									{ renderAnswer( item, index ) }
								</div>
							) }
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
