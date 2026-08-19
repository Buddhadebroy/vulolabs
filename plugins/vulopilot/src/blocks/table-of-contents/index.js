import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import {
	PanelBody,
	TextControl,
	RangeControl,
	ToggleControl,
} from '@wordpress/components';
import metadata from './block.json';

/**
 * Live editor-side mirror of PHP's HeadingAnchorResolver::collect() — text
 * and level only (no anchor/slug logic needed here, real anchors only
 * matter on the published page, computed server-side by render.php so the
 * TOC's own links and the real heading ids can never drift apart).
 */
function collectHeadings( blocks, minLevel, maxLevel ) {
	let headings = [];

	blocks.forEach( ( block ) => {
		if ( block.name === 'core/heading' ) {
			const level = block.attributes.level || 2;
			// core/heading's `content` attribute is a rich-text-sourced
			// value — WordPress hands it back as a RichTextData object
			// (not a plain string) when read this way via getBlocks(),
			// not through <RichText>'s own value/onChange plumbing.
			// String() calls its real toString() (plain text, formatting
			// stripped) rather than letting an object reach JSX directly.
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

registerBlockType( metadata.name, {
	edit: ( { attributes, setAttributes } ) => {
		const { title, minLevel, maxLevel, collapsible } = attributes;
		const blockProps = useBlockProps( { className: 'vulopilot-toc' } );

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
				</InspectorControls>
				<nav { ...blockProps }>
					<p className="vulopilot-toc__title">{ title }</p>
					{ headings.length === 0 ? (
						<p className="vulopilot-toc__empty">
							{ __(
								'No headings found yet — add some Heading blocks to this post.',
								'vulopilot'
							) }
						</p>
					) : (
						<ul className="vulopilot-toc__list">
							{ headings.map( ( heading, index ) => (
								<li
									key={ index }
									className={ `vulopilot-toc__item vulopilot-toc__item--level-${ heading.level }` }
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

	// Dynamic block — render.php builds all real frontend markup (and the
	// real per-page anchor ids), so save() persists nothing.
	save: () => null,
} );
