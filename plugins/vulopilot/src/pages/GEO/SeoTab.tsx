/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	BadgeComponent,
} from '@zyra/components';
import SectionedFindingsTab from '../Security/SectionedFindingsTab';
import type { FindingsSection } from '../Security/SectionedFindingsTab';
import type { SectionedIssuesTab } from '../Security/SectionedIssuesTable';
import { useSeoScore } from './useSeoScore';

/**
 * Section → scanner_id grouping, mirroring the 6 cards Settings → Scanning →
 * SEO already presents these same checks under (src/components/Settings/
 * Scanning/Seo.ts) so the findings page and its settings page agree on what
 * "Titles & meta"/"Images"/etc. actually cover. Fed into SectionedFindingsTab
 * (same shell GeoTab.tsx/AeoTab.tsx/SecurityTab.tsx use) per direct
 * instruction, replacing what used to be 5 separate independent
 * FindingsTable cards (own fetch/pagination/search/bulk actions each) with
 * one real, unified table (own fetch/pagination/search/bulk actions once,
 * scoped per section by the tab bar above it) — SEO-MODULE.md's 15+2
 * scanners used to all land in a single flat table here before that pass,
 * then were split into 5 sections, now merged back into one real table
 * with those same 5 sections as its own tab pills.
 *
 * Deliberately no `category` prop passed — these 17 scanners don't all
 * share one `category` column value (ImagesScanner is "images",
 * SchemaScanner is "schema", BrokenLinksScanner is "links"; only the other
 * 14 are actually "seo" — modules/Seo/Module.php's own docblock has the
 * full breakdown). SectionedIssuesTable.tsx's own `GET /findings/groups`
 * fetch (no category filter, client-side scannerIds slicing) already
 * handles this the same way GeoTab.tsx's own sections do.
 *
 * Kept in exact sync with Seo.php's own `CATEGORY_SCANNER_IDS` (same 5
 * `key`s) so the restyled tab's real per-category scores below always agree
 * with this table's own section tabs.
 *
 * A new SEO scanner's findings won't show up on this tab at all until it's
 * added both to modules/Seo/Module.php's registration list AND to the right
 * section below (see SEO-MODULE.md's own note on this).
 */
const SEO_SECTIONS: FindingsSection[] = [
	{
		key: 'titles-meta',
		title: __('Titles & meta', 'vulopilot'),
		description: __(
			'Title length, meta descriptions, canonicals, duplicate titles, orphan pages, thin content, heading structure, and (Pro) duplicate meta descriptions, multiple H1s, and focus keyword drift.',
			'vulopilot'
		),
		emptyMessage: __(
			'No titles/meta findings yet — run a scan to check titles, descriptions, and content structure.',
			'vulopilot'
		),
		scannerIds: [
			'seo',
			'meta-description',
			'canonical-url',
			'duplicate-content',
			'orphan-pages',
			'thin-content',
			'heading-structure',
			'meta-description-duplication',
			'multiple-h1',
			'focus-keyword-audit',
		],
	},
	{
		key: 'images',
		title: __('Images', 'vulopilot'),
		description: __(
			'Missing featured images and content images with no alt text.',
			'vulopilot'
		),
		emptyMessage: __(
			'No image findings yet — run a scan to check featured images and alt text.',
			'vulopilot'
		),
		scannerIds: ['seo-images', 'images'],
	},
	{
		key: 'links-schema',
		title: __('Links & schema', 'vulopilot'),
		description: __(
			'Internal links, broken links, structured data, and social preview tags.',
			'vulopilot'
		),
		emptyMessage: __(
			'No link/schema findings yet — run a scan to check internal links and structured data.',
			'vulopilot'
		),
		scannerIds: [
			'internal-linking',
			'broken-links',
			'schema',
			'structured-data',
			'sitewide-structured-data',
			'open-graph',
			'twitter-card',
		],
	},
	{
		key: 'sitemap',
		title: __('XML Sitemap', 'vulopilot'),
		description: __(
			'Whether /wp-sitemap.xml is reachable and valid.',
			'vulopilot'
		),
		emptyMessage: __(
			'No sitemap findings yet — run a scan to check your XML sitemap.',
			'vulopilot'
		),
		scannerIds: ['sitemap', 'sitemap-validation'],
	},
	{
		key: 'robots',
		title: __('Robots.txt', 'vulopilot'),
		description: __(
			'Whether robots.txt is reachable, not accidentally blocking every crawler, and not blocking specific AI crawlers from specific pages.',
			'vulopilot'
		),
		emptyMessage: __(
			'No robots.txt findings yet — run a scan to check crawler access.',
			'vulopilot'
		),
		scannerIds: ['robots-txt', 'ai-crawler-blocked-pages'],
	},
];

