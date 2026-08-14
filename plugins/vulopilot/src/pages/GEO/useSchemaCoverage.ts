/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';

export interface SchemaCoverageRow {
	type: string;
	meaning: string;
	found_on: number;
	problems: number;
}

export interface SchemaCoverageSnapshot {
	generated_at: string;
	sample_size: number;
	pages_checked: number;
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
