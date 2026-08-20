/* global appLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	NoticeComponent,
} from '@zyra/components';
import { scrollToId } from '@zyra/core';
import ProLockedCard from '../../components/ProLockedCard';
import GeoByTopicGrid from './GeoByTopicGrid';
import TopPagesCard from './TopPagesCard';
import GeoTrendCompactCard from './GeoTrendCompactCard';
import AeoCitationCoverageCard from './AeoCitationCoverageCard';
import AeoEngineTestingCard from './AeoEngineTestingCard';
import IssuesSection from './IssuesSection';
import { useAllFindingGroups } from './useAllFindingGroups';
import { sumGroupCounts } from './useGeoFindingGroups';
import {
	useGeoVisibilitySnapshot,
	type GeoVisibilityHistoryRow,
} from './useGeoVisibilitySnapshot';
import { useAeoPageAnalysis } from './useAeoPageAnalysis';

/**
 * Section → scanner_id grouping for AEO's 6 real topics — every scanner_id
 * here is a real, already-scanning-today scanner (Free unless noted); no
 * topic invents a signal that doesn't exist. Restructured from the
 * previous 5-topic version (direct instruction: match the reference
 * mockup's own 6-tile "AEO Checks at a Glance" grid) by splitting out a
 * 6th real topic — "Content Structure" — from GEO's own
 * `geo-chunking`/`geo-semantic-structure` scanners rather than inventing a
 * second "AI Summary" tile that would just re-show `geo-summary-block`'s
 * numbers under a second name (the mockup's own "Direct Answers" and "AI
 * Summary" tiles both describe that one real scanner — see "Direct
 * Answers"'s own description below for why they're kept as one real tile,
 * not duplicated data under two labels).
 *
 * Reusing `geo-chunking`/`geo-semantic-structure` here — scanners GEO's own
 * "AI-Readable Structure" topic also uses — is the same accepted overlap
 * this file already documents for `geo-summary-block` (also shown under
 * GEO's "AI Summary" topic): a finding can legitimately show up under both
 * GEO's and AEO's own groupings, since each tab is its own complete lens
 * over the same real finding data, not a disjoint partition of it.
 */
const AEO_SECTIONS: {
	key: string;
	title: string;
	titleIcon: string;
	description: string;
	emptyMessage: string;
	scannerIds: string[];
}[] = [
	{
		key: 'coverage',
		title: __('Questions & Answers', 'vulopilot'),
		titleIcon: 'form-phone',
		description: __(
			'Whether pages clearly answer the questions people are likely to ask, with a dedicated FAQ or Q&A block making that answer easy for AI to extract.',
			'vulopilot'
		),
		emptyMessage: __(
			'No question-coverage findings yet — run a scan to check for FAQ opportunities.',
			'vulopilot'
		),
		scannerIds: ['geo-faq-opportunity'],
	},
	{
		key: 'answers',
		title: __('Direct Answers', 'vulopilot'),
		titleIcon: 'analytics',
		description: __(
			'Whether pages have an extractable AI summary — a short, up-front answer an AI system can quote directly, rather than one buried in the middle of the content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No direct-answer findings yet — run a scan to check for AI summary blocks.',
			'vulopilot'
		),
		scannerIds: ['geo-summary-block'],
	},
	{
		key: 'readability',
		title: __('Content Structure', 'vulopilot'),
		titleIcon: 'blocks',
		description: __(
			'Paragraph length and heading hierarchy — how easily an AI system can pull out one clean, self-contained chunk to answer a question with.',
			'vulopilot'
		),
		emptyMessage: __(
			'No structure findings yet — run a scan to check paragraph length and heading hierarchy.',
			'vulopilot'
		),
		scannerIds: ['geo-chunking', 'geo-semantic-structure'],
	},
	{
		key: 'schema',
		title: __('Schema Markup', 'vulopilot'),
		titleIcon: 'editor-code',
		description: __(
			'Content already shaped like an FAQ or a how-to guide, but missing the schema.org markup that lets AI answer engines recognize it as one.',
			'vulopilot'
		),
		emptyMessage: __(
			'No schema findings yet — run a scan to check FAQ/HowTo-shaped content for missing markup.',
			'vulopilot'
		),
		scannerIds: ['aeo-schema'],
	},
	{
		key: 'citation',
		title: __('Evidence & Sources', 'vulopilot'),
		titleIcon: 'attachment',
		description: __(
			'Statistic-shaped claims with no citation or outbound link backing them up — the evidence an AI system needs before it will cite this site as a source.',
			'vulopilot'
		),
		emptyMessage: __(
			'No citation-readiness findings yet — run a scan to check for uncited claims.',
			'vulopilot'
		),
		scannerIds: ['geo-citation-opportunities'],
	},
	{
		key: 'other',
		title: __('Other Signals', 'vulopilot'),
		titleIcon: 'person',
		description: __(
			'Author credentials, naming consistency, trust pages, llms.txt, and content freshness — signals that shape whether an AI system trusts an answer enough to cite it.',
			'vulopilot'
		),
		emptyMessage: __(
			'No other findings yet — run a scan to check author info, naming consistency, and freshness.',
			'vulopilot'
		),
		scannerIds: [
			'geo-author-info',
			'geo-eeat-signals',
			'geo-entity-naming-consistency',
			'geo-trust-signals',
			'llms-txt-missing',
			'stale-content',
		],
	},
];

