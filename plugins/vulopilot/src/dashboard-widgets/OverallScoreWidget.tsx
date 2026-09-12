import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { COLOR_PALETTE } from '@zyra/core';
import {
	ChartComponent,
	BadgeComponent,
	TypographyComponent,
	ListComponent,
	IconComponent,
} from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useLastScanTime } from '../services/useLastScanTime';
import { formatWpDate } from '../services/formatWpDate';
import { WidgetProps } from './types';

/**
 * "Vital Pulse" — the Dashboard's hero status ring: one real 0-100
 * `overall_score`, colored by its own real rating band via
 * `ratingColorFor()`, with a single real critical-findings badge ("No
 * critical issues" / "N critical issues") and a real "Last scanned"
 * timestamp (`useLastScanTime()`'s own most-recently-completed scan,
 * called with no category filter since this score is a sitewide rollup)
 * below it — per a newer reference mockup.
 *
 * Now also includes the category score breakdown list (previously
 * ScoreBreakdownWidget.tsx) and a "View full report ›" header link.
 */
export const getRating = (score: number): string => {
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

/** Same real 4-tier `getRating()` bands above, mapped to real palette color names — feeds the ring's own stroke color and each row's own score number color. */
export const ratingColorFor = (score: number): string => {
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

const getRatingSummary = (score: number): string => {
	if (score >= 90) {
		return __('Your site is in excellent shape.', 'vulopilot');
	}
	if (score >= 70) {
		return __(
			'Your site is healthy and needs minimal work.',
			'vulopilot'
		);
	}
	if (score >= 50) {
		return __('Your site could use some improvement.', 'vulopilot');
	}
	return __('Your site needs attention in several areas.', 'vulopilot');
};

/** Average helper for grouping category scores into buckets. */
const average = (nums: number[]): number =>
	Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length);

const OverallScoreWidget: React.FC<WidgetProps> = ({
	summary,
	isLoading,
	onHide,
	isCustomizing,
}) => {
	// Real most-recent completed scan across every category — same real
	// `useLastScanTime()` hook CrawlRobotsSitemapSection.tsx's own "Last
	// Checked" tile already uses, called here with no category filter
	// since this widget's own score is a sitewide rollup, not scoped to
	// one category.
	const { lastScanAt } = useLastScanTime();

	// --- Category score breakdown data (from ScoreBreakdownWidget) ---
	const cs = summary.category_scores;
	const visibility = average([cs.seo, cs.geo, cs.content, cs.brand]);
	const health = average([cs.security, cs.accessibility]);
	const commerce = cs.woocommerce ?? 0;
	const performance = cs.performance;

	// Real week-over-week deltas per bucket, diffed against
	// category_scores_7d_ago.
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
				<a
					href="?page=vulopilot#&tab=reports"
					className="vital-pulse-full-report-link"
				>
					{__('View full report ›', 'vulopilot')}
				</a>
			}
		>
			<div className="overall-score-wrapper">
				<div className="overall-score-summary">
					<ChartComponent
						type="ring"
						isLoading={isLoading}
						height={240}
						color={
							COLOR_PALETTE[
							ratingColorFor(
								summary.overall_score
							) as keyof typeof COLOR_PALETTE
							]
						}
						centerLabel={
							<>
								<TypographyComponent variant={'h1'}>
									{summary.overall_score}
								</TypographyComponent>
								<TypographyComponent variant={'h4'}>
									{getRating(summary.overall_score)}
								</TypographyComponent>
							</>
						}
						data={[
							{
								label: __('Score', 'vulopilot'),
								value: summary.overall_score,
							},
						]}
					/>

					<TypographyComponent variant={'h3'} color="text-green">
						{__('Overall Score', 'vulopilot')}
					</TypographyComponent>
					<div className="desc">
						{getRatingSummary(summary.overall_score)}
					</div>
					<div className="buttons-wrapper">
						<BadgeComponent
							color={
								0 === summary.critical_findings ? 'green' : 'red'
							}
							icon={
								0 === summary.critical_findings ? 'check' : 'error'
							}
							text={
								0 === summary.critical_findings
									? __('No critical issues', 'vulopilot')
									: sprintf(
										/* translators: %d: number of open critical-severity findings. */
										__(
											'%d critical issues',
											'vulopilot'
										),
										summary.critical_findings
									)
							}
						/>
					</div>
					{lastScanAt && (
						<p className="desc overall-score-last-scanned">
							{sprintf(
								/* translators: %s: real formatted date+time of the most recent completed scan. */
								__('Last scanned: %s', 'vulopilot'),
								`${formatWpDate(lastScanAt)}, ${new Date(
									lastScanAt
								).toLocaleTimeString(undefined, {
									hour: 'numeric',
									minute: '2-digit',
								})}`
							)}
						</p>
					)}
				</div>
				{/* Category score breakdown list, moved here from ScoreBreakdownWidget.tsx */}
				<div className='overall-score-summary'>
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
											name={
												row.delta >= 0
													? 'arrow-up'
													: 'arrow-down'
											}
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
				</div>
			</div>
		</DashboardWidget>
	);
};

export default OverallScoreWidget;