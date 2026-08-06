import React, { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ChartComponent, AnalyticsComponent, ColumnComponent, ContainerComponent } from '@zyra/components';
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
	];

	/**
	 * Reorder is local/session-only (no persistence endpoint) — the
	 * dashboard's own whole-widget reorder (DashboardGrid.tsx's
	 * ReactSortable + POST /dashboard-layout) operates one level up, on
	 * whole widgets, not on items inside one, and adding a dedicated
	 * endpoint for this 4-item breakdown wasn't asked for.
	 */
	const [order, setOrder] = useState<number[]>([0, 1, 2, 3]);
	const orderedItems = order.map((index) => scoreItems[index]);

	const moveUp = (position: number) => {
		if (position === 0) {
			return;
		}
		setOrder((prev) => {
			const next = [...prev];
			[next[position - 1], next[position]] = [
				next[position],
				next[position - 1],
			];
			return next;
		});
	};

	const moveDown = (position: number) => {
		if (position === orderedItems.length - 1) {
			return;
		}
		setOrder((prev) => {
			const next = [...prev];
			[next[position], next[position + 1]] = [
				next[position + 1],
				next[position],
			];
			return next;
		});
	};

	return (
		<DashboardWidget
		// title={__('Overall Site Score', 'vulopilot')}
		// icon="analytics"
		// isLoading={isLoading}
		// onHide={onHide}
		// isCustomizing={isCustomizing}
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
				</ColumnComponent>
				<ColumnComponent grid={7}>
					<AnalyticsComponent
						cols={2}
						variant="progress"
						data={orderedItems.map((item, idx) => ({
							icon: item.icon,
							number: `${item.count}%`,
							text: item.label,
							colorClass: `admin-color${idx + 2}`,
							progress: item.progress
						}))}
					/>
					<ul className="score-reorder-controls">
						{orderedItems.map((item, position) => (
							<li key={item.key}>
								<span className="score-reorder-label">
									{item.label}
								</span>
								<button
									type="button"
									className="score-reorder-btn"
									aria-label={sprintf(
										/* translators: %s: score item label, e.g. "Visibility Score" */
										__('Move %s up', 'vulopilot'),
										item.label
									)}
									disabled={position === 0}
									onClick={() => moveUp(position)}
								>
									<i className="adminfont-arrow-up" />
								</button>
								<button
									type="button"
									className="score-reorder-btn"
									aria-label={sprintf(
										/* translators: %s: score item label, e.g. "Visibility Score" */
										__('Move %s down', 'vulopilot'),
										item.label
									)}
									disabled={position === orderedItems.length - 1}
									onClick={() => moveDown(position)}
								>
									<i className="adminfont-arrow-down" />
								</button>
							</li>
						))}
					</ul>
				</ColumnComponent>
			</ContainerComponent>
		</DashboardWidget>
	);
};

export default OverallScoreWidget;
