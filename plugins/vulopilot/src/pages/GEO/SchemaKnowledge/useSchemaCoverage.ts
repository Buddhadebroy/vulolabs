/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';

export interface SchemaCoveragePage {
	id: number;
	title: string;
	url: string;
	edit_url: string | null;
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
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * `GET`/`POST /schema/coverage` — Schema.php's own real per-page JSON-LD
 * sample (SchemaCoverageAnalyzer, real outbound HTTP, no AI). GET reads
 * back whatever was last generated (or `null`); `analyze()` triggers a
 * fresh real sample and updates local state with the result, same
 * "loading a page never silently spends real work" posture
 * useGeoVisibilitySnapshot.ts's own summary/history split already
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
	isAnalyzing: boolean;
	analyze: () => void;
} => {
	const [snapshot, setSnapshot] = useState<SchemaCoverageSnapshot | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);
	const [isAnalyzing, setIsAnalyzing] = useState(false);

	useEffect(() => {
		getApiResponse<SchemaCoverageSnapshot | null>(
			getApiLink(appLocalizer, 'schema/coverage'),
			nonceHeaders
		)
			.then((response) => setSnapshot(response ?? null))
			.finally(() => setIsLoading(false));
	}, []);

	const analyze = () => {
		setIsAnalyzing(true);
		sendApiResponse<SchemaCoverageSnapshot>(
			appLocalizer,
			getApiLink(appLocalizer, 'schema/coverage'),
			{}
		)
			.then((response) => {
				if (response) {
					setSnapshot(response);
				}
			})
			.finally(() => setIsAnalyzing(false));
	};

	return { snapshot, isLoading, isAnalyzing, analyze };
};
