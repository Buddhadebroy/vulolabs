/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, AnalyticsComponent } from '@zyra/core';
import { ChartComponent } from '@zyra/components';
import { ToggleInput } from '@zyra/inputs';
import DashboardWidget from './DashboardWidget';
import { useApiList } from '../services/useApiList';
import { useLastScanTime } from '../services/useLastScanTime';
import { formatWpDate } from '../services/formatWpDate';
import { WidgetProps } from './types';

interface CrawlerAnalyticsResponse {
	current_total: number;
	previous_total: number;
	daily_volume: { date: string; total: number }[];
}

interface ReportRow {
	created_at: string;
}

interface HealthSnapshot {
	snapshot_date: string;
	overall_score: number;
}

type PeriodDays = '7' | '30' | '90';

/** Same real `key` field convention `OverviewTab.tsx`'s own identical `ToggleInput` usage already establishes — required so React's list key and each radio's real `id`/`htmlFor` pair are unique. */
const PERIOD_OPTIONS = [
	{ key: '7', value: '7', label: __('Last 7 days', 'vulopilot') },
	{ key: '30', value: '30', label: __('Last 30 days', 'vulopilot') },
	{ key: '90', value: '90', label: __('Last 90 days', 'vulopilot') },
];

/** Same real day-range options the old `BadgeComponent` toggle used, now expressed as the real `PeriodDays` string values `ToggleInput` needs. */
const HEALTH_TIMELINE_DAY_OPTIONS: PeriodDays[] = ['7', '30', '90'];

/**
 * "VuloPilot activity" — a real 5-tile activity strip. Every tile reads
 * data that already exists elsewhere on this Dashboard/plugin; this widget
 * only re-presents it compactly rather than introducing a new data source
 * per tile:
 *
 * - AI crawler visits: `GET /crawler-traffic/analytics?days=7` (same
 *   endpoint CrawlerAnalyticsSection.tsx uses) — `current_total`/
 *   `previous_total` are a real, already-computed 7-day-vs-previous-7-day
 *   comparison (CrawlerVisitRepository::get_period_comparison()), and
 *   `daily_volume` backs a real sparkline of the last 7 real days.
 * - Automations: `summary.automation_status.enabled` — already on the
 *   shared `/dashboard` payload (Controllers\Dashboard::get_items()).
 * - Last audit: `useLastScanTime()` (sitewide, no scanner/category
 *   filter) — the same real `vulopilot_scans.finished_at` used by every
 *   category page's own header.
 * - Pending approvals: `summary.pending_approvals` — the same real count
 *   NeedsAttentionWidget's "Pending approval" tab already lists.
 * - Latest report: `GET /reports?per_page=1` (same endpoint
 *   LatestReportsWidget already reads), most recent row's `created_at`.
 *
 * The mockup's own 6th tile, "Next audit" (a specific upcoming date/time,
 * e.g. "Daily at 9:00 AM"), is deliberately NOT included: `automatic_site_scan`/
 * `scan_frequency` (Settings → General) are real, stored settings, but
 * nothing in this Free plugin actually reads them to schedule a recurring
 * full scan (confirmed — no `wp_schedule_event()` call anywhere references
 * either setting, unlike BackupScheduler's own real `backup_frequency`
 * wiring). The only real recurring-schedule mechanism in this codebase
 * (`vulopilot_automations_tick_{type}`, `Controllers\Automations::with_next_run()`)
 * lives entirely in vulopilot-pro's Automations module, drives
 * notification/AI-action automations rather than scans, and would show
 * `null` on any site without that Pro module active — showing a specific
 * "Next audit" date here would be fabricated on every Free-tier site.
 * Also, "Last audit" is labeled generically ("Last scan completed") rather
 * than the mockup's "Full audit completed" — `vulopilot_scans` has one row
 * per scanner (Scanners\ScanRunner::run_all() loops per-scanner), so the
 * single most-recently-finished row doesn't by itself distinguish a full
 * "Run Complete Audit" from one category's scan finishing.
 */
