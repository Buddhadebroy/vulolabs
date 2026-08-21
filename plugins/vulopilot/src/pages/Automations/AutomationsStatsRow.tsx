/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { formatWpDate } from '../../services/formatWpDate';

interface StatusCounts {
	enabled: number;
	disabled: number;
}

interface DashboardStats {
	last_check_at: string | null;
}

/** Real "Today, 3:42 PM"/"August 18, 2026, 3:42 PM" — same technique SecurityMetricsGrid.tsx's own formatLastScan() already established, just with a real "Today" short-circuit for the common case (matches the mockup's own wording) instead of always spelling out the date. */
const formatLastCheck = (isoDate: string): string => {
	const date = new Date(isoDate.replace(' ', 'T') + 'Z');
	const time = date.toLocaleTimeString(undefined, {
		hour: 'numeric',
		minute: '2-digit',
	});

	if (date.toDateString() === new Date().toDateString()) {
		return sprintf(
			/* translators: %s is the real time of this site's most recent automation run today. */
			__('Today, %s', 'vulopilot'),
			time
		);
	}

	return sprintf(
		/* translators: 1: real formatted date, 2: real formatted time of this site's most recent automation run. */
		__('%1$s, %2$s', 'vulopilot'),
		formatWpDate(isoDate),
		time
	);
};

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * "Your website is being watched" — one real card, not two: this used to
 * sit above a separate 4-tile row (Active automations/Need setup/Checks
 * this month/Actions taken this month), which duplicated this card's own
 * real Active/Need setup numbers and — once `AutomationPeriodStatsCard.tsx`
 * ("This month") shipped elsewhere on this same page — duplicated its
 * Checks/Changes numbers too. Collapsed into just this card's own real
 * Active/Need setup/Last check trio per direct instruction; nothing here
 * needs a fourth number anymore since "This month" already owns the
 * period-stats job.
 *
 * Real `status_counts` (`GET /automations`'s own `enabled`/`disabled`
 * counts, same field ManageAutomationsSection.tsx's status-filter pill bar
 * already reads) for "Active"/"Need setup"; real
 * `GET /automation-dashboard-stats?period=month`'s own `last_check_at`
 * (the real most-recent `automation_runs.finished_at` across every
 * automation — `AutomationsRunRepository::get_most_recent_finished_at()`)
 * for "Last check".
 *
 * The hero's icon state and headline both degrade honestly when nothing is
 * actually active yet, rather than always showing the positive "being
 * watched" framing the mockup shows unconditionally — same `is-good`/
 * `is-idle` real-state split this exact card's own predecessor
 * (AutomationHeroRow.tsx, retired earlier in this page's own redesign)
 * already established.
 */
const AutomationsStatsRow = () => {
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

	return (
		<div className="automation-stats-row">
			<div className="automation-watch-card">
				<div className="automation-watch-header">
					<div className={`automation-watch-icon ${enabled > 0 ? 'is-good' : 'is-idle'}`}>
						<i className="adminfont-ai" />
						{enabled > 0 && (
							<span className="automation-watch-check">
								<i className="adminfont-check" />
							</span>
						)}
					</div>
					<div>
						<div className="automation-watch-title-row">
							<strong>{__('Your website is being watched', 'vulopilot')}</strong>
						</div>
						<p className="automation-watch-sub">
							{isLoading
								? __('Loading…', 'vulopilot')
								: enabled > 0
									? sprintf(
											/* translators: %d is the real number of currently-enabled automations. */
											_n(
												'%d automation is working for you.',
												'%d automations are working for you.',
												enabled,
												'vulopilot'
											),
											enabled
										)
									: __('No automations are active yet.', 'vulopilot')}
						</p>
						<p className="automation-watch-desc">
							{__(
								'VuloPilot regularly checks your website and lets you know when something needs your attention.',
								'vulopilot'
							)}
						</p>
					</div>
				</div>

				<div className="automation-watch-stats">
					<div className="automation-watch-stat">
						<strong>{isLoading ? '—' : enabled}</strong>
						<span>{__('Active', 'vulopilot')}</span>
						<small>
							{isLoading
								? ''
								: enabled > 0
									? __('Running smoothly', 'vulopilot')
									: __('None active yet', 'vulopilot')}
						</small>
					</div>
					<div className="automation-watch-stat">
						<strong>{isLoading ? '—' : disabled}</strong>
						<span>{__('Need setup', 'vulopilot')}</span>
						<small>
							{isLoading
								? ''
								: disabled > 0
									? __('Almost ready', 'vulopilot')
									: __('All set', 'vulopilot')}
						</small>
					</div>
					<div className="automation-watch-stat">
						<strong>
							{stats?.last_check_at
								? formatLastCheck(stats.last_check_at)
								: __('—', 'vulopilot')}
						</strong>
						<span>{__('Last check', 'vulopilot')}</span>
						<small>
							{stats?.last_check_at
								? __('Everything up to date', 'vulopilot')
								: __('No checks yet', 'vulopilot')}
						</small>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AutomationsStatsRow;
