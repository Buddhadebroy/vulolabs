/* global appLocalizer */
import { useEffect, useState } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';
import { bucketFindingsByPage, fetchOpenFindingsFor } from './seoIssuesShared';
import type { FindingGroup } from '../../components/Issues/issuesTypes';

/**
 * GeoTab.tsx's/AeoTab.tsx's own family of small `GET /findings/groups`-
 * shaped and `/geo-visibility-*`-shaped data-fetching hooks - each used to
 * be its own file (`useGeoFindingGroups.ts`, `useAllFindingGroups.ts`,
 * `useGeoTopicAffectedPages.ts`, `useGeoVisibilitySnapshot.ts`); merged
 * here since they're all small, all real siblings of the same "one real
 * call, reused by every card that needs it" pattern, and each one's own
 * docblock already cross-references the others by name.
 */

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Shared `GET /findings/groups?category=geo` fetch - same "one real call,
 * reused by every card that needs a per-scanner-id breakdown" pattern
 * vulopilot-pro's own (moved) Commerce/CommerceTab.tsx already establishes.
 * Used by GeoFixTheseFirstCard.tsx and GeoByTopicGrid.tsx so the GEO tab's
 * "Fix These First" and "A Closer Look, By Topic" sections don't each run
 * their own independent copy of the same fetch. 200 is comfortably above
 * the real number of 'geo'-category scanners that exist today (12).
 * Deliberately separate from SectionedIssuesTable.tsx's own internal
 * fetch (all categories, powering the "All GEO Issues" table further down
 * this same tab) - that one needs every category for its cross-page
 * "Important" tab logic, this one only ever needs 'geo'.
 */
export const useGeoFindingGroups = (): {
	groups: FindingGroup[];
	isLoading: boolean;
} => {
	const [groups, setGroups] = useState<FindingGroup[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<{ data: FindingGroup[] }>(
			getApiLink(appLocalizer, 'findings/groups?category=geo&per_page=200'),
			nonceHeaders
		)
			.then((response) => setGroups(response?.data ?? []))
			.finally(() => setIsLoading(false));
	}, []);

	return { groups, isLoading };
};

/** Real sum of `.count` across every group whose scanner_id is in `scannerIds` - same technique Commerce/CommerceIssuesTable.tsx's own `sumGroupCounts()` already establishes. */
export const sumGroupCounts = (
	groups: FindingGroup[],
	scannerIds: string[]
): number =>
	groups
		.filter((group) => scannerIds.includes(group.scanner_id))
		.reduce((total, group) => total + group.count, 0);

/**
 * Shared `GET /findings/groups` fetch with no `category` filter - same
 * all-categories shape SectionedIssuesTable.tsx's own internal fetch
 * already uses. Unlike `useGeoFindingGroups` above (fixed to
 * `category=geo`), this is for callers whose own scanner ids span more
 * than one real `category` column value - AeoTab.tsx's own 5 AEO_SECTIONS
 * include `aeo-schema` (registered under Free's own 'seo'-ish scanner set)
 * and `llms-txt-missing` (vulopilot-pro, its own 'geo' scanner but
 * Pro-gated), so a `category=geo`-scoped fetch would silently miss one of
 * them.
 */
export const useAllFindingGroups = (): {
	groups: FindingGroup[];
	isLoading: boolean;
} => {
	const [groups, setGroups] = useState<FindingGroup[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<{ data: FindingGroup[] }>(
			getApiLink(appLocalizer, 'findings/groups?per_page=200'),
			nonceHeaders
		)
			.then((response) => setGroups(response?.data ?? []))
			.finally(() => setIsLoading(false));
	}, []);

	return { groups, isLoading };
};

/**
 * Real, *distinct*-page counts per scanner id - `sumGroupCounts()` above
 * adds up raw finding rows, which over-counts a page with two findings
 * from scanners in the same topic (GeoByTopicGrid.tsx's "Affected pages"
 * stat needs the actual number of distinct pages touched, not the raw
 * issue count that stat already shows next to it). Reuses the exact same
 * real fetch+bucket `IssuesSection.tsx` already runs for this tab's "All
 * GEO Issues" table (`fetchOpenFindingsFor()` + `bucketFindingsByPage()`,
 * seoIssuesShared.tsx) - a second real call rather than lifting that
 * fetch out of IssuesSection, which owns it for its own good reasons (see
 * that component's own docblock); the trade is one extra request against
 * an endpoint this same tab already hits, not a second source of truth.
 */
export const useGeoTopicAffectedPages = (
	scannerIds: string[]
): { affectedPagesByScanner: Map<string, Set<number>>; isLoading: boolean } => {
	const [affectedPagesByScanner, setAffectedPagesByScanner] = useState<
		Map<string, Set<number>>
	>(new Map());
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);

		fetchOpenFindingsFor(scannerIds)
			.then((findings) => {
				if (cancelled) {
					return;
				}

				const { byPostId } = bucketFindingsByPage(findings);
				const byScanner = new Map<string, Set<number>>();

				byPostId.forEach((pageFindings, postId) => {
					pageFindings.forEach((finding) => {
						const existing = byScanner.get(finding.scanner_id) || new Set<number>();
						existing.add(postId);
						byScanner.set(finding.scanner_id, existing);
					});
				});

				setAffectedPagesByScanner(byScanner);
			})
			.catch(() => {
				if (!cancelled) {
					setAffectedPagesByScanner(new Map());
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- same "fresh array every render, callers never change scope at runtime" rationale IssuesSection.tsx's own fetch effect already documents for scannerIds.
	}, []);

	return { affectedPagesByScanner, isLoading };
};

/** Real distinct-page union across every scanner id in `scannerIds` - GeoByTopicGrid.tsx's own per-topic tile stat. */
export const countDistinctAffectedPages = (
	affectedPagesByScanner: Map<string, Set<number>>,
	scannerIds: string[]
): number => {
	const union = new Set<number>();

	scannerIds.forEach((scannerId) => {
		affectedPagesByScanner.get(scannerId)?.forEach((postId) => union.add(postId));
	});

	return union.size;
};

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
	/** Same per-dimension breakdown `snapshot.ai_scores`/`sub_scores` carries for "today", now also available per historical day - lets a consumer compute its own scoped sub-average trend (e.g. AeoTab.tsx's "AEO Score Over Time") instead of only the one combined `overall_score` above. Null on a day the sample batch found nothing to average, same as `overall_score`. */
	ai_scores: VisibilityAiScores | null;
	sub_scores: VisibilitySubScores | null;
}

/**
 * Shared `GET /geo-visibility-summary` + `GET /geo-visibility-history`
 * fetch (both vulopilot-pro's GeoInsights module - Pro-only) - one real
 * pair of calls, reused by GeoVisibilitySummaryCard.tsx ("Overall AI
 * Visibility", merging what used to be GeoVisibilityOverviewRow.tsx's
 * "Overall AI Visibility"/"The 4 things AI checks for" and
 * GeoTrendCompactCard.tsx's "Are You Getting Easier to Find?" into one
 * card - see that component's own docblock), and the "your own score" bar
 * GeoTab.tsx passes into the Pro competitor-comparison slot - same "one
 * real call, reused by every card that needs it" pattern
 * `useGeoFindingGroups` above already establishes for `/findings/groups`.
 * `history`'s own most-recent row already carries a real `overall_score`
 * (GeoInsights\VisibilitySnapshotBuilder::calculate_overall_score()) even
 * though `snapshot` itself only exposes the raw per-dimension breakdown -
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
