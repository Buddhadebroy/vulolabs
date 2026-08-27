/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, COLOR_PALETTE } from '@zyra/core';
import {
	AnalyticsComponent,
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	MetricTileComponent,
	ModuleGuardComponent,
	NoticeComponent,
} from '@zyra/components';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import { useSeoScore, SeoScoreResponse } from './useSeoScore';
import { getRating, ratingClass, ratingColor } from './seoRating';
import SeoIssuesSection from './SeoIssuesSection';
import PageAnalysisPanel from './PageAnalysisPanel';
import WhatShouldIFixFirstCard from './WhatShouldIFixFirstCard';
import PagesNeedingAttentionTable from './PagesNeedingAttentionTable';
import SeoProgressCard from './SeoProgressCard';

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
		{ key: 'internal-linking', title: __('Internal Linking', 'vulopilot'), icon: 'admin-links lime', color: 'indigo' },
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
 * Real week-over-week delta text for one of `useSeoScore()`'s own
 * `deltas` fields — `Seo.php`'s own exact reconstruction of that same
 * count `deltas.lookback_days` ago (no fabricated/estimated number, no
 * stored snapshot needed — see that endpoint's own docblock). Fewer open
 * findings than before (`delta <= 0`) is the good direction for every
 * field this is used on (issues/critical/high), so that's the one
 * direction this helper hard-codes rather than taking a prop nobody would
 * ever pass the other way here.
 */
const deltaLabel = (delta: number, lookbackDays: number): string => {
	if (0 === delta) {
		return sprintf(
			/* translators: %d is the number of days this delta covers. */
			__('No change in the last %d days', 'vulopilot'),
			lookbackDays
		);
	}

	return sprintf(
		/* translators: 1: "+" or "-", 2: how much it changed by, 3: number of days this delta covers. */
		__('%1$s%2$d in the last %3$d days', 'vulopilot'),
		delta > 0 ? '+' : '-',
		Math.abs(delta),
		lookbackDays
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
 * findings" below, all real). Two pieces of that mockup are deliberately
 * NOT built here (direct instruction, after flagging both as genuinely
 * unbacked by any real data source):
 *
 * - The "Page Analysis" panel — a live per-URL check runner with a Search
 *   Preview snippet, per-check pass/fail list, and a "Fix with AI" button.
 *   Nothing in this codebase runs a live check against an arbitrary URL on
 *   demand like this; building it would mean a genuinely new feature, not
 *   a restyle.
 * - "SEO progress" — the full historical trend chart ("Issues Fixed 126",
 *   "New Issues 32", "Pages Improved 14", a score-over-time sparkline).
 *   That needs many historical data points; only the one real week-over-week
 *   delta below (see `deltaLabel()`'s own docblock) was cheaply available
 *   without a new stored snapshot series.
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
 *   per-day history exists for that count, only for findings).
 * - "SEO areas" is the same real per-category score grid as before, now 6
 *   tiles instead of 3 (`Seo.php`'s own docblock has the full scanner-id
 *   regrouping) with 2 more real numbers per tile (open issue count, real
 *   distinct affected-page count) alongside the existing score.
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
				<CardComponent title={__('SEO', 'vulopilot')}>
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
			<ColumnComponent grid={analyzingPostId ? 8 : 12}>
				<div className="seo-search-engine-access">
					<span
						className={`crawler-health-status ${null === searchEngineAccessOpen
							? ''
							: 0 === searchEngineAccessOpen
								? 'is-good'
								: 'is-warning'
							}`}
					>
						<i
							className={`adminfont-${null === searchEngineAccessOpen
								? 'info'
								: 0 === searchEngineAccessOpen
									? 'check'
									: 'error'
								}`}
						/>
						{sprintf(
							/* translators: %s is "Healthy", "Needs Attention", or "Checking…". */
							__('Search engine access: %s', 'vulopilot'),
							null === searchEngineAccessOpen
								? __('Checking…', 'vulopilot')
								: 0 === searchEngineAccessOpen
									? __('Healthy', 'vulopilot')
									: __('Needs Attention', 'vulopilot')
						)}
					</span>
					<button
						type="button"
						className="seo-search-engine-access-link"
						onClick={() => onNavigateTab('crawl-urls', 'robots-sitemap')}
					>
						{__('View in Crawl & URLs', 'vulopilot')}
						<i className="adminfont-arrow-right" />
					</button>
				</div>


				<CardComponent
					title={__('SEO Health Score', 'vulopilot')}
					isLoading={isLoadingScore}
				>
					{score && (
						<div className="seo-health-score-layout">
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
										iconClass: 'admin-bg-color2',
										extra: (
											<span
												className={
													score.deltas.total_open <= 0
														? 'is-good'
														: 'is-attention'
												}
											>
												{deltaLabel(
													score.deltas.total_open,
													score.deltas.lookback_days
												)}
											</span>
										),
									},
									{
									number: (
										<span className="is-poor">
											{score.severity_breakdown.critical}
										</span>
									),
									text: __('Critical issues', 'vulopilot'),
									iconClass: 'admin-bg-color2',
								},
								{
									number: (
										<span className="is-attention">
											{score.severity_breakdown.high}
										</span>
									),
									text: __('High priority issues', 'vulopilot'),
									iconClass: 'admin-bg-color2',
								},
								]}
							/>

						</div>
					)}
				</CardComponent>

				<CardComponent
					title={__('SEO areas', 'vulopilot')}
					desc={__(
						'Overview of where your SEO health is by area — click one to jump to its issues.',
						'vulopilot'
					)}
					isLoading={isLoadingScore}
				>
					{score && (
						<MetricTileComponent
							cols={3}
							isLoading={isLoadingScore}
							data={CATEGORY_CARDS.map((card) => {
								const category = score.category_scores[card.key];

								return {
									id: card.key,
									icon: card.icon,
									title: card.title,
									number: sprintf(
										/* translators: %d: real 0-100 category score. */
										__('%d/100', 'vulopilot'),
										category.score
									),
									stat: sprintf(
										/* translators: %d: number of open issues. */
										__('%d issues', 'vulopilot'),
										category.open_count
									),
									desc: sprintf(
										/* translators: %d: number of affected pages. */
										__('%d pages affected', 'vulopilot'),
										category.affected_pages
									),
									chart: {
										type: 'sparkline',
										data: category.trend,
										color: COLOR_PALETTE[ratingColor(category.score) as keyof typeof COLOR_PALETTE],
									},
									badge: {
										text: getRating(category.score),
										color: ratingColor(category.score),
										onClick: () =>
											setCategoryFocus({
												key: card.key,
												token: Date.now(),
											}),
									},
								};
							})}
						/>
					)}
				</CardComponent>

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

				<PagesNeedingAttentionTable
					onAnalyze={setAnalyzingPostId}
					activePostId={analyzingPostId}
				/>

				<SeoIssuesSection
					categoryFocus={categoryFocus}
					onAnalyze={setAnalyzingPostId}
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
			<SeoProgressCard />
		</ContainerComponent>
	);
};

export default SeoTab;
