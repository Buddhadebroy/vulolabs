import { __ } from '@wordpress/i18n';
import { Button, TextControl, TextareaControl, ToggleControl } from '@wordpress/components';
import { useState } from '@wordpress/element';
import type { ComponentType } from 'react';
import { usePostData } from '../usePostData';
import SnippetPreview from '../SnippetPreview';
import { useFieldHighlight } from '../useFieldHighlight';
import { useFilterSlot } from '../../services/useFilterSlot';

interface GeneralTabProps {
	/** "All SEO Issues" table's "Fix with AI" deep link - currently only ever resolves to 'canonical_url' on this tab (see seoIssueEditorTarget.ts). */
	highlightTarget?: string;
	/** `PostSeoPanel.tsx`'s own in-sidebar tab switch - accepted for prop-shape parity with every other tab, unused here. */
	// eslint-disable-next-line no-unused-vars
	onNavigate?: ( tab: string, target?: string ) => void;
}

/**
 * The metabox's General tab - focus keyword, SEO title (native `post_title`), meta description
 * (native `post_excerpt`), a live snippet preview.
 */
export default function GeneralTab( { highlightTarget }: GeneralTabProps ) {
	const { postId, title, excerpt, slug, meta, setTitle, setExcerpt, setMeta } = usePostData();
	const { metaKeys, shopUrl } = window.vulopilotPostSeo;
	const canonicalUrl = ( meta[ metaKeys.canonical_url ] as string ) || '';
	const noindex = Boolean( meta[ metaKeys.robots_noindex ] );
	const nofollow = Boolean( meta[ metaKeys.robots_nofollow ] );
	const isCanonicalHighlighted = useFieldHighlight( highlightTarget, 'canonical_url' );
	// Stored as one comma-separated string (PostSeoMetaFields::split_keywords()'s own docblock) -
	// the first is the "primary" keyword every check on the Page Analysis tab scores against,
	// same primary/additional distinction Rank Math's own focus keyword field uses.
	const focusKeywordRaw = ( meta[ window.vulopilotPostSeo.metaKeys.focus_keyword ] as string ) || '';
	const focusKeywords = focusKeywordRaw
		.split( ',' )
		.map( ( keyword ) => keyword.trim() )
		.filter( Boolean );

	const [ isEditingSnippet, setIsEditingSnippet ] = useState( false );
	const [ isAddingKeyword, setIsAddingKeyword ] = useState( false );
	const [ keywordDraft, setKeywordDraft ] = useState( '' );

	/** vulopilot-pro's own "Suggest Titles" button + popup. */
	const SuggestTitlesButton = useFilterSlot< ComponentType< { postId: number; onApply: ( title: string ) => void } > >(
		'vulopilot_seo_title_suggestions_button'
	);

	const startAddingKeyword = () => {
		setKeywordDraft( '' );
		setIsAddingKeyword( true );
	};

	const saveKeywords = ( keywords: string[] ) =>
		setMeta( { [ window.vulopilotPostSeo.metaKeys.focus_keyword ]: keywords.join( ', ' ) } );

	const commitKeywordDraft = () => {
		const value = keywordDraft.trim();

		// Case-insensitive de-dupe - re-typing the same keyword shouldn't add a second pill.
		if ( value && ! focusKeywords.some( ( keyword ) => keyword.toLowerCase() === value.toLowerCase() ) ) {
			saveKeywords( [ ...focusKeywords, value ] );
		}

		setKeywordDraft( '' );
		setIsAddingKeyword( false );
	};

	const removeKeyword = ( index: number ) =>
		saveKeywords( focusKeywords.filter( ( _keyword, i ) => i !== index ) );

	return (
		<div className="vulopilot-seo-tab vulopilot-seo-tab--general">
			<div className="vulopilot-seo-section-label">{ __( 'Preview', 'vulopilot' ) }</div>

			<SnippetPreview
				title={ title }
				description={ excerpt }
				url={ window.location.origin + '/' + slug }
				siteName={ document.title.split( '‹' ).pop()?.trim() || '' }
			/>

			<Button
				variant="secondary"
				size="small"
				className="vulopilot-seo-edit-snippet-toggle"
				onClick={ () => setIsEditingSnippet( ( open ) => ! open ) }
				aria-expanded={ isEditingSnippet }
			>
				{ isEditingSnippet
					? __( 'Close Snippet Editor', 'vulopilot' )
					: __( 'Edit Snippet', 'vulopilot' ) }
			</Button>

			{ isEditingSnippet && (
				<div className="vulopilot-seo-snippet-editor">
					<TextControl
						label={ __( 'SEO Title', 'vulopilot' ) }
						help={ __( 'This is the page title - shown in search results and used as the page heading.', 'vulopilot' ) + ` (${ title.length }/60)` }
						value={ title }
						onChange={ setTitle }
					/>

					{ SuggestTitlesButton ? (
						<SuggestTitlesButton postId={ postId } onApply={ setTitle } />
					) : (
						<Button
							variant="tertiary"
							size="small"
							className="vulopilot-seo-suggest-titles-toggle"
							href={ shopUrl }
							target="_blank"
							rel="noreferrer"
						>
							{ __( 'Suggest Titles (Upgrade to unlock)', 'vulopilot' ) }
						</Button>
					) }

					<TextareaControl
						label={ __( 'Meta Description', 'vulopilot' ) }
						help={ __( 'Shown as the description snippet in search results.', 'vulopilot' ) + ` (${ excerpt.length }/160)` }
						value={ excerpt }
						onChange={ setExcerpt }
						rows={ 3 }
					/>
				</div>
			) }

			<div className="vulopilot-seo-section-label">{ __( 'Focus Keyword', 'vulopilot' ) }</div>
			<p className="small desc vulopilot-seo-focus-keyword-help">
				{ __( 'The terms you want this page to rank for. The first (primary) keyword drives the checks on the Page Analysis tab - the rest are tracked alongside it.', 'vulopilot' ) }
			</p>

			<div className="vulopilot-seo-focus-keyword">
				{ focusKeywords.map( ( keyword, index ) => (
					<span
						key={ `${ keyword }-${ index }` }
						className={ `vulopilot-seo-keyword-pill${ 0 === index ? ' vulopilot-seo-keyword-pill--primary' : '' }` }
					>
						{ 0 === index && <i className="dashicons dashicons-star-filled" /> }
						{ keyword }
						<button
							type="button"
							className="vulopilot-seo-keyword-pill__remove"
							aria-label={ __( 'Remove focus keyword', 'vulopilot' ) }
							onClick={ () => removeKeyword( index ) }
						>
							<i className="dashicons dashicons-no-alt" />
						</button>
					</span>
				) ) }

				{ isAddingKeyword ? (
					<TextControl
						autoFocus
						value={ keywordDraft }
						placeholder={
							0 === focusKeywords.length
								? __( 'Add a focus keyword…', 'vulopilot' )
								: __( 'Add another keyword…', 'vulopilot' )
						}
						onChange={ setKeywordDraft }
						onKeyDown={ ( event ) => {
							if ( 'Enter' === event.key || ',' === event.key ) {
								event.preventDefault();
								commitKeywordDraft();
								setIsAddingKeyword( true );
							}

							if ( 'Escape' === event.key ) {
								setKeywordDraft( '' );
								setIsAddingKeyword( false );
							}
						} }
						onBlur={ commitKeywordDraft }
					/>
				) : (
					<Button variant="tertiary" size="small" icon="plus-alt2" onClick={ startAddingKeyword }>
						{ __( 'Add Focus Keyword', 'vulopilot' ) }
					</Button>
				) }
			</div>

			<div className="vulopilot-seo-section-label">{ __( 'Robots & Canonical', 'vulopilot' ) }</div>

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