const VuloPilotActivityWidget: React.FC<WidgetProps> = ({
	summary,
	isLoading,
	onHide,
	isCustomizing,
}) => {
	const [crawlerAnalytics, setCrawlerAnalytics] =
		useState<CrawlerAnalyticsResponse | null>(null);
	const [isCrawlerLoading, setIsCrawlerLoading] = useState(true);

	useEffect(() => {
		getApiResponse<CrawlerAnalyticsResponse>(
			getApiLink(appLocalizer, 'crawler-traffic/analytics?days=7'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setCrawlerAnalytics(response);
				}
			})
			.finally(() => setIsCrawlerLoading(false));
	}, []);

	const { data: reportRows, isLoading: isReportsLoading } =
		useApiList<ReportRow>('reports', { per_page: 1 });
	const { lastScanAt, isLoading: isLastScanLoading } = useLastScanTime();

	// Same real `/site-health-snapshots` endpoint
	// HealthTimelineWidget.tsx's own trend chart already uses — only
	// registered once vulopilot-pro's AdvancedReports module is active
	// (real, permanent 404 on a Free-only install otherwise, same reason
	// that widget checks `active_modules` directly rather than treating
	// "404'd" and "zero rows" as the same friendly empty state).
	//
	// Real "Last 7/30/90 days" toggle, now the same real `ToggleInput`
	// shape `OverviewTab.tsx`'s own "Visibility Trend" card already uses
	// for its identical day-range control — replacing the previous
	// `BadgeComponent`-based toggle per direct instruction.
	const [healthTimelineDays, setHealthTimelineDays] = useState<PeriodDays>('30');
	const { data: healthSnapshots } = useApiList<HealthSnapshot>(
		'site-health-snapshots',
		{ days: Number(healthTimelineDays) }
	);
	const isHealthTimelineModuleActive =
		appLocalizer.active_modules.includes('advanced-reports');

	const crawlerCurrent = crawlerAnalytics?.current_total ?? 0;
	const crawlerPrevious = crawlerAnalytics?.previous_total ?? 0;
	const crawlerChangePercent =
		crawlerPrevious > 0
			? Math.round(
				((crawlerCurrent - crawlerPrevious) / crawlerPrevious) *
				100
			)
			: null;
	const sparklineData = (crawlerAnalytics?.daily_volume ?? []).map(
		(day) => ({
			label: day.date,
			value: day.total,
		})
	);

	const formatAuditTime = (dateString: string): string => {
		const date = new Date(dateString);
		const isToday = date.toDateString() === new Date().toDateString();

		return isToday
			? sprintf(
				/* translators: %s: real completion time, e.g. "9:26 AM". */
				__('Today, %s', 'vulopilot'),
				date.toLocaleTimeString(undefined, {
					hour: 'numeric',
					minute: '2-digit',
				})
			)
			: formatWpDate(dateString);
	};

	return (
		<DashboardWidget
			title={__('Health timeline', 'vulopilot')}
			icon="analytics"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
			headerAction={
				<ToggleInput
					options={PERIOD_OPTIONS}
					value={healthTimelineDays}
					onChange={(value) => setHealthTimelineDays(value as PeriodDays)}
					modules={[]}
				/>
			}
		>

			{isHealthTimelineModuleActive && healthSnapshots.length > 0 && (
				<ChartComponent
					type="dynamic-line"
					data={healthSnapshots.map((snapshot) => ({
						...snapshot,
						snapshot_date: formatWpDate(snapshot.snapshot_date),
					}))}
					dataKey="overall_score"
					xKey="snapshot_date"
					height={300}
					yDomain={[0, 100]}
				/>
			)}
			<div className="vulopilot-activity-row">
				<AnalyticsComponent
					variant="small"
					cols={3}
					data={[
						{
							icon: 'global-community green',
							number: crawlerCurrent,
							text: __('AI crawler visits', 'vulopilot'),
						},
						{
							icon: 'automation blue',
							number: summary.automation_status.enabled,
							text: __('Automations', 'vulopilot'),
						},
						{
							icon: 'ai purple',
							number: summary.pending_approvals,
							text: __('Pending approvals', 'vulopilot'),
						},
						{
							icon: 'report blue',
							number:
								reportRows.length > 0
									? formatWpDate(reportRows[0].created_at)
									: '—',
							text: __('Latest report', 'vulopilot'),
						},
					]}
				/>
			</div>
		</DashboardWidget>
	);
};

export default VuloPilotActivityWidget;