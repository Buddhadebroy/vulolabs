/* global appLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import SectionedFindingsTab from '../Security/SectionedFindingsTab';
import type { FindingsSection } from '../Security/SectionedFindingsTab';
import type { SectionedIssuesTab } from '../Security/SectionedIssuesTable';
import ProLockedCard from '../../components/ProLockedCard';
import AiCopilotGuard from '../../components/AiCopilotGuard';
import GeoFixTheseFirstCard from './GeoFixTheseFirstCard';
import GeoByTopicGrid from './GeoByTopicGrid';
import TopPagesCard from './TopPagesCard';
import GeoPageAnalysisTable from './GeoPageAnalysisTable';
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
	proModule?: string;
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

/**
 * Same `active_modules` gate GeoTab.tsx's own isGeoInsightsActive() uses —
 * 'geo-insights' is GeoInsights' folder name kebab-cased
 * (Modules.php::camel_to_kebab()).
 */
const isGeoInsightsActive = () =>
	appLocalizer.active_modules?.includes('geo-insights') ?? false;

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
 * 3. "What Needs Your Attention" (GeoFixTheseFirstCard.tsx, unchanged,
 *    already includes a real "Ask AI Copilot" banner) + "Top pages by
 *    answer readiness" (TopPagesCard.tsx, NEW here — genericized this
 *    session so it can be scoped to AEO's own scanner ids instead of
 *    GEO's `category=geo` default) side by side, same layout GeoTab.tsx's
 *    own "Fix These First"/"Your Best & Worst Pages" pairing already
 *    uses.
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
 * 7. "Page-by-page answer readiness" (GeoPageAnalysisTable.tsx, NEW here —
 *    genericized this session the same way TopPagesCard.tsx was) — every
 *    page, a real deterministic answer-readiness % scoped to AEO's own
 *    scanner ids, Export CSV.
 * 8. "All AEO Issues" — the same real, unified findings table
 *    (SectionedFindingsTab.tsx) with the same 3 honestly-not-built-yet
 *    cards this tab already had, kept at the bottom.
 */
