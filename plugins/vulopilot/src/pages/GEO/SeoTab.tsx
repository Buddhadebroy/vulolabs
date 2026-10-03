/* global vulopilotAppLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { COLOR_PALETTE, scrollToId } from '@zyra/core';
import {
	AnalyticsComponent,
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	ListComponent,
	ModuleGuardComponent,
	TypographyComponent,
	IconComponent
} from '@zyra/components';
import { useSeoScore, SeoScoreResponse } from './useSeoTabData';
import { getRating, ratingColor } from './seoRating';
import { ALL_SEO_SCANNER_IDS } from './seoIssuesShared';
import { SEO_SECTIONS } from './seoSections';
import IssuesSection from './IssuesSection';
import SeoProgressCard from './SeoProgressCard';
import PageAnalysisPanel from './PageAnalysisPanel';

const CATEGORY_CARDS: {
	key: keyof SeoScoreResponse['category_scores'];
	title: string;
	icon: string;
	/** A fixed per-category identity color for the icon box. */
	color: string;
}[] = [
		{ key: 'titles-meta', title: __('Titles & Meta', 'vulopilot'), icon: 'search blue', color: 'purple' },
		{ key: 'content-structure', title: __('Content Structure', 'vulopilot'), icon: 'editor-list red', color: 'blue' },
		{ key: 'images', title: __('Images', 'vulopilot'), icon: 'image pink', color: 'green' },
		{ key: 'internal-linking', title: __('Internal Linking', 'vulopilot'), icon: 'link lime', color: 'indigo' },
		{ key: 'indexability-canonicals', title: __('Indexability & Canonicals', 'vulopilot'), icon: 'search-discovery cyan', color: 'teal' },
		{ key: 'structured-data', title: __('Social Metadata', 'vulopilot'), icon: 'blocks teal', color: 'orange' },
	];





/**
 * Real per-band copy under the "Overall SEO Score" ring.
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
			'Your site could use some improvement - a few real issues need attention.',
			'vulopilot'
		);
	}
	return __(
		'Your site needs attention - several real SEO issues are open.',
		'vulopilot'
	);
};

/**
 * Real per-category score change - this category's current `score` minus the oldest point in its
 * own real `trend` array (`Seo.php`'s own `get_category_trend()`, oldest-first - same real series
 * `overallCategoryTrend()` above already folds into the "All Areas" tile).
 */
const categoryScoreDelta = (category: SeoScoreResponse['category_scores'][keyof SeoScoreResponse['category_scores']]): number | null =>
	category.trend.length > 0 ? category.score - category.trend[0] : null;

/**
 * Unlike the 'geo' module (whose own scanners run regardless of its active-module state - see
 * modules/Geo/Module.php's docblock).
 */
const isSeoModuleActive = () =>
	vulopilotAppLocalizer.active_modules?.includes('technical-seo') ?? false;


const SeoTab = () => {
	const { score, isLoading: isLoadingScore } = useSeoScore();
	const [categoryFocus, setCategoryFocus] = useState<{ key: string; token: number } | null>(
		null
	);
	/** Set by a real "Analyze" click in the "Pages & Posts" table below. */
	const [analyzingPostId, setAnalyzingPostId] = useState<number | null>(null);

	/** Same real "scroll the just-opened detail panel into view" fix the other issues tables' own `handleSelectGroup` already establishes (`scrollToId`, not `window.scrollTo` - WP admin's own scrollable wrapper isn't the document). */
	const handleAnalyze = (postId: number) => {
		setAnalyzingPostId(postId);
		scrollToId('seo-page-analysis-panel');
	};

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
							'Turn the SEO module back on from Settings → Modules to resume SEO scanning and see its findings again here. Findings already found before it was turned off aren’t deleted - they still show up on the Health page, which lists every category.',
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
							<div className="overall-score-wrapper">
								 <div className="overall-score-summary">
										<ChartComponent
											type="ring"
											height={200}
											// Top-level `color` - `type="ring"` only ever paints
											// its stroke from this prop.
											color={
												COLOR_PALETTE[
													ratingColor(score.seo_score) as keyof typeof COLOR_PALETTE
												]
											}
											centerLabel={
												<>
													<TypographyComponent
														variant={'h1'}
														color={ratingColor(score.seo_score)}
													>
														{score.seo_score}
													</TypographyComponent>
													<TypographyComponent variant={'h4'}>
														{getRating(score.seo_score)}
													</TypographyComponent>
												</>
											}
											data={[
												{
													label: __('Score', 'vulopilot'),
													value: score.seo_score,
													// Same real rating color the ring's own "Needs
													// Attention"/"Good"/"Poor" label below already
													// uses (`ratingClass()`/`getRating()`).
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
										{/* * "Overall Score" - was a verbatim repeat of * this card's own header title ("SEO Health") * right above it. */}
										<TypographyComponent variant={'h3'} color="text-green">
											{__('Overall Score', 'vulopilot')}
										</TypographyComponent>
										<div className="desc">
											{scoreSummary(score.seo_score)}
										</div>
								</div>
								{/* * Same 6 real per-category scores the old * `AnalyticsComponent` progress-bar rows above * this used to show. */}
							  <div className="overall-score-summary">
								<ListComponent
									className="mini-card report hover without-border seo-health-score-category-list"
									loading={isLoadingScore}
									items={CATEGORY_CARDS.map((card) => {
										const category = score.category_scores[card.key];
										const delta = categoryScoreDelta(category);

										return {
											id: card.key,
											icon: card.icon,
											title: card.title,
											desc: sprintf(
												/* translators: %d: real number of open findings. */
												__('%d issues', 'vulopilot'),
												category.open_count
											),
											tags: (
												<>
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
													{null !== delta && (
														<TypographyComponent
															as="span"
															variant="body-md"
															weight="bold"
															color={delta >= 0 ? 'green' : 'red'}
															className="seo-health-score-row-delta"
														>
															<IconComponent
																name={delta >= 0 ? 'arrow-up' : 'arrow-down'}
															/>
															{Math.abs(delta)}
														</TypographyComponent>
													)}
												</>
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
			<ColumnComponent grid={8}>
				{/* SEO's own thin, defaults-only wrapping of the generalized * IssuesSection.tsx. */}
				<IssuesSection
					id="seo-all-issues-table"
					scannerIds={ALL_SEO_SCANNER_IDS}
					categories={SEO_SECTIONS}
					categoryFocus={categoryFocus}
					issuesColumnLabel="SEO Issues"
					onAnalyze={handleAnalyze}
					activePostId={analyzingPostId}
					onAnalyzeClose={() => setAnalyzingPostId(null)}
					pageScore
				/>
			</ColumnComponent>
			{analyzingPostId && (
				<ColumnComponent grid={4}>
					<div id="seo-page-analysis-panel">
					<PageAnalysisPanel
						postId={analyzingPostId}
					/>
					</div>
				</ColumnComponent>
			)}
		</ContainerComponent>
	);
};

export default SeoTab;