const ALL_AEO_SCANNER_IDS = AEO_SECTIONS.flatMap((section) => section.scannerIds);

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

const average = (values: number[]): number =>
	values.length
		? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length)
		: 0;

/**
 * The same 3-dimension average the "AEO Score" ring below computes for
 * "today" (`answer_first_structure`/`question_coverage`/`citation_readiness`),
 * applied to one historical `history` row instead — passed as
 * GeoTrendCompactCard.tsx's own `getScore` prop so "AEO Score Over Time"
 * trends this scoped average rather than that card's default sitewide
 * `overall_score`. Returns null for a day the sample batch found nothing
 * to average (same meaning `overall_score: null` already carries).
 */
const getAeoTrendScore = (row: GeoVisibilityHistoryRow): number | null =>
	row.ai_scores && row.sub_scores
		? average([
				row.ai_scores.answer_first_structure,
				row.ai_scores.question_coverage,
				row.sub_scores.citation_readiness,
			])
		: null;

/**
 * Whether GeoInsights' own Rest.php class is registered at all — either
 * 'geo-insights' or 'aeo-insights' being active is enough, since both
 * register that same class (AeoInsights\Module.php's own docblock). The
 * real gate AeoCitationCoverageCard.tsx/AeoEngineTestingCard.tsx check
 * before letting a click spend a real AI call, same "check the real
 * active_modules list directly" posture GeoTab.tsx's own
 * `isGeoInsightsActive()` already uses for its sibling Competitor
 * Visibility card.
 */
const isCitationCheckActive = (): boolean =>
	(appLocalizer.active_modules?.includes('geo-insights') ||
		appLocalizer.active_modules?.includes('aeo-insights')) ??
	false;

