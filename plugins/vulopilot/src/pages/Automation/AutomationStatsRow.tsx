/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { AnalyticsComponent } from '@zyra/components';

interface StatusCounts {
	enabled: number;
	disabled: number;
}

interface DashboardStats {
	runs: number;
	changes_made: number;
	previous: {
		runs: number;
		changes_made: number;
	};
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Same "current vs. immediately preceding period" percent-change formula
 * StoreOverviewCards.tsx/AutomationPeriodStatsCard.tsx already established
 * — ported here rather than imported, this codebase's own "duplicate small
 * per-file hooks" convention.
 */
const pctBadge = (current: number, previous: number): string | undefined => {
	if (previous <= 0) {
		return undefined;
	}

	const pct = ((current - previous) / previous) * 100;

	return sprintf(
		/* translators: 1: up/down arrow, 2: absolute percentage change. */
		__('%1$s%2$s%% vs last month', 'vulopilot'),
		pct >= 0 ? '↑ ' : '↓ ',
		Math.abs(pct).toFixed(0)
	);
};

/**
 * The mockup's own 4-tile stat row for the "Automations" tab — real
 * `status_counts` (`GET /automations`'s own `enabled`/`disabled` counts,
 * same field ManageAutomationsSection.tsx's status-filter pill bar already
 * reads) for the first two tiles, real `GET /automation-dashboard-stats?period=month`
 * for the last two (`runs`, real real `changes_made` — see
 * AutomationEngine::execute_actions()'s own docblock for why that's a
 * distinct, real count from `actions_executed`, not every action that ran).
 *
 * The mockup's own two tile concepts don't map onto this real data 1:1:
 * "Need setup" here is real disabled-automation count (an automation a
 * user created but hasn't turned on — the literal thing "needs setup"
 * means), and "Changes detected" is relabeled "Actions taken" — this
 * codebase's Automation Engine makes changes, it doesn't watch for and
 * "detect" ambient site changes the way a diff-monitor would, so "taken"
 * is the honest verb for what `changes_made` actually counts.
 */
const AutomationStatsRow = () => {
	const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(
		null
	);
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		Promise.all([
			getApiResponse<{ status_counts?: StatusCounts }>(
				`${getApiLink(appLocalizer, 'automations')}?per_page=1`,
				nonceHeaders
			),
			getApiResponse<DashboardStats>(
				`${getApiLink(appLocalizer, 'automation-dashboard-stats')}?period=month`,
				nonceHeaders
			),
		])
			.then(([automationsResponse, statsResponse]) => {
				if (cancelled) {
					return;
				}

				if (automationsResponse?.status_counts) {
					setStatusCounts(automationsResponse.status_counts);
				}

				if (statsResponse) {
					setStats(statsResponse);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const enabled = statusCounts?.enabled ?? 0;
	const disabled = statusCounts?.disabled ?? 0;

	const tiles = [
		{
			icon: 'active',
			iconClass: 'is-good',
			number: isLoading ? '—' : String(enabled),
			text: __('Active automations', 'vulopilot'),
			extra: isLoading
				? undefined
				: enabled > 0
					? __('Running smoothly', 'vulopilot')
					: __('None active yet', 'vulopilot'),
		},
		{
			icon: 'pending',
			iconClass: 'is-attention',
			number: isLoading ? '—' : String(disabled),
			text: __('Need setup', 'vulopilot'),
			extra: isLoading
				? undefined
				: disabled > 0
					? __('Turn these on to start automating', 'vulopilot')
					: __('All set', 'vulopilot'),
		},
		{
			icon: 'clock',
			iconClass: 'is-info',
			number: stats ? String(stats.runs) : '—',
			text: __('Checks this month', 'vulopilot'),
			extra: stats
				? (pctBadge(stats.runs, stats.previous.runs) ??
					(stats.runs > 0
						? undefined
						: __('No runs yet this month', 'vulopilot')))
				: undefined,
		},
		{
			icon: 'automation',
			iconClass: 'is-primary',
			number: stats ? String(stats.changes_made) : '—',
			text: __('Actions taken this month', 'vulopilot'),
			extra: stats
				? (pctBadge(stats.changes_made, stats.previous.changes_made) ??
					(stats.changes_made > 0
						? undefined
						: __('No changes made yet', 'vulopilot')))
				: undefined,
		},
	];

	return (
		<div className="automation-stats-row">
			<AnalyticsComponent
				variant="dashboard"
				cols={4}
				isLoading={isLoading}
				data={tiles}
			/>
		</div>
	);
};

export default AutomationStatsRow;
