/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { AnalyticsComponent, CardComponent } from '@zyra/components';
import { SelectInput } from '@zyra/inputs';

type StatsPeriod = 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days';

interface StatMetric {
	current: number;
	previous: number;
	change_percent: number | null;
}

interface StatsResponse {
	content_created: StatMetric;
	words_generated: StatMetric;
}

const PERIOD_OPTIONS: { value: StatsPeriod; label: string }[] = [
	{ value: 'this_month', label: __('This Month', 'vulopilot') },
	{ value: 'last_month', label: __('Last Month', 'vulopilot') },
	{ value: 'last_7_days', label: __('Last 7 Days', 'vulopilot') },
	{ value: 'last_30_days', label: __('Last 30 Days', 'vulopilot') },
];

const toYmd = (date: Date): string => date.toISOString().slice(0, 10);

/** Real `date_from`/`date_to` (Y-m-d) for the selected period — same client-side computation style HistoryTab.tsx's own `resolveDateFrom()` already uses, extended to also resolve a real end boundary ("Last Month" isn't "today", unlike that page's own presets). */
const resolvePeriod = (period: StatsPeriod): { dateFrom: string; dateTo: string } => {
	const now = new Date();

	if ('this_month' === period) {
		return {
			dateFrom: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)),
			dateTo: toYmd(now),
		};
	}

	if ('last_month' === period) {
		const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
		const lastMonthStart = new Date(
			lastMonthEnd.getFullYear(),
			lastMonthEnd.getMonth(),
			1
		);
		return { dateFrom: toYmd(lastMonthStart), dateTo: toYmd(lastMonthEnd) };
	}

	const days = 'last_7_days' === period ? 6 : 29;
	const from = new Date(now);
	from.setDate(from.getDate() - days);

	return { dateFrom: toYmd(from), dateTo: toYmd(now) };
};

/** "128.6K" past 1,000, plain otherwise — same abbreviated style the mockup's own "Words Generated" tile uses. */
const formatAbbreviated = (count: number): string =>
	count >= 1000
		? `${(count / 1000).toFixed(1)}K`
		: count.toLocaleString();

/**
 * "Content Stats" — real Content Created/Words Generated counts (real
 * `GET /content-intelligence/stats`, backed by ActionRunRepository's own
 * real `vulopilot_ai_action_runs` rows for `generate-blog`/
 * `generate-landing-page`/`generate-product-description`, the same 3
 * actions ContentOpenIssuesCard's own docblock precedent already scoped
 * a real feature to) for the selected real period, with a real
 * vs-previous-period percent change — no change badge shown when the
 * previous period had 0 (nothing honest to compare against, rather than
 * a fabricated "+100%").
 *
 * "SEO Score Improved" and "Time Saved" stay honest "Not tracked yet"
 * tiles: no historical Content/SEO score snapshot exists anywhere in
 * this codebase to compute a real delta from (`Dashboard::
 * calculate_content_score()` is a live, unstored calculation — see
 * `classes/RestAPI/Controllers/Dashboard.php`'s own method), and no
 * "time saved by AI content generation" estimate exists anywhere either
 * (the only `estimated_time_minutes` concept in this codebase is
 * RuleEngine\Rules's unrelated "time to manually fix a finding"). Same
 * honest-omission posture this card's own previous version already took,
 * just alongside the 2 tiles that genuinely are trackable now instead of
 * all 4 staying placeholders.
 */
const ContentStatsCard = () => {
	const [period, setPeriod] = useState<StatsPeriod>('this_month');
	const [stats, setStats] = useState<StatsResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const { dateFrom, dateTo } = resolvePeriod(period);

		setIsLoading(true);
		getApiResponse<StatsResponse>(
			getApiLink(
				appLocalizer,
				`content-intelligence/stats?date_from=${dateFrom}&date_to=${dateTo}`
			),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setStats(response);
				}
			})
			.finally(() => setIsLoading(false));
	}, [period]);

	const renderChange = (changePercent: number | null) => {
		if (null === changePercent) {
			return null;
		}

		const isPositive = changePercent >= 0;

		return (
			<span
				className={`content-stats-tile-change ${isPositive ? 'up' : 'down'}`}
			>
				<i
					className={`adminfont-arrow-${isPositive ? 'up' : 'down'}`}
				/>
				{Math.abs(changePercent)}%
			</span>
		);
	};

	return (
		<CardComponent
			className="content-stats-card"
			title={__('Content Stats', 'vulopilot')}
			titleIcon='ai'
			isLoading={isLoading}
			action={
				<SelectInput
					type="single-select"
					name="content-stats-period"
					value={period}
					onChange={(value) => setPeriod(value as StatsPeriod)}
					options={PERIOD_OPTIONS}
					isClearable={false}
				/>
			}
		>
			{stats && (
				<AnalyticsComponent
					variant="background-color"
					cols={2}
					data={[
						{
							colorClass: 'admin-bg-color2',
							icon: 'document',
							number: (
								<>
									{stats.content_created.current.toLocaleString()}
									{renderChange(
										stats.content_created.change_percent
									)}
								</>
							),
							text: __('Content Created', 'vulopilot'),
						},
						{
							icon: 'edit',
							colorClass: 'admin-bg-color3',
							number: (
								<>
									{formatAbbreviated(
										stats.words_generated.current
									)}
									{renderChange(
										stats.words_generated.change_percent
									)}
								</>
							),
							text: __('Words Generated', 'vulopilot'),
						},
						{
							icon: 'bar-chart',
							colorClass: 'admin-bg-color4',
							number: '0',
							text: (
								<>
									{__('SEO Score', 'vulopilot')}
								</>
							),
						},
						{
							icon: 'clock',
							colorClass: 'admin-bg-color6',
							number: '0',
							text: (
								<>
									{__('Time Saved', 'vulopilot')}
								</>
							),
						},
					]}
				/>
			)}
		</CardComponent>
	);
};

export default ContentStatsCard;
