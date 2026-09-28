/* global vulopilotAppLocalizer */
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
	/** Every real `@type` found on this page - empty when it has no structured data. */
	types: string[];
}

export interface SchemaCoverageRow {
	type: string;
	meaning: string;
	found_on: number;
	problems: number;
	/** The real, specific sampled pages that actually carried this @type - what "View pages" shows. */
	pages: SchemaCoveragePage[];
}

export interface SchemaCoverageSnapshot {
	generated_at: string;
	sample_size: number;
	pages_checked: number;
	/** Real count of `pages_checked` where at least one real `@type` was actually found. */
	pages_with_valid_schema: number;
	/** `pages_checked - pages_with_valid_schema` - pages where the real sample found zero structured data at all. */
	pages_needing_attention: number;
	coverage: SchemaCoverageRow[];
	/** Every checked page with its own found types. */
	pages?: SchemaCoverageCheckedPage[];
}

const nonceHeaders = { headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } };

/**
 * `GET`/`POST /schema/coverage` - Schema.php's own real per-page JSON-LD sample
 * (SchemaCoverageAnalyzer, real outbound HTTP, no AI).
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
			getApiLink(vulopilotAppLocalizer, 'schema/coverage'),
			nonceHeaders
		)
			.then((response) => setSnapshot(response ?? null))
			.finally(() => setIsLoading(false));
	}, []);

	return { snapshot, isLoading };
};
