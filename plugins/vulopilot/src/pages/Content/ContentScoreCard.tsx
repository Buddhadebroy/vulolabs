/* global appLocalizer */

import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

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

/**
 * Content page's "Content Score" card.
 *
 * GET /content-intelligence/score
 *
 * Uses ChartComponent instead of AnalyticsComponent and follows
 * the same card/chart pattern as SecurityStatusCard.
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

	return (
		<CardComponent
			title={__('Content Score', 'vulopilot')}
			titleIcon="content"
			isLoading={isLoading}
		>
			{data && (
				<>
					<ChartComponent
						type="pie"
						height={160}
						centerLabel={
							<span>
								{data.score}
								<small>/100</small>
							</span>
						}
						data={[
							{
								label: __('Score', 'vulopilot'),
								value: data.score,
								color: '#2563eb',
							},
							{
								label: __('Remaining', 'vulopilot'),
								value: Math.max(0, 100 - data.score),
								color: '#e5e7eb',
							},
						]}
					/>

					<div>
						<div>
							<strong>
								{__('Severity Breakdown', 'vulopilot')}
							</strong>
						</div>

						<div>
							<span>
								{__('Critical', 'vulopilot')}
							</span>
							<span>{data.severity_breakdown.critical}</span>
						</div>

						<div>
							<span>
								{__('High', 'vulopilot')}
							</span>
							<span>{data.severity_breakdown.high}</span>
						</div>

						<div>
							<span>
								{__('Medium', 'vulopilot')}
							</span>
							<span>{data.severity_breakdown.medium}</span>
						</div>

						<div>
							<span>
								{__('Low', 'vulopilot')}
							</span>
							<span>{data.severity_breakdown.low}</span>
						</div>
					</div>
				</>
			)}
		</CardComponent>
	);
};

export default ContentScoreCard;