const CATEGORY_CARDS: {
	key: 'titles-meta' | 'images' | 'links-schema' | 'sitemap' | 'robots';
	title: string;
	icon: string;
}[] = [
	{ key: 'titles-meta', title: __('Titles & Meta', 'vulopilot'), icon: 'search' },
	{ key: 'images', title: __('Images', 'vulopilot'), icon: 'attachment' },
	{ key: 'links-schema', title: __('Links & Schema', 'vulopilot'), icon: 'attachment' },
	{ key: 'sitemap', title: __('XML Sitemap', 'vulopilot'), icon: 'database' },
	{ key: 'robots', title: __('Robots.txt', 'vulopilot'), icon: 'security' },
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
 * the 17 SEO scanner classes get registered, so the merged table below
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
 * these same 17 real scanner ids), 5 real category cards with their own
 * real per-category score, then the same real, unified findings table
 * (SectionedFindingsTab.tsx) already built for this tab. The reference
 * mockup's own "Ranking keywords" table now has its own dedicated
 * "Keywords" tab (KeywordsTab.tsx, split out per direct instruction)
 * rather than sitting here as a footer strip — see that file's own
 * docblock for why it's still an honest "not connected yet" state, not
 * fabricated positions/volumes.
 */
const SeoTab = () => {
	const [activeTab, setActiveTab] = useState<SectionedIssuesTab>('all');
	const { score, isLoading: isLoadingScore } = useSeoScore();

	if (!isSeoModuleActive()) {
		return (
			<ContainerComponent general>
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
			</ContainerComponent>
		);
	}

	return (
		<SectionedFindingsTab
			title={__('All SEO Issues', 'vulopilot')}
			sections={SEO_SECTIONS}
			activeTab={activeTab}
			onTabChange={setActiveTab}
			header={
				<>
					<div className="geo-info-banner">
						<i className="adminfont-info" />
						<span>
							<strong>{__('In plain English:', 'vulopilot')}</strong>{' '}
							{__(
								'This checks whether your pages are set up correctly for classic Google search — titles, descriptions, images, links, and your sitemap.',
								'vulopilot'
							)}
						</span>
					</div>

					<ContainerComponent>
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
						<ColumnComponent grid={8}>
							<CardComponent
								title={__('SEO checks at a glance', 'vulopilot')}
								desc={__(
									'Each category below has its own real score based on open findings.',
									'vulopilot'
								)}
								isLoading={isLoadingScore}
							>
								<div className="geo-four-checks-grid seo-category-grid">
									{score &&
										CATEGORY_CARDS.map((card) => {
											const categoryScore =
												score.category_scores[card.key];
											return (
												<div
													key={card.key}
													className={`geo-four-checks-tile ${ratingClass(categoryScore)}`}
												>
													<p className="geo-four-checks-title">
														{card.title}
													</p>
													<BadgeComponent
														className="geo-four-checks-badge"
														color={ratingClass(categoryScore)}
														text={`${categoryScore}/100`}
													/>
												</div>
											);
										})}
								</div>
							</CardComponent>
						</ColumnComponent>
					</ContainerComponent>
				</>
			}
		/>
	);
};

export default SeoTab;
