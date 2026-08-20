/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ColumnComponent, ContainerComponent, BadgeComponent } from '@zyra/components';

interface BrandScoreResponse {
	brand_score: number;
	trust_score: number;
	authority_score: number;
	/** Still real, still returned by this same endpoint — just no longer one of this card's own tiles. KnowledgeGraphSection.tsx's own "Entity Understanding" card reads this same field directly (see BrandIntelligence.php's own docblock for why it moved there). */
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
	return __('Poor', 'vulopilot');
};

const ratingClass = (score: number): string => {
	if (score >= 70) {
		return 'is-good';
	}
	if (score >= 40) {
		return 'is-attention';
	}
	return 'is-poor';
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
		icon: 'person',
		title: __('Brand Score', 'vulopilot'),
		desc: __(
			'A composite score across trust signals and authority signals.',
			'vulopilot'
		),
	},
	{
		key: 'trust_score',
		icon: 'security',
		title: __('Trust Score', 'vulopilot'),
		desc: __(
			'How trustworthy your site looks to people and AI engines.',
			'vulopilot'
		),
	},
	{
		key: 'authority_score',
		icon: 'star',
		title: __('Authority Score', 'vulopilot'),
		desc: __(
			'How strong your brand is based on reputation and credibility.',
			'vulopilot'
		),
	},
];

/**
 * Brand Visibility page's own score cards — `GET /brand-intelligence/score`
 * (Controllers\BrandIntelligence, Free — deterministic, no AI call), the
 * same real endpoint this card has always used, restyled from one combined
 * AnalyticsComponent tile row into separate cards (each with a real status
 * pill) to match the reference mockup's own visual language, same
 * "Good"/"Needs Work"/"Poor" thresholds GeoTab.tsx's own rating helpers use.
 *
 * 3 tiles now (Brand/Trust/Authority), not 4 — Entity Score moved to
 * KnowledgeGraphSection.tsx's own new "Entity Understanding" card (direct
 * instruction: "Knowledge Graph and Brand Visibility overlap around
 * 'Entity'... Entity Score therefore has a much stronger conceptual home
 * in Knowledge Graph"). `brand_score` itself is a real, updated
 * composite now too — BrandIntelligence.php's own `get_score()` no longer
 * blends Entity's severity breakdown into it, so this ring's own number
 * only ever reflects the 2 dimensions still shown alongside it.
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
		<ContainerComponent>
			{SCORE_TILES.map((tile) => {
				const score = data ? data[tile.key] : 0;
				return (
					<ColumnComponent key={tile.key} grid={4}>
						<CardComponent
							title={tile.title}
							titleIcon={tile.icon}
							desc={tile.desc}
							isLoading={isLoading}
						>
							{data && (
								<>
									<div className="crawler-stat-value">{score}/100</div>
									<BadgeComponent
										className="geo-four-checks-badge"
										color={ratingClass(score)}
										text={getRating(score)}
									/>
								</>
							)}
						</CardComponent>
					</ColumnComponent>
				);
			})}
		</ContainerComponent>
	);
};

export default BrandScoreCard;
