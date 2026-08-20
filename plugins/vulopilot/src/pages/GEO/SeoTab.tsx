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
	ModuleGuardComponent,
	NoticeComponent,
} from '@zyra/components';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import { useSeoScore } from './useSeoScore';
import SeoIssuesSection from './SeoIssuesSection';

const CATEGORY_CARDS: {
	key: 'titles-meta' | 'images' | 'internal-linking';
	title: string;
	icon: string;
}[] = [
	{ key: 'titles-meta', title: __('Titles & Meta', 'vulopilot'), icon: 'search' },
	{ key: 'images', title: __('Images', 'vulopilot'), icon: 'attachment' },
	{ key: 'internal-linking', title: __('Internal Linking', 'vulopilot'), icon: 'admin-links' },
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
		return 'is-good';
	}
	if (score >= 40) {
		return 'is-attention';
	}
	return 'is-poor';
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
 * "SEO" tab of "Grow My Traffic" — restyled to match the reference
 * mockup's own information architecture: a real "SEO Score" gauge
 * (Seo.php's own `GET /seo/score`, the same deterministic weighted-severity
 * formula BrandIntelligence's own Brand Score already uses, scoped to
 * these same 15 real scanner ids), 3 real category cards with their own
 * real per-category score, then the two real tables `SeoIssuesSection.tsx`
 * owns — "Site-wide Issues" and a page-wise table, split apart per direct
 * instruction (previously one combined "All SEO Issues" card). Clicking a
 * category card scrolls to and filters that section down to just that
 * category's own real scanner ids (`categoryFocus` below) — the same
 * `SEO_SECTIONS` grouping these tiles' own scores are computed from, so
 * "what this tile means" and "what clicking it filters to" always agree.
 *
 * This tab used to own 5 category cards; 2 real overlaps were fixed (both
 * direct instruction), leaving 3:
 * - "Links & Schema" → "Internal Linking" — real overlapping ownership
 *   with "Grow My Traffic"'s own dedicated Broken Links and Schema &
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
		<ColumnComponent>
				<NoticeComponent
					// type="banner"
					displayPosition="inline"
					message={sprintf(
						'<strong>%1$s</strong> %2$s',
						__('In plain English:', 'vulopilot'),
						__(
							'This checks whether your pages are set up correctly for classic Google search — titles, descriptions, images, and internal links.',
							'vulopilot'
						)
					)}
				/>

				<div className="seo-search-engine-access">
					<span
						className={`crawler-health-status ${
							null === searchEngineAccessOpen
								? ''
								: 0 === searchEngineAccessOpen
									? 'is-good'
									: 'is-warning'
						}`}
					>
						<i
							className={`adminfont-${
								null === searchEngineAccessOpen
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

				<ContainerComponent>
					<ColumnComponent grid={8}>
							<CardComponent
								title={__('SEO checks at a glance', 'vulopilot')}
								desc={__(
									'Each category below has its own real score based on open findings — click one to jump to its issues.',
									'vulopilot'
								)}
								isLoading={isLoadingScore}
							>
								<div className="seo-category-grid">
									<AnalyticsComponent
										data={
											score
												? CATEGORY_CARDS.map((card) => {
														const categoryScore =
															score.category_scores[card.key];
														return {
															colorClass: ratingClass(categoryScore),
															number: `${categoryScore}/100`,
															text: card.title,
															onClick: () =>
																setCategoryFocus({
																	key: card.key,
																	token: Date.now(),
																}),
														};
													})
												: []
										}
										variant="small-card"
										isLoading={isLoadingScore}
									/>
								</div>
							</CardComponent>
						</ColumnComponent>
						<ColumnComponent grid={4}>
							<CardComponent
								title={__('SEO Score', 'vulopilot')}
								desc={__(
									'A composite score across every real SEO check below.',
									'vulopilot'
								)}
								isLoading={isLoadingScore}
							>
								{score && (
									<div className="geo-overall-visibility">
										<ChartComponent
											type="pie"
											height={140}
											centerLabel={
												<>
													<span className="score-ring-number">
														{score.seo_score}
													</span>
													<span className="score-ring-label">/100</span>
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
													color: '#7C3AED',
												},
												{
													label: __('Remaining', 'vulopilot'),
													value: 100 - score.seo_score,
													color: '#e5e7eb',
												},
											]}
										/>
									</div>
								)}
							</CardComponent>
						</ColumnComponent>
					</ContainerComponent>

				<SeoIssuesSection categoryFocus={categoryFocus} />

		</ColumnComponent>
	);
};

export default SeoTab;
