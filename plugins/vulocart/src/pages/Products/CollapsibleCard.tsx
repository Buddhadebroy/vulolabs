import { useLayoutEffect, useRef, useState } from '@wordpress/element';
import type { ComponentProps, KeyboardEvent, MouseEvent } from 'react';
import { CardComponent } from '@zyra/components';

type Props = Omit< ComponentProps< typeof CardComponent >, 'toggle' | 'defaultExpanded' > & {
	/** Open on first render. Read once: the card never opens or closes on its own after that. */
	initiallyOpen?: boolean;
};

/**
 * A product-editor card that folds away to its header (title plus a one-line summary in `desc`).
 *
 * zyra's toggle card opens only from its chevron icon, which a keyboard can't reach, and it re-applies
 * `defaultExpanded` whenever that prop changes. Here the open state lives in this component: the whole header is
 * the toggle (focusable, Enter or Space), clicks on zyra's own chevron are handled the same way, and
 * `defaultExpanded` only changes when the merchant toggles.
 */
export function CollapsibleCard( { initiallyOpen = false, children, ...props }: Props ) {
	const [ open, setOpen ] = useState( initiallyOpen );
	const root = useRef< HTMLDivElement >( null );

	const header = () => root.current?.querySelector< HTMLElement >( ':scope > .card-content > .card-header' ) ?? null;

	useLayoutEffect( () => {
		const element = header();

		if ( element ) {
			element.setAttribute( 'role', 'button' );
			element.setAttribute( 'tabindex', '0' );
			element.setAttribute( 'aria-expanded', String( open ) );
		}
	} );

	/** Whether an event came from the header itself rather than a control placed in it. */
	const fromHeader = ( target: EventTarget | null ) => {
		const element = header();
		const node = target as HTMLElement | null;

		return !! element && !! node && element.contains( node ) && ! node.closest( 'a, button, input, select, textarea' );
	};

	return (
		<div
			ref={ root }
			className={ `vulocart-collapsible${ open ? ' is-open' : '' }` }
			// Capture phase: runs before zyra's chevron handler, which would otherwise toggle its own copy of the state.
			onClickCapture={ ( event: MouseEvent ) => {
				if ( fromHeader( event.target ) ) {
					event.stopPropagation();
					setOpen( ( current ) => ! current );
				}
			} }
			onKeyDown={ ( event: KeyboardEvent ) => {
				if ( ( 'Enter' === event.key || ' ' === event.key ) && event.target === header() ) {
					event.preventDefault();
					setOpen( ( current ) => ! current );
				}
			} }
		>
			<CardComponent { ...props } toggle defaultExpanded={ open }>
				{ children }
			</CardComponent>
		</div>
	);
}

export default CollapsibleCard;
