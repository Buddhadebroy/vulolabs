import { __ } from '@wordpress/i18n';
import { useEffect, useRef, useState } from '@wordpress/element';
import { usePostData } from '../usePostData';
import { analyzePage, fetchOpenFindings, PageAnalysisCheck, PageAnalysisResponse, RawFinding } from '../api';
import { SEO_ISSUE_EDITOR_TARGETS, SeoIssueEditorTab, SeoIssueEditorTarget } from '../../services/seoIssueEditorTarget';

interface PageAnalysisTabProps {
	/** Either of 2 real deep-link vocabularies this tab now understands: `GEO/PageAnalysisPanel.tsx`'s own SEO check `key` (e.g. 'broken_links', `PAGE_ANALYSIS_CHECK_QUERY_PARAM`), or a GEO/AEO finding's own real numeric id as a string (`GeoAeoPageAnalysisPanel.tsx`/`SeoIssuesByPageTable.tsx`, `FINDING_ID_QUERY_PARAM`) — resolved against whichever of `data.checks`/`geoFindings`/`aeoFindings` actually contains a match, then scrolled to and pulse-highlighted once that section's own fetch has loaded. */
	highlightTarget?: string;
	/** `PostSeoPanel.tsx`'s own in-sidebar tab switch — lets a row here jump straight to the real General/Advanced/Social/Schema field that fixes it, instead of only scrolling within this same tab. */
	onNavigate?: ( tab: SeoIssueEditorTab, target?: string ) => void;
}

/**
 * This tab's own check `key`s (`Controllers\Seo::get_page_analysis()`) →
 * the scanner id `SEO_ISSUE_EDITOR_TARGETS` already understands — the same
 * translation `GEO/PageAnalysisPanel.tsx`'s own `CHECK_KEY_TO_SCANNER_ID`
 * already establishes for its "Edit"/"Fix with AI" row actions, duplicated
 * here per this codebase's own "duplicate small per-file logic" convention
 * rather than exporting that file's own local map. `title_tag`/`h1_heading`/
 * `headings` have no dedicated scanner of their own but map onto the
 * closest real equivalent scanner's own editor target. `featured_image`/
 * `broken_links`/`orphan_page`/`indexability` have no real editor-sidebar
 * field anywhere in this codebase (confirmed — same gap
 * `SEO_ISSUE_EDITOR_TARGETS`'s own docblock lists) — omitted on purpose,
 * so those rows simply aren't clickable rather than pretending to jump
 * somewhere that doesn't exist.
 */
const CHECK_KEY_TO_SCANNER_ID: Record< string, string > = {
	title_tag: 'seo',
	meta_description: 'meta-description',
	h1_heading: 'heading-structure',
	headings: 'heading-structure',
	content: 'thin-content',
	images: 'images',
	canonical: 'canonical-url',
	structured_data: 'structured-data',
	social_metadata: 'open-graph',
};

const editorTargetForCheck = ( checkKey: string ): SeoIssueEditorTarget | null => {
	const scannerId = CHECK_KEY_TO_SCANNER_ID[ checkKey ];

	return scannerId ? SEO_ISSUE_EDITOR_TARGETS[ scannerId ] ?? null : null;
};

/**
 * This tab's own local copy of GeoTab.tsx's/AeoTab.tsx's real scanner-id
 * unions (`GEO_SECTIONS`/`AEO_SECTIONS`) — duplicated rather than imported
 * for the same reason `CHECK_KEY_TO_SCANNER_ID` above is local: those are
 * big dashboard-page files with their own heavy zyra-based imports, and
 * this tab lives in the separate, small post-editor webpack entry (see
 * `../api.ts`'s own top docblock). GEO's and AEO's own scanner-id sets
 * overlap heavily by design (both tabs already show largely the same real
 * site-wide findings under different framing, confirmed against those
 * files directly) — kept as two separate fetches/sections here rather than
 * force-deduplicating between them, matching that same existing site-wide
 * behavior rather than inventing a new "GEO vs AEO" split this codebase
 * doesn't otherwise draw.
 */
const GEO_SCANNER_IDS = [
	'geo-summary-block',
	'geo-faq-opportunity',
	'geo-citation-opportunities',
	'geo-chunking',
	'geo-semantic-structure',
	'geo-author-info',
	'geo-eeat-signals',
	'geo-entity-naming-consistency',
	'geo-trust-signals',
	'llms-txt-missing',
	'stale-content',
];

