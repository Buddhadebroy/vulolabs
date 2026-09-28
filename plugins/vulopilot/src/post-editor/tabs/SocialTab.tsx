import { __ } from '@wordpress/i18n';
import { TextControl, TextareaControl, Button } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { usePostData } from '../usePostData';
import { useFieldHighlight } from '../useFieldHighlight';

// window.wp.media() has no shipped type definitions.
type MediaFrame = any;

interface SocialTabProps {
	/** "All SEO Issues" table's "Fix with AI" deep link. */
	highlightTarget?: string;
	/** `PostSeoPanel.tsx`'s own in-sidebar tab switch - accepted for prop-shape parity with every other tab, unused here. */
	onNavigate?: ( tab: string, target?: string ) => void;
}

/**
 * The metabox's Social tab - per-post Open Graph/Twitter Card overrides.
 */
export default function SocialTab( { highlightTarget }: SocialTabProps ) {
	const { meta, setMeta } = usePostData();
	const { metaKeys } = window.vulopilotPostSeo;

	const socialTitle = ( meta[ metaKeys.social_title ] as string ) || '';
	const socialDescription = ( meta[ metaKeys.social_description ] as string ) || '';
	const socialImageId = Number( meta[ metaKeys.social_image_id ] ) || 0;

	const [ previewUrl, setPreviewUrl ] = useState< string >( '' );

	const isSocialTitleHighlighted = useFieldHighlight( highlightTarget, 'social_title' );

	const openMediaPicker = () => {
		/* eslint-disable-next-line no-unused-vars */
		const wp = ( window as unknown as { wp: { media: ( args: Record< string, unknown > ) => MediaFrame } } ).wp;

		if ( ! wp?.media ) {
			return;
		}

		const frame: MediaFrame = wp.media( {
			title: __( 'Choose a social sharing image', 'vulopilot' ),
			multiple: false,
			library: { type: 'image' },
		} );

		frame.on( 'select', () => {
			const attachment = frame.state().get( 'selection' ).first().toJSON();
			setMeta( { [ metaKeys.social_image_id ]: attachment.id } );
			setPreviewUrl( attachment.url );
		} );

		frame.open();
	};

	const removeImage = () => {
		setMeta( { [ metaKeys.social_image_id ]: 0 } );
		setPreviewUrl( '' );
	};

	return (
		<div className="vulopilot-seo-tab vulopilot-seo-tab--social">
			<div
				id="vulopilot-seo-field-social_title"
				className={ isSocialTitleHighlighted ? 'vulopilot-seo-highlight-pulse' : undefined }
			>
				<TextControl
					label={ __( 'Social Title', 'vulopilot' ) }
					help={ __( 'Leave empty to use the SEO title.', 'vulopilot' ) }
					value={ socialTitle }
					onChange={ ( value ) => setMeta( { [ metaKeys.social_title ]: value } ) }
				/>
			</div>

			<TextareaControl
				label={ __( 'Social Description', 'vulopilot' ) }
				help={ __( 'Leave empty to use the meta description.', 'vulopilot' ) }
				value={ socialDescription }
				onChange={ ( value ) => setMeta( { [ metaKeys.social_description ]: value } ) }
				rows={ 3 }
			/>

			<div className="vulopilot-seo-social-image">
				<label>{ __( 'Social Image', 'vulopilot' ) }</label>
				{ ( previewUrl || socialImageId > 0 ) && previewUrl && (
					<img src={ previewUrl } alt="" className="vulopilot-seo-social-image__preview" />
				) }
				<div className="vulopilot-seo-social-image__actions">
					<Button variant="secondary" onClick={ openMediaPicker }>
						{ socialImageId > 0 ? __( 'Replace Image', 'vulopilot' ) : __( 'Choose Image', 'vulopilot' ) }
					</Button>
					{ socialImageId > 0 && (
						<Button variant="tertiary" isDestructive onClick={ removeImage }>
							{ __( 'Remove', 'vulopilot' ) }
						</Button>
					) }
				</div>
				<div className="desc vulopilot-seo-social-image__help">
					{ __( 'Leave empty to use the featured image.', 'vulopilot' ) }
				</div>
			</div>
		</div>
	);
}
