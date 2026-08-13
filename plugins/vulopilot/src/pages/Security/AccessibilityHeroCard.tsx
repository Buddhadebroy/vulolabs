/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ChartComponent } from '@zyra/components';
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

	useEffect(() => {
		getApiResponse<DashboardSummary>(
			getApiLink(appLocalizer, 'dashboard'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setScore(response.category_scores.accessibility);
			}
		});
	}, []);

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
					<div className="accessibility-hero-score">
						<ChartComponent
							type="pie"
							height={90}
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
					</div>
					<p className="accessibility-hero-title">
						{getRating(score as number)}
					</p>
					<p className="accessibility-hero-desc">
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
					</p>
					{total > 0 && (
						<div className="accessibility-hero-stats">
							<div className="accessibility-hero-stat is-total">
								<span className="accessibility-hero-stat-value">
									{total}
								</span>
								<span className="accessibility-hero-stat-label">
									{__('Issues found', 'vulopilot')}
								</span>
							</div>
							<div className="accessibility-hero-stat is-high">
								<span className="accessibility-hero-stat-value">
									{highCount}
								</span>
								<span className="accessibility-hero-stat-label">
									{__('Should review first', 'vulopilot')}
								</span>
							</div>
							<div className="accessibility-hero-stat is-pages">
								<span className="accessibility-hero-stat-value">
									{pagesAffected}
								</span>
								<span className="accessibility-hero-stat-label">
									{__('Pages affected', 'vulopilot')}
								</span>
							</div>
						</div>
					)}
					<div className="accessibility-hero-actions">
						<ButtonInput
							buttons={{
								text: __('Review Important Issues', 'vulopilot'),
								rightIcon: 'pagination-right-arrow',
								color: 'purple-bg',
								onClick: onReviewIssues,
							}}
						/>
						{total > 0 && (
							<ButtonInput
								buttons={{
									text: sprintf(
										/* translators: %d is the number of open findings. */
										__('View All %d Findings', 'vulopilot'),
										total
									),
									rightIcon: 'pagination-right-arrow',
									color: 'border-purple',
									onClick: onViewAll,
								}}
							/>
						)}
					</div>
				</>
			)}
		</CardComponent>
	);
};

export default AccessibilityHeroCard;
