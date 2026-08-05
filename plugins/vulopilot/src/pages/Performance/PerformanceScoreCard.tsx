/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ChartComponent } from '@zyra/components';
import './ImproveSpeed.scss';

interface DashboardSummary {
	category_scores: { performance: number };
}

const getRating = (score: number): string => {
	if (score >= 90) {
		return __('Excellent', 'vulopilot');
	}
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 50) {
		return __('Fair', 'vulopilot');
	}
	return __('Needs work', 'vulopilot');
};

const CORE_WEB_VITALS = ['LCP', 'INP', 'CLS', 'FCP'];

/**
 * "Performance Score" — a single real number, `category_scores.performance`
 * from `GET /dashboard` (same endpoint `VisibilityScoreCard.tsx` already
 * uses), rendered as a 2-slice pie (score/remainder) since — unlike
 * Visibility Score's SEO/GEO/Brand breakdown — there's no natural
 * sub-category split for this one score to show as separate legend
 * slices. Core Web Vitals (LCP/INP/CLS/FCP) have no measurement anywhere
 * in this codebase (no CrUX/lab-data integration exists) — rendered
 * honestly as "Not tracked yet" rather than fabricated milliseconds.
 */
const PerformanceScoreCard = () => {
	const [score, setScore] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<DashboardSummary>(
			getApiLink(appLocalizer, 'dashboard'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setScore(response.category_scores.performance);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<CardComponent
			title={__('Performance Score', 'vulopilot')}
			titleIcon="analytics"
			isLoading={isLoading}
		>
			{score !== null && (
				<ChartComponent
					type="pie"
					height={180}
					centerLabel={
						<>
							<span className="score-ring-number">{score}</span>
							<span className="score-ring-label">/100</span>
							<span className="score-ring-label">
								{getRating(score)}
							</span>
						</>
					}
					data={[
						{
							label: __('Score', 'vulopilot'),
							value: score,
							color: score >= 70 ? '#16a34a' : '#d97706',
						},
						{
							label: __('Remaining', 'vulopilot'),
							value: 100 - score,
							color: '#e5e7eb',
						},
					]}
				/>
			)}
			<div className="core-web-vitals-row">
				{CORE_WEB_VITALS.map((metric) => (
					<div className="core-web-vitals-tile" key={metric}>
						<span className="core-web-vitals-label">{metric}</span>
						<span className="admin-badge indigo">
							{__('Not tracked yet', 'vulopilot')}
						</span>
					</div>
				))}
			</div>
		</CardComponent>
	);
};

export default PerformanceScoreCard;