/**
 * AEO = Answer Engine Optimization — whether AI systems can extract,
 * structure, and cite a direct answer from this site's pages (distinct from
 * GEO's broader "can an AI understand this page at all" scope, and from
 * classic search-engine SEO). Rebuilt a second time to close the remaining
 * gap against the reference mockup (direct instruction: "still missing some
 * sections"), reusing real data/components already built for this tab or
 * for GEO rather than duplicating them:
 *
 * 1. Two real info banners (static, honest explanatory copy).
 * 2. 3 real stat tiles — AEO Score (Pro-gated bucket average), "Questions
 *    Answered" and "Pages Ready" (both NEW — see useAeoPageAnalysis.ts's
 *    own docblock for where their numbers come from). A 4th tile, "Open
 *    Issues", used to sit here too — removed (direct instruction: "remove
 *    the duplicate content") since it was the exact same open-findings
 *    total already shown two other ways on this same tab: summed across
 *    "AEO Checks at a Glance"'s 6 topic tiles below, and again as the
 *    issues table's own "All Issues" summary card (IssuesSection.tsx,
 *    left untouched — direct instruction: "table intact no change").
 * 3. "Top Pages by Answer Readiness" (TopPagesCard.tsx — genericized so it
 *    can be scoped to AEO's own scanner ids instead of GEO's
 *    `category=geo` default), full width on its own. "What Needs Your
 *    Attention" (GeoFixTheseFirstCard.tsx) used to sit alongside it here —
 *    removed from this tab per direct instruction (GeoTab.tsx's own
 *    "Fix These First" usage of that same component was removed earlier
 *    this session too — the component itself is still real, just not
 *    currently rendered by either GEO or AEO).
 * 4. "AEO Score Over Time" (GeoTrendCompactCard.tsx, genericized and
 *    reused rather than left as a "not tracked yet" placeholder) — turns
 *    out `VisibilitySnapshotBuilder` had been writing a real per-day
 *    `ai_scores`/`sub_scores` breakdown into `vulopilot_geo_visibility_history`
 *    since day one (GeoVisibilityHistoryRepository::upsert_today()'s own
 *    `longtext` columns); `Rest.php::get_visibility_history()` just never
 *    read those two columns back out, so every consumer only ever saw the
 *    one combined `overall_score`. Decoding and returning them there
 *    closes that gap for real, so this card now trends the same
 *    answer_first_structure/question_coverage/citation_readiness average
 *    the current-day "AEO Score" ring above already uses, per historical
 *    day — a real trend line, not a fabricated one.
 * 5. "AEO Checks at a Glance" (GeoByTopicGrid.tsx, reused) — now 6 real
 *    topics instead of 5, see AEO_SECTIONS's own docblock.
 * 6. "Need Help Improving?" briefly existed here (3 shortcuts: Ask AI
 *    Copilot, Fix Automatically, Learn More) — removed per direct
 *    instruction. Its own `scrollToId('aeo-top-banner')` target
 *    (`<div id="aeo-top-banner">` wrapping the "In plain English" banner
 *    at the top of this tab) had no other caller once this section was
 *    gone, so that wrapper div/id was removed too rather than left as
 *    dead scroll-target infrastructure.
 * 7. "Answerability Signals" — briefly existed as its own real card (the
 *    same 3 scores the "AEO Score" ring averages together —
 *    `answer_first_structure`/`question_coverage`/`citation_readiness` —
 *    broken out individually), then removed (direct instruction: "remove
 *    the duplicate content") once it was live: it was the exact same 3
 *    numbers as the AEO Score ring above, just re-shown unaveraged one
 *    section down, and its own tile labels ("Direct Answer Structure",
 *    "Question Coverage", "Citation Readiness") collided confusingly with
 *    "AEO Checks at a Glance"'s differently-sourced topic tiles ("Direct
 *    Answers", "Questions & Answers", "Evidence & Sources" — real
 *    finding counts, not AI-judged scores). The AEO Score ring is the one
 *    place those 3 dimensions are shown now. "Answer Engine Coverage"
 *    (AeoCitationCoverageCard.tsx) and "Engine Testing"
 *    (AeoEngineTestingCard.tsx, NEW) are real and functional now — both
 *    real outbound calls to this site's own configured AI provider
 *    (`GeoInsights\CitationCoverageChecker`, reusing Free's own
 *    `ai_request_sender` — the exact safety-validated call path
 *    GeoAnalysis\GeoAnalyzer already uses for GEO Score), asking it a real
 *    question drawn from the site's own content without ever naming the
 *    site, then checking whether the model's own real answer already
 *    recognizes it. Genuinely disclosed as "Simulated" (that badge
 *    predates this build and is still accurate): a plain chat completion
 *    has no live web search, so it can only ever recognize a site it
 *    already learned about during training — a "not recognized" result on
 *    a small or new site is an expected, true finding, not a broken
 *    check. Both gate on `isCitationCheckActive()` (same real
 *    `active_modules` check GeoTab.tsx's own `isGeoInsightsActive()`
 *    already uses for its sibling Competitor Visibility card) rather than
 *    the `hasSnapshot` a snapshot-cron run happens to have populated.
 * 8. "All AEO Issues" — `IssuesSection.tsx` (SeoTab.tsx's own real
 *    filter-pills + Site-wide Issues + Pages & Posts structure,
 *    generalized so this tab and GeoTab.tsx can reuse it too, per direct
 *    instruction), replacing the differently-shaped `SectionedFindingsTab.tsx`
 *    this used before. Its own `pageAnalysis` prop merges what used to be a
 *    separate standalone "Page-by-page answer readiness" table
 *    (GeoPageAnalysisTable.tsx, every page + a real deterministic
 *    answer-readiness % scoped to AEO's own scanner ids + Export CSV)
 *    directly into the "Pages & Posts" table here, per direct instruction
 *    ("merge the 2 sections... into the 2nd") — that component is now dead
 *    code on this tab (GeoTab.tsx merges the same way).
 */
