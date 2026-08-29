/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	BadgeComponent,
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	MetricTileComponent,
	ModuleGuardComponent,
	type MetricTileItem,
} from '@zyra/components';
import { ButtonInput, SelectInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import { useVisibilityScore } from './useVisibilityScore';
import type { VisibilityArea } from './useVisibilityScore';
import GeoFixTheseFirstCard from './GeoFixTheseFirstCard';
import './SeoVisibility.scss';

interface OverviewTabProps {
	onNavigateTab: (tab: string) => void;
}

const getRating = (score: number): string => {
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 40) {
		return __('Needs Work', 'vulopilot');
	}
	return __('Poor', 'vulopilot');
};

const ratingClass = (score: number): string => {
	if (score >= 70) {
		return 'green';
	}
	if (score >= 40) {
		return 'blue';
	}
	return 'red';
};

const ScoreDelta = ({ change }: { change: number }) => (
	<span className={`crawler-change ${change >= 0 ? 'is-up' : 'is-down'}`}>
		{change >= 0 ? '↑' : '↓'}{' '}
		{sprintf(
			/* translators: %d: real point change vs 7 days ago. */
			__('%d pts vs last week', 'vulopilot'),
			Math.abs(change)
		)}
	</span>
);

/**
 * One `MetricTileItem` per real score area — `number` (the real 0-100
 * score), `status` (the same real `ratingClass()`/`getRating()` pairing
 * `BadgeComponent` used to render directly, now via `MetricTileComponent`'s
 * own identical `admin-badge {color}` construction), and `stat` (the real
 * `ScoreDelta` "↑/↓ N pts vs last week" line, reused as-is — `stat` accepts
 * any `ReactNode`, so this is the same component, not a re-implementation).
 * `area` is `null` while loading or before this score area has real data —
 * that tile then renders header-only (icon/title), same as the old
 * `ScoreStatCard`'s own empty body.
 */
const scoreTile = (
	id: string,
	title: string,
	icon: string,
	area: VisibilityArea | { score: number; change: number } | null
): MetricTileItem => ({
	id,
	icon,
	title,
	number: area ? `${area.score}/100` : undefined,
	status: area
		? { text: getRating(area.score), color: ratingClass(area.score) }
		: undefined,
	stat: area ? <ScoreDelta change={area.change} /> : undefined,
});

type PeriodDays = '7' | '30' | '90';
const PERIOD_OPTIONS = [
	{ value: '7', label: __('Last 7 days', 'vulopilot') },
	{ value: '30', label: __('Last 30 days', 'vulopilot') },
	{ value: '90', label: __('Last 90 days', 'vulopilot') },
];

interface ProgressResponse {
	days: number;
	trend: { date: string; score: number }[];
}

interface ActivityLogRow {
	id: number;
	message: string;
	created_at: string;
}

/**
 * Every real event type `Services/ScanPersistenceListener.php`/
 * `AIActions/ActionRunner.php` actually write that plausibly belongs on a
 * sitewide "Recent Activity" feed (not `RecentActivityCard.tsx`'s own
 * security-only subset) — `scan.completed`/`scan.completed.security` (a
 * real scan finished), `critical_alert` (a real new-critical-findings
 * alert), `ai_action.executed`/`ai_action.failed` (a real AI-proposed fix
 * actually applied or attempted). No "score improved"/"AI answer
 * opportunity found" event type exists anywhere in this codebase — rather
 * than fabricate one, this just shows what's real.
 */
const ACTIVITY_EVENT_TYPES = [
	'scan.completed',
	'scan.completed.security',
	'critical_alert',
	'ai_action.executed',
	'ai_action.failed',
].join(',');

const timeAgo = (dateString: string): string => {
	const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
	if (seconds < 60) {
		return __('just now', 'vulopilot');
	}
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return sprintf(__('%dm ago', 'vulopilot'), minutes);
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return sprintf(__('%dh ago', 'vulopilot'), hours);
	}
	const days = Math.floor(hours / 24);
	return sprintf(__('%dd ago', 'vulopilot'), days);
};

/** Real `FindingGroup.category` values → the real SEO & Visibility subtab that owns that category's findings — kept in sync manually with each area's own scanner-id list, same posture Visibility.php's own `AREA_SCANNER_IDS` already documents. Defaults to 'seo', this plugin's own largest real issues surface. */
const CATEGORY_TO_TAB: Record<string, string> = {
	geo: 'geo',
	brand: 'brand-visibility',
	schema: 'schema-knowledge',
	links: 'crawl-urls',
};
const categoryToTab = (category: string): string => CATEGORY_TO_TAB[category] ?? 'seo';

