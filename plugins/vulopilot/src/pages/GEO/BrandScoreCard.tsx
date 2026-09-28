/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { MetricTileComponent, type MetricTileItem } from '@zyra/components';

interface BrandScoreResponse {
	brand_score: number;
	trust_score: number;
	authority_score: number;
	/** Still real, still returned by this same endpoint - just no longer one of this card's own tiles. */
	entity_score: number;
	severity_breakdown: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
}

const getRating = (score: number): string => {
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 40) {
		return __('Needs Work', 'vulopilot');
	}
	return __('At Risk', 'vulopilot');
};

/**
 * Same 3-tier thresholds as `getRating()` above, as one of zyra's own `$color-palette` names.
 */
const ratingColor = (score: number): string => {
	if (score >= 70) {
		return 'green';
	}
	if (score >= 40) {
		return 'yellow';
	}
	return 'red';
};

const RING_COLOR: Record<string, string> = {
	green: '#16a34a',
	yellow: '#b7791f',
	red: '#dc2626',
};

const SCORE_TILES: {
	key: keyof Pick<
		BrandScoreResponse,
		'brand_score' | 'trust_score' | 'authority_score'
	>;
	icon: string;
	title: string;
	desc: string;
}[] = [
	{
		key: 'brand_score',
		icon: 'person green',
		title: __('Brand Score', 'vulopilot'),
		desc: __(
			'A composite score across trust signals and authority signals.',
			'vulopilot'
		),
	},
	{
		key: 'trust_score',
		icon: 'security blue',
		title: __('Trust Score', 'vulopilot'),
		desc: __(
			'How trustworthy your site looks to people and AI engines.',
			'vulopilot'
		),
	},
	{
		key: 'authority_score',
		icon: 'star pink',
		title: __('Authority Score', 'vulopilot'),
		desc: __(
			'How strong your brand is based on reputation and credibility.',
			'vulopilot'
		),
	},
];

/**
 * Brand Visibility page's own score cards - `GET /brand-intelligence/score` (BrandIntelligence,
 * Free - deterministic, no AI call).
 */
const BrandScoreCard = () => {
	const [data, setData] = useState<BrandScoreResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<BrandScoreResponse>(
			getApiLink(vulopilotAppLocalizer, 'brand-intelligence/score'),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setData(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	return (
		<MetricTileComponent
			cols={3}
			isLoading={isLoading}
			data={SCORE_TILES.map((tile) => {
				const score = data ? data[tile.key] : 0;
				const color = ratingColor(score);

				return {
					id: tile.key,
					icon: tile.icon,
					title: tile.title,
					desc: tile.desc,
					number: sprintf(
						/* translators: %d: real 0-100 score. */
						__('%d/100', 'vulopilot'),
						score
					),
					status: { text: getRating(score), color },
					chart: {
						type: 'ring',
						data: score,
						color: RING_COLOR[color],
						height: 130,
					},
				};
			}) as MetricTileItem[]}
		/>
	);
};

export default BrandScoreCard;
