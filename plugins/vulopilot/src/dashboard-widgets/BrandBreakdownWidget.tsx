/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { ChartComponent, ModuleGuardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

interface BrandScore {
	brand_score: number;
	trust_score: number;
	authority_score: number;
	entity_score: number;
}

/**
 * Brand Intelligence's own real, deterministic sub-scores
 * (`GET /brand-intelligence/score` — Controllers/BrandIntelligence.php),
 * shown as a bar chart. No competitor share-of-voice data exists anywhere
 * in this codebase (that would need an external source like Ahrefs, which
 * isn't wired up) — this shows the three real sub-scores VuloPilot itself
 * computes instead of fabricating a competitive comparison. Fetches its
 * own data rather than reading off the shared /dashboard summary, same
 * reasoning HealthTimelineWidget's own docblock gives for list/breakdown
 * shaped widgets.
 */
const BrandBreakdownWidget: React.FC<WidgetProps> = ({
	onHide,
	isCustomizing,
}) => {
	const [score, setScore] = useState<BrandScore | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<BrandScore>(
			getApiLink(appLocalizer, 'brand-intelligence/score'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setScore(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	const data = score
		? [
				{ label: __('Overall', 'vulopilot'), value: score.brand_score },
				{ label: __('Trust', 'vulopilot'), value: score.trust_score },
				{
					label: __('Authority', 'vulopilot'),
					value: score.authority_score,
				},
				{ label: __('Entity', 'vulopilot'), value: score.entity_score },
			]
		: [];

	return (
		<DashboardWidget
			title={__('Brand Visibility breakdown', 'vulopilot')}
			icon="person pink-color"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
			borderColor="pink"
		>
			{!isLoading && !score ? (
				<ModuleGuardComponent
					icon="error"
					title={__(
						'Could not load Brand Visibility scores',
						'vulopilot'
					)}
					desc={__('Try refreshing the dashboard.', 'vulopilot')}
				/>
			) : (
				<ChartComponent
					type="bar"
					data={data}
					dataKey="value"
					labelKey="label"
					layout="vertical"
					height={200}
					color="pink"
					isLoading={isLoading}
				/>
			)}
		</DashboardWidget>
	);
};

export default BrandBreakdownWidget;
