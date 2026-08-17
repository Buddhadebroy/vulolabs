/* global appLocalizer */
import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NoticeComponent,
	BadgeComponent,
} from '@zyra/components';
import { useSeoScore } from './useSeoScore';
import SeoIssuesByPageTable from './SeoIssuesByPageTable';

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
<<<<<<< HEAD
 * these same 17 real scanner ids), 5 real category cards with their own
 * real per-category score, then the same real, unified findings table
 * (SectionedFindingsTab.tsx) already built for this tab. The reference
 * mockup's own "Ranking keywords" table now has its own dedicated
 * "Keywords" tab (KeywordsTab.tsx, split out per direct instruction)
 * rather than sitting here as a footer strip — see that file's own
 * docblock for why it's still an honest "not connected yet" state, not
 * fabricated positions/volumes.
=======
 * these same 23 real scanner ids), 5 real category cards with their own
 * real per-category score, then a real, page-wise "All SEO Issues" table
 * (SeoIssuesByPageTable.tsx — one row per post/page, matching "Content →
 * Recent Content"'s own interaction pattern, per direct instruction —
 * replacing the issue-type-grouped SectionedFindingsTab/SectionedIssuesTable
 * shell this tab used before). There's deliberately no "Ranking keywords"
 * table the way the reference mockup has one — this plugin has no real
 * keyword-rank-tracking data source anywhere (Free or Pro; SEO Copilot's
 * own Pro pitch in Popup.tsx already lists "Keyword rank tracking...
 * Google Search Console integration" as a still-unbuilt Pro feature) — an
 * honest "not connected yet" card sits where that table would go instead
 * of fabricated positions/volumes.
>>>>>>> e641e1e (change)
 */
const SeoTab = () => {
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
		<ContainerComponent>
			<ColumnComponent>
				<NoticeComponent
					// type="banner"
					displayPosition="inline"
					message={sprintf(
						'<strong>%1$s</strong> %2$s',
						__('In plain English:', 'vulopilot'),
						__(
							'This checks whether your pages are set up correctly for classic Google search — titles, descriptions, images, links, and your sitemap.',
							'vulopilot'
						)
					)}
				/>

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
													<div className="geo-four-checks-title">
														{card.title}
													</div>
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

				<SeoIssuesByPageTable />

				<ModuleGuardComponent
					icon="lock"
					title={__('Ranking keywords: not connected yet', 'vulopilot')}
					desc={__(
						'VuloPilot doesn’t track real keyword positions or search volume yet — that needs a connected Google Search Console (or similar rank-tracking) account. Flag if you want this scoped next.',
						'vulopilot'
					)}
				/>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default SeoTab;
