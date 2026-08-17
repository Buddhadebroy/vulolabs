import { __ } from '@wordpress/i18n';
import { TextControl, ToggleControl } from '@wordpress/components';
import { usePostData } from '../usePostData';
import { useFieldHighlight } from '../useFieldHighlight';

interface AdvancedTabProps {
	/** "All SEO Issues" table's "Fix with AI" deep link — currently only ever resolves to 'canonical_url' on this tab (see seoIssueEditorTarget.ts). */
	highlightTarget?: string;
}

/**
 * The metabox's Advanced tab — a per-post canonical URL override
 * (Services\CanonicalUrlManager::maybe_override_canonical(), which filters
 * WP core's own `get_canonical_url` directly, so it takes effect
 * regardless of the sitewide "Add canonical URL tags" setting) and
 * noindex/nofollow (Services\PostRobotsMetaManager's `wp_robots` filter).
 */
export default function AdvancedTab( { highlightTarget }: AdvancedTabProps ) {
	const { slug, meta, setMeta } = usePostData();
	const { metaKeys } = window.vulopilotPostSeo;

	const canonicalUrl = ( meta[ metaKeys.canonical_url ] as string ) || '';
	const noindex = Boolean( meta[ metaKeys.robots_noindex ] );
	const nofollow = Boolean( meta[ metaKeys.robots_nofollow ] );

	const isCanonicalHighlighted = useFieldHighlight( highlightTarget, 'canonical_url' );

	return (
		<div className="vulopilot-seo-tab vulopilot-seo-tab--advanced">
			<div
				id="vulopilot-seo-field-canonical_url"
				className={ isCanonicalHighlighted ? 'vulopilot-seo-highlight-pulse' : undefined }
			>
				<TextControl
					label={ __( 'Canonical URL', 'vulopilot' ) }
					help={ __( 'Leave empty to use this page\'s own permalink (the default WordPress already uses).', 'vulopilot' ) }
					placeholder={ window.location.origin + '/' + slug }
					value={ canonicalUrl }
					onChange={ ( value ) => setMeta( { [ metaKeys.canonical_url ]: value } ) }
				/>
			</div>

			<ToggleControl
				label={ __( 'No Index', 'vulopilot' ) }
				help={ __( 'Tell search engines not to show this page in search results.', 'vulopilot' ) }
				checked={ noindex }
				onChange={ ( value ) => setMeta( { [ metaKeys.robots_noindex ]: value } ) }
			/>

			<ToggleControl
				label={ __( 'No Follow', 'vulopilot' ) }
				help={ __( 'Tell search engines not to follow links on this page.', 'vulopilot' ) }
				checked={ nofollow }
				onChange={ ( value ) => setMeta( { [ metaKeys.robots_nofollow ]: value } ) }
			/>
		</div>
	);
}
