/* global appLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ListComponent, AnalyticsComponent } from '@zyra/components';
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
	// `severityBreakdown` (useSeoScore()) only ever carries critical/high/
	// medium/low — no `info` tier. This card already fetches every real
	// open SEO finding for the ranked list below, so `info`'s own real
	// count comes from that same fetch (each finding's own real
	// `severity`) rather than a second endpoint or a fabricated number.
	const [infoCount, setInfoCount] = useState(0);
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

				if (!cancelled) {
					setInfoCount(
						findings.filter((finding) => 'info' === finding.severity)
							.length
					);
				}

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

	const severityStats: { key: string; label: string; colorClass: string; icon: string; value: number }[] = [
		{ key: 'critical', label: __('Critical', 'vulopilot'), colorClass: 'pink', icon: 'error', value: severityBreakdown.critical },
		{ key: 'high', label: __('High', 'vulopilot'), colorClass: 'green', icon: 'error', value: severityBreakdown.high },
		{ key: 'medium', label: __('Medium', 'vulopilot'), colorClass: 'yellow', icon: 'error', value: severityBreakdown.medium },
		{ key: 'low', label: __('Low', 'vulopilot'), colorClass: 'red', icon: 'error', value: severityBreakdown.low },
		{ key: 'info', label: __('Info', 'vulopilot'), colorClass: 'blue', icon: 'info', value: infoCount },
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
				<AnalyticsComponent
					cols={3}
					isLoading={isLoading}
					variant='small-card'
					data={severityStats.map((stat) => ({
						icon: stat.icon,
						iconClass: stat.colorClass,
						colorClass: stat.colorClass,
						number: stat.value,
						text: stat.label,
					}))}
				/>

				<ListComponent
					className="mini-card report"
					items={
						0 === rankedIssues.length && !isLoading
							? [
								{
									id: 'empty',
									title: __(
										'No open SEO issues right now — nice work.',
										'vulopilot'
									),
								},
							]
							: rankedIssues.map((issue) => ({
								id: String(issue.scannerId),
								title: sprintf(
									/* translators: 1: real number of affected pages, 2: real issue type label, e.g. "Canonical URL". */
									_n(
										'%1$d page has %2$s',
										'%1$d pages have %2$s',
										issue.affectedPages,
										'vulopilot'
									),
									issue.affectedPages,
									issue.label
								),
								icon: 'error red',
								action: scrollToIssues,
								tags: (
									<i className="adminfont-next" />
								),
							}))
					}
				/>
			</div>

			<div className="fix-first-view-all">
				<ButtonInput
					buttons={{
						text: sprintf(
							/* translators: %d: total real open SEO issue count. */
							__('View all %d issues', 'vulopilot'),
							totalOpen
						),
						color: 'border-purple',
						rightIcon: 'arrow-right',
						onClick: scrollToIssues,
					}}
				/>
			</div>
		</CardComponent>
	);
};

export default WhatShouldIFixFirstCard;
