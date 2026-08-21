/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';

export interface VisibilityAiScores {
	entity_coverage: number;
	question_coverage: number;
	answer_completeness: number;
	llm_readability: number;
	purpose_clarity: number;
	conversation_readiness: number;
	knowledge_graph_coverage: number;
	answer_first_structure: number;
}

export interface VisibilitySubScores {
	retrieval_score: number;
	citation_readiness: number;
}

export interface VisibilitySnapshot {
	sample_size: number;
	ai_scores: VisibilityAiScores | null;
	sub_scores: VisibilitySubScores | null;
}

export interface GeoVisibilityHistoryRow {
	snapshot_date: string;
	sample_size: number;
	overall_score: number | null;
	/** Same per-dimension breakdown `snapshot.ai_scores`/`sub_scores` carries for "today", now also available per historical day — lets a consumer compute its own scoped sub-average trend (e.g. AeoTab.tsx's "AEO Score Over Time") instead of only the one combined `overall_score` above. Null on a day the sample batch found nothing to average, same as `overall_score`. */
	ai_scores: VisibilityAiScores | null;
	sub_scores: VisibilitySubScores | null;
}

/**
 * Shared `GET /geo-visibility-summary` + `GET /geo-visibility-history`
 * fetch (both vulopilot-pro's GeoInsights module — Pro-only) — one real
 * pair of calls, reused by GeoVisibilitySummaryCard.tsx ("Overall AI
 * Visibility", merging what used to be GeoVisibilityOverviewRow.tsx's
 * "Overall AI Visibility"/"The 4 things AI checks for" and
 * GeoTrendCompactCard.tsx's "Are You Getting Easier to Find?" into one
 * card — see that component's own docblock), and the "your own score" bar
 * GeoTab.tsx passes into the Pro competitor-comparison slot — same "one
 * real call, reused by every card that needs it" pattern
 * useGeoFindingGroups.ts already establishes for `/findings/groups`.
 * `history`'s own most-recent row already carries a real `overall_score`
 * (GeoInsights\VisibilitySnapshotBuilder::calculate_overall_score()) even
 * though `snapshot` itself only exposes the raw per-dimension breakdown —
 * see GeoVisibilitySummaryCard.tsx's own docblock for why both are needed
 * together.
 */
export const useGeoVisibilitySnapshot = (): {
	snapshot: VisibilitySnapshot | null;
	history: GeoVisibilityHistoryRow[];
	isLoading: boolean;
} => {
	const [snapshot, setSnapshot] = useState<VisibilitySnapshot | null>(null);
	const [history, setHistory] = useState<GeoVisibilityHistoryRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		Promise.all([
			getApiResponse<VisibilitySnapshot>(
				getApiLink(appLocalizer, 'geo-visibility-summary'),
				{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
			),
			getApiResponse<GeoVisibilityHistoryRow[]>(
				getApiLink(appLocalizer, 'geo-visibility-history'),
				{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
			),
		])
			.then(([summaryResponse, historyResponse]) => {
				if (summaryResponse) {
					setSnapshot(summaryResponse);
				}
				if (historyResponse) {
					setHistory(historyResponse);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return { snapshot, history, isLoading };
};
