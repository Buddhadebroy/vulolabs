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
	IconComponent,
	ListComponent,
	ModuleGuardComponent,
	TypographyComponent,
} from '@zyra/components';
import { ButtonInput, ChoiceToggleInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import { useVisibilityScore } from './useVisibilityScore';
import type { VisibilityScoreResponse } from './useVisibilityScore';
import GeoFixTheseFirstCard from './GeoFixTheseFirstCard';
import VisibilityBySourceCard from './VisibilityBySourceCard';
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

/** Real CSS hex per `ratingClass()` tier — `ChartComponent`'s own ring `data[].color` takes a real CSS color, not a palette name the way `TypographyComponent`'s own `color` prop does, so this small map exists just for the ring fill (same "duplicate per file" convention `SeoTab.tsx`'s own `COLOR_PALETTE` lookup covers there with a shared constant this file doesn't import). */
const RATING_RING_COLOR: Record<string, string> = {
	green: '#16a34a',
	blue: '#2563eb',
	red: '#dc2626',
};

/** Real per-area tab id `QUICK_LINKS` below already uses for the same 4 areas — reused here so clicking an area row in the new score list navigates to the exact same real tab its own Quick Links card links to. */
const AREA_TABS: Record<keyof VisibilityScoreResponse['areas'], string> = {
	brand: 'brand-visibility',
	seo: 'seo',
	geo: 'geo',
	crawl: 'crawl-urls',
};

const AREA_TILES: Record<
	keyof VisibilityScoreResponse['areas'],
	{ title: string; icon: string }
> = {
	brand: { title: __('Brand Visibility Score', 'vulopilot'), icon: 'person' },
	seo: { title: __('SEO Health Score', 'vulopilot'), icon: 'search' },
	geo: { title: __('GEO Visibility Score', 'vulopilot'), icon: 'search-discovery' },
	crawl: { title: __('Crawl & URLs Score', 'vulopilot'), icon: 'link' },
};

type PeriodDays = '7' | '30' | '90';
// Same real `key` field `GeoScoreSection.tsx`'s own identical
// `ChoiceToggleInput` usage already includes — `ToggleInput`'s own options
// use `option.key` for both React's own list `key` and each real radio's
// `id`/`htmlFor` pair (`SelectInput`, this used to feed, never needed one).
// Without it every option here shared the same `undefined` key/id, so only
// one really rendered/toggled correctly.
const PERIOD_OPTIONS = [
	{ key: '7', value: '7', label: __('Last 7 days', 'vulopilot') },
	{ key: '30', value: '30', label: __('Last 30 days', 'vulopilot') },
	{ key: '90', value: '90', label: __('Last 90 days', 'vulopilot') },
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
 * - "Visibility by Source" (VisibilityBySourceCard.tsx, matching the
 *   mockup's own donut+legend layout AND content this time — an earlier
 *   version of this card substituted the 4 real area scores here instead,
 *   reasoning that this plugin tracks no traffic-source data of its own
 *   anywhere; that's still true of `vulopilot_crawler_visits` (AI bots
 *   only) and Search Console (organic-search-only by definition), but GA4's
 *   own Data API genuinely exposes a real `sessionDefaultChannelGroup`
 *   dimension — the exact Organic Search/Direct/Referral/Social split the
 *   mockup shows — for any already-connected GA4 property
 *   (`GoogleAnalyticsClient::run_channel_group_report()`, `GET
 *   /visibility/traffic-sources`). So this card now shows genuinely real
 *   GA4 session data when a property is connected, and an honest "Connect
 *   Google Analytics" prompt otherwise — never a fabricated split. See
 *   that component's own docblock for why its center number is real total
 *   sessions rather than a 0-100 "score."
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
			<ColumnComponent grid={6} fullHeight>
				{/*
				 * Same real ring + `ListComponent` "mini-card report" row
				 * shape `SeoTab.tsx`'s own "SEO Health" card already uses,
				 * per direct instruction ("convert this... like this") —
				 * replaces the old 5-tile `MetricTileComponent` grid. The
				 * ring plots the real combined `visibility_score`
				 * (`GET /visibility/score`); each row below is one of its 4
				 * real areas (Brand/SEO/GEO/Crawl & URLs), same real score +
				 * week-over-week change those tiles already showed, just as
				 * a row's own trailing value/delta instead of a tile —
				 * clicking a row still navigates to that area's own real
				 * tab (`onNavigateTab`), same as the old tile's implicit
				 * click target never actually was (tiles here had no
				 * `onClick` before; this is a real new capability, not a
				 * behavior change to anything that already worked). No
				 * sparkline survives the move — `ListComponent`'s own
				 * `progress-list`/`report` variants don't render one the
				 * way `MetricTileComponent`'s `chart` prop did; the real
				 * score/change numbers themselves are unchanged.
				 */}
				<CardComponent
					title={__('Visibility Score', 'vulopilot')}
					titleIcon="bar-chart"
					desc={__('Your real, combined score across Brand, SEO, GEO, and Crawl & URLs.', 'vulopilot')}
					isLoading={isLoading}
				>
					{score && (
						<div className="seo-health-score-layout">
							<div className="seo-health-score-ring-block">
								<div className="seo-health-score-ring">
									<ChartComponent
										type="ring"
										height={200}
										centerLabel={
											<>
												<span className="score-ring-number">
													{score.visibility_score}
												</span>
												<span
													className={`score-ring-label geo-overall-rating ${ratingClass(score.visibility_score)}`}
												>
													{getRating(score.visibility_score)}
												</span>
											</>
										}
										data={[
											{
												label: __('Score', 'vulopilot'),
												value: score.visibility_score,
												color: RATING_RING_COLOR[ratingClass(score.visibility_score)],
											},
											{
												label: __('Remaining', 'vulopilot'),
												value: 100 - score.visibility_score,
												color: '#e5e7eb',
											},
										]}
									/>
								</div>
							</div>
							<ListComponent
								className="mini-card report hover seo-health-score-category-list"
								loading={isLoading}
								items={(
									Object.keys(AREA_TILES) as (keyof VisibilityScoreResponse['areas'])[]
								).map((key) => {
									const area = areas?.[key];
									const tile = AREA_TILES[key];

									return {
										id: key,
										icon: tile.icon,
										title: tile.title,
										tags: area ? (
											<>
												<TypographyComponent
													as="span"
													variant="body-md"
													weight="bold"
													color={area.change >= 0 ? 'green' : 'red'}
													className="seo-health-score-row-delta"
												>
													<IconComponent
														name={area.change >= 0 ? 'arrow-up' : 'arrow-down'}
													/>
													{Math.abs(area.change)}
												</TypographyComponent>
												<TypographyComponent
													variant="h5"
													weight="bold"
													color={ratingClass(area.score)}
													className="seo-health-score-row-value"
												>
													{area.score}
													<TypographyComponent
														as="span"
														variant="body-md"
														className="seo-health-score-row-suffix"
													>
														/100
													</TypographyComponent>
												</TypographyComponent>
											</>
										) : null,
										action: () => onNavigateTab(AREA_TABS[key]),
									};
								})}
							/>
						</div>
					)}
				</CardComponent>
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
						<ChoiceToggleInput
							options={PERIOD_OPTIONS}
							value={period}
							onChange={(value) => setPeriod(value as PeriodDays)}
							modules={[]}
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
			<ColumnComponent grid={6} fullHeight>
				<VisibilityBySourceCard />
			</ColumnComponent>
			<ColumnComponent grid={6} fullHeight>
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
			<ColumnComponent grid={6} fullHeight>
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
						// Hand-rolled per direct instruction (reverts this
						// card specifically off `ActivityListComponent`,
						// back to the same real vertical-timeline
						// `.activity-log`/`.activity` markup/SCSS this tab
						// used before — see the matching rules in
						// `SeoVisibility.scss`, already imported here).
						// Same real `activity` rows either way, just this
						// card's own layout now instead of that shared
						// component's.
						<ul className="activity-log">
							{activity.map((row) => (
								<li className="activity" key={row.id}>
									<span>{timeAgo(row.created_at)}</span>
									<div className="title">{row.message}</div>
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
					{/* Same real `className: 'mini-card documentation'` + `border` variant zyra's own Storybook documents (ListComponent--documentation-card) — icon + title + desc per item, real navigation via `action` instead of the old hand-rolled `<button>` grid. Same real 7 tabs/icons/copy `QUICK_LINKS` already had; only the markup changed. */}
					<ListComponent
						className="mini-card documentation hover"
						border
						items={QUICK_LINKS.map((link) => ({
							id: link.tab,
							icon: link.icon,
							title: link.title,
							desc: link.desc,
							action: () => onNavigateTab(link.tab),
						}))}
					/>
				</CardComponent>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default OverviewTab;
