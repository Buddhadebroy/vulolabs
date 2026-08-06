/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	AnalyticsComponent,
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';

interface AutomationRow {
	id: number;
	status: 'enabled' | 'disabled';
}

interface DashboardStats {
	period: 'today' | 'week';
	status_counts: { enabled: number; disabled: number };
	runs: number;
	succeeded: number;
	failed: number;
	running: number;
	actions_executed: number;
	actions_failed: number;
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

interface AutomationStatusCardProps {
	onScrollToCreate: () => void;
	onScrollToManage: () => void;
}

/**
 * The mockup's "AI Automation Status" gauge. "Automation Health" (a
 * fabricated 0-100 score) is renamed "Success Rate" — a real derived ratio
 * (succeeded / (succeeded + failed)) over the last 7 days, computed from
 * AutomationDashboardRest.php's now period-aware response. "4 AI Agents
 * Running" (no agent concept exists anywhere) is replaced with "Currently
 * Running" — a real count of in-progress runs, already present in the same
 * `by_status` breakdown the endpoint already computes. "Active Automations"
 * comes from the same `/automations` list every other section on this page
 * already fetches (no new call). "Browse Library" is replaced with "View
 * All Automations" since no automation template library exists anywhere in
 * this codebase.
 *
 * Gracefully degrades when Pro's Automation module isn't active: Active
 * Automations still works (Free's own list endpoint provides it), but the
 * run/success-rate tiles honestly show "Not available" instead of a
 * fabricated number.
 */
const AutomationStatusCard = ({
	onScrollToCreate,
	onScrollToManage,
}: AutomationStatusCardProps) => {
	const { data: automations, categoryCounts } = useApiList<AutomationRow>(
		'automations',
		{ per_page: 100 }
	);
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [statsLoaded, setStatsLoaded] = useState(false);

	useEffect(() => {
		const baseUrl = getApiLink(appLocalizer, 'automation-dashboard-stats');
		const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}period=week`;

		getApiResponse<DashboardStats>(url, nonceHeaders)
			.then((response) => {
				if (response?.status_counts) {
					setStats(response);
				}
			})
			.finally(() => setStatsLoaded(true));
	}, []);

	const activeCount =
		categoryCounts.find((count) => count.value === 'enabled')?.count ??
		automations.filter((automation) => automation.status === 'enabled')
			.length;

	const successRate =
		stats && stats.succeeded + stats.failed > 0
			? Math.round((stats.succeeded / (stats.succeeded + stats.failed)) * 100)
			: null;

	const statTiles = [
		{
			icon: 'automation',
			number: String(activeCount),
			text: __('Active Automations', 'vulopilot'),
		},
		{
			icon: 'editor-list',
			number: stats ? String(stats.runs) : '—',
			text: __('Automations Run (7d)', 'vulopilot'),
		},
		{
			icon: 'next',
			number: stats ? String(stats.actions_executed) : '—',
			text: __('Actions Executed (7d)', 'vulopilot'),
		},
		{
			icon: 'close',
			number: stats ? String(stats.failed) : '—',
			text: __('Failed (7d)', 'vulopilot'),
		},
		{
			icon: 'refresh',
			number: stats ? String(stats.running) : '—',
			text: __('Currently Running', 'vulopilot'),
		},
	];

	return (
		<CardComponent
			className="automation-status-card"
			titleIcon="analytics"
			title={__('AI Automation Status', 'vulopilot')}
		>
			<ContainerComponent>
				<ColumnComponent grid={4}>
					<ChartComponent
						type="pie"
						isLoading={!statsLoaded}
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
						{__('Success Rate (last 7 days)', 'vulopilot')}
					</p>
				</ColumnComponent>
				<ColumnComponent grid={8}>
					<AnalyticsComponent cols={3} data={statTiles} />
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

export default AutomationStatusCard;
