
export interface AnalysisResult {
	id: string;
	group: 'basic' | 'additional' | 'title_readability';
	status: 'pass' | 'warning' | 'fail';
	message: string;
	fixable: boolean;
	action_id: string | null;
}

/** One row of `Seo::get_page_analysis()`'s real `checks` array. */
export interface PageAnalysisCheck {
	key: string;
	label: string;
	status: 'pass' | 'warn' | 'fail';
	message: string;
}

export interface PageAnalysisResponse {
	post_id: number;
	title: string;
	permalink: string;
	meta_description: string;
	analyzed_at: string;
	checks: PageAnalysisCheck[];
}

export interface FixResponse {
	success: boolean;
	message?: string;
	post?: {
		title: string;
		excerpt: string;
		content_changed: boolean;
		/** The saved post_content after a content-mutating action (empty otherwise). */
		content?: string;
		schema_json: string;
		/** Only set by the 'set-featured-image-from-content' mechanical fix. */
		featured_media_id?: number | null;
	};
}

/** Same real shape `seoIssuesShared.tsx`'s own `RawFinding` (dashboard bundle) already establishes. */
export interface RawFinding {
	id: number;
	title: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	status: 'open' | 'resolved' | 'ignored' | 'snoozed';
	scanner_id: string;
	object_type: string;
	object_ref: string;
}

interface FindingsResponse {
	data: RawFinding[];
	total: number;
}

const FINDINGS_PAGE_SIZE = 100;
/** Same safety ceiling `seoIssuesShared.tsx`'s own `fetchOpenFindingsFor()` uses. */
const MAX_FINDINGS = 1000;

/**
 * Same real `GET /findings` pagination loop `seoIssuesShared.tsx`'s own `fetchOpenFindingsFor()`
 * already establishes for the dashboard bundle.
 */
export async function fetchOpenFindings( scannerIds: string[] ): Promise< RawFinding[] > {
	const scannerParam = scannerIds.join( ',' );
	let page = 1;
	let all: RawFinding[] = [];

	while ( true ) {
		const response = await request< FindingsResponse >(
			`findings?scanner_id=${ scannerParam }&status=open&per_page=${ FINDINGS_PAGE_SIZE }&page=${ page }&orderby=id&order=desc`
		);

		all = all.concat( response.data ?? [] );

		const gotFullPage = ( response.data ?? [] ).length === FINDINGS_PAGE_SIZE;
		const moreRemain = all.length < ( response.total ?? 0 );

		if ( ! gotFullPage || ! moreRemain || all.length >= MAX_FINDINGS ) {
			break;
		}

		page += 1;
	}

	return all;
}

/**
 * Same pagination loop as `fetchOpenFindings()` but with no status filter - distinguishes "never
 * scanned" (zero rows, any status) from "scanned, nothing currently open" (rows exist, none open).
 */
export async function fetchAllFindings( scannerIds: string[] ): Promise< RawFinding[] > {
	const scannerParam = scannerIds.join( ',' );
	let page = 1;
	let all: RawFinding[] = [];

	while ( true ) {
		const response = await request< FindingsResponse >(
			`findings?scanner_id=${ scannerParam }&per_page=${ FINDINGS_PAGE_SIZE }&page=${ page }&orderby=id&order=desc`
		);

		all = all.concat( response.data ?? [] );

		const gotFullPage = ( response.data ?? [] ).length === FINDINGS_PAGE_SIZE;
		const moreRemain = all.length < ( response.total ?? 0 );

		if ( ! gotFullPage || ! moreRemain || all.length >= MAX_FINDINGS ) {
			break;
		}

		page += 1;
	}

	return all;
}

async function request< T >( path: string, options: NonNullable< Parameters< typeof fetch >[ 1 ] > = {} ): Promise< T > {
	const config = window.vulopilotPostSeo;

	const response = await fetch( `${ config.apiUrl }/${ path }`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': config.nonce,
			...( options.headers || {} ),
		},
	} );

	const body = await response.json().catch( () => null );

	if ( ! response.ok ) {
		throw new Error( body?.message || `Request failed (${ response.status })` );
	}

	return body as T;
}

export function analyzePost(
	postId: number,
	payload: {
		title: string;
		content: string;
		excerpt: string;
		slug: string;
		focus_keyword: string;
	}
): Promise< { results: AnalysisResult[] } > {
	return request( `post-seo/${ postId }/analyze`, {
		method: 'POST',
		body: JSON.stringify( payload ),
	} );
}

export function analyzePage( postId: number ): Promise< PageAnalysisResponse > {
	return request( `seo/analyze-page?post_id=${ postId }`, { method: 'GET' } );
}

/** One row of `SeoScoreEngine::evaluate()`'s own return value. */
export interface SeoScoreRule {
	rule_id: string;
	category: string;
	status: 'pass' | 'warning' | 'fail' | 'not_applicable' | 'unknown';
	max_points: number;
	earned_points: number;
	reason: string;
	evidence: Record< string, unknown >;
	recommendation: string | null;
	data_source: string;
}

