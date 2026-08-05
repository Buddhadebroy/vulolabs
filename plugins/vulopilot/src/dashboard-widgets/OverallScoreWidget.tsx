import React from 'react';
import { __ } from '@wordpress/i18n';
import { ChartComponent, AnalyticsComponent } from '@zyra/components';
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

	 const overviewData = [
        {
            id: 'total_tax',
            label: __('Visibility Score', 'vulopilot'),
            count: visibility,
            icon: 'tax-compliance',
			colorClass: 'red-yellow'
        },
        {
            id: 'order_tax',
            label: __('Health Score', 'vulopilot'),
            count: health,
            icon: 'order',
			colorClass: 'red-blue'
        },
        {
            id: 'shipping_tax',
            label: __('Commerce Score', 'vulopilot'),
            count: commerce,
            icon: 'shipping',
			colorClass: 'red-green'
        },
		{
            id: 'shipping_tax',
            label: __('Performance Score', 'vulopilot'),
            count: performance,
            icon: 'shipping',
			colorClass: 'red-color'
        },
    ];

	return (
		<DashboardWidget
			// title={__('Overall Site Score', 'vulopilot')}
			// icon="analytics"
			// isLoading={isLoading}
			// onHide={onHide}
			// isCustomizing={isCustomizing}
		>
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

			<AnalyticsComponent
            cols={4}
            variant="progress"
            data={overviewData.map((item, idx) => ({
                icon: item.icon,
                iconClass: `admin-color${idx + 2}`,
                number: item.count,
                text: __(item.label, 'vulopilot'),
				colorClass: `admin-color${idx + 2}`,
            }))}
        />
		</DashboardWidget>
	);
};

export default OverallScoreWidget;
