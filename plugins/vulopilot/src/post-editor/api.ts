/**
 * Thin fetch wrapper for the post-editor metabox's own endpoints —
 * `vulopilotPostSeo` (Services\PostEditorAssets::enqueue_assets()) rather
 * than `appLocalizer`, since the Block Editor screen doesn't guarantee the
 * dashboard's own localized script has run. Native `fetch()` with a manual
 * `X-WP-Nonce` header, the same "raw call + manual nonce" pattern
 * react-frontend.md documents for direct WP/WC REST calls elsewhere in
 * this codebase — chosen over pulling zyra's axios-based helpers into this
 * small, separate Block Editor bundle.
 */

export interface AnalysisResult {
	id: string;
	group: 'basic' | 'additional' | 'title_readability';
	status: 'pass' | 'warning' | 'fail';
	message: string;
	fixable: boolean;
	action_id: string | null;
}

/** One row of `Controllers\Seo::get_page_analysis()`'s real `checks` array — the same saved-post-state SEO/GEO checklist `GEO/PageAnalysisPanel.tsx`'s own "Page Analysis" panel already renders, reused here verbatim so this tab's own "Page Analysis" list is never a second, possibly-drifting copy of that data. */
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
		schema_json: string;
	};
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

/** Same real `GET vulopilot/v1/seo/analyze-page?post_id=` `GEO/PageAnalysisPanel.tsx` already calls — this bundle's own `apiUrl`/nonce just point at the same `vulopilot/v1` namespace under a different localized script (see this file's own top docblock). */
export function analyzePage( postId: number ): Promise< PageAnalysisResponse > {
	return request( `seo/analyze-page?post_id=${ postId }`, { method: 'GET' } );
}

export function fixWithAi( postId: number, actionId: string ): Promise< FixResponse > {
	return request( `post-seo/${ postId }/fix`, {
		method: 'POST',
		body: JSON.stringify( { action_id: actionId } ),
	} );
}
