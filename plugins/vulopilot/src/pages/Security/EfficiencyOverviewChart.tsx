import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ChartComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import type { EfficiencySummary } from './efficiencyChecks';

interface EfficiencyOverviewChartProps {
	summary: EfficiencySummary | null;
	isLoading: boolean;
	onViewAll: () => void;
}

/**
 * The mockup's closing "Efficiency Overview" donut — real
 * working/need-attention/not-applicable counts, same `summary` object
 * every other component on this tab reads. zyra's `ChartComponent`
 * always renders its own "label: value" legend row below the chart with
 * no prop to disable it (same gap AccessibilityHeroCard.tsx's own docblock
 * documents) — hidden here the same `!important` way, in favor of this
 * mockup's own right-aligned dot+label+count list instead.
 */
const EfficiencyOverviewChart = ({
	summary,
	isLoading,
	onViewAll,
}: EfficiencyOverviewChartProps) => {
	const working = summary?.working ?? 0;
	const needAttention = summary?.need_attention ?? 0;
	const notApplicable = summary?.not_applicable ?? 0;
	const total = summary?.total ?? 0;

	return (
		<CardComponent
			title={__('Efficiency Overview', 'vulopilot')}
			titleIcon="report"
			desc={__('How your WordPress efficiency looks overall.', 'vulopilot')}
			isLoading={isLoading}
		>
			{!isLoading && summary && (
				<>
					<div className="efficiency-overview-body">
						<div className="efficiency-overview-chart">
							<ChartComponent
								type="pie"
								height={160}
								centerLabel={
									<>
										<span className="efficiency-overview-chart-number">
											{total}
										</span>
										<span className="efficiency-overview-chart-label">
											{__('Checks', 'vulopilot')}
										</span>
									</>
								}
								data={[
									{
										label: __('Working correctly', 'vulopilot'),
										value: working,
										color: '#16a34a',
									},
									{
										label: __('Need attention', 'vulopilot'),
										value: needAttention,
										color: '#f97316',
									},
									{
										label: __('Not applicable', 'vulopilot'),
										value: notApplicable,
										color: '#d1d5db',
									},
								]}
							/>
						</div>
						<ul className="efficiency-overview-legend">
							<li>
								<span className="efficiency-overview-dot is-good" />
								{__('Working correctly', 'vulopilot')}
								<span className="efficiency-overview-count">{working}</span>
							</li>
							<li>
								<span className="efficiency-overview-dot is-attention" />
								{__('Need attention', 'vulopilot')}
								<span className="efficiency-overview-count">
									{needAttention}
								</span>
							</li>
							<li>
								<span className="efficiency-overview-dot is-neutral" />
								{__('Not applicable', 'vulopilot')}
								<span className="efficiency-overview-count">
									{notApplicable}
								</span>
							</li>
						</ul>
					</div>
					<ButtonInput
						wrapperClass="efficiency-overview-view-all"
						buttons={{
							text: sprintf(
								/* translators: %d is the total number of efficiency checks. */
								__('View all checks (%d) →', 'vulopilot'),
								total
							),
							onClick: onViewAll,
						}}
					/>
				</>
			)}
		</CardComponent>
	);
};

export default EfficiencyOverviewChart;
