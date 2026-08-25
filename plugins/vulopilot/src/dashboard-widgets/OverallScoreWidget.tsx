import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	ChartComponent,
	AnalyticsComponent,
	ColumnComponent,
	ContainerComponent,
	TrendIndicatorComponent,
	BadgeComponent,
} from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

/**
 * The mockup's "Overall Site Score" donut groups the 8 real
 * category_scores into the 4 buckets it shows as legend items — Visibility
 * (seo/geo/content/brand), Health (security/accessibility), Commerce
 * (woocommerce as-is), Performance (performance as-is). This is a simple
 * average, computed here rather than in the /dashboard payload, since
 * nothing else needs this specific 4-way grouping.
 *
 * The mockup's stat-boxes below the donut show a week-over-week delta per
 * bucket — there's no historical per-category data to compute that from
 * (only overall_score gets a daily snapshot, and only when Pro's
 * AdvancedReports module is active), so this widget omits that row rather
 * than fabricate a number, same call as CategoryScoreWidget.tsx's own
 * omitted sparkline/delta.
 */
const average = (nums: number[]): number =>
	Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length);

const getRating = (score: number): string => {
	if (score >= 90) {
		return __('Excellent', 'vulopilot');
	}
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 50) {
		return __('Fair', 'vulopilot');
	}
	return __('Needs work', 'vulopilot');
};

