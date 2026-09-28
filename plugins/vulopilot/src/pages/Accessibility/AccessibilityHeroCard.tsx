/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, COLOR_PALETTE } from '@zyra/core';
import {
	CardComponent,
	ChartComponent,
	TypographyComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import { ACCESSIBILITY_SCANNER_IDS } from './accessibilityChecks';
import AccessibilityChecksGrid from './AccessibilityChecksGrid';

interface AccessibilityFinding {
	id: number;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	page?: string;
}

interface DashboardSummary {
	category_scores: { accessibility: number };
	category_scores_7d_ago: { accessibility: number };
}

interface AccessibilityHeroCardProps {
	onReviewIssues: () => void;
}

/** Same real 3-tier band shape `PerformanceScoreCard.tsx`'s own `Rating` interface uses. */
interface Rating {
	label: string;
	className: 'good' | 'needs-improvement' | 'poor';
}

/** Lighthouse-style real 0-100 bands, matching `PerformanceScoreCard.tsx`'s own `getScoreRating()` so a "good" accessibility score and a "good" performance score mean the same thing. */
const getScoreRating = (score: number): Rating => {
	if (score >= 90) {
		return { label: __('Good', 'vulopilot'), className: 'good' };
	}
	if (score >= 50) {
		return { label: __('Needs Work', 'vulopilot'), className: 'needs-improvement' };
	}
	return { label: __('At Risk', 'vulopilot'), className: 'poor' };
};

/**
 * Real zyra palette hex (`@zyra/core`'s `COLOR_PALETTE`) - same real source
 * `PerformanceScoreCard.tsx`'s own `RATING_COLOR` reads.
 */
const RATING_COLOR: Record<Rating['className'], string> = {
	good: COLOR_PALETTE.green,
	'needs-improvement': COLOR_PALETTE.orange,
	poor: COLOR_PALETTE.red,
};

/** Same 3 tiers as `RATING_COLOR` above, mapped to `TypographyComponent`'s own palette color names instead of a literal hex. */
const TEXT_COLOR: Record<Rating['className'], string> = {
	good: 'green',
	'needs-improvement': 'orange',
	poor: 'red',
};

/** Same real bands as `getScoreRating()` above, mapped to the real palette class name the ring color map is keyed by. */
const ratingClass = (score: number): Rating['className'] => {
	return getScoreRating(score).className;
};

/**
 * `category_scores.accessibility` (GET /dashboard, same endpoint SecurityStatusCard.tsx already
 * uses) is real.
 */
const getRating = (score: number): string => {
	if (score >= 90) {
		return __(
			'Great job',
			'vulopilot'
		);
	}
	if (score >= 70) {
		return __('Accessibility needs some attention.', 'vulopilot');
	}
	if (score >= 50) {
		return __('Accessibility needs attention.', 'vulopilot');
	}
	return __('Accessibility needs urgent attention.', 'vulopilot');
};

/**
 * The mockup's hero card - a real accessibility score gauge (see getRating()'s own docblock for
 * its one real scope caveat).
 */
const AccessibilityHeroCard = ({
	onReviewIssues,
}: AccessibilityHeroCardProps) => {
	const [score, setScore] = useState<number | null>(null);

	useEffect(() => {
		getApiResponse<DashboardSummary>(
			getApiLink(vulopilotAppLocalizer, 'dashboard'),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setScore(response.category_scores.accessibility);
			}
		});
	}, []);

	// Real week-over-week delta - `category_scores_7d_ago` is already part of the same `GET
	// /dashboard` response this card already fetches (Dashboard.php's own snapshot-based 7-days-
	// ago score).

	const { total, isLoading } = useApiList<AccessibilityFinding>(
		'findings',
		{
			scanner_id: ACCESSIBILITY_SCANNER_IDS.join(','),
			status: 'open',
			// Bounds the client-side high-priority/pages-affected tally to the 100 most recent open
			// findings.
			per_page: 100,
		}
	);


	const isReady = !isLoading && score !== null;
	const overallScore = (score as number) ?? 0;

	return (
		<CardComponent isLoading={!isReady} className="accessibility-hero">
			<div className='overall-score-wrapper'>
				<div className='overall-score-summary'>
					{isReady && (
						<>
							<ChartComponent
								type="ring"
								height={200}
								// Top-level `color` - see SecurityStatusCard.tsx's own identical
								// fix: `type="ring"` only ever paints its stroke from this prop.
								color={RATING_COLOR[ratingClass(overallScore)]}
								centerLabel={
									<>
										<TypographyComponent
											variant={'h1'}
											color={TEXT_COLOR[ratingClass(overallScore)]}
										>
											{overallScore}
										</TypographyComponent>
										<TypographyComponent variant={'h4'}>
											{getScoreRating(overallScore).label}
										</TypographyComponent>
									</>
								}
								data={[
									{
										label: __('Score', 'vulopilot'),
										value: overallScore,
										color: RATING_COLOR[ratingClass(overallScore)],
									},
									{
										label: __('Remaining', 'vulopilot'),
										value: 100 - overallScore,
										color: '#e5e7eb',
									},
								]}
							/>
							<TypographyComponent variant={'h3'} color="text-green">
								{getRating(score as number)}
								
							</TypographyComponent>
							<div className="desc">
								{total > 0
									? sprintf(__(
											'Most visitors can use your site, but some areas could be improved.',
											'vulopilot'
										),
									)
									: __(
										"You're all caught up - no open accessibility issues right now.",
										'vulopilot'
									)}
							</div>
							<ButtonInput
								position="left"
								buttons={[
									{
										text: __('Review Important Issues', 'vulopilot'),
										rightIcon: 'pagination-right-arrow',
										color: 'border-purple',
										onClick: onReviewIssues,
									},
								]}
							/>
						</>
					)}
				</div>
				<div className='overall-score-summary'>
					<AccessibilityChecksGrid />
				</div>
			</div>
		</CardComponent>
	);
};

export default AccessibilityHeroCard;