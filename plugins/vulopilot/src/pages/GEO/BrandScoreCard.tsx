/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { AnalyticsComponent } from '@zyra/components';

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

/**
 * Same 3-tier thresholds as `getRating()` above, as one of zyra's own
 * `$color-palette` names (`BadgeComponent`'s own `color` prop, and
 * `AnalyticsComponent`'s own `variant="score-ring"` `iconClass`/`badgeColor`
 * props, both resolve these against that same real palette — see
 * `AnalyticsComponent.stories.tsx`'s own "ScoreRing" story) rather than a
 * bespoke semantic class name, so the icon tint, the badge, and the ring
 * all draw from the exact same real color source instead of 3 separately
 * hand-picked ones.
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

/**
 * The same 3 `ratingColor()` names, as the real hex value zyra's own
 * `$color-palette` maps each one to (`packages/theme/src/global.scss`) —
 * `AnalyticsComponent`'s own ring is a `ChartComponent` stroke, which needs
 * a literal CSS color rather than a class name to color itself.
 */
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
 * same real endpoint this card has always used. Real 3-tile
 * `AnalyticsComponent` row (`variant="score-ring"`, direct instruction —
 * added to zyra itself for this rather than hand-rolled markup) matching
 * the reference screenshot's own icon+title/desc/score/badge-left,
 * ring-right shape, replacing what had briefly been 3 separate
 * `CardComponent`s (each with a plain status pill, no ring) — this tab
 * used one combined `AnalyticsComponent` row even before that, so this is
 * a return to that shape with a real ring now rather than a 2nd rewrite.
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
		<AnalyticsComponent
			variant="score-ring"
			cols={3}
			isLoading={isLoading}
			data={SCORE_TILES.map((tile) => {
				const score = data ? data[tile.key] : 0;
				const color = ratingColor(score);

				return {
					icon: tile.icon,
					iconClass: color,
					text: tile.title,
					desc: tile.desc,
					number: score,
					progress: score,
					badgeText: getRating(score),
					badgeColor: color,
					ringColor: RING_COLOR[color],
				};
			})}
		/>
	);
};

export default BrandScoreCard;