const QUICK_LINKS: { tab: string; icon: string; title: string; desc: string }[] = [
	{
		tab: 'brand-visibility',
		icon: 'person',
		title: __('Brand Visibility', 'vulopilot'),
		desc: __('Check how AI understands your brand.', 'vulopilot'),
	},
	{
		tab: 'seo',
		icon: 'search',
		title: __('SEO', 'vulopilot'),
		desc: __('Optimize for search engines.', 'vulopilot'),
	},
	{
		tab: 'geo',
		icon: 'search-discovery',
		title: __('GEO (AI Visibility)', 'vulopilot'),
		desc: __('Improve visibility in AI answers.', 'vulopilot'),
	},
	{
		tab: 'aeo',
		icon: 'ai',
		title: __('AEO', 'vulopilot'),
		desc: __('Answer-engine readiness checks.', 'vulopilot'),
	},
	{
		tab: 'keywords',
		icon: 'vpn-key',
		title: __('Keywords', 'vulopilot'),
		desc: __('Track your keyword rankings.', 'vulopilot'),
	},
	{
		tab: 'crawl-urls',
		icon: 'link',
		title: __('Crawl & URLs', 'vulopilot'),
		desc: __('robots.txt, sitemaps, redirects & more.', 'vulopilot'),
	},
	{
		tab: 'schema-knowledge',
		icon: 'identity-verification',
		title: __('Business Identity & Schema', 'vulopilot'),
		desc: __('Manage structured data & entities.', 'vulopilot'),
	},
];

/**
 * "SEO & Visibility"'s top-level Overview tab, rebuilt to match a reference
 * mockup's own dashboard layout (score cards / trend / breakdown /
 * opportunities / activity / quick links) — replacing the former AI-chat-
 * centric layout (AiChatCard + VisibilityScoreCard/AiOpportunitiesCard/
 * DiscoverCard/AuthorityCard/TechnicalVisibilityCard/CompetitorRadarCard/
 * VisibilityTrendCard/AiRecommendationsSidebar), none of which the new
 * mockup shows. All 8 of those components are left in place, still real,
 * valid code — just no longer rendered here, same "supersede, don't
 * delete" precedent `GeoScoreSection.tsx`'s own docblock already
 * documents for `GeoVisibilitySummaryCard.tsx`.
 *
 * Every real number here:
 * - 4 score cards + "Visibility Breakdown" table: `GET /visibility/score`
 *   (new `Visibility.php`), which reads Brand/SEO/GEO/Crawl & URLs each
 *   straight from that area's own existing endpoint — see that class's own
 *   docblock for why this can never disagree with each area's own tab.
 *   AEO and Keywords are deliberately NOT included (no free-tier score
 *   exists for either anywhere in this codebase — see Visibility.php).
 * - "Visibility Trend": `GET /visibility/progress?days=N`, a real daily
 *   reconstructed combined score, same technique `Controllers\Geo`'s own
 *   `/geo/progress` already uses.
 * - "Visibility by Area" (replacing the mockup's own "Visibility by
 *   Source" — Organic/Direct/Referral/Social): this plugin tracks zero
 *   human-visitor traffic-source data anywhere (`vulopilot_crawler_visits`
 *   is AI bots only, by explicit design — see `CrawlerTraffic.php`'s own
 *   docblock; Search Console is organic-search-only by definition; GA4
 *   integration pulls session totals, not a channel-group split) —
 *   fabricating that split would mean inventing 4 numbers outright, so
 *   this donut instead shows the same 4 real area scores the cards/table
 *   above already show, reusing that one response rather than a second
 *   fetch.
 * - "Top Opportunities": real sitewide `GET /findings/groups?per_page=5`
 *   (no category scope — unlike GeoTab.tsx's own "Fix These First" copy of
 *   this same component, this one intentionally spans every real scanner
 *   category), reusing `GeoFixTheseFirstCard.tsx` (confirmed unused
 *   elsewhere) with its title overridden.
 * - "Recent Activity": real `GET /activity-logs`, scoped to
 *   `ACTIVITY_EVENT_TYPES` below — only event types this codebase actually
 *   writes; there is no "score improved"/"AI answer opportunity found"
 *   event anywhere, so those mockup rows are honestly omitted rather than
 *   invented.
 * - "Quick Links": real in-SPA tab navigation (`onNavigateTab`, the same
 *   `goToTab` `SeoVisibility.tsx` already passes down) — no full page
 *   reload.
 */
