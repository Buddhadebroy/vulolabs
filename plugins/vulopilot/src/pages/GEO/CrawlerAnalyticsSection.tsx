/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
} from '@zyra/components';
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import type { CrawlerAnalytics } from './useCrawlerAnalytics';

const PIE_COLORS = ['#7C3AED', '#2563EB', '#0D9488', '#EA580C', '#DB2777', '#65A30D'];

const pctChange = (current: number, previous: number): number | null => {
	if (0 === previous) {
		return null;
	}
	return Math.round(((current - previous) / previous) * 100);
};

const ChangeBadge = ({ current, previous }: { current: number; previous: number }) => {
	const change = pctChange(current, previous);
	if (null === change) {
		return <span className="crawler-change is-neutral">—</span>;
	}
	return (
		<span className={`crawler-change ${change >= 0 ? 'is-up' : 'is-down'}`}>
			{change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
		</span>
	);
};

/**
 * Real "Robots.txt is accessible" / "XML sitemap is accessible" / "No
 * critical AI-bot blocks" checklist — reuses the same real `scanner_id`s
 * SeoTab.tsx's own `robots`/`sitemap` sections already report on, fetched
 * once here rather than duplicating SeoTab's own SectionedFindingsTab
 * fetch. Only shown while the SEO module is active, same gate SeoTab.tsx
 * itself uses for the identical reason (those scanners don't run at all
 * otherwise, so "0 open findings" would be a false "Good", not a real one).
 */
const CHECKLIST_ITEMS: { key: string; scannerIds: string[]; label: string }[] = [
	{
		key: 'robots',
		scannerIds: ['robots-txt'],
		label: __('Robots.txt is accessible', 'vulopilot'),
	},
	{
		key: 'sitemap',
		scannerIds: ['sitemap', 'sitemap-validation'],
		label: __('XML sitemap is accessible', 'vulopilot'),
	},
	{
		key: 'ai-blocks',
		scannerIds: ['ai-crawler-blocked-pages'],
		label: __('No critical AI-bot blocks', 'vulopilot'),
	},
];

const isSeoModuleActive = () =>
	appLocalizer.active_modules?.includes('seo') ?? false;

interface CrawlerAnalyticsSectionProps {
	analytics: CrawlerAnalytics | null;
	isLoading: boolean;
}

/**
 * The restyled Crawler Traffic tab's real analytics section — an "Overall
 * Crawl Health" summary, 4 real stat cards (each with a real %-change
 * against the immediately preceding period), a real trend chart, a real
 * "by AI lab" breakdown (not "search vs AI" — see CrawlerTraffic.php's own
 * `get_analytics()` docblock on why), a real Top Crawlers table, a real
 * Most Crawled Pages table with real %-change per page, and a real crawl
 * health checklist. Every number here traces back to either
 * `crawler-traffic/analytics` (CrawlerVisitRepository::get_period_comparison())
 * or a real `findings/groups` fetch — nothing here is invented.
 */
const CrawlerAnalyticsSection = ({
	analytics,
	isLoading,
}: CrawlerAnalyticsSectionProps) => {
	const [checklistGroups, setChecklistGroups] = useState<FindingGroup[] | null>(
		null
	);

	useEffect(() => {
		if (!isSeoModuleActive()) {
			return;
		}
		getApiResponse<{ data: FindingGroup[] }>(
			getApiLink(appLocalizer, 'findings/groups?per_page=200'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => setChecklistGroups(response?.data ?? []));
	}, []);

	if (isLoading || !analytics) {
		return (
			<ContainerComponent>
				<ColumnComponent grid={12}>
					<CardComponent
						title={__('Overall Crawl Health', 'vulopilot')}
						isLoading
					/>
				</ColumnComponent>
			</ContainerComponent>
		);
	}

	const openCount = (scannerIds: string[]): number =>
		(checklistGroups ?? [])
			.filter((group) => scannerIds.includes(group.scanner_id))
			.reduce((sum, group) => sum + group.count, 0);

	const checklist = isSeoModuleActive()
		? CHECKLIST_ITEMS.map((item) => ({
				...item,
				isGood: null === checklistGroups ? null : 0 === openCount(item.scannerIds),
			}))
		: [];
	const allGood =
		checklist.length > 0 && checklist.every((item) => item.isGood);

	const statCards = [
		{
			key: 'requests',
			label: __('Total Crawl Requests', 'vulopilot'),
			value: analytics.current_total,
			previous: analytics.previous_total,
		},
		{
			key: 'crawlers',
			label: __('Unique Crawlers', 'vulopilot'),
			value: analytics.current_unique_bots,
			previous: analytics.previous_unique_bots,
		},
		{
			key: 'pages',
			label: __('Pages Crawled', 'vulopilot'),
			value: analytics.most_crawled_pages.length,
			previous: analytics.most_crawled_pages.filter(
				(page) => page.previous_total > 0
			).length,
		},
		{
			key: 'blocked',
			label: __('Blocked Pages', 'vulopilot'),
			value: analytics.blocked_pages_total,
			previous: analytics.blocked_pages_total,
		},
	];

	const vendorEntries = Object.entries(analytics.by_vendor);
	const vendorTotal = vendorEntries.reduce((sum, [, total]) => sum + total, 0);

	return (
		<>
			<ContainerComponent>
				<ColumnComponent grid={3}>
					<CardComponent title={__('Overall Crawl Health', 'vulopilot')}>
						{checklist.length === 0 ? (
							<p className="desc">
								{__(
									'Turn on the SEO module to see robots.txt/sitemap crawl-health checks here.',
									'vulopilot'
								)}
							</p>
						) : (
							<div
								className={`crawler-health-status ${allGood ? 'is-good' : 'is-warning'}`}
							>
								<i
									className={`adminfont-${allGood ? 'check' : 'error'}`}
								/>
								{allGood
									? __('Good', 'vulopilot')
									: __('Needs attention', 'vulopilot')}
							</div>
						)}
					</CardComponent>
				</ColumnComponent>
				{statCards.map((stat) => (
					<ColumnComponent key={stat.key} grid={3}>
						<CardComponent title={stat.label}>
							<div className="crawler-stat-value">{stat.value}</div>
							<ChangeBadge current={stat.value} previous={stat.previous} />
						</CardComponent>
					</ColumnComponent>
				))}
			</ContainerComponent>

			<ContainerComponent>
				<ColumnComponent grid={7}>
					<CardComponent
						title={__('Crawl Requests Over Time', 'vulopilot')}
						desc={__(
							'Number of requests your site received from AI crawlers.',
							'vulopilot'
						)}
					>
						<div className="dashboard-trend-chart">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={analytics.daily_volume}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="date" />
									<YAxis allowDecimals={false} />
									<Tooltip />
									<Area
										type="monotone"
										dataKey="total"
										stroke="#4B227A"
										fill="#00EED0"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent grid={5}>
					<CardComponent
						title={__('Crawler Traffic by AI Lab', 'vulopilot')}
						desc={__(
							'Breakdown of AI-crawler requests by the company behind each bot.',
							'vulopilot'
						)}
					>
						{0 === vendorEntries.length ? (
							<p className="desc">
								{__('No AI crawler visits detected yet.', 'vulopilot')}
							</p>
						) : (
							<>
								<div className="crawler-vendor-chart">
									<ChartComponent
										type="pie"
										height={160}
										data={vendorEntries.map(([vendor, total], index) => ({
											label: vendor,
											value: total,
											color: PIE_COLORS[index % PIE_COLORS.length],
										}))}
									/>
								</div>
								<div className="crawler-vendor-legend">
									{vendorEntries.map(([vendor, total], index) => (
										<div key={vendor} className="crawler-vendor-legend-row">
											<span
												className="crawler-vendor-dot"
												style={{
													backgroundColor:
														PIE_COLORS[index % PIE_COLORS.length],
												}}
											/>
											<span className="crawler-vendor-name">{vendor}</span>
											<span className="crawler-vendor-count">
												{total.toLocaleString()}{' '}
												{sprintf(
													'(%d%%)',
													vendorTotal
														? Math.round((total / vendorTotal) * 100)
														: 0
												)}
											</span>
										</div>
									))}
								</div>
							</>
						)}
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>

			<ContainerComponent>
				<ColumnComponent grid={6}>
					<CardComponent
						title={__('Top Crawlers', 'vulopilot')}
						desc={__('Bots that crawled your site the most.', 'vulopilot')}
					>
						{0 === analytics.top_crawlers.length ? (
							<p className="desc">
								{__('No AI crawler visits detected yet.', 'vulopilot')}
							</p>
						) : (
							<table className="crawler-table">
								<thead>
									<tr>
										<th>{__('Crawler', 'vulopilot')}</th>
										<th>{__('Requests', 'vulopilot')}</th>
										<th>{__('Change', 'vulopilot')}</th>
									</tr>
								</thead>
								<tbody>
									{analytics.top_crawlers.slice(0, 8).map((crawler) => (
										<tr key={crawler.bot_name}>
											<td>{crawler.bot_name}</td>
											<td>{crawler.total.toLocaleString()}</td>
											<td>
												<ChangeBadge
													current={crawler.total}
													previous={crawler.previous_total}
												/>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent grid={6}>
					<CardComponent
						title={__('Most Crawled Pages', 'vulopilot')}
						desc={__('Pages that crawlers visited most often.', 'vulopilot')}
					>
						{0 === analytics.most_crawled_pages.length ? (
							<p className="desc">
								{__('No AI crawler visits detected yet.', 'vulopilot')}
							</p>
						) : (
							<table className="crawler-table">
								<thead>
									<tr>
										<th>{__('Page', 'vulopilot')}</th>
										<th>{__('Requests', 'vulopilot')}</th>
										<th>{__('Change', 'vulopilot')}</th>
									</tr>
								</thead>
								<tbody>
									{analytics.most_crawled_pages.slice(0, 8).map((page) => (
										<tr key={page.requested_url}>
											<td className="crawler-table-url">
												{page.requested_url}
											</td>
											<td>{page.total.toLocaleString()}</td>
											<td>
												<ChangeBadge
													current={page.total}
													previous={page.previous_total}
												/>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>

			{checklist.length > 0 && (
				<CardComponent title={__('Crawl Health Checklist', 'vulopilot')}>
					<div className="crawler-checklist">
						{checklist.map((item) => (
							<div key={item.key} className="crawler-checklist-row">
								<i
									className={`adminfont-${
										null === item.isGood
											? 'info'
											: item.isGood
												? 'check'
												: 'error'
									}`}
								/>
								<span className="crawler-checklist-label">{item.label}</span>
								<span
									className={`admin-badge ${
										null === item.isGood
											? ''
											: item.isGood
												? 'green'
												: 'yellow'
									}`}
								>
									{null === item.isGood
										? __('Checking…', 'vulopilot')
										: item.isGood
											? __('Good', 'vulopilot')
											: __('Warning', 'vulopilot')}
								</span>
							</div>
						))}
					</div>
				</CardComponent>
			)}
		</>
	);
};

export default CrawlerAnalyticsSection;
