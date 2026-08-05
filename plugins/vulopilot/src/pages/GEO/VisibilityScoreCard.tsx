/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ChartComponent } from '@zyra/components';
import './GrowMyTraffic.scss';

interface DashboardSummary {
	category_scores: { seo: number; geo: number };
}

interface BrandScoreResponse {
	brand_score: number;
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
 * "Visibility Score" — same hero-donut shape as the Dashboard's
 * OverallScoreWidget.tsx (`ChartComponent type="pie" legendPosition="side"`).
 * Real values: SEO and GEO ("AI Search") from `GET /dashboard`'s
 * `category_scores` (same endpoint Dashboard.tsx itself fetches), Brand
 * Presence from `GET /brand-intelligence/score`'s `brand_score`
 * (BrandScoreCard.tsx's exact endpoint). There's no AEO score anywhere in
 * this codebase (AeoTab.tsx's own docblock: a dedicated per-signal AEO
 * score hasn't been built) — rather than fabricate a 4th number, its
 * legend slot shows "Not scored yet" and contributes 0 to the donut (same
 * "0 renders as no visible slice" precedent the Dashboard's Commerce score
 * already established for sites without WooCommerce). The center label
 * averages only the 3 real scores.
 */
const VisibilityScoreCard = () => {
	const [scores, setScores] = useState<{
		seo: number;
		geo: number;
		brand: number | null;
	} | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		Promise.all([
			getApiResponse<DashboardSummary>(
				getApiLink(appLocalizer, 'dashboard'),
				{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
			),
			getApiResponse<BrandScoreResponse>(
				getApiLink(appLocalizer, 'brand-intelligence/score'),
				{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
			),
		])
			.then(([dashboard, brand]) => {
				setScores({
					seo: dashboard?.category_scores.seo ?? 0,
					geo: dashboard?.category_scores.geo ?? 0,
					brand: brand?.brand_score ?? null,
				});
			})
			.finally(() => setIsLoading(false));
	}, []);

	const brand = scores?.brand ?? 0;
	const realScores = scores
		? [scores.seo, scores.geo, ...(scores.brand !== null ? [scores.brand] : [])]
		: [];
	const overall = realScores.length
		? Math.round(
				realScores.reduce((sum, n) => sum + n, 0) / realScores.length
			)
		: 0;

	return (
		<CardComponent
			title={__('Visibility Score', 'vulopilot')}
			titleIcon="analytics"
			isLoading={isLoading}
		>
			{scores && (
				<ChartComponent
					type="pie"
					legendLabels
					legendPosition="side"
					height={180}
					centerLabel={
						<>
							<span className="score-ring-number">{overall}</span>
							<span className="score-ring-label">/100</span>
							<span className="score-ring-label">
								{getRating(overall)}
							</span>
						</>
					}
					data={[
						{
							label: __('SEO', 'vulopilot'),
							value: scores.seo,
							color: '#2563eb',
						},
						{
							label: __('AI Search (GEO)', 'vulopilot'),
							value: scores.geo,
							color: '#7c3aed',
						},
						{
							label: __('Answer Engine (AEO)', 'vulopilot'),
							value: 0,
							color: '#e5e7eb',
						},
						{
							label: __('Brand Presence', 'vulopilot'),
							value: brand,
							color: '#16a34a',
						},
					]}
				/>
			)}
			<p className="visibility-score-aeo-note">
				{__(
					'Answer Engine (AEO) scoring isn’t built yet — not counted above.',
					'vulopilot'
				)}
			</p>
		</CardComponent>
	);
};

export default VisibilityScoreCard;
