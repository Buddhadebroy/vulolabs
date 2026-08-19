/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';

export interface SchemaInspectorBlock {
	index: number;
	type: string | null;
	raw: string;
}

export interface SchemaInspectorProblem {
	type: string;
	block_index: number;
	field: string;
	message: string;
}

export interface SchemaInspectorConflict {
	type: string;
	block_indexes: number[];
}

export interface SchemaInspectorPreview {
	title: string | null;
	description: string | null;
	rating: number | null;
	rating_count: number | null;
	availability: string | null;
}

export interface SchemaInspectorResult {
	url: string;
	fetched_at: string;
	types: string[];
	blocks: SchemaInspectorBlock[];
	problems: SchemaInspectorProblem[];
	conflicts: SchemaInspectorConflict[];
	preview: SchemaInspectorPreview | null;
}

/**
 * `POST /schema/inspect` — a real, on-demand single-page JSON-LD check
 * (SchemaPageInspector, real outbound HTTP + extraction, no AI). Same
 * "loading a page never silently spends real work" posture
 * useSchemaCoverage.ts's own `analyze()` already documents.
 */
export const useSchemaInspector = (): {
	result: SchemaInspectorResult | null;
	isInspecting: boolean;
	error: string | null;
	// Base no-unused-vars doesn't understand TS function-type parameter
	// positions (no runtime binding to "use") — same known gap
	// useApiList.ts's own onQueryUpdate type already documents.
	// eslint-disable-next-line no-unused-vars
	inspect: (url: string) => void;
} => {
	const [result, setResult] = useState<SchemaInspectorResult | null>(null);
	const [isInspecting, setIsInspecting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const inspect = (url: string) => {
		if ('' === url.trim()) {
			return;
		}

		setIsInspecting(true);
		setError(null);

		sendApiResponse<SchemaInspectorResult>(
			appLocalizer,
			getApiLink(appLocalizer, 'schema/inspect'),
			{ url: url.trim() }
		)
			.then((response) => {
				if (response) {
					setResult(response);
				} else {
					setError(
						__(
							'Could not fetch that page. Check the URL and try again.',
							'vulopilot'
						)
					);
				}
			})
			.finally(() => setIsInspecting(false));
	};

	return { result, isInspecting, error, inspect };
};
