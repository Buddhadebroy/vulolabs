/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	AnalyticsComponent,
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { formatWpDate } from '../../services/formatWpDate';

interface DashboardStats {
	period: 'today' | 'week' | 'month';
	period_start: string;
	period_end: string;
	previous_period_start: string;
	previous_period_end: string;
	runs: number;
	succeeded: number;
	failed: number;
	running: number;
	actions_executed: number;
	actions_failed: number;
	previous: {
		runs: number;
		succeeded: number;
		failed: number;
		actions_executed: number;
	};
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

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

const pctBadge = (current: number, previous: number): string | undefined => {
	if (previous <= 0) {
		return undefined;
	}

	const pct = ((current - previous) / previous) * 100;

	return sprintf(
		/* translators: 1: up/down arrow, 2: absolute percentage change. */
		__('%1$s%2$s%% vs last period', 'vulopilot'),
		pct >= 0 ? '↑ ' : '↓ ',
		Math.abs(pct).toFixed(0)
	);
};

interface AutomationPeriodStatsCardProps {
	onScrollToCreate: () => void;
	onScrollToManage: () => void;
}

/**
 * Merges two mockup sections that both turned out to describe the same
 * real `automation-dashboard-stats` data: "This month" (4 stat tiles
 * with a real period-over-period %) and the previous rebuild's own
 * "AI Automation Status" gauge (real success rate) — kept as one card
 * rather than two, since separating them would mean two different cards
 * both reading the same 30-day window. Real percentage deltas come from
 * AutomationDashboardRest.php's new `previous` field (the immediately
 * preceding 30-day window) — same "fetch current + previous, diff them"
 * approach StoreOverviewCards.tsx's own `pctBadge()` already established
 * (ported here rather than imported, this codebase's own "duplicate
 * small per-file hooks" convention), rendered via `AnalyticsComponent`'s
 * real `variant="dashboard"` + per-item `extra` string (confirmed against
 * zyra's own compiled source — it has no `badge` prop, only `icon`/
 * `number`/`text`/`extra`). "Failed" deliberately has no up/down arrow —
 * a rise in failures isn't a "good" direction, so it only gets a plain
 * "Needs attention" string when non-zero, same restraint
 * StoreOverviewCards.tsx's own "Failed Purchases" tile already applies.
 * Renamed from the mockup's "Checks completed"/"Changes detected"/"Alerts
 * sent"/"Reports delivered" — none of those four concepts has any real
 * backing in the Automation Engine's own data model (no per-check-type
 * tracking, no alert-delivery log, and "Reports delivered" belongs to the
 * entirely separate Reports feature, not this one) — to the real fields
 * this endpoint actually computes.
 */
const AutomationPeriodStatsCard = ({
	onScrollToCreate,
	onScrollToManage,
}: AutomationPeriodStatsCardProps) => {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const baseUrl = getApiLink(appLocalizer, 'automation-dashboard-stats');
		const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}period=month`;

		getApiResponse<DashboardStats>(url, nonceHeaders)
			.then((response) => {
				if (response?.period_start) {
					setStats(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	const successRate =
		stats && stats.succeeded + stats.failed > 0
			? Math.round((stats.succeeded / (stats.succeeded + stats.failed)) * 100)
			: null;

	const tiles = [
		{
			icon: 'automation',
			number: stats ? String(stats.runs) : '—',
			text: __('Automations Run', 'vulopilot'),
			extra: stats ? pctBadge(stats.runs, stats.previous.runs) : undefined,
		},
		{
			icon: 'next',
			number: stats ? String(stats.actions_executed) : '—',
			text: __('Actions Executed', 'vulopilot'),
			extra: stats
				? pctBadge(stats.actions_executed, stats.previous.actions_executed)
				: undefined,
		},
		{
			icon: 'check',
			number: stats ? String(stats.succeeded) : '—',
			text: __('Succeeded', 'vulopilot'),
			extra: stats
				? pctBadge(stats.succeeded, stats.previous.succeeded)
				: undefined,
		},
		{
			icon: 'close',
			number: stats ? String(stats.failed) : '—',
			text: __('Failed', 'vulopilot'),
			extra:
				stats && stats.failed > 0
					? __('Needs attention', 'vulopilot')
					: undefined,
		},
	];

	return (
		<CardComponent
			className="automation-period-stats-card"
			titleIcon="analytics"
			title={__('This Month', 'vulopilot')}
			isLoading={isLoading}
		>
			<ContainerComponent>
				<ColumnComponent grid={4}>
					<ChartComponent
						type="pie"
						isLoading={isLoading}
						legendLabels={false}
						height={160}
						centerLabel={
							successRate !== null ? (
								<>
									<span className="score-ring-number">
										{successRate}
									</span>
									<span className="score-ring-label">/100</span>
									<span className="score-ring-label">
										{getRating(successRate)}
									</span>
								</>
							) : (
								<span className="score-ring-label">
									{__('Not available', 'vulopilot')}
								</span>
							)
						}
						data={[
							{
								label: __('Succeeded', 'vulopilot'),
								value: stats?.succeeded ?? 0,
								color: '#16a34a',
							},
							{
								label: __('Failed', 'vulopilot'),
								value: stats?.failed ?? 0,
								color: '#dc2626',
							},
						]}
					/>
					<p className="automation-status-gauge-label">
						{__('Success Rate (last 30 days)', 'vulopilot')}
					</p>
				</ColumnComponent>
				<ColumnComponent grid={8}>
					<AnalyticsComponent variant="dashboard" cols={2} data={tiles} />
					{stats && (
						<p className="automation-period-stats-compare">
							{sprintf(
								/* translators: 1: start date, 2: end date of the previous comparison period. */
								__('Compared to %1$s – %2$s', 'vulopilot'),
								formatWpDate(stats.previous_period_start),
								formatWpDate(stats.previous_period_end)
							)}
						</p>
					)}
					<div className="automation-status-actions">
						<ButtonInput
							buttons={{
								text: __('Create New Automation', 'vulopilot'),
								icon: 'plus',
								onClick: onScrollToCreate,
							}}
						/>
						<ButtonInput
							buttons={{
								text: __('View All Automations', 'vulopilot'),
								icon: 'editor-list',
								onClick: onScrollToManage,
							}}
						/>
					</div>
				</ColumnComponent>
			</ContainerComponent>
		</CardComponent>
	);
};

export default AutomationPeriodStatsCard;
