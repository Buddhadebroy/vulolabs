/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface SchemaCoveragePage {
	id: number;
	title: string;
	url: string;
	edit_url: string | null;
}

/** Which group of checked pages the Inspector's table is narrowed to. */
export type SchemaPageFilter = 'all' | 'valid' | 'attention';

export interface SchemaCoverageCheckedPage extends SchemaCoveragePage {
	/** Every real `@type` found on this page — empty when it has no structured data. */
	types: string[];
}

export interface SchemaCoverageRow {
	type: string;
	meaning: string;
	found_on: number;
	problems: number;
	/** The real, specific sampled pages that actually carried this @type — what "View pages" shows. */
	pages: SchemaCoveragePage[];
}

export interface SchemaCoverageSnapshot {
	generated_at: string;
	sample_size: number;
	pages_checked: number;
	/** Real count of `pages_checked` where at least one real `@type` was actually found — the "Schema Status" summary card's own per-page pass count. */
	pages_with_valid_schema: number;
	/** `pages_checked - pages_with_valid_schema` — pages where the real sample found zero structured data at all. */
	pages_needing_attention: number;
	coverage: SchemaCoverageRow[];
	/** Every checked page with its own found types. Absent on a snapshot cached before this field existed — re-analyze to populate. */
	pages?: SchemaCoverageCheckedPage[];
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * `GET`/`POST /schema/coverage` — Schema.php's own real per-page JSON-LD
 * sample (SchemaCoverageAnalyzer, real outbound HTTP, no AI). GET reads
 * back whatever was last generated (or `null`); `analyze()` triggers a
 * fresh real sample and updates local state with the result, same
 * "loading a page never silently spends real work" posture
 * GEO's own useGeoTabData.ts (`useGeoVisibilitySnapshot`) summary/history split already
 * documents for GEO.
 *
 * Moved here unchanged from GEO/useSchemaCoverage.ts as part of merging
 * the standalone Schema tab into the "Schema & Knowledge" tab's own
 * Overview/Structured Data sections — this hook's own contract didn't
 * change, only which components import it.
 */
export const useSchemaCoverage = (): {
	snapshot: SchemaCoverageSnapshot | null;
	isLoading: boolean;
} => {
	const [snapshot, setSnapshot] = useState<SchemaCoverageSnapshot | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<SchemaCoverageSnapshot | null>(
			getApiLink(appLocalizer, 'schema/coverage'),
			nonceHeaders
		)
			.then((response) => setSnapshot(response ?? null))
			.finally(() => setIsLoading(false));
	}, []);

	return { snapshot, isLoading };
};
