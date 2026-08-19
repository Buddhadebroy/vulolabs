import { __ } from '@wordpress/i18n';
import { Button, TextControl, TextareaControl } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { usePostData } from '../usePostData';
import SnippetPreview from '../SnippetPreview';
import Checklist from '../Checklist';
import { analyzePost, AnalysisResult, FixResponse } from '../api';

const GROUP_LABELS: Record< AnalysisResult[ 'group' ], string > = {
	basic: __( 'Basic SEO', 'vulopilot' ),
	additional: __( 'Additional', 'vulopilot' ),
	title_readability: __( 'Title Readability', 'vulopilot' ),
};

interface GeneralTabProps {
	/** "All SEO Issues" table's "Fix with AI" deep link — an OnPageAnalyzer check id (e.g. 'description_length') to scroll to and highlight once the checklist below has (re-)computed it. */
	highlightTarget?: string;
}

/**
 * The metabox's General tab — focus keyword, SEO title (native
 * `post_title`), meta description (native `post_excerpt`), a live snippet
 * preview, and Services\OnPageAnalyzer's checklist. Analysis re-runs on a
 * short debounce as the editor's title/excerpt/content/focus keyword
 * change — it has to run against LIVE, possibly-unsaved editor state
 * (this class's own PHP counterpart's docblock explains why that's a
 * POST-with-body rather than reading the stored post).
 *
 * Section order/shape mirrors RankMath's own General tab (per direct
 * screenshot comparison): Preview first with the title/description fields
 * tucked behind an "Edit Snippet" toggle rather than always visible, then
 * Focus Keyword as a removable pill rather than a plain text field, then
 * the grouped checklist. Deliberately NOT cloned 1:1 though — RankMath's
 * own focus keyword is a genuine multi-keyword field (several independent
 * pills, each separately graded) and has a "This post is Pillar Content"
 * checkbox; VuloPilot's Services\OnPageAnalyzer only ever grades ONE
 * `_vulopilot_focus_keyword` string end to end (title/description/content
 * checks below all read a single value), and there's no pillar-content
 * concept anywhere in this codebase (RankMath's own version feeds its
 * internal-linking suggestions, which VuloPilot has no equivalent of) — so
 * this keeps the single-keyword pill honestly wired to that one real
 * field instead of building a multi-pill input with no backing analysis,
 * and leaves the checkbox out rather than adding a control that would do
 * nothing.
 */
export default function GeneralTab( { highlightTarget }: GeneralTabProps ) {
	const { postId, title, excerpt, slug, content, meta, setTitle, setExcerpt, setMeta } = usePostData();
	const focusKeyword = ( meta[ window.vulopilotPostSeo.metaKeys.focus_keyword ] as string ) || '';

	const [ results, setResults ] = useState< AnalysisResult[] >( [] );
	const [ analyzing, setAnalyzing ] = useState( false );
	const [ isEditingSnippet, setIsEditingSnippet ] = useState( false );
	const [ isAddingKeyword, setIsAddingKeyword ] = useState( false );
	const [ keywordDraft, setKeywordDraft ] = useState( '' );

	useEffect( () => {
		let cancelled = false;
		setAnalyzing( true );

		const timeout = setTimeout( () => {
			analyzePost( postId, { title, content, excerpt, slug, focus_keyword: focusKeyword } )
				.then( ( response ) => {
					if ( ! cancelled ) {
						setResults( response.results );
					}
				} )
				.catch( () => {
					// A failed analysis call just leaves the previous
					// checklist showing — not worth surfacing as an error,
					// it re-runs automatically on the next edit.
				} )
				.finally( () => {
					if ( ! cancelled ) {
						setAnalyzing( false );
					}
				} );
		}, 600 );

		return () => {
			cancelled = true;
			clearTimeout( timeout );
		};
	}, [ postId, title, excerpt, slug, content, focusKeyword ] );

	const handleFixed = ( actionId: string, response: FixResponse ) => {
		if ( ! response.post ) {
			return;
		}

		if ( 'write-meta-title' === actionId ) {
			setTitle( response.post.title );
		}

		if ( 'write-meta-description' === actionId ) {
			setExcerpt( response.post.excerpt );
		}

		// improve-readability/add-subheadings rewrite post_content on the
		// server — deliberately NOT live-synced into the open editor's
		// block canvas (that would mean re-parsing HTML into blocks under
		// an actively-edited post, risking clobbering an in-progress edit
		// or the undo stack). The write already happened and is real;
		// reloading the editor is what picks it up.
	};

	const byGroup = ( group: AnalysisResult[ 'group' ] ) => results.filter( ( result ) => result.group === group );

	const startAddingKeyword = () => {
		setKeywordDraft( '' );
		setIsAddingKeyword( true );
	};

	const commitKeywordDraft = () => {
		const value = keywordDraft.trim();

		if ( value ) {
			setMeta( { [ window.vulopilotPostSeo.metaKeys.focus_keyword ]: value } );
		}

		setIsAddingKeyword( false );
	};

	const removeKeyword = () =>
		setMeta( { [ window.vulopilotPostSeo.metaKeys.focus_keyword ]: '' } );

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
						help={ __( 'This is the page title — shown in search results and used as the page heading.', 'vulopilot' ) + ` (${ title.length }/60)` }
						value={ title }
						onChange={ setTitle }
					/>

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
				{ __( 'The main term you want this page to rank for — drives the checks below.', 'vulopilot' ) }
			</p>

			<div className="vulopilot-seo-focus-keyword">
				{ focusKeyword && (
					<span className="vulopilot-seo-keyword-pill">
						<i className="dashicons dashicons-star-filled" />
						{ focusKeyword }
						<button
							type="button"
							className="vulopilot-seo-keyword-pill__remove"
							aria-label={ __( 'Remove focus keyword', 'vulopilot' ) }
							onClick={ removeKeyword }
						>
							<i className="dashicons dashicons-no-alt" />
						</button>
					</span>
				) }

				{ ! focusKeyword && isAddingKeyword && (
					<TextControl
						autoFocus
						value={ keywordDraft }
						placeholder={ __( 'Add a focus keyword…', 'vulopilot' ) }
						onChange={ setKeywordDraft }
						onKeyDown={ ( event ) => {
							if ( 'Enter' === event.key ) {
								event.preventDefault();
								commitKeywordDraft();
							}

							if ( 'Escape' === event.key ) {
								setIsAddingKeyword( false );
							}
						} }
						onBlur={ commitKeywordDraft }
					/>
				) }

				{ ! focusKeyword && ! isAddingKeyword && (
					<Button variant="tertiary" size="small" icon="plus-alt2" onClick={ startAddingKeyword }>
						{ __( 'Add Focus Keyword', 'vulopilot' ) }
					</Button>
				) }
			</div>

			{ analyzing && 0 === results.length ? (
				<div className="desc">{ __( 'Analyzing…', 'vulopilot' ) }</div>
			) : (
				( [ 'basic', 'additional', 'title_readability' ] as const ).map( ( group ) => (
					<Checklist
						key={ group }
						title={ GROUP_LABELS[ group ] }
						results={ byGroup( group ) }
						postId={ postId }
						isPro={ window.vulopilotPostSeo.isPro }
						shopUrl={ window.vulopilotPostSeo.shopUrl }
						onFixed={ handleFixed }
						highlightId={ highlightTarget }
					/>
				) )
			) }
		</div>
	);
}
