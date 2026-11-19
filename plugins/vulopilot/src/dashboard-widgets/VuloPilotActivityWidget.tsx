/* global vulopilotAppLocalizer */
import React, { useMemo, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { PopupComponent } from '@zyra/components';
import { Delta, EmptyState, Segmented, Skeleton, scoreTone } from '../components/ui';
import ShowProPopup from '../components/Popup/Popup';
import { useApiList } from '../services/useApiList';
import DashboardWidget from './DashboardWidget';
import ScoreTrendChart, { shortDate } from './ScoreTrendChart';
import AreaShiftChart from './AreaShiftChart';
import { getAreaScores } from '../pages/Dashboard/scoring';
import type { ScorePoint } from './ScoreTrendChart';
import { WidgetProps, PeriodDays } from './types';

interface HealthSnapshot {
	snapshot_date: string;
	overall_score: number;
}

const PERIODS = [
	{ value: '7', label: __('7D', 'vulopilot') },
	{ value: '30', label: __('30D', 'vulopilot') },
	{ value: '90', label: __('90D', 'vulopilot') },
];

const PERIOD_NAMES: Record<PeriodDays, string> = {
	'7': __('7 days', 'vulopilot'),
	'30': __('30 days', 'vulopilot'),
	'90': __('90 days', 'vulopilot'),
};

/**
 * "Health trend". Pro: the overall score per day from its daily snapshots, led by today's score and how far it moved.
 * Free: what the free summary already knows - every area's score a week ago against today - with 30 and 90 days as
 * locked periods and a slim upgrade strip, never a fake chart.
 */
const VuloPilotActivityWidget: React.FC<WidgetProps> = ({ summary, isLoading, onHide, isCustomizing }) => {
	const [days, setDays] = useState<PeriodDays>('30');
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	const isPro = Boolean(vulopilotAppLocalizer.khali_dabba);

	const snapshots = useApiList<HealthSnapshot>('site-health-snapshots', { days: Number(days) }, undefined, isPro);

	const points: ScorePoint[] = useMemo(
		() =>
			isPro
				? snapshots.data
						.map((row) => ({ date: String(row.snapshot_date).slice(0, 10), score: Math.round(Number(row.overall_score)) }))
						.filter((point) => Number.isFinite(point.score))
						.sort((a, b) => a.date.localeCompare(b.date))
				: [],
		[isPro, snapshots.data, days]
	);

	const scores = points.map((point) => point.score);
	const first = points[0];
	const last = points[points.length - 1];
	const change = first && last && points.length > 1 ? last.score - first.score : null;
	const current = isPro && last ? last.score : summary.overall_score;
	const period = PERIOD_NAMES[days];

	const areas = getAreaScores(summary);
	const down = areas.filter((area) => area.delta < 0).length;
	const up = areas.filter((area) => area.delta > 0).length;

	let desc = __('How your overall score has moved over time.', 'vulopilot');

	if (!isPro) {
		if (0 === down && 0 === up) {
			desc = __('Every area held steady over the last 7 days.', 'vulopilot');
		} else {
			const parts: string[] = [];
			if (up > 0) {
				/* translators: %d: number of areas whose score rose. */
				parts.push(sprintf(_n('%d area up', '%d areas up', up, 'vulopilot'), up));
			}
			if (down > 0) {
				/* translators: %d: number of areas whose score fell. */
				parts.push(sprintf(_n('%d area down', '%d areas down', down, 'vulopilot'), down));
			}
			desc = sprintf(
				/* translators: %s: e.g. "1 area up, 4 areas down". */
				__('%s over the last 7 days.', 'vulopilot'),
				parts.join(', ')
			);
		}
	}

	if (isPro && null !== change) {
		desc =
			0 === change
				? sprintf(
						/* translators: %s: period such as "30 days". */
						__('Holding steady over the last %s.', 'vulopilot'),
						period
				  )
				: sprintf(
						/* translators: 1: "Up" or "Down", 2: points, 3: period such as "30 days". */
						_n('%1$s %2$d point over the last %3$s.', '%1$s %2$d points over the last %3$s.', Math.abs(change), 'vulopilot'),
						change > 0 ? __('Up', 'vulopilot') : __('Down', 'vulopilot'),
						Math.abs(change),
						period
				  );
	}

	const stats =
		scores.length > 0
			? [
					{ label: __('High', 'vulopilot'), value: Math.max(...scores) },
					{ label: __('Low', 'vulopilot'), value: Math.min(...scores) },
					{ label: __('Average', 'vulopilot'), value: Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) },
			  ]
			: [];

	const headline = (
		<div className="vp-trend-head">
			<div className="vp-trend-now">
				<strong className={`is-${scoreTone(current)}`}>{current}</strong>
				<div>
					<Delta change={isPro ? change : null} suffix="" />
					<span>
						{isPro && first && points.length > 1
							? sprintf(
									/* translators: %s: date the period starts, such as "Oct 21". */
									__('Today, against %s', 'vulopilot'),
									shortDate(first.date)
							  )
							: __('Today', 'vulopilot')}
					</span>
				</div>
			</div>
			{!isPro && (
				<dl className="vp-trend-stats">
					<div className="is-up">
						<dt>{__('Up', 'vulopilot')}</dt>
						<dd>{up}</dd>
					</div>
					<div className="is-down">
						<dt>{__('Down', 'vulopilot')}</dt>
						<dd>{down}</dd>
					</div>
					<div>
						<dt>{__('Steady', 'vulopilot')}</dt>
						<dd>{areas.length - up - down}</dd>
					</div>
				</dl>
			)}
			{isPro && stats.length > 0 && (
				<dl className="vp-trend-stats">
					{stats.map((stat) => (
						<div key={stat.label}>
							<dt>{stat.label}</dt>
							<dd>{stat.value}</dd>
						</div>
					))}
				</dl>
			)}
		</div>
	);

	let body: React.ReactNode;

	if (!isPro) {
		body = (
			<>
				{headline}
				<AreaShiftChart areas={areas} />
				<div className="vp-trend-upsell">
					<i className="adminfont-lock" aria-hidden="true" />
					<span>
						<strong>{__('See every day, not just this week', 'vulopilot')}</strong>
						{__('Pro records your score daily for 30 and 90-day trends, so you spot a drop the day it starts.', 'vulopilot')}
					</span>
					<button type="button" className="vp-step-cta is-ai" onClick={() => setIsProPopupOpen(true)}>
						<i className="adminfont-pro-tag" aria-hidden="true" />
						{__('Unlock', 'vulopilot')}
					</button>
				</div>
			</>
		);
	} else if (snapshots.isLoading) {
		body = <Skeleton size="chart" />;
	} else if (points.length < 2) {
		body = (
			<>
				{points.length > 0 && headline}
				<EmptyState
					compact
					icon="calendar"
					title={__('Your trend starts today', 'vulopilot')}
					text={__('VuloPilot records your score once a day. The line appears once there are two days to compare.', 'vulopilot')}
				/>
			</>
		);
	} else {
		body = (
			<>
				{headline}
				<ScoreTrendChart
					points={points}
					label={sprintf(
						/* translators: %s: period such as "30 days". */
						__('Overall score per day over the last %s', 'vulopilot'),
						period
					)}
				/>
			</>
		);
	}

	return (
		<>
			<DashboardWidget
				title={__('Health trend', 'vulopilot')}
				desc={desc}
				icon="analytics"
				isLoading={isLoading}
				onHide={onHide}
				isCustomizing={isCustomizing}
				className="vp-trend-card"
				headerAction={
					<Segmented
						size="sm"
						options={isPro ? PERIODS : PERIODS.map((option) => ('7' === option.value ? option : { ...option, icon: 'lock' }))}
						value={isPro ? days : '7'}
						onChange={(value) => (isPro || '7' === value ? setDays(value as PeriodDays) : setIsProPopupOpen(true))}
						label={__('Period', 'vulopilot')}
					/>
				}
			>
				{body}
			</DashboardWidget>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				<ShowProPopup />
			</PopupComponent>
		</>
	);
};

export default VuloPilotActivityWidget;
