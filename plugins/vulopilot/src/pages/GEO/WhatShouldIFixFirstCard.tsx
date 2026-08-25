/* global appLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { SeoScoreResponse } from './useSeoScore';
import {
	ALL_SEO_SCANNER_IDS,
	bucketFindingsByPage,
	fetchOpenFindingsFor,
	nonceHeaders,
} from './seoIssuesShared';
import './WhatShouldIFixFirst.scss';

interface FindingGroupRow {
	scanner_id: string;
	label: string;
}

interface RankedIssueType {
	scannerId: string;
	label: string;
	affectedPages: number;
}

/** Top N issue types shown in the ranked "biggest wins" list — same real reasoning a "top offenders" list anywhere else in this app caps itself (e.g. `FindingRepository::get_top_finding_groups()`'s own default `$limit = 3`), just a slightly longer list to match the reference mockup's own 5 rows. */
const MAX_RANKED_ISSUES = 5;

interface WhatShouldIFixFirstCardProps {
	severityBreakdown: SeoScoreResponse['severity_breakdown'];
	totalOpen: number;
	isLoadingScore: boolean;
}

/**
 * "What should I fix first?" — a new, additive card (SEO & Visibility →
 * SEO, direct instruction: sits above the existing filter-tabs/severity
 * cards/Site-wide Issues/Pages & Posts section, which stays completely
 * unchanged). Two real halves:
 *
 * - Left: the same real Critical/High/Medium/Low counts `useSeoScore()`
 *   already fetches for the "SEO Health Score" card above (passed down as
 *   `severityBreakdown` rather than re-fetched) — that endpoint's own
 *   `severity_breakdown` already includes all 4 tiers, just not all 4 were
 *   rendered anywhere on this tab until now.
 * - Right: a real ranked list of "N pages have {issue type}" — this card's
 *   own fetch of every currently-open finding across the same 15 real SEO
 *   scanner ids `IssuesSection.tsx`'s own SEO usage covers (reusing its
 *   exported `fetchOpenFindingsFor()`/`bucketFindingsByPage()` helpers
 *   directly, a second real fetch rather than lifting state out of
 *   `IssuesSection.tsx` — kept fully separate per direct instruction to
 *   leave that section, and everything under it, completely intact),
 *   grouped by `scanner_id` and counted by real DISTINCT affected page
 *   count (not raw finding count), top 5 shown worst-first. Every SEO
 *   scanner id is page-scoped (`object_type: 'post'`), so no site-wide
 *   bucket is needed here the way `IssuesSection.tsx`'s own fetch keeps one.
 *
 * "View all N issues" scrolls the existing filter-tab bar below into view
 * rather than duplicating any of its own state/behavior.
 */
const WhatShouldIFixFirstCard = ({
	severityBreakdown,
	totalOpen,
	isLoadingScore,
}: WhatShouldIFixFirstCardProps) => {
	const [rankedIssues, setRankedIssues] = useState<RankedIssueType[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const [findings, groupsResponse] = await Promise.all([
					fetchOpenFindingsFor(ALL_SEO_SCANNER_IDS),
					getApiResponse<{ data: FindingGroupRow[] }>(
						getApiLink(appLocalizer, 'findings/groups?per_page=100'),
						nonceHeaders
					),
				]);

				const { byPostId } = bucketFindingsByPage(findings);
				const labelByScannerId = new Map<string, string>(
					(groupsResponse?.data ?? []).map(
						(group: FindingGroupRow): [string, string] => [
							group.scanner_id,
							group.label,
						]
					)
				);

				const affectedPagesByScannerId = new Map<string, Set<number>>();
				byPostId.forEach((pageFindings, postId) => {
					pageFindings.forEach((finding) => {
						if (!affectedPagesByScannerId.has(finding.scanner_id)) {
							affectedPagesByScannerId.set(finding.scanner_id, new Set());
						}
						affectedPagesByScannerId.get(finding.scanner_id)?.add(postId);
					});
				});

				const ranked: RankedIssueType[] = Array.from(
					affectedPagesByScannerId.entries()
				)
					.map(([scannerId, pages]) => ({
						scannerId,
						label: labelByScannerId.get(scannerId) || scannerId,
						affectedPages: pages.size,
					}))
					.sort((a, b) => b.affectedPages - a.affectedPages)
					.slice(0, MAX_RANKED_ISSUES);

				if (!cancelled) {
					setRankedIssues(ranked);
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const scrollToIssues = () => {
		document
			.querySelector('.seo-issues-filter-tabs')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const severityStats: { key: keyof SeoScoreResponse['severity_breakdown']; label: string; className: string }[] = [
		{ key: 'critical', label: __('Critical', 'vulopilot'), className: 'is-poor' },
		{ key: 'high', label: __('High', 'vulopilot'), className: 'is-attention' },
		{ key: 'medium', label: __('Medium', 'vulopilot'), className: 'is-medium' },
		{ key: 'low', label: __('Low', 'vulopilot'), className: 'is-good' },
	];

	return (
		<CardComponent
			title={__('What should I fix first?', 'vulopilot')}
			desc={__(
				'These issues have the biggest impact on your search visibility.',
				'vulopilot'
			)}
			isLoading={isLoadingScore || isLoading}
		>
			<div className="fix-first-layout">
				<div className="fix-first-severity">
					{severityStats.map((stat) => (
						<div className="fix-first-severity-stat" key={stat.key}>
							<div className={`typography-h3 ${stat.className}`}>
								{severityBreakdown[stat.key]}
							</div>
							<div className="typography-body-xs">{stat.label}</div>
						</div>
					))}
				</div>

				<div className="fix-first-ranked">
					{0 === rankedIssues.length && !isLoading ? (
						<div className="fix-first-empty typography-body-xs">
							{__('No open SEO issues right now — nice work.', 'vulopilot')}
						</div>
					) : (
						rankedIssues.map((issue) => (
							<div className="fix-first-ranked-row" key={issue.scannerId}>
								<span className="fix-first-ranked-count">
									{issue.affectedPages}
								</span>
								<span className="fix-first-ranked-label">
									{sprintf(
										/* translators: %s: real issue type label, e.g. "Canonical URL". */
										_n(
											'%s — 1 page affected',
											'%s — %d pages affected',
											issue.affectedPages,
											'vulopilot'
										),
										issue.label,
										issue.affectedPages
									)}
								</span>
							</div>
						))
					)}
				</div>
			</div>

			<div className="fix-first-view-all">
				<ButtonInput
					buttons={{
						text: sprintf(
							/* translators: %d: total real open SEO issue count. */
							__('View all %d issues', 'vulopilot'),
							totalOpen
						),
						onClick: scrollToIssues,
					}}
				/>
			</div>
		</CardComponent>
	);
};

export default WhatShouldIFixFirstCard;
