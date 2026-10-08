import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
	PanelColorSettings,
} from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import {
	PanelBody,
	TextControl,
	RangeControl,
	ToggleControl,
	SelectControl,
	CheckboxControl,
	BoxControl,
	Notice,
	__experimentalUnitControl as UnitControl,
} from '@wordpress/components';
import metadata from './block.json';
import { buildTocStyleVars } from './styleVars';
import {
	headingKey,
	filterHeadings,
	buildHeadingTree,
	assignHierarchicalNumbers,
} from './headingTree';

/**
 * Editor-side mirror of PHP's HeadingAnchorResolver::collect(): text and level only. Anchors matter
 * only on the published page, computed by render.php so TOC links and heading ids can't drift.
 */
function collectHeadings( blocks ) {
	let headings = [];

	blocks.forEach( ( block ) => {
		if ( block.name === 'core/heading' ) {
			const level = block.attributes.level || 2;
			// core/heading's `content` comes back from getBlocks() as a RichTextData object, not a string.
			// String() gives its plain text rather than letting an object reach JSX.
			const text = String( block.attributes.content ?? '' );

			if ( text.trim() !== '' ) {
				headings.push( { level, text } );
			}
		}

		if ( block.innerBlocks && block.innerBlocks.length ) {
			headings = headings.concat( collectHeadings( block.innerBlocks ) );
		}
	} );

	return headings;
}

/**
 * Fixed, read-only sample headings - shown (clearly labelled) whenever this post has no real
 * matching headings yet, so there's still something real to style. Never reaches `setAttributes()`
 * or any other post-content write path, and the frontend (TableOfContentsRenderer.php) returns ''
 * for an empty real heading list regardless of what the editor shows - so this can never leak into
 * saved content or the live page.
 */
const SAMPLE_HEADINGS = [
	{ level: 2, text: __( 'Getting started', 'vulopilot' ) },
	{ level: 3, text: __( 'Installation', 'vulopilot' ) },
	{ level: 3, text: __( 'Basic setup', 'vulopilot' ) },
	{ level: 2, text: __( 'Features', 'vulopilot' ) },
	{ level: 3, text: __( 'Customization', 'vulopilot' ) },
	{ level: 2, text: __( 'Frequently asked questions', 'vulopilot' ) },
];

const LIST_STYLE_OPTIONS = [
	{ label: __( 'Bullets', 'vulopilot' ), value: 'disc' },
	{ label: __( 'Numbers', 'vulopilot' ), value: 'decimal' },
	{ label: __( 'Hierarchical numbers', 'vulopilot' ), value: 'hierarchical' },
	{ label: __( 'None', 'vulopilot' ), value: 'none' },
];

const HEADING_LEVELS = [ 1, 2, 3, 4, 5, 6 ];

/**
 * One real tree node - itself, then its own children, recursively. The one shared shape both the
 * nested-list render below and the flat-list render build from, so a flat vs. nested toggle never
 * needs two independent heading-walk implementations.
 */
function TocNode( { node, nested } ) {
	return (
		<li className={ `vulopilot-toc-item vulopilot-toc-item--level-${ node.level }` }>
			<a href={ `#${ headingKey( node ) }` } onClick={ ( event ) => event.preventDefault() }>
				{ node.number && (
					<span className="vulopilot-toc-number">{ node.number }</span>
				) }
				{ node.text }
			</a>
			{ nested && node.children.length > 0 && (
				<ul className="vulopilot-toc-list vulopilot-toc-sublist">
					{ node.children.map( ( child ) => (
						<TocNode key={ headingKey( child ) } node={ child } nested={ nested } />
					) ) }
				</ul>
			) }
		</li>
	);
}

/**
 * Builds the real `<ul>` (nested or flat) a set of already-filtered headings renders as - the one
 * shared renderer behind both the real-heading preview and the sample preview below, so the two
 * can never visually drift.
 */
