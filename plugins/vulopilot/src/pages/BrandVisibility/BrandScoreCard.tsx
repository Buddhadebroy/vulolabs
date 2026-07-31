/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, AnalyticsComponent } from '@zyra/components';

interface BrandScoreResponse {
	brand_score: number;
	trust_score: number;
	authority_score: number;
	entity_score: number;
	severity_breakdown: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
}

/**
 * Brand Visibility page's "Brand Score" card — `GET /brand-intelligence/score`
 * (Controllers\BrandIntelligence, Free — deterministic, no AI call). Same
 * fetch-on-mount, read-only shape Content page's ContentScoreCard.tsx
 * already uses, extended with Brand's own 3 named sub-scores.
 */
const BrandScoreCard = () => {
	const [data, setData] = useState<BrandScoreResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<BrandScoreResponse>(
			getApiLink(appLocalizer, 'brand-intelligence/score'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setData(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<CardComponent
			title={__('Brand Score', 'vulopilot')}
			desc={__(
				'A composite score across trust signals, authority signals, and entity/schema consistency.',
				'vulopilot'
			)}
			isLoading={isLoading}
		>
			{data && (
				<AnalyticsComponent
					variant="dashboard"
					cols={4}
					data={[
						{
							icon: 'admin-users',
							number: `${data.brand_score}/100`,
							text: __('Brand Score', 'vulopilot'),
						},
						{
							icon: 'shield',
							number: `${data.trust_score}/100`,
							text: __('Trust Score', 'vulopilot'),
						},
						{
							icon: 'star-filled',
							number: `${data.authority_score}/100`,
							text: __('Authority Score', 'vulopilot'),
						},
						{
							icon: 'networking',
							number: `${data.entity_score}/100`,
							text: __('Entity Score', 'vulopilot'),
						},
					]}
				/>
			)}
		</CardComponent>
	);
};

export default BrandScoreCard;
