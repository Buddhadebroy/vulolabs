/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, AnalyticsComponent } from '@zyra/components';
import { formatWpDate } from '../../services/formatWpDate';

interface ActionTypeTotals {
	[actionId: string]: number;
}

interface DashboardStats {
	runs: number;
	changes_made: number;
	action_type_totals: ActionTypeTotals;
	period_start: string;
	period_end: string;
	previous: {
		runs: number;
		changes_made: number;
		action_type_totals: ActionTypeTotals;
	};
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/** Same "current vs. immediately preceding period" percent-change formula `AutomationStatsRow.tsx`'s own `pctBadge()` already established — ported here rather than imported, this codebase's own "duplicate small per-file hooks" convention. */
const pctBadge = (current: number, previous: number): string | undefined => {
	if (previous <= 0) {
		return undefined;
	}

	const pct = ((current - previous) / previous) * 100;

	return sprintf(
		/* translators: 1: up/down arrow, 2: absolute percentage change. */
		__('%1$s%2$s%%', 'vulopilot'),
		pct >= 0 ? '↑ ' : '↓ ',
		Math.abs(pct).toFixed(0)
	);
};

/**
 * "This month" — real `GET /automation-dashboard-stats?period=month`.
 * "Checks completed"/"Changes made" reuse the same real `runs`/
 * `changes_made` totals `AutomationStatsRow.tsx`'s own merged hero+tiles
 * section already shows elsewhere on this page (this card's real value is
 * pairing them with "Needs your attention" as a period-context sidebar, the
 * shape this pairing had in this page's own earlier design) — "Alerts
 * sent"/"Reports delivered" are new here: real successful counts of the
 * `create-notification`/`send-email` action types for the period
 * (`AutomationRunRepository::get_action_type_totals_for_period()`), not
 * available anywhere else on this page. Worded "Changes made" rather than
 * the mockup's own "Changes detected" — this codebase's Automation Engine
 * makes changes, it doesn't watch for and detect ambient site changes,
 * same real-verb correction `AutomationStatsRow.tsx`'s own docblock
 * already applied to this exact number.
 */
const AutomationsPeriodStatsCard = () => {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getApiResponse<DashboardStats>(
			`${getApiLink(appLocalizer, 'automation-dashboard-stats')}?period=month`,
			nonceHeaders
		)
			.then((response) => {
				if (response) {
					setStats(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	const alertsSent = stats?.action_type_totals?.['create-notification'] ?? 0;
	const previousAlertsSent = stats?.previous?.action_type_totals?.['create-notification'] ?? 0;
	const reportsDelivered = stats?.action_type_totals?.['send-email'] ?? 0;
	const previousReportsDelivered = stats?.previous?.action_type_totals?.['send-email'] ?? 0;

	const tiles = [
		{
			icon: 'calendar',
			iconClass: 'is-primary',
			number: stats ? String(stats.runs) : '—',
			text: __('Checks completed', 'vulopilot'),
			extra: stats ? pctBadge(stats.runs, stats.previous.runs) : undefined,
		},
		{
			icon: 'document',
			iconClass: 'is-good',
			number: stats ? String(stats.changes_made) : '—',
			text: __('Changes made', 'vulopilot'),
			extra: stats ? pctBadge(stats.changes_made, stats.previous.changes_made) : undefined,
		},
		{
			icon: 'bell',
			iconClass: 'is-attention',
			number: stats ? String(alertsSent) : '—',
			text: __('Alerts sent', 'vulopilot'),
			extra: stats ? pctBadge(alertsSent, previousAlertsSent) : undefined,
		},
		{
			icon: 'automation',
			iconClass: 'is-info',
			number: stats ? String(reportsDelivered) : '—',
			text: __('Reports delivered', 'vulopilot'),
			extra: stats ? pctBadge(reportsDelivered, previousReportsDelivered) : undefined,
		},
	];

	return (
		<CardComponent title={__('This month', 'vulopilot')} isLoading={isLoading}>
			<AnalyticsComponent variant="dashboard" cols={4} isLoading={isLoading} data={tiles} />
			{stats && (
				<p className="automation-period-stats-compare">
					{sprintf(
						/* translators: 1: real period start date, 2: real period end date. */
						__('Compared to %1$s – %2$s', 'vulopilot'),
						formatWpDate(stats.period_start),
						formatWpDate(stats.period_end)
					)}
				</p>
			)}
		</CardComponent>
	);
};

export default AutomationsPeriodStatsCard;