function TocList( { headings, nestedList, markerStyle } ) {
	const hierarchical = 'hierarchical' === markerStyle;

	if ( nestedList ) {
		const tree = buildHeadingTree( headings );
		if ( hierarchical ) {
			assignHierarchicalNumbers( tree );
		}
		return (
			<ul className="vulopilot-toc-list">
				{ tree.map( ( node ) => (
					<TocNode key={ headingKey( node ) } node={ node } nested />
				) ) }
			</ul>
		);
	}

	// Flat list - every heading at the same `<li>` depth, indented purely visually by its own
	// `--item-level-N` CSS rule, same as before this rewrite. Hierarchical numbering has no real
	// parent/child shape to read here, so it falls back to a plain sequential count.
	return (
		<ul className="vulopilot-toc-list">
			{ headings.map( ( heading, index ) => (
				<li
					key={ headingKey( heading ) }
					className={ `vulopilot-toc-item vulopilot-toc-item--level-${ heading.level }` }
				>
					<a href={ `#${ headingKey( heading ) }` } onClick={ ( event ) => event.preventDefault() }>
						{ hierarchical && (
							<span className="vulopilot-toc-number">{ index + 1 }</span>
						) }
						{ heading.text }
					</a>
				</li>
			) ) }
		</ul>
	);
}

