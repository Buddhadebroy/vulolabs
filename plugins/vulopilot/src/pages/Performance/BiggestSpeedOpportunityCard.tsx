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

interface BiggestSpeedOpportunityCardProps {
	/** Jumps to the real "Slow Pages" tab — every page this issue affects is a real row there. */
	onViewSlowPages: () => void;
}

/**
 * "Biggest Speed Opportunity" — one real, prioritized recommendation
 * instead of a static tip list, per direct instruction: replaces
 * PerformanceTipsCard.tsx (now deleted), which restated the exact same
 * category names MetricsGrid.tsx's own tiles already show ("Use WebP
 * Images"/"Enable Full Page Cache"/"Minify CSS & JavaScript" — the same
 * ground as the Images/Caching/CSS tiles above it, just as prose).
 *
 * Reads the real, already-built `top_issues` from `GET /page-speed`
 * (Repositories\PageSpeedRepository::get_top_issues() — real Lighthouse
 * opportunity-audit titles or plain load-time labels, grouped by how many
 * real pages they affect, ranked highest-impact first; already backs Slow
 * Pages' own "Why these pages are slow?" sidebar, reused here rather than
 * duplicated). Deliberately doesn't show a fabricated "~1.2s" time
 * estimate the way the mockup's own copy does — no real per-issue
 * millisecond-savings figure is exposed anywhere in this codebase (Google's
 * own Lighthouse `numericValue` is used server-side only to pick which
 * issue ranks highest, never persisted or returned) — real "affects N
 * page(s)" impact instead, same "never a fabricated number" posture
 * PageSpeedRepository's own docblock documents.
 */
const BiggestSpeedOpportunityCard = ({
	onViewSlowPages,
}: BiggestSpeedOpportunityCardProps) => {
	const [topIssue, setTopIssue] = useState<PageSpeedIssue | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<PageSpeedResponse>(
			getApiLink(appLocalizer, 'page-speed') + '?per_page=1',
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				setTopIssue(response?.top_issues?.[0] ?? null);
			})
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<CardComponent
			title={__('Biggest Speed Opportunity', 'vulopilot')}
			titleIcon="light"
			isLoading={isLoading}
		>
			{!isLoading && !topIssue && (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing to optimize yet', 'vulopilot')}
					desc={__(
						'Run a speed test to find your biggest opportunity.',
						'vulopilot'
					)}
				/>
			)}
			{!isLoading && topIssue && (
				<>
					<div className="speed-opportunity-title">{topIssue.issue}</div>
					<div className="desc">
						{sprintf(
							/* translators: %d is the number of real pages this issue affects. */
							_n(
								'Affects %d page.',
								'Affects %d pages.',
								topIssue.affected_pages,
								'vulopilot'
							),
							topIssue.affected_pages
						)}
					</div>
					<ButtonInput
						position="full-width"
						buttons={{
							text: __('View Affected Pages', 'vulopilot'),
							rightIcon: 'pagination-right-arrow',
							color: 'border-purple',
							onClick: onViewSlowPages,
						}}
					/>
				</>
			)}
		</CardComponent>
	);
};

export default BiggestSpeedOpportunityCard;
