import React from 'react';
import { __ } from '@wordpress/i18n';
import {
	ListComponent,
	IconComponent,
	TypographyComponent,
} from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

/** Same real 4-tier bands as OverallScoreWidget.tsx's own `ratingColorFor()` — duplicated here rather than imported cross-widget, same "duplicate small logic across scopes" precedent this codebase already uses elsewhere (e.g. EntityExtractor.php's own `CONTACT_SLUGS`/`ABOUT_SLUGS`). */
const ratingColorFor = (score: number): string => {
	if (score >= 90) {
		return 'green';
	}
	if (score >= 70) {
		return 'blue';
	}
	if (score >= 50) {
		return 'yellow';
	}
	return 'red';
};

const average = (nums: number[]): number =>
	Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length);

/**
 * "Category Scores" — the 8 real `category_scores` grouped into the same
 * 4 buckets `OverallScoreWidget.tsx`'s hero ring used to break down by
 * segment (Visibility/Health/Commerce/Performance), plus Content/Brand on
 * their own, as one real row per bucket — same `SeoTab.tsx`-matching
 * "SEO Health" row shape (score + real week-over-week delta together,
 * `category_scores_7d_ago` diffed against `category_scores`) this used
 * to render as OverallScoreWidget.tsx's own right-side column, before
 * being split into its own independently hideable/reorderable widget
 * (direct instruction: "separate this with 2 DashboardWidget").
 */
const ScoreBreakdownWidget: React.FC<WidgetProps> = ({
	summary,
	isLoading,
	onHide,
	isCustomizing,
}) => {
	const cs = summary.category_scores;
	const visibility = average([cs.seo, cs.geo, cs.content, cs.brand]);
	const health = average([cs.security, cs.accessibility]);
	const commerce = cs.woocommerce ?? 0;
	const performance = cs.performance;

	// Real week-over-week deltas per bucket, diffed against
	// category_scores_7d_ago (Dashboard controller's
	// build_category_scores_as_of() — a genuine reconstruction from
	// findings' own created_at/resolved_at timestamps, not a fabricated
	// number).
	const cs7 = summary.category_scores_7d_ago;
	const visibility7d = average([cs7.seo, cs7.geo, cs7.content, cs7.brand]);
	const health7d = average([cs7.security, cs7.accessibility]);
	const commerce7d = cs7.woocommerce ?? 0;
	const performance7d = cs7.performance;

	const scoreRows = [
		{
			key: 'visibility',
			label: __('Visibility Score', 'vulopilot'),
			score: visibility,
			delta: visibility - visibility7d,
			icon: 'tax-compliance',
		},
		{
			key: 'health',
			label: __('Health Score', 'vulopilot'),
			score: health,
			delta: health - health7d,
			icon: 'order',
		},
		{
			key: 'commerce',
			label: __('Commerce Score', 'vulopilot'),
			score: commerce,
			delta: commerce - commerce7d,
			icon: 'shipping',
		},
		{
			key: 'performance',
			label: __('Performance Score', 'vulopilot'),
			score: performance,
			delta: performance - performance7d,
			icon: 'shipping',
		},
		{
			key: 'content',
			label: __('Content Score', 'vulopilot'),
			score: cs.content,
			delta: cs.content - cs7.content,
			icon: 'text-fields',
		},
		{
			key: 'brand',
			label: __('Brand Score', 'vulopilot'),
			score: cs.brand,
			delta: cs.brand - cs7.brand,
			icon: 'person',
		},
	];

	return (
		<DashboardWidget
			title={__('Website Health Scores', 'vulopilot')}
			icon="analytics"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
			headerAction={
				<a href="?page=vulopilot#&tab=reports" className="vital-pulse-full-report-link">
					{__('View full report ›', 'vulopilot')}
				</a>
			}
		>
			<ListComponent
				className="mini-card report hover seo-health-score-category-list"
				loading={isLoading}
				items={scoreRows.map((row) => ({
					id: row.key,
					icon: row.icon,
					title: row.label,
					tags: (
						<>
							<TypographyComponent
								as="span"
								variant="body-md"
								weight="bold"
								color={row.delta >= 0 ? 'green' : 'red'}
								className="seo-health-score-row-delta"
							>
								<IconComponent
									name={row.delta >= 0 ? 'arrow-up' : 'arrow-down'}
								/>
								{Math.abs(row.delta)}
							</TypographyComponent>
							<TypographyComponent
								variant="h5"
								weight="bold"
								color={ratingColorFor(row.score)}
								className="seo-health-score-row-value"
							>
								{row.score}
								<TypographyComponent
									as="span"
									variant="body-md"
									className="seo-health-score-row-suffix"
								>
									/100
								</TypographyComponent>
							</TypographyComponent>
						</>
					),
				}))}
			/>
		</DashboardWidget>
	);
};

export default ScoreBreakdownWidget;