export interface SeoScoreResponse {
	score: number;
	ruleset_version: string;
	insufficient_data: boolean;
	coverage_percent: number;
	evaluated_count: number;
	unknown_count: number;
	not_applicable_count: number;
	categories: Record< string, { max: number; earned: number; applicable: number } >;
	rules: SeoScoreRule[];
}

/**
 * Real per-post SEO score (`Seo::get_post_score()`), computed from the saved post plus - when
 * given - the editor's own live (possibly-unsaved) field values, so the toolbar/sidebar score
 * pill reacts to typing the same way the Page Analysis tab's own live checklist does, not just
 * to the last save.
 */
export function getPostSeoScore(
	postId: number,
	live?: { title: string; content: string; excerpt: string; slug: string; focus_keyword: string },
	/** True for a debounced-on-keystroke call - skips the engine's one real HTTP self-fetch (http_status/canonical/structured_data), so typing doesn't queue up a network round trip behind itself every ~600ms. */
	liveOnly = false
): Promise< SeoScoreResponse > {
	return request( `seo/post-score?post_id=${ postId }${ liveOnly ? '&live_only=1' : '' }`, {
		method: 'POST',
		body: JSON.stringify( live ?? {} ),
	} );
}

/** Same real `POST /findings/{id}/fix` the dashboard's own "Fix with AI" buttons call. */
export function fixFinding( findingId: number ): Promise< FixResponse > {
	return request( `findings/${ findingId }/fix`, { method: 'POST' } );
}

export function fixWithAi( postId: number, actionId: string ): Promise< FixResponse > {
	return request( `post-seo/${ postId }/fix`, {
		method: 'POST',
		body: JSON.stringify( { action_id: actionId } ),
	} );
}

export interface AutoFixScoreResult {
	rule_id: string;
	status: 'fixed' | 'failed' | 'skipped';
	message: string;
}

export interface AutoFixScoreResponse {
	before_score: number | null;
	after_score: number | null;
	results: AutoFixScoreResult[];
}

/**
 * `ScoreImprovementCard.tsx`'s own "Upgrade to Pro to Auto-Fix" button (Pro-active state) -
 * `VuloPilotPro\OneClickFix\SeoScoreAutoFixRunner::run_all()`, Pro-only (vulopilot-pro's own
 * route; 404s on free).
 */
export function autoFixScore( postId: number ): Promise< AutoFixScoreResponse > {
	return request( `post-seo/${ postId }/auto-fix-score`, { method: 'POST' } );
}

/** `GeoScore::to_array()`'s own real shape - same one `VuloPilotPro\GeoAnalysis\Rest::get_item()`/`create_item()` both return. */
export interface GeoScoreResponse {
	post_id: number;
	deterministic_score: number | null;
	ai_scores: {
		entity_coverage: number;
		question_coverage: number;
		answer_completeness: number;
		llm_readability: number;
		purpose_clarity: number;
		conversation_readiness: number;
		knowledge_graph_coverage: number;
		answer_first_structure: number;
	};
	sub_scores: {
		retrieval_score: number;
		citation_readiness: number;
		ai_summary_qa_detection: number;
		entity_naming_consistency: number;
		content_freshness: number;
		data_point_evidence_density: number;
	};
	overall_score: number;
	suggestions: string[];
	generated_at: string;
}

/**
 * `AiVisibilityCard.tsx`'s own "load the last stored analysis" - reads cached postmeta, no AI
 * call. Pro-only route (404s on free, same as `autoFixScore()`).
 */
export function getGeoScore( postId: number ): Promise< GeoScoreResponse > {
	return request( `geo-analysis/${ postId }`, { method: 'GET' } );
}

// analyzeGeoScore now lives in vulopilot-pro's own api.ts, resolved via a filter.

// AEO citation-check (checkAeoCitationForPost/AeoCitationResult) lives in vulopilot-pro's
// own src/post-editor/api.ts now - resolved via the `vulopilot_post_editor_aeo_citation_panel`
// filter where Free still needs it (tabs/AeoTab.tsx).

// Keyword management (KeywordManagementPanel), topic intelligence (TopicLinkingPanel: topic
// profile, related articles, link opportunities, content gaps, content brief, website profile,
// content inventory, topic opportunities, keyword research), the text-selection AI toolbar
// (TextSelectionActionsPanel), and Content Planner's own API calls now live entirely in
// vulopilot-pro's own src/post-editor/api.ts - all Pro-only, resolved via filter slots where
// Free still needs a shell.

/** `CrawlerVisitRepository::get_stats_for_url()`'s own real shape. */
export interface CrawlerPostStatsResponse {
	total: number;
	by_bot: Array< { bot_name: string; total: number; last_seen_at: string } >;
	is_404_rate_percent: number | null;
}

/**
 * Real logged AI-bot visits to this post's own permalink - distinct from the content-derived
 * GEO/AI-Readiness scores above, since this reflects whether AI crawlers have actually fetched
 * the page, not how well-structured it is for them to understand.
 */
export function getCrawlerStatsForPost( postId: number, days = 90 ): Promise< CrawlerPostStatsResponse > {
	return request( `crawler-traffic/post/${ postId }?days=${ days }`, { method: 'GET' } );
}
