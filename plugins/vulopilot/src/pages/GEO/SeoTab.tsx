/* global appLocalizer */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { useSeoScore } from './useSeoScore';
import SeoIssuesSection from './SeoIssuesSection';

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
 * these same 23 real scanner ids), 5 real category cards with their own
 * real per-category score, then the two real tables `SeoIssuesSection.tsx`
 * owns — "Site-wide Issues" and a page-wise table, split apart per direct
 * instruction (previously one combined "All SEO Issues" card). Clicking a
 * category card scrolls to and filters that section down to just that
 * category's own real scanner ids (`categoryFocus` below) — the same
 * `SEO_SECTIONS` grouping these tiles' own scores are computed from, so
 * "what this tile means" and "what clicking it filters to" always agree.
 * There's deliberately no "Ranking keywords" table the way the reference
 * mockup has one — this plugin has no real keyword-rank-tracking data
 * source anywhere (Free or Pro; SEO Copilot's own Pro pitch in Popup.tsx
 * already lists "Keyword rank tracking... Google Search Console
 * integration" as a still-unbuilt Pro feature) — an honest "not connected
 * yet" card sits where that table would go instead of fabricated
 * positions/volumes.
 */
const SeoTab = () => {
	const { score, isLoading: isLoadingScore } = useSeoScore();
	const [categoryFocus, setCategoryFocus] = useState<{ key: string; token: number } | null>(
		null
	);

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
									'Each category below has its own real score based on open findings — click one to jump to its issues.',
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
													className={`geo-four-checks-tile geo-four-checks-tile-clickable ${ratingClass(categoryScore)}`}
													role="button"
													tabIndex={0}
													onClick={() =>
														setCategoryFocus({
															key: card.key,
															token: Date.now(),
														})
													}
													onKeyDown={(event) => {
														if (
															'Enter' === event.key ||
															' ' === event.key
														) {
															event.preventDefault();
															setCategoryFocus({
																key: card.key,
																token: Date.now(),
															});
														}
													}}
												>
													<p className="geo-four-checks-title">
														{card.title}
													</p>
													<span
														className={`admin-badge geo-four-checks-badge ${ratingClass(categoryScore)}`}
													>
														{categoryScore}/100
													</span>
												</div>
											);
										})}
								</div>
							</CardComponent>
						</ColumnComponent>
					</ContainerComponent>

				<SeoIssuesSection categoryFocus={categoryFocus} />

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
