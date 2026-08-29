/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { BadgeComponent, ChartComponent } from '@zyra/components';
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

	const tiles = [
		{
			key: 'crawler-visits',
			icon: 'global-community',
			label: __('AI crawler visits', 'vulopilot'),
			loading: isCrawlerLoading,
			content:
				crawlerCurrent === 0 && crawlerPrevious === 0 ? (
					<div className="vulopilot-activity-tile-empty">
						{__('No visits yet', 'vulopilot')}
					</div>
				) : (
					<>
						<div className="vulopilot-activity-tile-value">
							{crawlerCurrent}
						</div>
						<div className="vulopilot-activity-tile-sub">
							{__('Last 7 days', 'vulopilot')}
							{null !== crawlerChangePercent && (
								<BadgeComponent
									color={
										crawlerChangePercent >= 0
											? 'green'
											: 'red'
									}
									icon={`arrow-${crawlerChangePercent >= 0 ? 'up' : 'down'}`}
									text={`${Math.abs(crawlerChangePercent)}%`}
								/>
							)}
						</div>
						{sparklineData.length > 0 && (
							<div className="vulopilot-activity-tile-sparkline">
								<ChartComponent
									type="area"
									sparkline
									height={32}
									color="#16a34a"
									data={sparklineData}
								/>
							</div>
						)}
					</>
				),
		},
		{
			key: 'automations',
			icon: 'automation',
			label: __('Automations', 'vulopilot'),
			loading: isLoading,
			content: (
				<>
					<div className="vulopilot-activity-tile-value">
						{summary.automation_status.enabled}
					</div>
					<div className="vulopilot-activity-tile-sub">
						{summary.automation_status.enabled > 0
							? __('Running', 'vulopilot')
							: __('None active', 'vulopilot')}
					</div>
				</>
			),
		},
		{
			key: 'last-audit',
			icon: 'clock',
			label: __('Last audit', 'vulopilot'),
			loading: isLastScanLoading,
			content: lastScanAt ? (
				<>
					<div className="vulopilot-activity-tile-value vulopilot-activity-tile-value--date">
						{formatAuditTime(lastScanAt)}
					</div>
					<div className="vulopilot-activity-tile-sub">
						{__('Last scan completed', 'vulopilot')}
					</div>
				</>
			) : (
				<div className="vulopilot-activity-tile-empty">
					{__('No scans yet', 'vulopilot')}
				</div>
			),
		},
		{
			key: 'pending-approvals',
			icon: 'ai',
			label: __('Pending approvals', 'vulopilot'),
			loading: isLoading,
			content: (
				<>
					<div className="vulopilot-activity-tile-value">
						{summary.pending_approvals}
					</div>
					<div className="vulopilot-activity-tile-sub">
						{__('AI suggested changes', 'vulopilot')}
					</div>
				</>
			),
		},
		{
			key: 'latest-report',
			icon: 'report',
			label: __('Latest report', 'vulopilot'),
			loading: isReportsLoading,
			content:
				reportRows.length > 0 ? (
					<>
						<div className="vulopilot-activity-tile-value vulopilot-activity-tile-value--date">
							{formatWpDate(reportRows[0].created_at)}
						</div>
						<a
							href="?page=vulopilot#&tab=reports"
							className="vulopilot-activity-tile-link"
						>
							{__('View report', 'vulopilot')} →
						</a>
					</>
				) : (
					<div className="vulopilot-activity-tile-empty">
						{__('No reports yet', 'vulopilot')}
					</div>
				),
		},
	];

	return (
		<DashboardWidget
			title={__('VuloPilot activity', 'vulopilot')}
			icon="analytics"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			<div className="vulopilot-activity-row">
				{tiles.map((tile) => (
					<div className="vulopilot-activity-tile" key={tile.key}>
						<div className="vulopilot-activity-tile-label">
							<i className={`adminfont-${tile.icon}`} />
							{tile.label}
						</div>
						{tile.loading ? (
							<div className="vulopilot-activity-tile-empty">
								{__('Loading…', 'vulopilot')}
							</div>
						) : (
							tile.content
						)}
					</div>
				))}
			</div>
		</DashboardWidget>
	);
};

export default VuloPilotActivityWidget;
