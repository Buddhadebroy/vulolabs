/* global appLocalizer */

import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ChartComponent } from '@zyra/components';

interface ContentScoreResponse {
	score: number;
	severity_breakdown: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
}

interface ScoreRating {
	label: string;
	color: string;
	badgeClass: string;
}

// Same 90/70/50 tiering dashboard-widgets/OverallScoreWidget.tsx's own
// getRating() uses for the main Dashboard's Overall Site Score. Kept as
// its own local copy rather than a shared helper — every other score
// card in this codebase (VisibilityScoreCard, PerformanceScoreCard, etc.)
// defines its own rating logic the same way — but the thresholds match,
// so "Fair" here means the same thing it does everywhere else.
const getRating = (score: number): ScoreRating => {
	if (score >= 90) {
		return {
			label: __('Excellent', 'vulopilot'),
			color: '#16a34a',
			badgeClass: 'green',
		};
	}
	if (score >= 70) {
		return {
			label: __('Good', 'vulopilot'),
			color: '#16a34a',
			badgeClass: 'green',
		};
	}
	if (score >= 50) {
		return {
			label: __('Fair', 'vulopilot'),
			color: '#b45309',
			badgeClass: 'yellow',
		};
	}
	return {
		label: __('Needs work', 'vulopilot'),
		color: '#dc2626',
		badgeClass: 'red',
	};
};

/**
 * Content page's "Content Score" card.
 *
 * GET /content-intelligence/score
 *
 * Uses ChartComponent instead of AnalyticsComponent and follows the same
 * card/chart pattern as SecurityStatusCard. The ring's fill color and the
 * "Needs work"/"Fair"/"Good"/"Excellent" rating both derive from the same
 * real score the ring plots — not a second, separately-fabricated signal.
 */
const ContentScoreCard = () => {
	const [data, setData] = useState<ContentScoreResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<ContentScoreResponse>(
			getApiLink(appLocalizer, 'content-intelligence/score'),
			{
				headers: {
					'X-WP-Nonce': appLocalizer.nonce,
				},
			}
		)
			.then((response) => {
				if (response) {
					setData(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	const rating = data ? getRating(data.score) : null;
	const breakdown = data?.severity_breakdown;
	const totalIssues = breakdown
		? breakdown.critical + breakdown.high + breakdown.medium + breakdown.low
		: 0;

	return (
		<CardComponent
			title={__('Content Score', 'vulopilot')}
			titleIcon="content"
			isLoading={isLoading}
		>
			{data && rating && breakdown && (
				<div className="content-score-card">
					<ChartComponent
						type="pie"
						height={160}
						centerLabel={
							<span className="content-score-value">
								{data.score}
								<small>/100</small>
							</span>
						}
						data={[
							{
								label: __('Score', 'vulopilot'),
								value: data.score,
								color: rating.color,
							},
							{
								label: __('Remaining', 'vulopilot'),
								value: Math.max(0, 100 - data.score),
								color: '#e5e7eb',
							},
						]}
					/>

					<span
						className={`admin-badge ${rating.badgeClass} content-score-rating`}
					>
						{rating.label}
					</span>

					<div className="content-score-breakdown">
						<div className="content-score-breakdown-header">
							<strong>
								{__('Severity Breakdown', 'vulopilot')}
							</strong>
							<span className="content-score-breakdown-total">
								{sprintf(
									/* translators: %d: number of open content findings */
									__('%d total', 'vulopilot'),
									totalIssues
								)}
							</span>
						</div>

						<ul>
							<li>
								<span className="admin-badge badge-critical">
									{__('Critical', 'vulopilot')}
								</span>
								<span className="content-score-severity-count">
									{breakdown.critical}
								</span>
							</li>
							<li>
								<span className="admin-badge badge-high">
									{__('High', 'vulopilot')}
								</span>
								<span className="content-score-severity-count">
									{breakdown.high}
								</span>
							</li>
							<li>
								<span className="admin-badge badge-medium">
									{__('Medium', 'vulopilot')}
								</span>
								<span className="content-score-severity-count">
									{breakdown.medium}
								</span>
							</li>
							<li>
								<span className="admin-badge badge-low">
									{__('Low', 'vulopilot')}
								</span>
								<span className="content-score-severity-count">
									{breakdown.low}
								</span>
							</li>
						</ul>
					</div>
				</div>
			)}
		</CardComponent>
	);
};

export default ContentScoreCard;