registerBlockType( metadata.name, {
	edit: ( { attributes, setAttributes } ) => {
		const {
			title,
			showTitle,
			includedLevels,
			minLevel,
			maxLevel,
			excludedHeadings,
			nestedList,
			collapsible,
			collapseInitialState,
			smoothScroll,
			scrollOffset,
			contentFontSize,
			contentColor,
			contentLineHeight,
			contentListStyle,
			contentGap,
			titleFontSize,
			titleColor,
			titleLineHeight,
			titlePadding,
			titleMargin,
			sectionBackground,
			sectionPadding,
			sectionMargin,
		} = attributes;

		const styleVars = buildTocStyleVars( {
			...attributes,
			// 'hierarchical' isn't a real CSS `list-style-type` - the numbers render as literal
			// text instead (`TocNode`/`TocList` above), so the native marker is hidden either way.
			contentListStyle:
				'hierarchical' === contentListStyle ? 'none' : contentListStyle,
		} );
		const blockProps = useBlockProps( {
			className: nestedList
				? 'vulopilot-toc vulopilot-toc--nested'
				: 'vulopilot-toc',
			style: styleVars,
		} );

		const realHeadings = useSelect(
			( select ) => collectHeadings( select( 'core/block-editor' ).getBlocks() ),
			[]
		);

		const usingSample = 0 === realHeadings.length;
		const headings = filterHeadings( usingSample ? SAMPLE_HEADINGS : realHeadings, {
			includedLevels,
			minLevel,
			maxLevel,
			excludedHeadings,
		} );

		const effectiveIncludedLevels =
			includedLevels.length > 0
				? includedLevels
				: HEADING_LEVELS.filter(
						( level ) => level >= minLevel && level <= maxLevel
					);

		const toggleIncludedLevel = ( level, checked ) => {
			const next = checked
				? [ ...effectiveIncludedLevels, level ]
				: effectiveIncludedLevels.filter( ( value ) => value !== level );
			setAttributes( { includedLevels: next.sort() } );
		};

		// Every real heading currently on the page (unfiltered by level, so a level this
		// instance has excluded from the list can still be toggled back on here) - exclusions
		// are keyed by `headingKey()` (level+text), not the final anchor (see headingTree.js's
		// own docblock for why).
		const allRealHeadings = usingSample ? [] : realHeadings;

		return (
			<>
				<InspectorControls>
					<PanelBody
						title={ __( 'Table of Contents Settings', 'vulopilot' ) }
					>
						<ToggleControl
							label={ __( 'Show title', 'vulopilot' ) }
							checked={ showTitle }
							onChange={ ( value ) =>
								setAttributes( { showTitle: value } )
							}
						/>
						{ showTitle && (
							<TextControl
								label={ __( 'Title', 'vulopilot' ) }
								value={ title }
								onChange={ ( value ) =>
									setAttributes( { title: value } )
								}
							/>
						) }

						<p className="vulopilot-toc-field-label">
							{ __( 'Included heading levels', 'vulopilot' ) }
						</p>
						<div className="vulopilot-toc-level-checkboxes">
							{ HEADING_LEVELS.map( ( level ) => (
								<CheckboxControl
									key={ level }
									label={ `H${ level }` }
									checked={ effectiveIncludedLevels.includes( level ) }
									onChange={ ( checked ) =>
										toggleIncludedLevel( level, checked )
									}
								/>
							) ) }
						</div>

						<ToggleControl
							label={ __( 'Nested list', 'vulopilot' ) }
							help={
								nestedList
									? __(
											'Sub-headings indent under their own parent heading.',
											'vulopilot'
										)
									: __(
											'Every heading listed at the same level.',
											'vulopilot'
										)
							}
							checked={ nestedList }
							onChange={ ( value ) =>
								setAttributes( { nestedList: value } )
							}
						/>
						<SelectControl
							label={ __( 'Marker style', 'vulopilot' ) }
							value={ contentListStyle }
							options={ LIST_STYLE_OPTIONS }
							onChange={ ( value ) =>
								setAttributes( { contentListStyle: value } )
							}
						/>

						<ToggleControl
							label={ __( 'Collapsible', 'vulopilot' ) }
							checked={ collapsible }
							onChange={ ( value ) =>
								setAttributes( { collapsible: value } )
							}
						/>
						{ collapsible && (
							<SelectControl
								label={ __( 'Initial state', 'vulopilot' ) }
								value={ collapseInitialState }
								options={ [
									{ label: __( 'Expanded', 'vulopilot' ), value: 'expanded' },
									{ label: __( 'Collapsed', 'vulopilot' ), value: 'collapsed' },
								] }
								onChange={ ( value ) =>
									setAttributes( { collapseInitialState: value } )
								}
							/>
						) }

						<ToggleControl
							label={ __( 'Smooth scrolling', 'vulopilot' ) }
							checked={ smoothScroll }
							onChange={ ( value ) =>
								setAttributes( { smoothScroll: value } )
							}
						/>
						{ smoothScroll && (
							<RangeControl
								label={ __(
									'Scroll offset (px, for a sticky site header)',
									'vulopilot'
								) }
								value={ scrollOffset }
								min={ 0 }
								max={ 300 }
								onChange={ ( value ) =>
									setAttributes( { scrollOffset: value ?? 0 } )
								}
							/>
						) }

						{ allRealHeadings.length > 0 && (
							<>
								<p className="vulopilot-toc-field-label">
									{ __( 'Exclude specific headings', 'vulopilot' ) }
								</p>
								{ allRealHeadings.map( ( heading ) => {
									const key = headingKey( heading );
									return (
										<CheckboxControl
											key={ key }
											label={ `H${ heading.level } — ${ heading.text }` }
											checked={ ! excludedHeadings.includes( key ) }
											onChange={ ( checked ) =>
												setAttributes( {
													excludedHeadings: checked
														? excludedHeadings.filter(
																( value ) => value !== key
															)
														: [ ...excludedHeadings, key ],
												} )
											}
										/>
									);
								} ) }
							</>
						) }
					</PanelBody>

					{ /* 1. Content style - the heading list itself: font, color, line height, and the gap
					between items (marker style moved into the main settings panel above, next to
					nested-list). Per direct instruction, a separate collapsible panel from the title/
					section ones below. */ }
					<PanelBody
						title={ __( 'Content Style', 'vulopilot' ) }
						initialOpen={ false }
					>
						<UnitControl
							label={ __( 'Font size', 'vulopilot' ) }
							value={ contentFontSize }
							onChange={ ( value ) =>
								setAttributes( { contentFontSize: value ?? '' } )
							}
						/>
						<RangeControl
							label={ __( 'Line height', 'vulopilot' ) }
							value={ contentLineHeight }
							min={ 1 }
							max={ 3 }
							step={ 0.1 }
							onChange={ ( value ) =>
								setAttributes( { contentLineHeight: value } )
							}
						/>
						<UnitControl
							label={ __( 'Gap between items', 'vulopilot' ) }
							value={ contentGap }
							onChange={ ( value ) =>
								setAttributes( { contentGap: value ?? '' } )
							}
						/>
						<PanelColorSettings
							title={ __( 'Color', 'vulopilot' ) }
							initialOpen={ false }
							colorSettings={ [
								{
									value: contentColor,
									onChange: ( value ) =>
										setAttributes( {
											contentColor: value ?? '',
										} ),
									label: __( 'Text color', 'vulopilot' ),
								},
							] }
						/>
					</PanelBody>

					{ /* 2. Title style - the "Table of Contents" heading line above the list. */ }
					<PanelBody
						title={ __( 'Title Style', 'vulopilot' ) }
						initialOpen={ false }
					>
						<UnitControl
							label={ __( 'Font size', 'vulopilot' ) }
							value={ titleFontSize }
							onChange={ ( value ) =>
								setAttributes( { titleFontSize: value ?? '' } )
							}
						/>
						<RangeControl
							label={ __( 'Line height', 'vulopilot' ) }
							value={ titleLineHeight }
							min={ 1 }
							max={ 3 }
							step={ 0.1 }
							onChange={ ( value ) =>
								setAttributes( { titleLineHeight: value } )
							}
						/>
						<PanelColorSettings
							title={ __( 'Color', 'vulopilot' ) }
							initialOpen={ false }
							colorSettings={ [
								{
									value: titleColor,
									onChange: ( value ) =>
										setAttributes( {
											titleColor: value ?? '',
										} ),
									label: __( 'Text color', 'vulopilot' ),
								},
							] }
						/>
						<BoxControl
							label={ __( 'Padding', 'vulopilot' ) }
							values={ titlePadding }
							onChange={ ( value ) =>
								setAttributes( { titlePadding: value } )
							}
						/>
						<BoxControl
							label={ __( 'Margin', 'vulopilot' ) }
							values={ titleMargin }
							onChange={ ( value ) =>
								setAttributes( { titleMargin: value } )
							}
						/>
					</PanelBody>

					{ /* 3. Section style - the whole block's own outer box. */ }
					<PanelBody
						title={ __( 'Section Style', 'vulopilot' ) }
						initialOpen={ false }
					>
						<PanelColorSettings
							title={ __( 'Background', 'vulopilot' ) }
							initialOpen={ true }
							colorSettings={ [
								{
									value: sectionBackground,
									onChange: ( value ) =>
										setAttributes( {
											sectionBackground: value ?? '',
										} ),
									label: __(
										'Background color',
										'vulopilot'
									),
								},
							] }
						/>
						<BoxControl
							label={ __( 'Padding', 'vulopilot' ) }
							values={ sectionPadding }
							onChange={ ( value ) =>
								setAttributes( { sectionPadding: value } )
							}
						/>
						<BoxControl
							label={ __( 'Margin', 'vulopilot' ) }
							values={ sectionMargin }
							onChange={ ( value ) =>
								setAttributes( { sectionMargin: value } )
							}
						/>
					</PanelBody>
				</InspectorControls>
				<nav { ...blockProps }>
					{ usingSample && (
						<Notice status="info" isDismissible={ false }>
							{ __(
								'Add headings to your page to generate its table of contents. The list below is a sample so you can still style this block.',
								'vulopilot'
							) }
						</Notice>
					) }
					{ showTitle && (
						<p className="vulopilot-toc-title">
							{ title }
							{ collapsible && (
								<i className="adminfont-keyboard-arrow-down vulopilot-toc-toggle-icon" />
							) }
						</p>
					) }
					{ 0 === headings.length ? (
						<p className="vulopilot-toc-empty">
							{ __(
								'No headings match the current level/exclusion settings.',
								'vulopilot'
							) }
						</p>
					) : (
						<TocList
							headings={ headings }
							nestedList={ nestedList }
							markerStyle={ contentListStyle }
						/>
					) }
					{ usingSample && (
						<p className="vulopilot-toc-sample-label small desc">
							{ __( 'Sample preview - not saved to this post.', 'vulopilot' ) }
						</p>
					) }
				</nav>
			</>
		);
	},

	// Dynamic block - render.php builds all real frontend markup (and the
	// real per-page anchor ids), so save() persists nothing.
	save: () => null,
} );
