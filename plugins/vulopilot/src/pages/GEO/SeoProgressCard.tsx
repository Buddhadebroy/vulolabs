/* global appLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { AnalyticsComponent, CardComponent, ChartComponent, ModuleGuardComponent } from '@zyra/components';
import { nonceHeaders } from './seoIssuesShared';
import './WhatShouldIFixFirst.scss';

interface TrendPoint {
	date: string;
	score: number;
}

interface WeekStat {
	this_week: number;
	delta: number;
}

interface SeoProgressResponse {
	trend: TrendPoint[];
	issues_fixed: WeekStat;
	new_issues: WeekStat;
	pages_improved: WeekStat;
}

/** Same signed "+N"/"-N" convention `deltaLabel()` (SeoTab.tsx) already established for the sitewide score's own week-over-week delta — reused here for all 3 progress counters' own real week-over-week change. */
const signedDelta = (delta: number): string => (delta > 0 ? `+${delta}` : `${delta}`);

/**
 * "SEO progress" — a new, additive card (direct instruction: sits above the
 * existing filter-tabs/severity cards/Site-wide Issues/Pages & Posts
 * section, which this doesn't touch). `GET /seo/progress` (Seo.php): a real
 * 7-day score trend (one real reconstructed score per day, same
 * `..._as_of()` technique the "SEO Health Score" card's own single 7-day
 * delta already uses — no new stored snapshot table) plus 3 real
 * week-over-week counters (`count_resolved_between()`/`get_stats_for_period()`,
 * both already existing repository methods; "Pages Improved" reuses "Pages
 * that need attention"'s own new `get_open_findings_for_scanner_ids_by_post()`
 * helper to compare real per-page scores now vs a week ago).
 */
const SeoProgressCard = () => {
	const [data, setData] = useState<SeoProgressResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);

	useEffect(() => {
		let cancelled = false;

		getApiResponse<SeoProgressResponse>(
			getApiLink(appLocalizer, 'seo/progress'),
			nonceHeaders
		)
			.then((response) => {
				if (cancelled) {
					return;
				}
				if (response) {
					setData(response);
				} else {
					setHasError(true);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setHasError(true);
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
	}, []);

	const latestScore = data && data.trend.length > 0 ? data.trend[data.trend.length - 1].score : null;

	return (
		<CardComponent
			title={__('SEO progress', 'vulopilot')}
			desc={__('Track your SEO health over time.', 'vulopilot')}
			isLoading={isLoading}
		>
			{hasError && (
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load your SEO progress', 'vulopilot')}
					desc={__(
						'Something went wrong fetching this data. Please try again.',
						'vulopilot'
					)}
				/>
			)}

			{data && (
				<div className="seo-progress-layout">
					<div className="seo-progress-chart">
						<div className="seo-progress-chart-title typography-body-xs">
							{__('SEO Score Over Time', 'vulopilot')}
						</div>
						<ChartComponent
							type="area"
							data={data.trend}
							dataKey="score"
							xKey="date"
							height={220}
							yDomain={[0, 100]}
							color="#7C3AED"
						/>
						{null !== latestScore && (
							<div className="seo-progress-latest-score">
								{sprintf(
									/* translators: %d: current real SEO score, 0-100. */
									__('Latest: %d', 'vulopilot'),
									latestScore
								)}
							</div>
						)}
					</div>

					<div className="seo-progress-stats">
						<AnalyticsComponent
							data={[
								{
									icon: 'check',
									colorClass: 'green',
									number: String(data.issues_fixed.this_week),
									text: (
										<>
											<div className="typography-body-xs">
												{__('Issues Fixed', 'vulopilot')}
											</div>
											<div className="typography-caption is-good">
												{sprintf(
													/* translators: %s: signed change vs the previous week, e.g. "+18". */
													__('%s this week', 'vulopilot'),
													signedDelta(data.issues_fixed.delta)
												)}
											</div>
										</>
									),
								},
								{
									icon: 'error',
									colorClass: 'yellow',
									number: String(data.new_issues.this_week),
									text: (
										<>
											<div className="typography-body-xs">
												{__('New Issues', 'vulopilot')}
											</div>
											<div
												className={`typography-caption ${data.new_issues.delta <= 0 ? 'is-good' : 'is-attention'}`}
											>
												{sprintf(
													/* translators: %s: signed change vs the previous week, e.g. "-6". */
													__('%s this week', 'vulopilot'),
													signedDelta(data.new_issues.delta)
												)}
											</div>
										</>
									),
								},
								{
									icon: 'document',
									colorClass: 'blue',
									number: String(data.pages_improved.this_week),
									text: (
										<>
											<div className="typography-body-xs">
												{__('Pages Improved', 'vulopilot')}
											</div>
											<div className="typography-caption is-good">
												{sprintf(
													/* translators: %s: signed change vs the previous week, e.g. "+3". */
													__('%s this week', 'vulopilot'),
													signedDelta(data.pages_improved.delta)
												)}
											</div>
										</>
									),
								},
							]}
							variant="small-card"
							cols={1}
							isLoading={isLoading}
						/>
					</div>
				</div>
			)}
		</CardComponent>
	);
};

export default SeoProgressCard;