const OverallScoreWidget: React.FC<WidgetProps> = ({
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

	// Real net change in open findings this week (fixed minus new) — what
	// the hero's "+N this week" badge shows, replacing what used to be a
	// hardcoded "+5 this week" string.
	const netChange =
		summary.fixed_findings_this_week - summary.new_findings_this_week;

	const scoreItems = [
		{
			key: 'visibility',
			label: __('Visibility Score', 'vulopilot'),
			count: visibility,
			progress: visibility,
			icon: 'tax-compliance',
			colorClass: 'red-yellow'
		},
		{
			key: 'health',
			label: __('Health Score', 'vulopilot'),
			count: health,
			progress: health,
			icon: 'order',
			colorClass: 'red-blue'
		},
		{
			key: 'commerce',
			label: __('Commerce Score', 'vulopilot'),
			count: commerce,
			progress: commerce,
			icon: 'shipping',
			colorClass: 'red-green'
		},
		{
			key: 'performance',
			label: __('Performance Score', 'vulopilot'),
			count: performance,
			progress: 50,
			icon: 'shipping',
			colorClass: 'red-color'
		},
		{
			key: 'content',
			label: __('Content Score', 'vulopilot'),
			count: cs.content,
			progress: cs.content,
			icon: 'text-fields',
			colorClass: 'red-yellow'
		},
		{
			key: 'brand',
			label: __('Brand Score', 'vulopilot'),
			count: cs.brand,
			progress: cs.brand,
			icon: 'person',
			colorClass: 'red-blue'
		},
	];

	// Real week-over-week deltas per bucket, diffed against
	// category_scores_7d_ago (Dashboard controller's
	// build_category_scores_as_of() — a genuine reconstruction from
	// findings' own created_at/resolved_at timestamps, not a fabricated
	// number). Same 4-way grouping as the donut/scoreItems above, just
	// applied to last week's snapshot too.
	const cs7 = summary.category_scores_7d_ago;
	const visibility7d = average([cs7.seo, cs7.geo, cs7.content, cs7.brand]);
	const health7d = average([cs7.security, cs7.accessibility]);
	const commerce7d = cs7.woocommerce ?? 0;
	const performance7d = cs7.performance;

	const trendItems = [
		{
			key: 'visibility',
			label: __('Visibility', 'vulopilot'),
			delta: visibility - visibility7d,
		},
		{
			key: 'health',
			label: __('Health', 'vulopilot'),
			delta: health - health7d,
		},
		{
			key: 'commerce',
			label: __('Commerce', 'vulopilot'),
			delta: commerce - commerce7d,
		},
		{
			key: 'performance',
			label: __('Performance', 'vulopilot'),
			delta: performance - performance7d,
		},
		{
			key: 'content',
			label: __('Content', 'vulopilot'),
			delta: cs.content - cs7.content,
		},
		{
			key: 'brand',
			label: __('Brand', 'vulopilot'),
			delta: cs.brand - cs7.brand,
		},
	];

	return (
		<DashboardWidget
			title={__('Overall Site Score', 'vulopilot')}
			icon="analytics"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			<ContainerComponent>
				<ColumnComponent grid={3}>
					<ChartComponent
						type="pie"
						isLoading={isLoading}
						legendLabels
						legendPosition="side"
						height={180}
						centerLabel={
							<>
								<span className="score-ring-number">
									{summary.overall_score}
								</span>
								<span className="score-ring-label">/100</span>
								<span className="score-ring-label">
									{getRating(summary.overall_score)}
								</span>
							</>
						}
						data={[
							{
								label: __('Visibility', 'vulopilot'),
								value: visibility,
								color: '#2563eb',
							},
							{
								label: __('Health', 'vulopilot'),
								value: health,
								color: '#16a34a',
							},
							{
								label: __('Commerce', 'vulopilot'),
								value: commerce,
								color: '#f97316',
							},
							{
								label: __('Performance', 'vulopilot'),
								value: performance,
								color: '#7c3aed',
							},
						]}
					/>
					<div className="overall-score-summary overall-score-summary--divider">
						<div className="title">
							{getRating(summary.overall_score)}
						</div>
						<div className="desc">
							{sprintf(
								/* translators: %d: number of open findings */
								__(
									'%d open findings across your site.',
									'vulopilot'
								),
								summary.open_findings
							)}
						</div>
						{(netChange !== 0 ||
							summary.new_findings_this_week > 0 ||
							summary.fixed_findings_this_week > 0) && (
							<div className="buttons-wrapper">
								{netChange !== 0 && (
									<BadgeComponent
										color={netChange > 0 ? 'green' : 'red'}
										icon={`arrow-${netChange > 0 ? 'up' : 'down'}`}
										text={sprintf(
											/* translators: %+d: signed net change in open findings this week */
											__('%+d this week', 'vulopilot'),
											netChange
										)}
									/>
								)}
								{summary.new_findings_this_week > 0 && (
									<BadgeComponent
										color="red"
										icon="error"
										text={sprintf(
											/* translators: %d: number of findings first detected this week */
											__('%d new issues', 'vulopilot'),
											summary.new_findings_this_week
										)}
									/>
								)}
								{summary.fixed_findings_this_week > 0 && (
									<BadgeComponent
										color="yellow"
										icon="check"
										text={sprintf(
											/* translators: %d: number of findings resolved this week */
											__('%d fixed', 'vulopilot'),
											summary.fixed_findings_this_week
										)}
									/>
								)}
							</div>
						)}
					</div>
				</ColumnComponent>
				<ColumnComponent grid={9}>
					<AnalyticsComponent
						cols={2}
						variant="progress"
						data={scoreItems.map((item, idx) => ({
							icon: item.icon,
							number: `${item.count}%`,
							text: item.label,
							colorClass: `admin-color${idx + 2}`,
							progress: item.progress
						}))}
					/>
				</ColumnComponent>
				<ColumnComponent >
					<div className="score-trend-row">
						{trendItems.map((item) => (
							<div className="score-trend-item" key={item.key}>
								<TrendIndicatorComponent
									value={item.delta}
									decimals={0}
									suffix=""
								/>
								<div className="score-trend-label">
									{item.label}
								</div>
								<div className="score-trend-sub">
									{__('vs last 7 days', 'vulopilot')}
								</div>
							</div>
						))}
					</div>
				</ColumnComponent>
			</ContainerComponent>
		</DashboardWidget>
	);
};

export default OverallScoreWidget;