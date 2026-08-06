/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ChartComponent } from '@zyra/components';

interface DashboardSummary {
	category_scores: { security: number };
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

/**
 * "Security Overview" — a single real number, `category_scores.security`
 * from `GET /dashboard` (same endpoint `PerformanceScoreCard.tsx`/
 * `VisibilityScoreCard.tsx` already use), rendered as the same 2-slice pie
 * gauge those cards already established. Drops the mockup's "Good 7 items
 * / Attention 3 items / Critical 1 item" legend — there's no honest way
 * to bucket all 11 metrics-grid tiles into good/attention/critical when 5
 * of them (Malware/Firewall/Login Protection/Backups/Recovery) are
 * genuinely untracked; claiming "good" for something never measured would
 * misreport it, same reasoning that dropped Improve Speed's fabricated
 * "+18 points"/"78th percentile" claims.
 */
const SecurityOverviewCard = () => {
	const [score, setScore] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<DashboardSummary>(
			getApiLink(appLocalizer, 'dashboard'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setScore(response.category_scores.security);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<CardComponent
			title={__('Security Overview', 'vulopilot')}
			titleIcon="security"
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
		</CardComponent>
	);
};

export default SecurityOverviewCard;
