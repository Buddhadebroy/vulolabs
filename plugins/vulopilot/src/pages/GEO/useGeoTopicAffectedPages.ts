import { useEffect, useState } from '@wordpress/element';
import { bucketFindingsByPage, fetchOpenFindingsFor } from './seoIssuesShared';

/**
 * Real, *distinct*-page counts per scanner id — `useGeoFindingGroups.ts`'s
 * own `sumGroupCounts()` adds up raw finding rows, which over-counts a page
 * with two findings from scanners in the same topic (GeoByTopicGrid.tsx's
 * new "Affected pages" stat needs the actual number of distinct pages
 * touched, not the raw issue count that stat already shows next to it).
 * Reuses the exact same real fetch+bucket `IssuesSection.tsx` already runs
 * for this tab's "All GEO Issues" table (`fetchOpenFindingsFor()` +
 * `bucketFindingsByPage()`, seoIssuesShared.tsx) — a second real call
 * rather than lifting that fetch out of IssuesSection, which owns it for
 * its own good reasons (see that component's own docblock); the trade is
 * one extra request against an endpoint this same tab already hits, not a
 * second source of truth.
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

/** Real distinct-page union across every scanner id in `scannerIds` — GeoByTopicGrid.tsx's own per-topic tile stat. */
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
