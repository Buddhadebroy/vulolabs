import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NoticeComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { scrollToId } from '@zyra/core';
import ProLockedCard from '../../components/ProLockedCard';
import AiCopilotGuard from '../../components/AiCopilotGuard';
import GeoByTopicGrid from './GeoByTopicGrid';
import TopPagesCard from './TopPagesCard';
import IssuesSection from './IssuesSection';
import { useAllFindingGroups } from './useAllFindingGroups';
import { sumGroupCounts } from './useGeoFindingGroups';
import { useGeoVisibilitySnapshot } from './useGeoVisibilitySnapshot';
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
 * AEO = Answer Engine Optimization — whether AI systems can extract,
 * structure, and cite a direct answer from this site's pages (distinct from
 * GEO's broader "can an AI understand this page at all" scope, and from
 * classic search-engine SEO). Rebuilt a second time to close the remaining
 * gap against the reference mockup (direct instruction: "still missing some
 * sections"), reusing real data/components already built for this tab or
 * for GEO rather than duplicating them:
 *
 * 1. Two real info banners (static, honest explanatory copy).
 * 2. 4 real stat tiles — AEO Score (Pro-gated bucket average, unchanged),
 *    "Questions Answered" and "Pages Ready" (both NEW — see
 *    useAeoPageAnalysis.ts's own docblock for where their numbers come
 *    from), and Open Issues (unchanged).
 * 3. "Top Pages by Answer Readiness" (TopPagesCard.tsx — genericized so it
 *    can be scoped to AEO's own scanner ids instead of GEO's
 *    `category=geo` default), full width on its own. "What Needs Your
 *    Attention" (GeoFixTheseFirstCard.tsx) used to sit alongside it here —
 *    removed from this tab per direct instruction (GeoTab.tsx's own
 *    "Fix These First" usage of that same component was removed earlier
 *    this session too — the component itself is still real, just not
 *    currently rendered by either GEO or AEO).
 * 4. "AEO score over time" — an honest not-tracked-yet card (NEW). No
 *    per-dimension AEO score history exists anywhere in this codebase
 *    (GeoInsights\VisibilitySnapshotBuilder's own history table only ever
 *    stores one combined `overall_score` per day, not a per-bucket
 *    breakdown — same gap this file already documented before), so this
 *    is a real acknowledgement of that gap with a real link to the one
 *    place an AEO breakdown does exist today (the page-by-page table
 *    below), not a fabricated trend line.
 * 5. "AEO Checks at a Glance" (GeoByTopicGrid.tsx, reused) — now 6 real
 *    topics instead of 5, see AEO_SECTIONS's own docblock.
 * 6. "Need help improving?" (NEW) — 3 real shortcuts: Ask AI Copilot (same
 *    real destination as #3's banner), Fix automatically (scrolls to the
 *    real Fix/Fix-selected actions already live in the issues table below
 *    — see OneClickFix's own `vulopilot_finding_fix_handler` filter, which
 *    is what actually powers that table's row actions when Pro's
 *    One-Click Fix module is active), and Learn more (scrolls back to the
 *    real explanatory banner at the top of this tab).
 * 7. The same 3 honestly-not-built-yet cards this tab already had, plus
 *    "All AEO Issues" — `IssuesSection.tsx` (SeoTab.tsx's own real
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
	const { snapshot, isLoading: isLoadingSnapshot } = useGeoVisibilitySnapshot();
	const { pages: aeoPages, total: totalPages, isLoading: isLoadingPages } =
		useAeoPageAnalysis(ALL_AEO_SCANNER_IDS);

	const totalOpenFindings = sumGroupCounts(groups, ALL_AEO_SCANNER_IDS);

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
			{/* id kept on this wrapper, not NoticeComponent itself (no id prop) — real scrollToId('aeo-top-banner') target, see the "Learn More" tile's onClick below. */}
			<div id="aeo-top-banner">
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
			</div>

			<ContainerComponent>
				<ColumnComponent grid={3}>
					<CardComponent
						title={__('AEO Score', 'vulopilot')}
						desc={__(
							'How ready your content is to be extracted and quoted directly by AI answer engines.',
							'vulopilot'
						)}
						isLoading={isLoadingSnapshot}
					>
						{!isLoadingSnapshot && !hasSnapshot ? (
							<ProLockedCard moduleName="geo-insights" />
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
				<ColumnComponent grid={3}>
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
				<ColumnComponent grid={3}>
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
				<ColumnComponent grid={3}>
					<CardComponent
						title={__('Open Issues', 'vulopilot')}
						desc={__(
							'Real open findings across all 6 AEO checks below.',
							'vulopilot'
						)}
						isLoading={isLoadingGroups}
					>
						<div className="crawler-stat-value">{totalOpenFindings}</div>
						<div className="desc">
							{__(
								'Fixing these raises how often AI answer engines can quote this site directly.',
								'vulopilot'
							)}
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

			<ContainerComponent>
				<ColumnComponent grid={12}>
					<CardComponent
						title={__('AEO Score Over Time', 'vulopilot')}
						desc={__(
							'How your answer-readiness has changed since your last scans.',
							'vulopilot'
						)}
					>
						<ModuleGuardComponent
							icon="analytics"
							title={__('Historical tracking not built yet', 'vulopilot')}
							desc={__(
								'Day-by-day AEO score history isn’t recorded yet — only one combined visibility score is tracked over time today. The real, current breakdown is available right now in the page-by-page table below.',
								'vulopilot'
							)}
							buttonText={__('View page-by-page breakdown', 'vulopilot')}
							onButtonClick={() => scrollToId('aeo-all-issues-table')}
						/>
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>

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

			<div className="aeo-help-band">
				<h3 className="reports-section-title">
					{__('Need Help Improving?', 'vulopilot')}
				</h3>
				<div className="aeo-help-band-grid">
					<AiCopilotGuard
						title={__('AI Copilot is turned off', 'vulopilot')}
						desc={__(
							'Turn the AI Copilot module back on from Settings → Modules to ask it about these issues.',
							'vulopilot'
						)}
					>
						<a href="?page=vulopilot#&tab=ai-assistant" className="aeo-help-tile">
							<i className="adminfont-ai" />
							<div>
								<div className="aeo-help-tile-title">
									{__('Ask AI Copilot', 'vulopilot')}
								</div>
								<p className="aeo-help-tile-desc">
									{__(
										'Get real suggestions for improving your answer readiness.',
										'vulopilot'
									)}
								</p>
							</div>
						</a>
					</AiCopilotGuard>
					<ButtonInput
						position="full-width"
						buttons={{
							text: __('Fix Automatically', 'vulopilot'),
							className: 'aeo-help-tile',
							onClick: () => goToIssuesTable('all'),
							children: (
								<>
									<i className="adminfont-yes-alt" />
									<div>
										<div className="aeo-help-tile-title">
											{__('Fix Automatically', 'vulopilot')}
										</div>
										<p className="aeo-help-tile-desc">
											{__(
												'Jump to the issues table below to fix findings one by one or in bulk.',
												'vulopilot'
											)}
										</p>
									</div>
								</>
							),
						}}
					/>
					<ButtonInput
						position="full-width"
						buttons={{
							text: __('Learn More', 'vulopilot'),
							className: 'aeo-help-tile',
							onClick: () => scrollToId('aeo-top-banner'),
							children: (
								<>
									<i className="adminfont-info" />
									<div>
										<div className="aeo-help-tile-title">
											{__('Learn More', 'vulopilot')}
										</div>
										<p className="aeo-help-tile-desc">
											{__(
												'Understand how AEO helps AI answer engines find and quote your content.',
												'vulopilot'
											)}
										</p>
									</div>
								</>
							),
						}}
					/>
				</div>
			</div>

			<NoticeComponent
				// type="banner"
				displayPosition="inline"
				message={__(
					'AEO helps answer engines find clear, accurate answers on your website. Better answers means more visibility in AI-generated results.',
					'vulopilot'
				)}
			/>

			<ContainerComponent>
				<CardComponent
					title={__('Answerability signals', 'vulopilot')}
					titleIcon="analytics"
					badges={[
						{ text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
					]}
					toggle
				>
					<ModuleGuardComponent
						icon="info"
						title={__('Not scoring answerability signals yet', 'vulopilot')}
						desc={__(
							'A dedicated per-signal AEO score breakdown hasn’t been built yet. The AEO Score above already reflects several real answer-extraction dimensions for VuloPilot Pro users.',
							'vulopilot'
						)}
					/>
				</CardComponent>
				<CardComponent
					title={__('Answer engine coverage', 'vulopilot')}
					titleIcon="global-community"
					desc={__(
						'Whether AI answer engines currently cite this site when asked questions its content answers.',
						'vulopilot'
					)}
					badges={[
						{
							text: __('Simulated Citation Checks', 'vulopilot'),
							color: 'purple',
						},
					]}
					toggle
				>
					<ModuleGuardComponent
						icon="info"
						title={__('Not available yet', 'vulopilot')}
						desc={__(
							'Live citation testing against ChatGPT, Perplexity, and other AI answer engines isn’t built yet — flag if you want it scoped next.',
							'vulopilot'
						)}
					/>
				</CardComponent>
				<CardComponent
					title={__('Engine Testing', 'vulopilot')}
					titleIcon="intelligence"
					desc={__(
						'Re-verifies a previously-flagged finding against an AI answer engine once you’ve fixed it, instead of waiting for the next full scan.',
						'vulopilot'
					)}
					badges={[
						{ text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
					]}
					toggle
				>
					<ModuleGuardComponent
						icon="info"
						title={__('Not available yet', 'vulopilot')}
						desc={__(
							'Per-engine re-test tracking isn’t built yet — flag if you want it scoped next.',
							'vulopilot'
						)}
					/>
				</CardComponent>
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
