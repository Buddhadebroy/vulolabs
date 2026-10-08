/**
 * Heading filtering/nesting logic shared by the editor preview (index.js) and mirrored by hand on
 * the frontend (TableOfContentsRenderer.php's own PHP copy of these same functions - see that
 * class's own docblock) - the ToC block's own `nestedList`/marker-style/exclusion behavior must be
 * byte-identical between the two, same "one mapping, two renderers" shape styleVars.js already
 * established for the color/spacing style attributes.
 */

/**
 * A heading's own stable identifier for `excludedHeadings` - its level + text, not its final
 * anchor (the editor never computes real anchors; see index.js's own `collectHeadings()` docblock
 * for why). Stable across re-saves as long as the heading's own level/text don't change; a renamed
 * heading simply stops matching a stale exclusion entry rather than throwing.
 *
 * @param {{level: number, text: string}} heading
 * @return {string}
 */
export function headingKey( heading ) {
	return `${ heading.level }:${ heading.text }`;
}

/**
 * @param {Array<{level: number, text: string}>} headings       Every real heading, unfiltered.
 * @param {Object}                                options
 * @param {number[]}                              options.includedLevels Explicit H1-H6 selection - takes priority when non-empty.
 * @param {number}                                 options.minLevel      Back-compat fallback (pre-`includedLevels` blocks) - only used when `includedLevels` is empty.
 * @param {number}                                 options.maxLevel      Back-compat fallback, paired with `minLevel`.
 * @param {string[]}                                options.excludedHeadings `headingKey()` values to drop.
 * @return {Array<{level: number, text: string}>}
 */
export function filterHeadings(
	headings,
	{ includedLevels = [], minLevel = 2, maxLevel = 6, excludedHeadings = [] }
) {
	const excluded = new Set( excludedHeadings );
	const levelAllowed =
		includedLevels.length > 0
			? ( level ) => includedLevels.includes( level )
			: ( level ) => level >= minLevel && level <= maxLevel;

	return headings.filter(
		( heading ) =>
			levelAllowed( heading.level ) && ! excluded.has( headingKey( heading ) )
	);
}

/**
 * Groups a flat, document-ordered heading list into a real tree - a heading nests under the
 * nearest *preceding* heading with a shallower level, same as a document outline reads (a level
 * jump, e.g. h2 straight to h4 with no h3 between, simply nests the h4 under that h2 rather than
 * erroring).
 *
 * @param {Array<{level: number, text: string}>} headings Already filtered (`filterHeadings()`).
 * @return {Array<Object>} Each node is `{ ...heading, children: [...] }`.
 */
export function buildHeadingTree( headings ) {
	const root = { level: 0, children: [] };
	const stack = [ root ];

	headings.forEach( ( heading ) => {
		const node = { ...heading, children: [] };

		while (
			stack.length > 1 &&
			stack[ stack.length - 1 ].level >= heading.level
		) {
			stack.pop();
		}

		stack[ stack.length - 1 ].children.push( node );
		stack.push( node );
	} );

	return root.children;
}

/**
 * Hierarchical numbering ("1", "1.1", "1.2", "2", ...) over an already-built tree - only
 * meaningful shape for a nested list; a flat list uses plain sequential numbers instead (see
 * index.js/TableOfContentsRenderer.php's own flat-list branch).
 *
 * @param {Array<Object>} nodes  `buildHeadingTree()` output (or one node's own `children`).
 * @param {string}         prefix Already-resolved parent number, e.g. `'1'` - '' at the root.
 * @return {void} Mutates each node in place, adding a `number` string property.
 */
export function assignHierarchicalNumbers( nodes, prefix = '' ) {
	nodes.forEach( ( node, index ) => {
		node.number = prefix ? `${ prefix }.${ index + 1 }` : `${ index + 1 }`;

		if ( node.children.length ) {
			assignHierarchicalNumbers( node.children, node.number );
		}
	} );
}
