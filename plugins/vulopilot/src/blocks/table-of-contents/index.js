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
	BoxControl,
	__experimentalUnitControl as UnitControl,
} from '@wordpress/components';
import metadata from './block.json';
import { buildTocStyleVars } from './styleVars';

/**
 * Editor-side mirror of PHP's HeadingAnchorResolver::collect(): text and level only. Anchors matter
 * only on the published page, computed by render.php so TOC links and heading ids can't drift.
 */
function collectHeadings( blocks, minLevel, maxLevel ) {
	let headings = [];

	blocks.forEach( ( block ) => {
		if ( block.name === 'core/heading' ) {
			const level = block.attributes.level || 2;
			// core/heading's `content` comes back from getBlocks() as a RichTextData object, not a string.
			// String() gives its plain text rather than letting an object reach JSX.
			const text = String( block.attributes.content ?? '' );

			if (
				level >= minLevel &&
				level <= maxLevel &&
				text.trim() !== ''
			) {
				headings.push( { level, text } );
			}
		}

		if ( block.innerBlocks && block.innerBlocks.length ) {
			headings = headings.concat(
				collectHeadings( block.innerBlocks, minLevel, maxLevel )
			);
		}
	} );

	return headings;
}

const LIST_STYLE_OPTIONS = [
	{ label: __( 'Dotted', 'vulopilot' ), value: 'disc' },
	{ label: __( 'Numeric', 'vulopilot' ), value: 'decimal' },
	{ label: __( 'None', 'vulopilot' ), value: 'none' },
];

registerBlockType( metadata.name, {
	edit: ( { attributes, setAttributes } ) => {
		const {
			title,
			minLevel,
			maxLevel,
			collapsible,
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

		const styleVars = buildTocStyleVars( attributes );
		const blockProps = useBlockProps( {
			className: 'vulopilot-toc',
			style: styleVars,
		} );

		const headings = useSelect(
			( select ) =>
				collectHeadings(
					select( 'core/block-editor' ).getBlocks(),
					minLevel,
					maxLevel
				),
			[ minLevel, maxLevel ]
		);

		return (
			<>
				<InspectorControls>
					<PanelBody
						title={ __(
							'Table of Contents Settings',
							'vulopilot'
						) }
					>
						<TextControl
							label={ __( 'Title', 'vulopilot' ) }
							value={ title }
							onChange={ ( value ) =>
								setAttributes( { title: value } )
							}
						/>
						<RangeControl
							label={ __(
								'Minimum heading level',
								'vulopilot'
							) }
							value={ minLevel }
							min={ 2 }
							max={ 6 }
							onChange={ ( value ) =>
								setAttributes( { minLevel: value } )
							}
						/>
						<RangeControl
							label={ __(
								'Maximum heading level',
								'vulopilot'
							) }
							value={ maxLevel }
							min={ 2 }
							max={ 6 }
							onChange={ ( value ) =>
								setAttributes( { maxLevel: value } )
							}
						/>
						<ToggleControl
							label={ __( 'Collapsible', 'vulopilot' ) }
							checked={ collapsible }
							onChange={ ( value ) =>
								setAttributes( { collapsible: value } )
							}
						/>
					</PanelBody>

					{ /* 1. Content style - the heading list itself: font, color, line height, list
					marker (dotted/numeric/none), and the gap between items. Per direct
					instruction, a separate collapsible panel from the title/section ones below. */ }
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
						<SelectControl
							label={ __( 'List style', 'vulopilot' ) }
							value={ contentListStyle }
							options={ LIST_STYLE_OPTIONS }
							onChange={ ( value ) =>
								setAttributes( { contentListStyle: value } )
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
					<p className="vulopilot-toc-title">{ title }</p>
					{ headings.length === 0 ? (
						<p className="vulopilot-toc-empty">
							{ __(
								'No headings found yet - add some Heading blocks to this post.',
								'vulopilot'
							) }
						</p>
					) : (
						<ul className="vulopilot-toc-list">
							{ headings.map( ( heading, index ) => (
								<li
									key={ index }
									className={ `vulopilot-toc-item vulopilot-toc-item--level-${ heading.level }` }
								>
									{ heading.text }
								</li>
							) ) }
						</ul>
					) }
				</nav>
			</>
		);
	},

	// Dynamic block - render.php builds all real frontend markup (and the
	// real per-page anchor ids), so save() persists nothing.
	save: () => null,
} );
