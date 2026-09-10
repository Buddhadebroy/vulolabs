import { __ } from '@wordpress/i18n';
import { useEffect, useRef, useState } from '@wordpress/element';
import { usePostData } from '../usePostData';
import { analyzePage, PageAnalysisCheck, PageAnalysisResponse } from '../api';

interface PageAnalysisTabProps {
	/** "Page Analysis" panel's own deep link (`GEO/PageAnalysisPanel.tsx`) — a check `key` (e.g. 'broken_links') to scroll to and pulse-highlight once this tab's own real checklist has loaded. */
	highlightTarget?: string;
}

const STATUS_ICON: Record< PageAnalysisCheck[ 'status' ], string > = {
	pass: 'yes-alt',
	warn: 'warning',
	fail: 'dismiss',
};

/** `PageAnalysisCheck['status']` → this bundle's own `vulopilot-seo-checklist__item--{modifier}` CSS already ships for Checklist.tsx (`--pass`/`--warning`/`--fail`) — 'warn' (this endpoint's own naming) reuses the existing '--warning' rule rather than adding a near-duplicate one. */
const STATUS_MODIFIER: Record< PageAnalysisCheck[ 'status' ], string > = {
	pass: 'pass',
	warn: 'warning',
	fail: 'fail',
};

/**
 * The metabox's "Page Analysis" tab — the exact same real, saved-post-state
 * checklist `GEO/PageAnalysisPanel.tsx`'s own "Page Analysis" panel already
 * renders (`GET seo/analyze-page?post_id=`, Free's
 * `Controllers\Seo::get_page_analysis()`), reused here rather than a second
 * copy: every issue that panel lists (Title Tag, Meta Description, H1
 * Heading, Headings, Content, Images, Featured Image, Broken Links, Orphan
 * Page, Canonical, Structured Data, Social Metadata, Indexability) is
 * therefore genuinely listed here too, and clicking one of that panel's
 * rows deep-links straight to the matching row here
 * (`PAGE_ANALYSIS_CHECK_QUERY_PARAM`, `post-editor/index.tsx`).
 *
 * Deliberately its own tab rather than folded into General's own
 * OnPageAnalyzer-driven checklist: that one re-analyzes LIVE, unsaved
 * editor state on every keystroke (Services\OnPageAnalyzer's own docblock)
 * and only ever covers title/description/content/headings/links/images —
 * this one reflects the last-scanned, saved-post-state truth for the full
 * 13-check set, including checks (Featured Image, Broken Links, Orphan
 * Page, Indexability) OnPageAnalyzer has no way to compute at all (no
 * unsaved-field equivalent for a post thumbnail, a site-wide link graph, or
 * published/noindex state). Fetched once per postId rather than on every
 * keystroke — it isn't live the way General's checklist is.
 */
export default function PageAnalysisTab( { highlightTarget }: PageAnalysisTabProps ) {
	const { postId } = usePostData();

	const [ data, setData ] = useState< PageAnalysisResponse | null >( null );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState< string | null >( null );
	const [ pulsingKey, setPulsingKey ] = useState< string | null >( null );
	const hasScrolledRef = useRef( false );

	useEffect( () => {
		let cancelled = false;
		setIsLoading( true );
		setError( null );

		analyzePage( postId )
			.then( ( response ) => {
				if ( ! cancelled ) {
					setData( response );
				}
			} )
			.catch( ( err ) => {
				if ( ! cancelled ) {
					setError( err instanceof Error ? err.message : String( err ) );
				}
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setIsLoading( false );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ postId ] );

	useEffect( () => {
		if ( ! highlightTarget || hasScrolledRef.current || ! data ) {
			return;
		}

		const match = data.checks.find( ( check ) => check.key === highlightTarget );

		if ( ! match ) {
			return;
		}

		hasScrolledRef.current = true;
		const element = document.getElementById( `vulopilot-page-analysis-check-${ highlightTarget }` );
		element?.scrollIntoView( { behavior: 'smooth', block: 'center' } );
		setPulsingKey( highlightTarget );

		const timeout = setTimeout( () => setPulsingKey( null ), 4000 );
		return () => clearTimeout( timeout );
	}, [ highlightTarget, data ] );

	if ( isLoading ) {
		return (
			<div className="vulopilot-seo-tab vulopilot-seo-tab--page-analysis">
				<div className="desc">{ __( 'Analyzing…', 'vulopilot' ) }</div>
			</div>
		);
	}

	if ( error || ! data ) {
		return (
			<div className="vulopilot-seo-tab vulopilot-seo-tab--page-analysis">
				<div className="desc">
					{ error || __( 'Could not analyze this page. Please try again.', 'vulopilot' ) }
				</div>
			</div>
		);
	}

	return (
		<div className="vulopilot-seo-tab vulopilot-seo-tab--page-analysis">
			<p className="small desc vulopilot-seo-focus-keyword-help">
				{ __( 'This page\'s real SEO/GEO signals, last checked live.', 'vulopilot' ) }
			</p>

			<div className="vulopilot-seo-checklist">
				<ul className="vulopilot-seo-checklist__list">
					{ data.checks.map( ( check ) => (
						<li
							key={ check.key }
							id={ `vulopilot-page-analysis-check-${ check.key }` }
							className={ `vulopilot-seo-checklist__item vulopilot-seo-checklist__item--${ STATUS_MODIFIER[ check.status ] }${ pulsingKey === check.key ? ' vulopilot-seo-highlight-pulse' : '' }` }
						>
							<i className={ `dashicons dashicons-${ STATUS_ICON[ check.status ] } vulopilot-seo-checklist__icon` } />
							<span className="vulopilot-seo-checklist__message">
								<strong>{ check.label }</strong>
								{ ' — ' }
								{ check.message }
							</span>
						</li>
					) ) }
				</ul>
			</div>
		</div>
	);
}
