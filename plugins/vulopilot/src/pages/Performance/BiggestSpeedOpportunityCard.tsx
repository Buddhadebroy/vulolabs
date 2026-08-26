/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface PageSpeedIssue {
	issue: string;
	affected_pages: number;
}

interface PageSpeedResponse {
	top_issues: PageSpeedIssue[];
}

/** One row of `GET /findings/groups` — only the fields this card actually reads (real scanner label + real open-finding count), same "narrow local slice" posture other cards in this codebase already take rather than importing a shared full `FindingGroup` type. */
interface FindingGroupRow {
	label: string;
	count: number;
}

interface FindingGroupsResponse {
	data: FindingGroupRow[];
}

type SpeedOpportunity =
	| { source: 'page_speed'; label: string; count: number }
	| { source: 'finding'; label: string; count: number };

interface BiggestSpeedOpportunityCardProps {
	/** Jumps to the real "Slow Pages" tab — only meaningful for a page_speed-sourced opportunity, where every affected page is a real row there. */
	onViewSlowPages: () => void;
	/** Jumps to the real "Top Issues" findings table on this same tab (`#performance-section-findings`) — where a finding-sourced opportunity's own row actually lives. */
	onViewFindings: () => void;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * "Biggest Speed Opportunity" — one real, prioritized recommendation
 * instead of a static tip list, per direct instruction: replaces
 * PerformanceTipsCard.tsx (now deleted), which restated the exact same
 * category names MetricsGrid.tsx's own tiles already show ("Use WebP
 * Images"/"Enable Full Page Cache"/"Minify CSS & JavaScript" — the same
 * ground as the Images/Caching/CSS tiles above it, just as prose).
 *
 * Primary source: the real, already-built `top_issues` from `GET /page-speed`
 * (Repositories\PageSpeedRepository::get_top_issues() — real Lighthouse
 * opportunity-audit titles or plain load-time labels, grouped by how many
 * real pages they affect, ranked highest-impact first; already backs Slow
 * Pages' own "Why these pages are slow?" sidebar, reused here rather than
 * duplicated).
 *
 * Confirmed live: `top_issues` comes back empty on any site that hasn't run
 * a real per-page speed test yet, or whose tested pages all scored "good" —
 * which previously showed "Nothing to optimize yet" even while this same
 * Performance tab's own "Top Issues" table (below) listed real, open
 * Performance-category findings (missing caching, unminified CSS/JS, no
 * CDN, ...), reading as "this card isn't wired up" rather than "no
 * PageSpeed data yet." Falls back to that same real data instead
 * (`GET /findings/groups?category=performance`, highest-severity-first —
 * the exact query "Top Issues" itself is built from) when `top_issues` is
 * empty, rather than claiming nothing needs attention while real open
 * issues sit lower on this same page. Still deliberately doesn't show a
 * fabricated "~1.2s" time estimate the way the mockup's own copy does — no
 * real per-issue millisecond-savings figure is exposed anywhere in this
 * codebase for either source (Google's own Lighthouse `numericValue` is
 * used server-side only to pick which issue ranks highest, never persisted
 * or returned) — a real "affects N page(s)"/"affects N endpoint(s)" count
 * instead, same "never a fabricated number" posture PageSpeedRepository's
 * own docblock documents.
 */
const BiggestSpeedOpportunityCard = ({
	onViewSlowPages,
	onViewFindings,
}: BiggestSpeedOpportunityCardProps) => {
	const [opportunity, setOpportunity] = useState<SpeedOpportunity | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<PageSpeedResponse>(
			getApiLink(appLocalizer, 'page-speed') + '?per_page=1',
			nonceHeaders
		)
			.then((response) => {
				const topIssue = response?.top_issues?.[0];

				if (topIssue) {
					setOpportunity({
						source: 'page_speed',
						label: topIssue.issue,
						count: topIssue.affected_pages,
					});
					return null;
				}

				return getApiResponse<FindingGroupsResponse>(
					getApiLink(
						appLocalizer,
						'findings/groups?category=performance&per_page=1'
					),
					nonceHeaders
				);
			})
			.then((groupsResponse) => {
				const group = groupsResponse?.data?.[0];

				if (group) {
					setOpportunity({
						source: 'finding',
						label: group.label,
						count: group.count,
					});
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<CardComponent
			title={__('Biggest Speed Opportunity', 'vulopilot')}
			titleIcon="light"
			isLoading={isLoading}
		>
			{!isLoading && !opportunity && (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing to optimize yet', 'vulopilot')}
					desc={__(
						'Run a speed test to find your biggest opportunity.',
						'vulopilot'
					)}
				/>
			)}
			{!isLoading && opportunity && (
				<>
					<div className="speed-opportunity-title">
						{opportunity.label}
					</div>
					<div className="desc">
						{'page_speed' === opportunity.source
							? sprintf(
								/* translators: %d is the number of real pages this issue affects. */
								_n(
									'Affects %d page.',
									'Affects %d pages.',
									opportunity.count,
									'vulopilot'
								),
								opportunity.count
							)
							: sprintf(
								/* translators: %d is the number of real endpoints this issue affects. */
								_n(
									'Affects %d endpoint.',
									'Affects %d endpoints.',
									opportunity.count,
									'vulopilot'
								),
								opportunity.count
							)}
					</div>
					<ButtonInput
						position="full-width"
						buttons={{
							text:
								'page_speed' === opportunity.source
									? __('View Affected Pages', 'vulopilot')
									: __('View Details', 'vulopilot'),
							rightIcon: 'pagination-right-arrow',
							color: 'border-purple',
							onClick:
								'page_speed' === opportunity.source
									? onViewSlowPages
									: onViewFindings,
						}}
					/>
				</>
			)}
		</CardComponent>
	);
};

export default BiggestSpeedOpportunityCard;