const AeoTab = () => {
	const [activeTab, setActiveTab] = useState<SectionedIssuesTab>('all');
	const { groups, isLoading: isLoadingGroups } = useAllFindingGroups();
	const { snapshot, isLoading: isLoadingSnapshot } = useGeoVisibilitySnapshot();
	const { pages: aeoPages, total: totalPages, isLoading: isLoadingPages } =
		useAeoPageAnalysis(ALL_AEO_SCANNER_IDS);

	const aeoSections: FindingsSection[] = AEO_SECTIONS.map((section) => ({
		key: section.key,
		title: section.title,
		description: section.description,
		emptyMessage: section.emptyMessage,
		scannerIds: section.scannerIds,
		proModule: section.proModule,
		locked: Boolean(section.proModule) && !isGeoInsightsActive(),
	}));

	const totalOpenFindings = sumGroupCounts(groups, ALL_AEO_SCANNER_IDS);
	// GeoFixTheseFirstCard (reused generically, see its own docblock) sorts
	// and shows whatever `groups` it's given as-is — it doesn't filter by
	// scanner id itself, since GeoTab.tsx's own usage already passes a
	// category-scoped fetch. useAllFindingGroups() here deliberately fetches
	// every category (aeo-schema/llms-txt-missing don't share GEO's own
	// 'geo' category — see this file's own useAllFindingGroups.ts docblock),
	// so it has to be narrowed to just this tab's own real scanner ids before
	// handing it to a "top findings" card, or "What Needs Your Attention"
	// would show the single worst finding sitewide (e.g. a Security
	// finding) instead of an AEO one.
	const aeoGroups = groups.filter((group) =>
		ALL_AEO_SCANNER_IDS.includes(group.scanner_id)
	);

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

	const scrollToId = (id: string) => {
		const el = document.getElementById(id);
		if (!el) {
			return;
		}
		el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		el.classList.add('vulopilot-glimpse-highlight');
		setTimeout(() => el.classList.remove('vulopilot-glimpse-highlight'), 1200);
	};

	const goToIssuesTable = (tab: SectionedIssuesTab = 'all') => {
		setActiveTab(tab);
		setTimeout(() => scrollToId('aeo-all-issues-table'), 50);
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
			<div id="aeo-top-banner" className="geo-info-banner">
				<i className="adminfont-info" />
				<span>
					<strong>{__('In plain English:', 'vulopilot')}</strong>{' '}
					{__(
						'When someone asks ChatGPT, Perplexity, or Google’s AI a question your page could answer, this checks whether your content is written so AI can actually quote it directly.',
						'vulopilot'
					)}
				</span>
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

			<ContainerComponent>
				<GeoFixTheseFirstCard
					groups={aeoGroups}
					isLoading={isLoadingGroups}
					total={totalOpenFindings}
					title={__('What Needs Your Attention', 'vulopilot')}
					emptyMessage={__(
						'No open AEO findings right now — nothing to fix.',
						'vulopilot'
					)}
					onViewAll={() => goToIssuesTable('all')}
					onSelectScanner={(scannerId) => {
						const section = AEO_SECTIONS.find((s) =>
							s.scannerIds.includes(scannerId)
						);
						goToIssuesTable(section?.key ?? 'all');
					}}
				/>
				<TopPagesCard
					scannerIds={ALL_AEO_SCANNER_IDS}
					title={__('Top Pages by Answer Readiness', 'vulopilot')}
					desc={__(
						'Which pages an AI answer engine could already quote, and which need the most work.',
						'vulopilot'
					)}
					topLabel={__('Most ready', 'vulopilot')}
					bottomLabel={__('Needs attention', 'vulopilot')}
					id="aeo-top-pages"
					onViewAll={() => scrollToId('aeo-page-analysis')}
				/>
			</ContainerComponent>

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
							onButtonClick={() => scrollToId('aeo-page-analysis')}
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
								<p className="aeo-help-tile-title">
									{__('Ask AI Copilot', 'vulopilot')}
								</p>
								<p className="aeo-help-tile-desc">
									{__(
										'Get real suggestions for improving your answer readiness.',
										'vulopilot'
									)}
								</p>
							</div>
						</a>
					</AiCopilotGuard>
					<button
						type="button"
						className="aeo-help-tile"
						onClick={() => goToIssuesTable('all')}
					>
						<i className="adminfont-yes-alt" />
						<div>
							<p className="aeo-help-tile-title">
								{__('Fix Automatically', 'vulopilot')}
							</p>
							<p className="aeo-help-tile-desc">
								{__(
									'Jump to the issues table below to fix findings one by one or in bulk.',
									'vulopilot'
								)}
							</p>
						</div>
					</button>
					<button
						type="button"
						className="aeo-help-tile"
						onClick={() => scrollToId('aeo-top-banner')}
					>
						<i className="adminfont-info" />
						<div>
							<p className="aeo-help-tile-title">{__('Learn More', 'vulopilot')}</p>
							<p className="aeo-help-tile-desc">
								{__(
									'Understand how AEO helps AI answer engines find and quote your content.',
									'vulopilot'
								)}
							</p>
						</div>
					</button>
				</div>
			</div>

			<div className="geo-info-banner">
				<i className="adminfont-info" />
				<span>
					{__(
						'AEO helps answer engines find clear, accurate answers on your website. Better answers means more visibility in AI-generated results.',
						'vulopilot'
					)}
				</span>
			</div>

			<div id="aeo-page-analysis">
				<GeoPageAnalysisTable
					scannerIds={ALL_AEO_SCANNER_IDS}
					title={__('Page-by-Page Answer Readiness', 'vulopilot')}
					scoreColumnLabel={__('Answer Readiness', 'vulopilot')}
					exportFilename="aeo-page-analysis.csv"
					id="aeo-page-analysis-table"
				/>
			</div>

			<div id="aeo-all-issues-table">
				<SectionedFindingsTab
					title={__('All AEO Issues', 'vulopilot')}
					sections={aeoSections}
					activeTab={activeTab}
					onTabChange={setActiveTab}
					header={
						<>
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
						</>
					}
				/>
			</div>
		</>
	);
};

export default AeoTab;