const AeoTab = () => {
	const [categoryFocus, setCategoryFocus] = useState<{
		key: string;
		token: number;
	} | null>(null);
	const { groups, isLoading: isLoadingGroups } = useAllFindingGroups();
	const { snapshot, history, isLoading: isLoadingSnapshot } = useGeoVisibilitySnapshot();
	const { pages: aeoPages, total: totalPages, isLoading: isLoadingPages } =
		useAeoPageAnalysis(ALL_AEO_SCANNER_IDS);

	// "Questions Answered" — real published pages minus the real count of
	// pages with an open geo-faq-opportunity finding (i.e. pages that
	// already have adequate question coverage). Reuses the same `groups`
	// fetch above rather than a second request just for this one number.
	const openFaqFindings = sumGroupCounts(groups, ['geo-faq-opportunity']);
	const questionsAnswered = totalPages
		? Math.max(0, totalPages - openFaqFindings)
		: 0;

	// "Pages Ready" — real published pages with zero open AEO findings
	// (across all 6 topics above), out of the real total. `aeoPages` is
	// the same real `/geo-analysis/pages` dataset GeoPageAnalysisTable
	// below independently re-fetches paginated — see useAeoPageAnalysis.ts's
	// own docblock for why this is a second real request rather than a
	// shared one.
	const pagesReady = aeoPages.filter((page) => 0 === page.open_findings).length;

	/**
	 * Sets a fresh `categoryFocus` (a new `token` even for the same `key`
	 * twice in a row) — `IssuesSection.tsx`'s own effect both switches its
	 * active filter to that category (or resets to unfiltered for the
	 * literal `'all'`) and scrolls itself into view, so this doesn't also
	 * need its own `scrollToId()` call the way the old `SectionedFindingsTab`-based
	 * version did (that component had no such self-scrolling behavior).
	 */
	const goToIssuesTable = (key: string = 'all') => {
		setCategoryFocus({ key, token: Date.now() });
	};

	const hasSnapshot = snapshot && snapshot.ai_scores && snapshot.sub_scores;
	const aeoScore = hasSnapshot
		? average([
				snapshot!.ai_scores!.answer_first_structure,
				snapshot!.ai_scores!.question_coverage,
				snapshot!.sub_scores!.citation_readiness,
			])
		: 0;

	return (
		<>
			<NoticeComponent
				// type="banner"
				displayPosition="inline"
				message={sprintf(
					'<strong>%1$s</strong> %2$s',
					__('In plain English:', 'vulopilot'),
					__(
						'When someone asks ChatGPT, Perplexity, or Google’s AI a question your page could answer, this checks whether your content is written so AI can actually quote it directly.',
						'vulopilot'
					)
				)}
			/>

			<ContainerComponent>
				<ColumnComponent grid={4}>
					<CardComponent
						title={__('AEO Score', 'vulopilot')}
						desc={__(
							'How ready your content is to be extracted and quoted directly by AI answer engines.',
							'vulopilot'
						)}
						isLoading={isLoadingSnapshot}
					>
						{!isLoadingSnapshot && !hasSnapshot ? (
							<ProLockedCard moduleName="aeo-insights" />
						) : (
							<div className="geo-overall-visibility">
								<ChartComponent
									type="pie"
									height={120}
									centerLabel={
										<>
											<span className="score-ring-number">
												{aeoScore}
											</span>
											<span className="score-ring-label">/100</span>
											<span
												className={`score-ring-label geo-overall-rating ${ratingClass(aeoScore)}`}
											>
												{getRating(aeoScore)}
											</span>
										</>
									}
									data={[
										{
											label: __('Score', 'vulopilot'),
											value: aeoScore,
											color: '#7C3AED',
										},
										{
											label: __('Remaining', 'vulopilot'),
											value: 100 - aeoScore,
											color: '#e5e7eb',
										},
									]}
								/>
							</div>
						)}
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent grid={4}>
					<CardComponent
						title={__('Questions Answered', 'vulopilot')}
						desc={__(
							'Published pages that already have adequate FAQ/Q&A coverage for the questions they plausibly answer.',
							'vulopilot'
						)}
						isLoading={isLoadingGroups || isLoadingPages}
					>
						<div className="crawler-stat-value">{questionsAnswered}</div>
						<div className="desc">
							{sprintf(
								/* translators: %d is the total number of real published pages/posts on this site. */
								__('out of %d published pages', 'vulopilot'),
								totalPages
							)}
						</div>
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent grid={4}>
					<CardComponent
						title={__('Pages Ready', 'vulopilot')}
						desc={__(
							'Published pages with zero open AEO findings right now.',
							'vulopilot'
						)}
						isLoading={isLoadingPages}
					>
						<div className="crawler-stat-value">
							{sprintf('%d/%d', pagesReady, totalPages)}
						</div>
						<div className="desc">
							{__('Ready to be quoted by an AI answer engine.', 'vulopilot')}
						</div>
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>

			<TopPagesCard
				grid={12}
				scannerIds={ALL_AEO_SCANNER_IDS}
				title={__('Top Pages by Answer Readiness', 'vulopilot')}
				desc={__(
					'Which pages an AI answer engine could already quote, and which need the most work.',
					'vulopilot'
				)}
				topLabel={__('Most ready', 'vulopilot')}
				bottomLabel={__('Needs attention', 'vulopilot')}
				id="aeo-top-pages"
				onViewAll={() => scrollToId('aeo-all-issues-table')}
			/>

			<ColumnComponent grid={12}>
				<GeoTrendCompactCard
					history={history}
					isLoading={isLoadingSnapshot}
					isGeoInsightsActive={isLoadingSnapshot || Boolean(hasSnapshot)}
					title={__('AEO Score Over Time', 'vulopilot')}
					desc={__(
						'Your answer-readiness score over the last 30 days — going up means AI answer engines can extract and quote your content more easily.',
						'vulopilot'
					)}
					moduleName="aeo-insights"
					getScore={getAeoTrendScore}
				/>
			</ColumnComponent>

			<GeoByTopicGrid
				topics={AEO_SECTIONS}
				groups={groups}
				isLoading={isLoadingGroups}
				title={__('AEO Checks at a Glance', 'vulopilot')}
				desc={__(
					'Key areas that help answer engines understand and use your content.',
					'vulopilot'
				)}
				onViewTopic={(key) => goToIssuesTable(key)}
			/>

			<NoticeComponent
				// type="banner"
				displayPosition="inline"
				message={__(
					'AEO helps answer engines find clear, accurate answers on your website. Better answers means more visibility in AI-generated results.',
					'vulopilot'
				)}
			/>

			<ContainerComponent>
				<AeoCitationCoverageCard isActive={isCitationCheckActive()} />
				<AeoEngineTestingCard isActive={isCitationCheckActive()} pages={aeoPages} />
			</ContainerComponent>

			{/* Same real "filter pills + Site-wide Issues + Pages & Posts" structure SeoTab.tsx's own issues table already has (IssuesSection.tsx, generalized from what used to be SEO-only) — replaces the differently-shaped SectionedFindingsTab this used before, per direct instruction. `pageAnalysis` merges the former standalone "Page-by-Page Answer Readiness" table into the "Pages & Posts" table below. */}
			<IssuesSection
				id="aeo-all-issues-table"
				scannerIds={ALL_AEO_SCANNER_IDS}
				categories={AEO_SECTIONS}
				categoryFocus={categoryFocus}
				issuesColumnLabel={__('AEO Issues', 'vulopilot')}
				pageAnalysis={{
					scoreColumnLabel: __('Answer Readiness', 'vulopilot'),
					exportFilename: 'aeo-page-analysis.csv',
				}}
			/>
		</>
	);
};

export default AeoTab;
