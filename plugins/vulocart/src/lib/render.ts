import { createRoot } from '@wordpress/element';
import type { ReactNode } from 'react';

const roots = new WeakMap< Element, ReturnType< typeof createRoot > >();

/**
 * Renders a React tree into a DOM node with the React 18 root API (the old `render()` of `@wordpress/element` logs a
 * deprecation warning). Calling it again for the same node updates the tree; passing `null` unmounts it.
 *
 * @param tree      What to render, or null to unmount.
 * @param container The DOM node to render into.
 */
export function render( tree: ReactNode, container: Element ): void {
	let root = roots.get( container );

	if ( null === tree ) {
		root?.unmount();
		roots.delete( container );

		return;
	}

	if ( ! root ) {
		root = createRoot( container );
		roots.set( container, root );
	}

	root.render( tree );
}