const OverviewTab = ({ onNavigateTab }: OverviewTabProps) => {
	const { score, isLoading } = useVisibilityScore();
	const [period, setPeriod] = useState<PeriodDays>('30');
	const [progress, setProgress] = useState<ProgressResponse | null>(null);
	const [isLoadingProgress, setIsLoadingProgress] = useState(true);
	const [opportunityGroups, setOpportunityGroups] = useState<FindingGroup[]>([]);
	const [opportunityTotal, setOpportunityTotal] = useState(0);
	const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(true);

	useEffect(() => {
		setIsLoadingProgress(true);
		getApiResponse<ProgressResponse>(
			getApiLink(appLocalizer, `visibility/progress?days=${period}`),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => response && setProgress(response))
			.finally(() => setIsLoadingProgress(false));
	}, [period]);

	useEffect(() => {
		getApiResponse<{ data: FindingGroup[]; total: number }>(
			getApiLink(
				appLocalizer,
				// Same real category grouping issuesTypes.ts's own CATEGORY_TABS
				// already establishes for "SEO & Visibility" ('seo','images','schema','links')
				// + "AI Visibility" ('geo','brand') — this page covers both, so
				// "Top Opportunities" is scoped to exactly these 6, not every
				// real finding sitewide (which would also surface Security/
				// Performance/Accessibility findings that have nothing to do
				// with this page).
				'findings/groups?per_page=5&status=open&category=seo,images,schema,links,geo,brand'
			),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setOpportunityGroups(response.data);
					setOpportunityTotal(response.total);
				}
			})
			.finally(() => setIsLoadingOpportunities(false));
	}, []);

	const { data: activity, isLoading: isLoadingActivity } = useApiList<ActivityLogRow>(
		'activity-logs',
		{ event_type: ACTIVITY_EVENT_TYPES, per_page: 5 }
	);

	const areas = score?.areas;
	const trendUplift =
		progress && progress.trend.length > 1
			? progress.trend[progress.trend.length - 1].score - progress.trend[0].score
			: null;

	return (
		<ContainerComponent>
			<ColumnComponent>
				<MetricTileComponent
					cols={4}
					isLoading={isLoading}
					data={[
						scoreTile(
							'visibility',
							__('Visibility Score', 'vulopilot'),
							'bar-chart',
							score
								? { score: score.visibility_score, change: score.change }
								: null
						),
						scoreTile(
							'brand',
							__('Brand Visibility Score', 'vulopilot'),
							'person',
							areas?.brand ?? null
						),
						scoreTile(
							'seo',
							__('SEO Health Score', 'vulopilot'),
							'search',
							areas?.seo ?? null
						),
						scoreTile(
							'geo',
							__('GEO Visibility Score', 'vulopilot'),
							'search-discovery',
							areas?.geo ?? null
						),
					]}
				/>
			</ColumnComponent>

			<ColumnComponent grid={6} fullHeight>
				<CardComponent
					title={__('Visibility Trend', 'vulopilot')}
					titleIcon='security'
					desc={
						null !== trendUplift
							? sprintf(
									/* translators: 1: signed real point change, 2: real number of days the chart covers. */
									__('%1$s points vs %2$d days ago', 'vulopilot'),
									trendUplift >= 0 ? `+${trendUplift}` : `${trendUplift}`,
									progress?.days ?? 30
								)
							: __('Combined score across Brand, SEO, GEO, and Crawl & URLs.', 'vulopilot')
					}
					isLoading={isLoadingProgress}
					action={
						<SelectInput
							type="single-select"
							name="visibility-progress-period"
							value={period}
							onChange={(value) => setPeriod(value as PeriodDays)}
							options={PERIOD_OPTIONS}
							isClearable={false}
						/>
					}
				>
					{progress && (
						<ChartComponent
							type="area"
							data={progress.trend}
							dataKey="score"
							xKey="date"
							height={220}
							yDomain={[0, 100]}
							color="#7C3AED"
						/>
					)}
				</CardComponent>
			</ColumnComponent>
			<ColumnComponent grid={6}>
				<CardComponent
					title={__('Visibility by Area', 'vulopilot')}
					titleIcon='security'
					desc={__('The same 4 real area scores above, compared at a glance.', 'vulopilot')}
					isLoading={isLoading}
				>
					{areas && (
						<>
							<div className="crawler-vendor-chart">
								<ChartComponent
									type="pie"
									height={160}
									centerLabel={
										<>
											<span className="score-ring-number">
												{score?.visibility_score}
											</span>
											<span className="score-ring-label">/100</span>
										</>
									}
									data={[
										{ label: areas.brand.label, value: areas.brand.score, color: '#7C3AED' },
										{ label: areas.seo.label, value: areas.seo.score, color: '#2563EB' },
										{ label: areas.geo.label, value: areas.geo.score, color: '#0D9488' },
										{ label: areas.crawl.label, value: areas.crawl.score, color: '#EA580C' },
									]}
								/>
							</div>
							<div className="crawler-vendor-legend">
								{[areas.brand, areas.seo, areas.geo, areas.crawl].map((area, index) => (
									<div key={area.label} className="crawler-vendor-legend-row">
										<span
											className="crawler-vendor-dot"
											style={{
												backgroundColor: ['#7C3AED', '#2563EB', '#0D9488', '#EA580C'][index],
											}}
										/>
										<span className="crawler-vendor-name">{area.label}</span>
										<span className="crawler-vendor-count">{area.score}/100</span>
									</div>
								))}
							</div>
						</>
					)}
				</CardComponent>
			</ColumnComponent>

			<ColumnComponent grid={6} fullHeight>
				<CardComponent
					title={__('Visibility Breakdown', 'vulopilot')}
					titleIcon="category"
					desc={__('See how your site performs across each real area.', 'vulopilot')}
					isLoading={isLoading}
					action={
						<ButtonInput
							buttons={{
								text: __('View all sections', 'vulopilot'),
								rightIcon: 'pagination-right-arrow',
								color: 'text-purple',
								onClick: () => onNavigateTab('seo'),
							}}
						/>
					}
				>
					{areas && (
						<table className="geo-score-breakdown-table">
							<thead>
								<tr>
									<th>{__('Area', 'vulopilot')}</th>
									<th>{__('Score', 'vulopilot')}</th>
									<th>{__('Change', 'vulopilot')}</th>
									<th>{__('Status', 'vulopilot')}</th>
								</tr>
							</thead>
							<tbody>
								{(Object.keys(areas) as (keyof typeof areas)[]).map((key) => {
									const area = areas[key];
									return (
										<tr key={key}>
											<td>{area.label}</td>
											<td>{area.score}/100</td>
											<td>
												<ScoreDelta change={area.change} />
											</td>
											<td>
												<BadgeComponent
													color={ratingClass(area.score)}
													text={getRating(area.score)}
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					)}
				</CardComponent>
			</ColumnComponent>
			<ColumnComponent grid={6}>
				<GeoFixTheseFirstCard
					title={__('Top Opportunities', 'vulopilot')}
					emptyMessage={__('No open findings right now — nothing to fix.', 'vulopilot')}
					groups={opportunityGroups}
					total={opportunityTotal}
					isLoading={isLoadingOpportunities}
					onViewAll={() =>
						onNavigateTab(
							opportunityGroups.length ? categoryToTab(opportunityGroups[0].category) : 'seo'
						)
					}
					onSelectScanner={(scannerId) => {
						const group = opportunityGroups.find((g) => g.scanner_id === scannerId);
						onNavigateTab(group ? categoryToTab(group.category) : 'seo');
					}}
				/>
			</ColumnComponent>

			<ColumnComponent grid={6}>
				<CardComponent
					title={__('Recent Activity', 'vulopilot')}
					titleIcon="clock"
					desc={__('Scans, alerts, and applied fixes across your site.', 'vulopilot')}
					isLoading={isLoadingActivity}
					action={
						<ButtonInput
						buttons={{
							text: __('View all activity', 'vulopilot'),
							rightIcon: 'pagination-right-arrow',
							color: 'text-purple',
							onClick: () => {
								window.location.href = `${appLocalizer.admin_url}#&tab=reports&subtab=activity`;
							},
						}}
					/>
					}
				>
					{!isLoadingActivity && 0 === activity.length ? (
						<ModuleGuardComponent
							icon="info"
							title={__('No recent activity', 'vulopilot')}
							desc={__('Scans, alerts, and applied fixes will appear here as they happen.', 'vulopilot')}
						/>
					) : (
						<ul className="activity-log">
							{activity.map((row) => (
								<li key={row.id} className='activity'>
									<div className="title">{row.message}</div>
									<span>
										{timeAgo(row.created_at)}
									</span>
								</li>
							))}
						</ul>
					)}
				</CardComponent>
			</ColumnComponent>
			<ColumnComponent grid={6} fullHeight>
				<CardComponent
					title={__('Quick Links', 'vulopilot')}
					titleIcon="link"
					desc={__('Jump straight to any SEO & Visibility section.', 'vulopilot')}
				>
					<div className="visibility-quick-links">
						{QUICK_LINKS.map((link) => (
							<button
								key={link.tab}
								type="button"
								className="visibility-quick-link"
								onClick={() => onNavigateTab(link.tab)}
							>
								<i className={`adminfont-${link.icon}`} />
								<span className="visibility-quick-link-text">
									<span className="visibility-quick-link-title">{link.title}</span>
									<span className="visibility-quick-link-desc">{link.desc}</span>
								</span>
							</button>
						))}
					</div>
				</CardComponent>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default OverviewTab;
