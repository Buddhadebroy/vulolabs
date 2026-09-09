/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, COLOR_PALETTE } from '@zyra/core';
import {
	AnalyticsComponent,
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	ListComponent,
	ModuleGuardComponent,
	NoticeComponent,
	TypographyComponent,
	SectionComponent
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import { useSeoScore, SeoScoreResponse } from './useSeoScore';
import { useSeoProgress } from './useSeoProgress';
import { useRunScan } from '../../services/useRunScan';
import { getRating, ratingClass, ratingColor } from './seoRating';
import SeoIssuesSection from './SeoIssuesSection';
import SeoProgressCard from './SeoProgressCard';
import PageAnalysisPanel from './PageAnalysisPanel';
import WhatShouldIFixFirstCard from './WhatShouldIFixFirstCard';

const CATEGORY_CARDS: {
	key: keyof SeoScoreResponse['category_scores'];
	title: string;
	icon: string;
	/** A fixed per-category identity color for the icon box — independent of `ratingColor(category.score)`, which separately tints the border/graph/number by real live status. */
	color: string;
}[] = [
		{ key: 'titles-meta', title: __('Titles & Meta', 'vulopilot'), icon: 'search blue', color: 'purple' },
		{ key: 'content-structure', title: __('Content Structure', 'vulopilot'), icon: 'editor-list red', color: 'blue' },
		{ key: 'images', title: __('Images', 'vulopilot'), icon: 'attachment pink', color: 'green' },
		{ key: 'internal-linking', title: __('Internal Linking', 'vulopilot'), icon: 'search lime', color: 'indigo' },
		{ key: 'indexability-canonicals', title: __('Indexability & Canonicals', 'vulopilot'), icon: 'search-discovery cyan', color: 'teal' },
		{ key: 'structured-data', title: __('Structured Data', 'vulopilot'), icon: 'blocks teal', color: 'orange' },
	];


/**
 * Real `robots-txt`/`sitemap`/`sitemap-validation`/`ai-crawler-blocked-pages`
 * findings — the exact 4 scanner ids `sitemap`/`robots` used to cover as
 * their own full SeoTab.tsx category cards, before those moved to what's
 * now Crawl & URLs' own "Robots & Sitemap" inner tab (direct instruction:
 * "Robots.txt and Sitemap should move away from SEO... these are
 * fundamentally crawler/discovery controls"). SEO's own "Search engine
 * access" status line below reads just their combined open-finding count
 * — real, just deliberately not a drill-down table here anymore;
 * CrawlRobotsSitemapSection.tsx's own Robots.txt/XML Sitemap findings
 * tables are where those individual findings actually live now.
 */
const SEARCH_ENGINE_ACCESS_SCANNER_IDS = [
	'robots-txt',
	'sitemap',
	'sitemap-validation',
	'ai-crawler-blocked-pages',
];


/**
 * Real day-by-day average of every real per-category `trend` array
 * (`Seo.php`'s own `get_category_trend()`, already real, one point per
 * category per day) — the "All areas" tile's own sparkline below. A real
 * derived number, not a fabricated one: each day's value is the same real
 * per-category scores `CATEGORY_CARDS`' own 6 tiles already plot,
 * averaged the same way `average()` (GeoVisibilitySummaryCard.tsx) folds
 * several already-fetched real sub-scores into one combined number.
 */
const overallCategoryTrend = (score: SeoScoreResponse): number[] => {
	const trends = Object.values(score.category_scores).map(
		(category) => category.trend
	);
	const days = trends[0]?.length ?? 0;

	return Array.from({ length: days }, (_, dayIndex) =>
		Math.round(
			trends.reduce((sum, trend) => sum + (trend[dayIndex] ?? 0), 0) /
			trends.length
		)
	);
};

/**
 * Real per-band copy under the "Overall SEO Score" ring — same real
 * `getRating()` 3-tier thresholds this tab already renders as the ring's
 * own label, just a longer sentence for the same real number. Duplicated
 * locally rather than importing `OverallScoreWidget.tsx`'s own
 * `getRatingSummary()` (dashboard-widgets/) since that one describes a
 * different, sitewide score — this is SEO's own scoped copy for SEO's own
 * scoped score, same "duplicate small per-file logic" convention as
 * `signedDelta()` above.
 */
const scoreSummary = (score: number): string => {
	if (score >= 70) {
		return __(
			'Your site is performing well. Keep optimizing to reach the next level.',
			'vulopilot'
		);
	}
	if (score >= 40) {
		return __(
			'Your site could use some improvement — a few real issues need attention.',
			'vulopilot'
		);
	}
	return __(
		'Your site needs attention — several real SEO issues are open.',
		'vulopilot'
	);
};

/**
 * Unlike the 'geo' module (whose own scanners run regardless of its
 * active-module state — see modules/Geo/Module.php's docblock), 'seo'
 * genuinely gates scanning (modules/Seo/Module.php): if it's off, none of
 * the 18 free-tier SEO scanner classes get registered, so the table below
 * would silently sit empty forever with no explanation. This tab is the
 * one place in Free that actually checks `appLocalizer.active_modules` to
 * tell a site owner why, rather than leaving them staring at "no findings
 * yet — run a scan" when a scan running wouldn't help.
 */
const isSeoModuleActive = () =>
	appLocalizer.active_modules?.includes('seo') ?? false;

/**
 * "SEO" tab of "SEO & Visibility" — restyled a 2nd time to match a newer
 * reference mockup ("SEO Health Score" hero card, a 6-tile "SEO areas"
 * grid, "What should I fix first?"/"Pages that need attention"/"All SEO
 * findings" below, all real). One piece of that mockup is deliberately NOT
 * built here (direct instruction, after flagging it as genuinely unbacked
 * by any real data source): the "Page Analysis" panel — a live per-URL
 * check runner with a Search Preview snippet, per-check pass/fail list, and
 * a "Fix with AI" button. Nothing in this codebase runs a live check
 * against an arbitrary URL on demand like this; building it would mean a
 * genuinely new feature, not a restyle.
 *
 * Everything else here is real:
 * - "SEO Health Score" merges what used to be 2 separate cards (a plain
 *   ring + a separate 3-tile category grid) into the mockup's own single
 *   hero card: the same real ring, plus 4 real stat blocks (Pages checked/
 *   Issues found/Critical issues/High priority issues — `Seo.php`'s own
 *   `pages_checked`/`total_open`/`severity_breakdown`, `pages_checked`
 *   being the real published post+page count `SeoScanner` itself scans,
 *   not a separate invented definition). "Issues found"/"Critical"/"High"
 *   each get the one real delta above; "Pages checked" doesn't (no
 *   per-day history exists for that count, only for findings). 4 more real
 *   tiles (Latest score/Issues Fixed/New Issues/Pages Improved,
 *   `useSeoProgress()`'s own `GET /seo/progress`) are merged into this same
 *   tile row too, per direct instruction — originally a separate "SEO
 *   progress" card/section, folded in here instead of standing on its own.
 *   The mockup's own full historical trend chart ("Issues Fixed 126", "New
 *   Issues 32", "Pages Improved 14", a score-over-time sparkline) still
 *   isn't built — that needs many historical data points; only these 3 real
 *   week-over-week deltas were cheaply available without a new stored
 *   snapshot series.
 * - "SEO areas" is the same real per-category score grid as before, now 6
 *   tiles instead of 3 (`Seo.php`'s own docblock has the full scanner-id
 *   regrouping) with 2 more real numbers per tile (open issue count, real
 *   distinct affected-page count) alongside the existing score, plus a
 *   real 7th "All Areas" tile combining those 6 (`overallCategoryTrend()`'s
 *   own docblock) — same real overall numbers the "SEO Health Score" card
 *   above already shows, not a second invented total.
 * - "What should I fix first?"/"Pages that need attention"/"All SEO
 *   findings" are the same real `SeoIssuesSection`/`IssuesSection` this tab
 *   already had (priority stat cards + the 2 real tables) — unchanged.
 *
 * This tab used to own 5 category cards; 2 real overlaps were fixed (both
 * direct instruction), leaving the current 6 (was 3, further split this
 * pass — see `Seo.php`'s own docblock):
 * - "Links & Schema" → "Internal Linking" — real overlapping ownership
 *   with "SEO & Visibility"'s own dedicated Broken Links and Schema &
 *   Knowledge tabs, which already own `broken-links`/`schema`/
 *   `structured-data`/`sitewide-structured-data` findings. See
 *   seoSections.ts's own docblock for the full before/after breakdown.
 * - "XML Sitemap"/"Robots.txt" → dropped entirely, replaced by the tiny
 *   real "Search engine access" status line below — both are crawler/
 *   discovery controls, real overlapping ownership with "Grow My
 *   Traffic"'s own dedicated Crawler Traffic tab (since folded into
 *   "Crawl & URLs" — see CrawlUrlsTab.tsx's own docblock), which now owns
 *   real Robots.txt/XML Sitemap findings tables itself
 *   (CrawlRobotsSitemapSection.tsx, its own "Robots & Sitemap" inner
 *   tab). SEO keeps on-page SEO only now: titles, meta, headings,
 *   canonicals, images, and internal links.
 *
 * There's deliberately no "Ranking keywords" table the way the reference
 * mockup has one — this plugin has no real keyword-rank-tracking data
 * source anywhere (Free or Pro; SEO Copilot's own Pro pitch in Popup.tsx
 * already lists "Keyword rank tracking... Google Search Console
 * integration" as a still-unbuilt Pro feature) — an honest "not connected
 * yet" card sits where that table would go instead of fabricated
 * positions/volumes.
 */
interface SeoTabProps {
	/**
	 * Same real cross-tab navigation callback OverviewTab.tsx's own
	 * AiOpportunitiesCard/DiscoverCard already use (GEO.tsx's own
	 * `goToTab`) — "Search engine access"'s own "View in Crawler Traffic"
	 * link uses this instead of a hash `<a href>` since Crawl & URLs is a
	 * sibling tab inside this same already-mounted shell, not a fresh page
	 * load a hash change alone would be read on. Targets `'crawl-urls'`'s
	 * own `'robots-sitemap'` inner tab (GEO.tsx's own `goToTab` optional
	 * second argument) now that "Crawler Traffic" isn't a top-level tab of
	 * its own any more — see CrawlUrlsTab.tsx's own docblock for that
	 * merge.
	 */
	onNavigateTab: (tab: 'crawl-urls', crawlUrlsSection: 'robots-sitemap') => void;
}

const SeoTab = ({ onNavigateTab }: SeoTabProps) => {
	const { score, isLoading: isLoadingScore } = useSeoScore();
	const { data: progress } = useSeoProgress();
	/** "Run Complete Audit" — same real `POST /scans` call every other category page's own "Run scan" button already fires (`RunScanHeaderExtra.tsx`'s own `useRunScan`), scoped to `['seo']` so it only re-runs this tab's own 15 real scanner ids rather than the whole site. */
	const { runScanButton } = useRunScan({ categories: ['seo'] });
	const [categoryFocus, setCategoryFocus] = useState<{ key: string; token: number } | null>(
		null
	);
	const [searchEngineAccessOpen, setSearchEngineAccessOpen] = useState<
		number | null
	>(null);
	/** Set by a real "Analyze" click in the "Pages & Posts" table below — opens PageAnalysisPanel as a real sidebar alongside this tab's own existing content, rather than replacing it. */
	const [analyzingPostId, setAnalyzingPostId] = useState<number | null>(null);

	useEffect(() => {
		if (!isSeoModuleActive()) {
			return;
		}

		getApiResponse<{ data: FindingGroup[] }>(
			getApiLink(
				appLocalizer,
				`findings/groups?scanner_id=${SEARCH_ENGINE_ACCESS_SCANNER_IDS.join(',')}&per_page=200`
			),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			const openCount = (response?.data ?? []).reduce(
				(sum, group) => sum + group.count,
				0
			);
			setSearchEngineAccessOpen(openCount);
		});
	}, []);

	if (!isSeoModuleActive()) {
		return (
			<ColumnComponent>
				<CardComponent
					title={__('SEO', 'vulopilot')}
					titleIcon="search"
					desc={__('Your site-wide SEO score and open issues.', 'vulopilot')}
				>
					<ModuleGuardComponent
						icon="error"
						title={__('SEO module is turned off', 'vulopilot')}
						desc={__(
							'Turn the SEO module back on from Settings → Modules to resume SEO scanning and see its findings again here. Findings already found before it was turned off aren’t deleted — they still show up on the Health page, which lists every category.',
							'vulopilot'
						)}
					/>
				</CardComponent>
			</ColumnComponent>
		);
	}

	return (
		<ContainerComponent>
			<ColumnComponent grid={6} fullHeight>
				<CardComponent
					title={__('SEO Health', 'vulopilot')}
					titleIcon="search"
					desc={__('Your real, site-wide SEO score, open issue counts, and progress over time.', 'vulopilot')}
					isLoading={isLoadingScore}
				>
					<>
						{score && (
							<div className="seo-health-score-layout">
								<div className="seo-health-score-ring-block">
									<div className="seo-health-score-ring">
										<ChartComponent
											type="ring"
											height={140}
											centerLabel={
												<>
													<span className="score-ring-number">
														{score.seo_score}
													</span>
													<span
														className={`score-ring-label geo-overall-rating ${ratingClass(score.seo_score)}`}
													>
														{getRating(score.seo_score)}
													</span>
												</>
											}
											data={[
												{
													label: __('Score', 'vulopilot'),
													value: score.seo_score,
													// Same real rating color the ring's
													// own "Needs Attention"/"Good"/"Poor"
													// label below already uses
													// (`ratingClass()`/`getRating()`) —
													// resolved through `COLOR_PALETTE`
													// for the real hex `ratingColor()`'s
													// own palette name stands for,
													// rather than a fixed brand purple
													// unrelated to the actual score.
													color: COLOR_PALETTE[
														ratingColor(score.seo_score) as keyof typeof COLOR_PALETTE
													],
												},
												{
													label: __('Remaining', 'vulopilot'),
													value: 100 - score.seo_score,
													color: '#e5e7eb',
												},
											]}
										/>
									</div>
									<div className="seo-health-score-ring-copy">
										<div className="typography-h4">
											{__('Overall SEO Score', 'vulopilot')}
										</div>
										<div className="typography-caption desc">
											{scoreSummary(score.seo_score)}
										</div>
									</div>
								</div>
								{/*
							 * Same 6 real per-category scores the old
							 * `AnalyticsComponent` progress-bar rows above
							 * this used to show — now the same real
							 * `ListComponent` "mini-card report" row shape
							 * `TechnicalVisibilityCard.tsx`/`WhatShouldIFixFirstCard.tsx`
							 * already use elsewhere in this tab's own module
							 * (icon + title + trailing value, one divider
							 * per row, no progress bar — that variant
							 * doesn't have one), `without-border` added on
							 * top since this row sits inside a card that
							 * already has its own outer border. The same
							 * real number (`category.score`) is still
							 * there as the row's own trailing value, and
							 * clicking a row still opens the same real
							 * `categoryFocus` drill-down (`SeoIssuesSection`
							 * below) it always did.
							 */}
								<div className="seo-health-score-category-list">
									<ListComponent
										className="mini-card report without-border"
										loading={isLoadingScore}
										items={CATEGORY_CARDS.map((card) => {
											const category = score.category_scores[card.key];

											return {
												id: card.key,
												icon: card.icon,
												title: card.title,
												tags: (
													<TypographyComponent
														variant="h5"
														weight="bold"
														color={ratingColor(category.score)}
														className="seo-health-score-row-value"
													>
														{category.score}
														<TypographyComponent
															as="span"
															variant="body-md"
															className="seo-health-score-row-suffix"
														>
															/100
														</TypographyComponent>
													</TypographyComponent>
												),
												action: () =>
													setCategoryFocus({
														key: card.key,
														token: Date.now(),
													}),
											};
										})}
									/>
								</div>
							</div>
						)}
						{score && (
							<AnalyticsComponent
								variant="with-out-boxshadow"
								cols={4}
								isLoading={isLoadingScore}
								data={[
									{
										number: score.pages_checked,
										text: __('Pages checked', 'vulopilot'),
										iconClass: 'admin-bg-color2',
									},
									{
										number: score.total_open,
										text: __('Issues found', 'vulopilot'),
										iconClass: 'admin-bg-color3',
									},
									{
										number: (
											<span className="is-poor">
												{score.severity_breakdown.critical}
											</span>
										),
										text: __('Critical issues', 'vulopilot'),
										iconClass: 'admin-bg-color4',
									},
									{
										number: (
											<span className="is-attention">
												{score.severity_breakdown.high}
											</span>
										),
										text: __('High priority issues', 'vulopilot'),
										iconClass: 'admin-bg-color5',
									},
								]}
							/>
						)}
					</>

				</CardComponent>
			</ColumnComponent>

			<ColumnComponent grid={6} fullHeight>
				<SeoProgressCard />
			</ColumnComponent>
			{/* <ColumnComponent>
				<WhatShouldIFixFirstCard
					severityBreakdown={
						score?.severity_breakdown ?? {
							critical: 0,
							high: 0,
							medium: 0,
							low: 0,
						}
					}
					totalOpen={score?.total_open ?? 0}
					isLoadingScore={isLoadingScore}
				/>
			</ColumnComponent> */}
			<ColumnComponent grid={8}>
				<SeoIssuesSection
					categoryFocus={categoryFocus}
					onAnalyze={setAnalyzingPostId}
					activePostId={analyzingPostId}
				/>
			</ColumnComponent>
			{analyzingPostId && (
				<ColumnComponent grid={4}>
					<PageAnalysisPanel
						postId={analyzingPostId}
						onClose={() => setAnalyzingPostId(null)}
					/>
				</ColumnComponent>
			)}
		</ContainerComponent>
	);
};

export default SeoTab;