const AEO_SCANNER_IDS = [
	'geo-faq-opportunity',
	'geo-summary-block',
	'geo-chunking',
	'geo-semantic-structure',
	'aeo-schema',
	'geo-citation-opportunities',
	'geo-author-info',
	'geo-eeat-signals',
	'geo-entity-naming-consistency',
	'geo-trust-signals',
	'llms-txt-missing',
	'stale-content',
];

/** A finding's own `scanner_id` already IS the id `SEO_ISSUE_EDITOR_TARGETS` is keyed by — no `key`-to-scanner-id translation needed here the way `editorTargetForCheck()` above needs one for Page Analysis's own different check-key vocabulary. */
const editorTargetForFinding = ( finding: RawFinding ): SeoIssueEditorTarget | null =>
	SEO_ISSUE_EDITOR_TARGETS[ finding.scanner_id ] ?? null;

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

/** GEO/AEO findings have no "pass" state (a finding only ever exists for a real open problem — same real gap `GeoAeoPageAnalysisPanel.tsx`'s own docblock documents) — folded onto the same 3-icon/3-color scheme SEO's own checks already use, critical/high reading as the same real "fail" a SEO check would, medium/low/info as "warn". */
const SEVERITY_TO_STATUS: Record< RawFinding[ 'severity' ], PageAnalysisCheck[ 'status' ] > = {
	critical: 'fail',
	high: 'fail',
	medium: 'warn',
	low: 'warn',
	info: 'warn',
};

/** One shared row shape both this tab's own real SEO checklist (`PageAnalysisCheck`) and GEO's/AEO's own real open findings (`RawFinding`) resolve into, so all 3 sections below share one render path instead of 3 near-duplicate ones. */
interface IssueRow {
	id: string;
	status: PageAnalysisCheck[ 'status' ];
	label: string;
	message: string;
	target: SeoIssueEditorTarget | null;
}

const rowFromCheck = ( check: PageAnalysisCheck ): IssueRow => ( {
	id: check.key,
	status: check.status,
	label: check.label,
	message: check.message,
	target: editorTargetForCheck( check.key ),
} );

const rowFromFinding = ( finding: RawFinding ): IssueRow => ( {
	id: String( finding.id ),
	status: SEVERITY_TO_STATUS[ finding.severity ],
	label: finding.title,
	message: '',
	target: editorTargetForFinding( finding ),
} );

interface IssueListProps {
	idPrefix: string;
	rows: IssueRow[];
	pulsingId: string | null;
	onNavigate?: ( tab: SeoIssueEditorTab, target?: string ) => void;
}

/** Renders one section's own real row list — the exact same clickable-row markup/behavior this tab's SEO section already had, now shared by GEO's/AEO's own sections below it too. */
function IssueList( { idPrefix, rows, pulsingId, onNavigate }: IssueListProps ) {
	return (
		<ul className="vulopilot-seo-checklist__list">
			{ rows.map( ( row ) => {
				// Real "go fix this" destination — resolves to null (row stays
				// inert) whenever this row's own scanner/check has no real
				// editor-sidebar field anywhere in this codebase.
				const isClickable = Boolean( row.target && onNavigate );

				return (
					<li
						key={ row.id }
						id={ `${ idPrefix }-${ row.id }` }
						className={ `vulopilot-seo-checklist__item vulopilot-seo-checklist__item--${ STATUS_MODIFIER[ row.status ] }${ pulsingId === row.id ? ' vulopilot-seo-highlight-pulse' : '' }${ isClickable ? ' vulopilot-seo-checklist__item--clickable' : '' }` }
						role={ isClickable ? 'button' : undefined }
						tabIndex={ isClickable ? 0 : undefined }
						onClick={
							isClickable
								? () => onNavigate?.( ( row.target as SeoIssueEditorTarget ).tab, ( row.target as SeoIssueEditorTarget ).target )
								: undefined
						}
						onKeyDown={
							isClickable
								? ( event ) => {
										if ( 'Enter' === event.key || ' ' === event.key ) {
											event.preventDefault();
											onNavigate?.( ( row.target as SeoIssueEditorTarget ).tab, ( row.target as SeoIssueEditorTarget ).target );
										}
									}
								: undefined
						}
					>
						<i className={ `dashicons dashicons-${ STATUS_ICON[ row.status ] } vulopilot-seo-checklist__icon` } />
						<span className="vulopilot-seo-checklist__message">
							<strong>{ row.label }</strong>
							{ row.message && <>{ ' — ' }{ row.message }</> }
						</span>
						{ isClickable && (
							<i className="dashicons dashicons-arrow-right-alt2 vulopilot-seo-checklist__arrow" />
						) }
					</li>
				);
			} ) }
		</ul>
	);
}

