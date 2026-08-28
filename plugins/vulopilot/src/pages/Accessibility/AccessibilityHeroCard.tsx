/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { AnalyticsComponent, CardComponent, ChartComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import { ACCESSIBILITY_SCANNER_IDS } from './accessibilityChecks';

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
	onViewAll: () => void;
}

/**
 * `category_scores.accessibility` (GET /dashboard, same endpoint
 * SecurityStatusCard.tsx already uses) is real,
 * but `Dashboard::calculate_category_score()` scores category
 * `accessibility` alone — 5 of this page's 7 real scanners (everything
 * but ImagesScanner's `images` category and ReadabilityScanner's
 * `content` category). Still the most honest real number available
 * (a genuine server-computed score, not a fabricated one) — just
 * documented here rather than silently presented as if it covered all 7.
 */
const getRating = (score: number): string => {
	if (score >= 90) {
		return __(
			'Great job — accessibility is in excellent shape.',
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
 * The mockup's hero card — a real accessibility score gauge (see
 * getRating()'s own docblock for its one real scope caveat), a real
 * open-findings total/high-priority-count/distinct-pages-affected
 * breakdown (computed from the same combined `ACCESSIBILITY_SCANNER_IDS`
 * fetch every other new component on this tab uses), and two real
 * actions. Everything stacks in one column (score gauge, then headline,
 * then the stat row, then the two buttons) — deliberately not the
 * side-by-side donut+text row VulnerabilityHeroCard/SecurityMockupHeader
 * use for Security, since this reference mockup's own hero card is a
 * single stacked column instead.
 */
const AccessibilityHeroCard = ({
	onReviewIssues,
	onViewAll,
}: AccessibilityHeroCardProps) => {
	const [score, setScore] = useState<number | null>(null);
	const [previousScore, setPreviousScore] = useState<number | null>(null);

	useEffect(() => {
		getApiResponse<DashboardSummary>(
			getApiLink(appLocalizer, 'dashboard'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setScore(response.category_scores.accessibility);
				setPreviousScore(response.category_scores_7d_ago.accessibility);
			}
		});
	}, []);

	// Real week-over-week delta — `category_scores_7d_ago` is already part
	// of the same `GET /dashboard` response this card already fetches
	// (Dashboard.php's own snapshot-based 7-days-ago score), just not
	// previously surfaced here. `null` when the delta is genuinely zero or
	// either score hasn't loaded yet, so no "+0" noise shows.
	const scoreDelta =
		null !== score && null !== previousScore && score !== previousScore
			? score - previousScore
			: null;

	const { data, total, isLoading } = useApiList<AccessibilityFinding>(
		'findings',
		{
			scanner_id: ACCESSIBILITY_SCANNER_IDS.join(','),
			status: 'open',
			// Bounds the client-side high-priority/pages-affected tally to
			// the 100 most recent open findings — same tradeoff
			// useSectionStatus.ts's own docblock documents; `total` itself
			// stays exact regardless.
			per_page: 100,
		}
	);

	const highCount = data.filter(
		(row) => row.severity === 'critical' || row.severity === 'high'
	).length;
	const pagesAffected = new Set(
		data.map((row) => row.page).filter(Boolean)
	).size;

	const isReady = !isLoading && score !== null;

	return (
		<CardComponent isLoading={!isReady} className="accessibility-hero">
			{isReady && (
				<>
					<ChartComponent
						type="ring"
						height={150}
						centerLabel={
							<>
								<span className="score-ring-number">{score}</span>
								<span className="score-ring-label">/100</span>
							</>
						}
						data={[
							{
								label: __('Score', 'vulopilot'),
								value: score as number,
								color: '#7c3aed',
							},
							{
								label: __('Remaining', 'vulopilot'),
								value: 100 - (score as number),
								color: '#f97316',
							},
						]}
					/>
					<div className="title">
						{getRating(score as number)}
						{null !== scoreDelta && (
							<span
								className={`accessibility-hero-delta ${scoreDelta > 0 ? 'is-up' : 'is-down'
									}`}
							>
								{sprintf(
									/* translators: 1: "↑" or "↓", 2: how many points the accessibility score changed by since last week. */
									__('%1$s %2$d pts vs last week', 'vulopilot'),
									scoreDelta > 0 ? '↑' : '↓',
									Math.abs(scoreDelta)
								)}
							</span>
						)}
					</div>
					<div className="desc">
						{total > 0
							? sprintf(
								/* translators: 1: number of open accessibility findings, 2: number of distinct pages affected. */
								__(
									'%1$d accessibility issue(s) found across %2$d page(s). Most visitors can use your site, but some areas could be improved.',
									'vulopilot'
								),
								total,
								pagesAffected
							)
							: __(
								"You're all caught up — no open accessibility issues right now.",
								'vulopilot'
							)}
					</div>
					{total > 0 && (
						<>
							<AnalyticsComponent
								variant="card"
								data={[
									{
										number: total,
										text: __('Issues found', 'vulopilot'),
										colorClass: 'is-total red',
									},
									{
										number: highCount,
										text: __(
											'Should review first',
											'vulopilot'
										),
										colorClass: 'is-high green',
									},
									{
										number: pagesAffected,
										text: __('Pages affected', 'vulopilot'),
										colorClass: 'is-pages blue',
									},
								]}
							/>
						</>
					)}
					<ButtonInput
						position="full-width"
						buttons={[
							{
								text: __('Review Important Issues', 'vulopilot'),
								rightIcon: 'pagination-right-arrow',
								color: 'purple-bg',
								onClick: onReviewIssues,
							},
							...(total > 0
								? [
									{
										text: sprintf(
											/* translators: %d is the number of open findings. */
											__('View All %d Findings', 'vulopilot'),
											total
										),
										rightIcon: 'pagination-right-arrow',
										color: 'border-purple',
										onClick: onViewAll,
									},
								]
								: []),
						]}
					/>
				</>
			)}
		</CardComponent>
	);
};

export default AccessibilityHeroCard;
