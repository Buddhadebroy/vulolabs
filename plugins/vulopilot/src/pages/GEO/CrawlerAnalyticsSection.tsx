/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	AnalyticsComponent,
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	BadgeComponent,
	ListComponent,
	ModuleGuardComponent,
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
import { formatWpDate } from '../../services/formatWpDate';

const PIE_COLORS = ['#7C3AED', '#2563EB', '#0D9488', '#EA580C', '#DB2777', '#65A30D'];

/** Same 3-tier 0-100 band this codebase's other real score rings (GeoScoreSection.tsx, GeoVisibilitySummaryCard.tsx) already use. */
const getRating = (score: number): string => {
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 40) {
		return __('Needs Attention', 'vulopilot');
	}
	return __('Poor', 'vulopilot');
};

const ratingClass = (score: number): string => {
	if (score >= 70) {
		return 'is-good';
	}
	if (score >= 40) {
		return 'is-attention';
	}
	return 'is-poor';
};

const pctChange = (current: number, previous: number): number | null => {
	if (0 === previous) {
		return null;
	}
	return Math.round(((current - previous) / previous) * 100);
};

const ChangeBadge = ({ current, previous }: { current: number; previous: number }) => {
	const change = pctChange(current, previous);
	if (null === change) {
		return;
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
 * `get_analytics()` docblock on why), a real Top Crawlers table (own real
 * "Last seen" column — the separate "Last seen" tiles card
 * (CrawlerSummaryCard.tsx) that used to sit below this section was merged
 * into this table instead, per direct instruction ("merge top crawlers
 * and last seen section, add a column in top crawlers last seen") — same
 * real `MAX(created_at)`-per-bot value, just a column here now instead of
 * its own card; CrawlerSummaryCard.tsx itself was deleted since this was
 * its only real consumer), a real Most Crawled Pages table with real
 * %-change per page, and a real crawl health checklist. Every number here
 * traces back to either `crawler-traffic/analytics`
 * (CrawlerVisitRepository::get_period_comparison(), which now folds
 * get_bot_last_seen()'s own real per-bot timestamp into each `top_crawlers`
 * row) or a real `findings/groups` fetch — nothing here is invented.
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
				<ColumnComponent >
					<CardComponent
						title={__('Overall Crawl Health', 'vulopilot')}
						titleIcon="search-discovery"
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

	const statCards = [
		{
			key: 'requests',
			label: __('Total Crawl Requests', 'vulopilot'),
			colorClass: 'green',
			value: analytics.current_total,
			previous: analytics.previous_total,
		},
		{
			key: 'crawlers',
			label: __('Unique Crawlers', 'vulopilot'),
			colorClass: 'sky',
			value: analytics.current_unique_bots,
			previous: analytics.previous_unique_bots,
		},
		{
			key: 'pages',
			label: __('Pages Crawled', 'vulopilot'),
			colorClass: 'lime',
			value: analytics.most_crawled_pages.length,
			previous: analytics.most_crawled_pages.filter(
				(page) => page.previous_total > 0
			).length,
		},
		{
			key: 'blocked',
			label: __('Blocked Pages', 'vulopilot'),
			colorClass: 'indigo',
			value: analytics.blocked_pages_total,
			previous: analytics.blocked_pages_total,
		},
	];

	const vendorEntries = Object.entries(analytics.by_vendor);
	const vendorTotal = vendorEntries.reduce((sum, [, total]) => sum + total, 0);

	return (
		<>
			<ContainerComponent>
				<ColumnComponent grid={4}>
					<CardComponent
						title={__('Overall Crawl Health', 'vulopilot')}
						titleIcon="search-discovery"
						desc={__('How many robots.txt/sitemap crawl-health checks currently pass.', 'vulopilot')}
					>
						{checklist.length === 0 ? (
							<div className="desc">
								{__(
									'Turn on the SEO module to see robots.txt/sitemap crawl-health checks here.',
									'vulopilot'
								)}
							</div>
						) : (
							<div className="crawl-health-ring">
								<ChartComponent
									type="ring"
									height={150}
									centerLabel={
										<>
											<span className="score-ring-number">
												{analytics.crawl_health_score}
											</span>
											<span className="score-ring-label">/100</span>
											<span
												className={`score-ring-label geo-overall-rating ${ratingClass(analytics.crawl_health_score)}`}
											>
												{getRating(analytics.crawl_health_score)}
											</span>
										</>
									}
									data={[
										{
											label: __('Score', 'vulopilot'),
											value: analytics.crawl_health_score,
											color: '#16a34a',
										},
										{
											label: __('Remaining', 'vulopilot'),
											value: 100 - analytics.crawl_health_score,
											color: '#e5e7eb',
										},
									]}
								/>
							</div>
						)}
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent grid={8}>
					<AnalyticsComponent
						variant="small-card"
						cols={4}
						data={statCards.map((stat) => ({
							number: stat.value,
							text: stat.label,
							colorClass: stat.colorClass,
							extra: (
								<ChangeBadge
									current={stat.value}
									previous={stat.previous}
								/>
							),
						}))}
					/>
				</ColumnComponent>
			</ContainerComponent>

			<ContainerComponent>
				<ColumnComponent grid={7}>
					<CardComponent
						title={__('Crawl Requests Over Time', 'vulopilot')}
						titleIcon="analytics"
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
				<ColumnComponent grid={5} fullHeight>
					<CardComponent
						title={__('Crawler Traffic by AI Lab', 'vulopilot')}
						titleIcon="global-community"
						desc={__(
							'Breakdown of AI-crawler requests by the company behind each bot.',
							'vulopilot'
						)}
					>
						{0 === vendorEntries.length ? (
							<ModuleGuardComponent
								icon="info"
								title={__('No AI crawler visits yet', 'vulopilot')}
								desc={__(
									'AI crawler activity will show up here once detected.',
									'vulopilot'
								)}
							/>
						) : (
							<>
								<div className="crawler-vendor-chart">
									<ChartComponent
										type="pie"
										height={160}
										centerLabel={
											<>
												<span className="score-ring-number">
													{vendorTotal.toLocaleString()}
												</span>
												<span className="score-ring-label">
													{__('Total', 'vulopilot')}
												</span>
											</>
										}
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
						titleIcon="search-discovery"
						desc={__('Bots that crawled your site the most.', 'vulopilot')}
					>
						{0 === analytics.top_crawlers.length ? (
							<ModuleGuardComponent
								icon="info"
								title={__('No AI crawler visits yet', 'vulopilot')}
								desc={__(
									'AI crawler activity will show up here once detected.',
									'vulopilot'
								)}
							/>
						) : (
							<>
								<table className="crawler-table">
									<thead>
										<tr>
											<th>{__('Crawler', 'vulopilot')}</th>
											<th>{__('Requests', 'vulopilot')}</th>
											<th>{__('Change', 'vulopilot')}</th>
											<th>{__('Last seen', 'vulopilot')}</th>
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
												<td>
													{crawler.last_seen_at
														? formatWpDate(crawler.last_seen_at)
														: '—'}
												</td>
											</tr>
										))}
									</tbody>
								</table>
								<a
									className="crawler-view-all-link"
									href="#recent-crawl-requests"
									onClick={(event) => {
										event.preventDefault();
										document
											.getElementById('recent-crawl-requests')
											?.scrollIntoView({ behavior: 'smooth' });
									}}
								>
									{sprintf(
										/* translators: %d: real total number of distinct crawlers seen. */
										__('View all (%d total) ›', 'vulopilot'),
										analytics.top_crawlers.length
									)}
								</a>
							</>
						)}
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent grid={6}>
					<CardComponent
						title={__('Most Crawled Pages', 'vulopilot')}
						titleIcon="document"
						desc={__('Pages that crawlers visited most often.', 'vulopilot')}
					>
						{0 === analytics.most_crawled_pages.length ? (
							<ModuleGuardComponent
								icon="info"
								title={__('No AI crawler visits yet', 'vulopilot')}
								desc={__(
									'AI crawler activity will show up here once detected.',
									'vulopilot'
								)}
							/>
						) : (
							<>
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
								<a
									className="crawler-view-all-link"
									href="#recent-crawl-requests"
									onClick={(event) => {
										event.preventDefault();
										document
											.getElementById('recent-crawl-requests')
											?.scrollIntoView({ behavior: 'smooth' });
									}}
								>
									{__('View all pages ›', 'vulopilot')}
								</a>
							</>
						)}
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>

			{checklist.length > 0 && (
				<CardComponent
					title={__('Crawl Health Checklist', 'vulopilot')}
					titleIcon="check"
					desc={__('Real robots.txt/sitemap crawl-health checks, at a glance.', 'vulopilot')}
				>
					<ListComponent
						className="crawler-checklist-row"
						items={checklist.map((item) => ({
							id: item.key,
							icon:
								null === item.isGood
									? 'info'
									: item.isGood
										? 'check'
										: 'error',
							title: item.label,
							tags: (
								<BadgeComponent
									color={
										null === item.isGood
											? ''
											: item.isGood
												? 'green'
												: 'yellow'
									}
									text={
										null === item.isGood
											? __('Checking…', 'vulopilot')
											: item.isGood
												? __('Good', 'vulopilot')
												: __('Warning', 'vulopilot')
									}
								/>
							),
						}))}
					/>
				</CardComponent>
			)}
		</>
	);
};

export default CrawlerAnalyticsSection;