interface IssueSectionProps {
	heading: string;
	idPrefix: string;
	rows: IssueRow[];
	isLoading: boolean;
	error: string | null;
	emptyMessage: string;
	pulsingId: string | null;
	onNavigate?: ( tab: SeoIssueEditorTab, target?: string ) => void;
}

/** One headed section (SEO Issues / GEO Issues / AEO Issues) — a real heading using this bundle's own existing `vulopilot-seo-checklist__header`/`__title` look (Checklist.tsx's General-tab groups already ship this CSS), then that section's own real row list, loading state, error, or "nothing open" message. */
function IssueSection( { heading, idPrefix, rows, isLoading, error, emptyMessage, pulsingId, onNavigate }: IssueSectionProps ) {
	return (
		<div className="vulopilot-seo-checklist">
			<div className="vulopilot-seo-checklist__header">
				<span className="title vulopilot-seo-checklist__title">{ heading }</span>
			</div>
			{ isLoading ? (
				<div className="desc vulopilot-seo-checklist__error">{ __( 'Loading…', 'vulopilot' ) }</div>
			) : error ? (
				<div className="desc vulopilot-seo-checklist__error">{ error }</div>
			) : 0 === rows.length ? (
				<div className="desc vulopilot-seo-checklist__error">{ emptyMessage }</div>
			) : (
				<IssueList idPrefix={ idPrefix } rows={ rows } pulsingId={ pulsingId } onNavigate={ onNavigate } />
			) }
		</div>
	);
}

/**
 * The metabox's "Page Analysis" tab — 3 headed sections (SEO Issues / GEO
 * Issues / AEO Issues), all sharing the exact same real click → navigate →
 * highlight experience.
 *
 * "SEO Issues" is unchanged from before this pass: the same real,
 * saved-post-state checklist `GEO/PageAnalysisPanel.tsx`'s own "Page
 * Analysis" panel already renders (`GET seo/analyze-page?post_id=`, Free's
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
 *
 * "GEO Issues"/"AEO Issues" are new: unlike SEO, GEO/AEO have no on-demand
 * per-post checklist endpoint anywhere in this codebase (confirmed —
 * `GeoAeoPageAnalysisPanel.tsx`'s own docblock explicitly refuses to
 * fabricate one), so these 2 sections instead show this exact page's own
 * real *open findings* for GEO's/AEO's own scanner ids (`GET /findings`,
 * the same real data `GeoTab.tsx`'s/`AeoTab.tsx`'s own site-wide "Pages &
 * Posts" tables and `GeoAeoPageAnalysisPanel.tsx`'s own per-page side panel
 * already use), fetched once per postId and filtered to this post
 * client-side (`object_ref === postId`) the same way that panel already
 * does — there's no server-side per-post filter for this endpoint. A
 * finding has no "pass" state, so a page with none currently open for that
 * tab shows a real "nothing open" message rather than an empty list.
 *
 * GEO/AEO rows are also now externally deep-linkable, same as SEO's own —
 * `GeoAeoPageAnalysisPanel.tsx`/`SeoIssuesByPageTable.tsx` link here with
 * `?vulopilot_finding_id={id}` (the finding's own real numeric id) for any
 * row whose `scanner_id` has no `SEO_ISSUE_EDITOR_TARGETS` entry (most real
 * GEO/AEO scanner ids), resolved by the deep-link effect further down
 * against `geoFindings`/`aeoFindings` once loaded — see
 * `FINDING_ID_QUERY_PARAM`'s own docblock.
 */
