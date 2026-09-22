/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	AnalyticsComponent,
	CardComponent,
	ChartComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { ToggleInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';

interface SecurityScoreSnapshot {
	snapshot_date: string;
	security_score: number;
}

interface AttentionSummary {
	total: number;
	priority_counts: { high: number; medium: number; low: number };
}

type PeriodDays = '7' | '30' | '90';
const PERIOD_OPTIONS = [
	{ key: '7', value: '7', label: __('7D', 'vulopilot') },
	{ key: '30', value: '30', label: __('30D', 'vulopilot') },
	{ key: '90', value: '90', label: __('90D', 'vulopilot') },
];

/**
 * "Security Trend" - real daily `security_score` snapshots from
 * `GET /security-score-snapshots?days=N`
 * (`classes/Repositories/SecurityScoreSnapshotRepository.php`, written by
 * `Services\SecurityScoreSnapshotRecorder` after every scan plus once
 * daily via cron - the same real weighting `GET /dashboard`'s
 * `category_scores.security` already uses). Not a reuse of
 * `vulopilot_site_health_snapshots.security_score` - that column exists
 * but is only ever written by Pro's AdvancedReports module, so this Free
 * tab needed its own dedicated table, same reasoning Performance's own
 * "Speed History" already established for `performance_score`. Same
 * `useApiList` + `ChartComponent type="area"` pattern SpeedHistoryCard.tsx
 * uses, including its graceful "no trend data yet" empty state for a
 * freshly-installed site or one that hasn't run a scan/waited for the
 * daily cron yet.
 *
 * `days` is a real 7/30/90 toggle now (same `PERIOD_OPTIONS`/`ToggleInput`
 * shape GeoScoreSection.tsx's own card action already uses) rather than a
 * fixed 30 - `useApiList`'s own `params` are re-read on every render, so
 * changing `period` here refetches the same real endpoint with a
 * different `days` value, no new request-plumbing needed.
 */
const SecurityTrendCard = () => {
	const [period, setPeriod] = useState<PeriodDays>('30');
	const { data: snapshots, isLoading } = useApiList<SecurityScoreSnapshot>(
		'security-score-snapshots',
		{ days: Number(period) }
	);

	// Same real `GET /findings/attention-summary` `high`/`medium`/`low`/
	// `total` counts SecurityStatusCard.tsx's own hero card reads - moved
	// here (per direct instruction) as a real `AnalyticsComponent` tile row
	// under the trend chart, replacing the `ListComponent` rows that used
	// to sit under SecurityStatusCard's own metrics list.
	const [summary, setSummary] = useState<AttentionSummary | null>(null);
	useEffect(() => {
		getApiResponse<AttentionSummary>(
			getApiLink(appLocalizer, 'findings/attention-summary'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setSummary(response);
			}
		});
	}, []);
	const { high = 0, medium = 0, low = 0 } = summary?.priority_counts ?? {};
	const total = summary?.total ?? 0;

	return (
		<CardComponent
			id="security-trend-card"
			title={__('Security Trend', 'vulopilot')}
			titleIcon="security"
			desc={sprintf(
				/* translators: %d: number of days the trend below covers. */
				__('Your daily security score over the last %d days.', 'vulopilot'),
				Number(period)
			)}
			action={
				<ToggleInput
					options={PERIOD_OPTIONS}
					value={period}
					onChange={(value) => setPeriod(value as PeriodDays)}
					modules={[]}
					variant="pill"
				/>
			}
		>
			{!isLoading && snapshots.length === 0 ? (
				<ModuleGuardComponent
					icon="analytics"
					title={__('No trend data yet', 'vulopilot')}
					desc={__(
						'Security trend builds up after your first scan - run a scan, or check back after today.',
						'vulopilot'
					)}
				/>
			) : (
				<ChartComponent
					type="dynamic-line"
					isLoading={isLoading}
					data={snapshots.map((snapshot) => ({
						...snapshot,
						snapshot_date: formatWpDate(snapshot.snapshot_date),
					}))}
					dataKey="security_score"
					xKey="snapshot_date"
					height={250}
					yDomain={[0, 100]}
				/>
			)}
			<AnalyticsComponent
				variant="background-color"
				cols={4}
				data={[
					{
						colorClass: 'admin-bg-color2',
						number: high,
						text: __('High', 'vulopilot'),
					},
					{
						colorClass: 'admin-bg-color3',
						number: medium,
						text: __('Medium', 'vulopilot'),
					},
					{
						colorClass: 'admin-bg-color4',
						number: low,
						text: __('Low', 'vulopilot'),
					},
					{
						colorClass: 'admin-bg-color5',
						number: total,
						text: __('Total findings', 'vulopilot'),
					},
				]}
			/>
		</CardComponent>
	);
};

export default SecurityTrendCard;
