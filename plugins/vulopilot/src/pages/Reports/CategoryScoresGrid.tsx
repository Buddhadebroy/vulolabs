/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent } from '@zyra/components';

interface CategoryScores {
	seo: number;
	performance: number;
	security: number;
	accessibility: number;
	woocommerce: number | null;
	geo: number;
	content: number;
	brand: number;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

const average = (nums: number[]): number =>
	Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length);

/**
 * The mockup's 6 category cards (Traffic/Visibility/Health/Performance/
 * Commerce/Content). Real `category_scores` (GET /dashboard, 8 keys)
 * regrouped using the same averaging precedent OverallScoreWidget.tsx
 * already established for Visibility/Health/Commerce/Performance — Content
 * is split out on its own here (unlike that widget's 4-way grouping, which
 * folds content into Visibility), so Visibility here averages only
 * seo/geo/brand. No sparkline/delta on any tile — no daily per-category
 * history exists anywhere (only overall_score has any snapshot history,
 * and only when Pro's AdvancedReports module is active — see
 * WebsiteProgressChart.tsx for that one real trend). Traffic has no real
 * score anywhere in this codebase and is shown honestly as "Not tracked
 * yet" rather than invented; Commerce shows "Not applicable" rather than a
 * misleading 0 when WooCommerce is inactive.
 */
const CategoryScoresGrid = () => {
	const [scores, setScores] = useState<CategoryScores | null>(null);

	useEffect(() => {
		getApiResponse<{ category_scores: CategoryScores }>(
			getApiLink(appLocalizer, 'dashboard'),
			nonceHeaders
		).then((response) => {
			if (response?.category_scores) {
				setScores(response.category_scores);
			}
		});
	}, []);

	const visibility = scores
		? average([scores.seo, scores.geo, scores.brand])
		: null;
	const health = scores
		? average([scores.security, scores.accessibility])
		: null;

	const tiles: {
		key: string;
		icon: string;
		label: string;
		value: number | null;
	}[] = [
		{
			key: 'traffic',
			icon: 'bar-chart',
			label: __('Traffic', 'vulopilot'),
			value: null,
		},
		{
			key: 'visibility',
			icon: 'search-discovery',
			label: __('Visibility', 'vulopilot'),
			value: visibility,
		},
		{
			key: 'health',
			icon: 'security',
			label: __('Health', 'vulopilot'),
			value: health,
		},
		{
			key: 'performance',
			icon: 'analytics',
			label: __('Performance', 'vulopilot'),
			value: scores ? scores.performance : null,
		},
		{
			key: 'commerce',
			icon: 'woocommerce',
			label: __('Commerce', 'vulopilot'),
			value: scores ? scores.woocommerce : null,
		},
		{
			key: 'content',
			icon: 'document',
			label: __('Content', 'vulopilot'),
			value: scores ? scores.content : null,
		},
	];

	return (
		<div className="category-scores-grid">
			{tiles.map((tile) => (
				<CardComponent key={tile.key} className="category-score-tile">
					<i className={`adminfont-${tile.icon}`} />
					{tile.value !== null ? (
						<span className="category-score-value">
							{tile.value}
							<span className="category-score-max">/100</span>
						</span>
					) : (
						<span className="category-score-unavailable">
							{tile.key === 'traffic'
								? __('Not tracked yet', 'vulopilot')
								: tile.key === 'commerce'
									? __('Not applicable', 'vulopilot')
									: '—'}
						</span>
					)}
					<span className="category-score-label">{tile.label}</span>
				</CardComponent>
			))}
		</div>
	);
};

export default CategoryScoresGrid;