export default function PageAnalysisTab( { highlightTarget, onNavigate }: PageAnalysisTabProps ) {
	const { postId } = usePostData();

	const [ data, setData ] = useState< PageAnalysisResponse | null >( null );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState< string | null >( null );

	const [ geoFindings, setGeoFindings ] = useState< RawFinding[] >( [] );
	const [ isLoadingGeo, setIsLoadingGeo ] = useState( true );
	const [ geoError, setGeoError ] = useState< string | null >( null );

	const [ aeoFindings, setAeoFindings ] = useState< RawFinding[] >( [] );
	const [ isLoadingAeo, setIsLoadingAeo ] = useState( true );
	const [ aeoError, setAeoError ] = useState< string | null >( null );

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

	// 2 more real, independent requests rather than gating the whole tab
	// (including the unchanged SEO section above) behind them — same "don't
	// change existing SEO behavior" posture the top docblock documents.
	useEffect( () => {
		let cancelled = false;
		setIsLoadingGeo( true );
		setGeoError( null );

		fetchOpenFindings( GEO_SCANNER_IDS )
			.then( ( findings ) => {
				if ( ! cancelled ) {
					setGeoFindings( findings.filter( ( finding ) => finding.object_ref === String( postId ) ) );
				}
			} )
			.catch( ( err ) => {
				if ( ! cancelled ) {
					setGeoError( err instanceof Error ? err.message : String( err ) );
				}
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setIsLoadingGeo( false );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ postId ] );

	useEffect( () => {
		let cancelled = false;
		setIsLoadingAeo( true );
		setAeoError( null );

		fetchOpenFindings( AEO_SCANNER_IDS )
			.then( ( findings ) => {
				if ( ! cancelled ) {
					setAeoFindings( findings.filter( ( finding ) => finding.object_ref === String( postId ) ) );
				}
			} )
			.catch( ( err ) => {
				if ( ! cancelled ) {
					setAeoError( err instanceof Error ? err.message : String( err ) );
				}
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setIsLoadingAeo( false );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ postId ] );

	// Deep-link highlighting — SEO's own `data.checks` (matched by real
	// `key`, `PAGE_ANALYSIS_CHECK_QUERY_PARAM`) is tried first, same real
	// behavior this tab had before GEO/AEO Issues existed; GEO's/AEO's own
	// findings (matched by real numeric id, `FINDING_ID_QUERY_PARAM` — see
	// that constant's own docblock) are tried next, once each section's
	// own independent fetch has actually resolved. A target that's really
	// a GEO/AEO finding simply doesn't match on an earlier render where
	// `isLoadingGeo`/`isLoadingAeo` is still true — this effect re-runs as
	// those settle (see the dependency array) rather than giving up.
	useEffect( () => {
		if ( ! highlightTarget || hasScrolledRef.current ) {
			return;
		}

		let elementId: string | null = null;

		if ( data?.checks.some( ( check ) => check.key === highlightTarget ) ) {
			elementId = `vulopilot-page-analysis-check-${ highlightTarget }`;
		} else if (
			! isLoadingGeo &&
			geoFindings.some( ( finding ) => String( finding.id ) === highlightTarget )
		) {
			elementId = `vulopilot-page-analysis-geo-${ highlightTarget }`;
		} else if (
			! isLoadingAeo &&
			aeoFindings.some( ( finding ) => String( finding.id ) === highlightTarget )
		) {
			elementId = `vulopilot-page-analysis-aeo-${ highlightTarget }`;
		}

		if ( ! elementId ) {
			return;
		}

		hasScrolledRef.current = true;
		const element = document.getElementById( elementId );
		element?.scrollIntoView( { behavior: 'smooth', block: 'center' } );
		setPulsingKey( highlightTarget );

		const timeout = setTimeout( () => setPulsingKey( null ), 4000 );
		return () => clearTimeout( timeout );
	}, [ highlightTarget, data, geoFindings, aeoFindings, isLoadingGeo, isLoadingAeo ] );

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
				{ __( 'This page\'s real SEO/GEO/AEO signals, last checked live.', 'vulopilot' ) }
			</p>

			<IssueSection
				heading={ __( 'SEO Issues', 'vulopilot' ) }
				idPrefix="vulopilot-page-analysis-check"
				rows={ data.checks.map( rowFromCheck ) }
				isLoading={ false }
				error={ null }
				emptyMessage={ __( 'No SEO checks to show.', 'vulopilot' ) }
				pulsingId={ pulsingKey }
				onNavigate={ onNavigate }
			/>

			<IssueSection
				heading={ __( 'GEO Issues', 'vulopilot' ) }
				idPrefix="vulopilot-page-analysis-geo"
				rows={ geoFindings.map( rowFromFinding ) }
				isLoading={ isLoadingGeo }
				error={ geoError }
				emptyMessage={ __( 'No open GEO findings for this page.', 'vulopilot' ) }
				pulsingId={ pulsingKey }
				onNavigate={ onNavigate }
			/>

			<IssueSection
				heading={ __( 'AEO Issues', 'vulopilot' ) }
				idPrefix="vulopilot-page-analysis-aeo"
				rows={ aeoFindings.map( rowFromFinding ) }
				isLoading={ isLoadingAeo }
				error={ aeoError }
				emptyMessage={ __( 'No open AEO findings for this page.', 'vulopilot' ) }
				pulsingId={ pulsingKey }
				onNavigate={ onNavigate }
			/>
		</div>
	);
}
