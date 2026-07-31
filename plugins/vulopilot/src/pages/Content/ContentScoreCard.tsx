/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, AnalyticsComponent } from '@zyra/components';

interface ContentScoreResponse {
	score: number;
	severity_breakdown: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
}

/**
 * Content page's "Content Score" card — `GET /content-intelligence/score`
 * (Controllers\ContentIntelligence, Free — deterministic, no AI call).
 * Same fetch-on-mount, read-only shape TopPagesCard.tsx already uses.
 */
const ContentScoreCard = () => {
	const [data, setData] = useState<ContentScoreResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<ContentScoreResponse>(
			getApiLink(appLocalizer, 'content-intelligence/score'),
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
			title={__('Content Score', 'vulopilot')}
			desc={__(
				'A composite score across readability, thin content, duplicate content, heading structure, internal linking, and orphan pages.',
				'vulopilot'
			)}
			isLoading={isLoading}
		>
			{data && (
				<AnalyticsComponent
					variant="dashboard"
					data={[
						{
							icon: 'media-text',
							number: `${data.score}/100`,
							text: __('Content Score', 'vulopilot'),
						},
						{
							icon: 'warning',
							number: data.severity_breakdown.critical,
							text: __('Critical', 'vulopilot'),
						},
						{
							icon: 'warning',
							number: data.severity_breakdown.high,
							text: __('High', 'vulopilot'),
						},
					]}
				/>
			)}
		</CardComponent>
	);
};

export default ContentScoreCard;
