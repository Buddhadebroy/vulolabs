
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

	// eslint-disable-next-line no-constant-condition
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

/** Same real `POST /findings/{id}/fix` the dashboard's own "Fix with AI" buttons call (vulopilot-pro's OneClickFix `FindingFixRest`). */
export function fixFinding( findingId: number ): Promise< FixResponse > {
	return request( `findings/${ findingId }/fix`, { method: 'POST' } );
}

export function fixWithAi( postId: number, actionId: string ): Promise< FixResponse > {
	return request( `post-seo/${ postId }/fix`, {
		method: 'POST',
		body: JSON.stringify( { action_id: actionId } ),
	} );
}
