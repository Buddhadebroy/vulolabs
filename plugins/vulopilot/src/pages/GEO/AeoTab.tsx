/* global vulopilotAppLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useModules } from '@zyra/core';
import { ColumnComponent, ContainerComponent } from '@zyra/components';
import AeoScoreSummaryCard from './AeoScoreSummaryCard';
import { computeTrendChange } from './geoTrendChange';
import AeoCitationCoverageCard from './AeoCitationCoverageCard';
import AeoEngineTestingCard from './AeoEngineTestingCard';
import IssuesSection from './IssuesSection';
import GeoAeoPageAnalysisPanel from './GeoAeoPageAnalysisPanel';
import {
	useAllFindingGroups,
	sumGroupCounts,
	useGeoVisibilitySnapshot,
	type GeoVisibilityHistoryRow,
} from './useGeoTabData';
import { useAeoPageAnalysis } from './useAeoPageAnalysis';

/**
 * Section → scanner_id grouping for AEO's 6 topics - every scanner_id is
 * a real, already-running scanner; no topic invents a signal. Some
 * scanners (e.g. `geo-chunking`/`geo-semantic-structure`,
 * `geo-summary-block`) are intentionally reused from GEO's own topic
 * groupings - a finding can legitimately show up under both tabs, since
 * each is its own complete lens over the same finding data, not a
 * disjoint partition of it.
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
		titleIcon: 'question blue',
		description: __(
			'Whether pages clearly answer the questions people are likely to ask, with a dedicated FAQ or Q&A block making that answer easy for AI to extract.',
			'vulopilot'
		),
		emptyMessage: __(
			'No question-coverage findings yet - run a scan to check for FAQ opportunities.',
			'vulopilot'
		),
		scannerIds: ['geo-faq-opportunity'],
	},
	{
		key: 'answers',
		title: __('Direct Answers', 'vulopilot'),
		titleIcon: 'analytics pink',
		description: __(
			'Whether pages have an extractable AI summary - a short, up-front answer an AI system can quote directly, rather than one buried in the middle of the content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No direct-answer findings yet - run a scan to check for AI summary blocks.',
			'vulopilot'
		),
		scannerIds: ['geo-summary-block'],
	},
	{
		key: 'schema',
		title: __('Schema Markup', 'vulopilot'),
		titleIcon: 'shortcode teal',
		description: __(
			'Content already shaped like an FAQ or a how-to guide, but missing the schema.org markup that lets AI answer engines recognize it as one.',
			'vulopilot'
		),
		emptyMessage: __(
			'No schema findings yet - run a scan to check FAQ/HowTo-shaped content for missing markup.',
			'vulopilot'
		),
		scannerIds: ['aeo-schema'],
	},
];

/** Exported so KeyPagesWidget.tsx's own Dashboard-tab "Issues at a glance" row can count real open AEO findings the same way this tab itself does, rather than duplicating this scanner-id union a 2nd time. */
export const ALL_AEO_SCANNER_IDS = AEO_SECTIONS.flatMap((section) => section.scannerIds);

const average = (values: number[]): number =>
	values.length
		? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length)
		: 0;

/**
 * The same 3-dimension average the "AEO Score" ring computes for "today"
 * (`answer_first_structure`/`question_coverage`/`citation_readiness`),
 * applied to one historical `history` row - passed as
 * `computeTrendChange()`'s `getScore` param so "AEO Score Over Time"
 * trends this scoped average, not sitewide `overall_score`. Null means
 * no sample that day (same meaning `overall_score: null` carries).
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
 * Whether GeoInsights' Rest.php class is registered - either
 * 'geo-insights' or 'aeo-insights' being active is enough, since both
 * register that class. Gates the AI-call buttons in
 * AeoCitationCoverageCard.tsx/AeoEngineTestingCard.tsx.
 *
 * Reads zyra's `useModules()` store, not `vulopilotAppLocalizer.active_modules`
 * directly - that global is a static snapshot from initial page load, so
 * toggling a module in Settings → Modules wouldn't be reflected here
 * without a full refresh.
 */
const isCitationCheckActive = (modules: string[]): boolean =>
	Boolean(vulopilotAppLocalizer.khali_dabba) &&
	(modules.includes('geo-analysis') || modules.includes('answer-engine-optimization'));

/**
 * AEO = Answer Engine Optimization - whether AI systems can extract,
 * structure, and cite a direct answer from this site's pages (distinct
 * from GEO's broader "can an AI understand this page at all" scope, and
 * from classic search-engine SEO). Reuses real data/components already
 * built for GEO/this tab rather than duplicating them:
 */
const AeoTab = () => {
	const [categoryFocus, setCategoryFocus] = useState<{
		key: string;
		token: number;
	} | null>(null);
	/** Set by a real "Analyze" click in the "Pages & Posts" table below - opens `GeoAeoPageAnalysisPanel` as a real sidebar, same real "Analyze"/"Viewing" toggle + side panel SeoTab.tsx's own SEO table already has (see that panel's own docblock for why it shows real findings instead of a fabricated pass/fail checklist). */
	const [analyzingPostId, setAnalyzingPostId] = useState<number | null>(null);
	const { modules } = useModules();
	const { groups, isLoading: isLoadingGroups } = useAllFindingGroups();
	const { history, isLoading: isLoadingSnapshot } = useGeoVisibilitySnapshot();
	const { pages: aeoPages, total: totalPages, isLoading: isLoadingPages } =
		useAeoPageAnalysis(ALL_AEO_SCANNER_IDS);

	// "Questions Answered" - real published pages minus the real count of
	// pages with an open geo-faq-opportunity finding (i.e. pages that
	// already have adequate question coverage). Reuses the same `groups`
	// fetch above rather than a second request just for this one number.
	const openFaqFindings = sumGroupCounts(groups, ['geo-faq-opportunity']);
	const questionsAnswered = totalPages
		? Math.max(0, totalPages - openFaqFindings)
		: 0;

	// "Pages Ready" - real published pages with zero open AEO findings
	// (across all 6 topics above), out of the real total. `aeoPages` is
	// the same real `/geo-analysis/pages` dataset GeoPageAnalysisTable
	// below independently re-fetches paginated - see useAeoPageAnalysis.ts's
	// own docblock for why this is a second real request rather than a
	// shared one.
	const pagesReady = aeoPages.filter((page) => 0 === page.open_findings).length;

	/**
	 * Sets a fresh `categoryFocus` (a new `token` even for the same `key`
	 * twice in a row) - `IssuesSection.tsx`'s own effect both switches its
	 * active filter to that category (or resets to unfiltered for the
	 * literal `'all'`) and scrolls itself into view, so this doesn't also
	 * need its own `scrollToId()` call the way the old `SectionedFindingsTab`-based
	 * version did (that component had no such self-scrolling behavior).
	 */
	const goToIssuesTable = (key: string = 'all') => {
		setCategoryFocus({ key, token: Date.now() });
	};

	const aeoTrend = computeTrendChange(history, getAeoTrendScore);

	return (
		<ContainerComponent>
			<ColumnComponent grid={6}>
				<AeoScoreSummaryCard
					isLoading={isLoadingSnapshot || isLoadingGroups || isLoadingPages}
					questionsAnswered={questionsAnswered}
					totalPages={totalPages}
					pagesReady={pagesReady}
					trend={aeoTrend}
					topics={AEO_SECTIONS}
					groups={groups}
					onSelectTopic={goToIssuesTable}
				/>
			</ColumnComponent>
			<AeoCitationCoverageCard isActive={isCitationCheckActive(modules)} />
			<AeoEngineTestingCard isActive={isCitationCheckActive(modules)} pages={aeoPages} />
	

			{/* Same real "filter pills + Site-wide Issues + Pages & Posts" structure SeoTab.tsx's own issues table already has (IssuesSection.tsx, generalized from what used to be SEO-only) - replaces the differently-shaped SectionedFindingsTab this used before, per direct instruction. `pageAnalysis` merges the former standalone "Page-by-Page Answer Readiness" table into the "Pages & Posts" table below. */}
			<ColumnComponent grid={8}>
				<IssuesSection
					id="aeo-all-issues-table"
					title={__('All AEO Findings', 'vulopilot')}
					scannerIds={ALL_AEO_SCANNER_IDS}
					categories={AEO_SECTIONS}
					categoryFocus={categoryFocus}
					issuesColumnLabel={__('AEO Issues', 'vulopilot')}
					pageAnalysis={{
						scoreColumnLabel: __('Answer Readiness', 'vulopilot'),
						exportFilename: 'aeo-page-analysis.csv',
					}}
					onAnalyze={setAnalyzingPostId}
					activePostId={analyzingPostId}
				/>
			</ColumnComponent>
			{analyzingPostId && (
				<ColumnComponent grid={4}>
					<GeoAeoPageAnalysisPanel
						postId={analyzingPostId}
						scannerIds={ALL_AEO_SCANNER_IDS}
						title={__('Page Analysis', 'vulopilot')}
						desc={__(
							'A single page’s real AEO signals from your most recent scan.',
							'vulopilot'
						)}
						onClose={() => setAnalyzingPostId(null)}
					/>
				</ColumnComponent>
			)}
		</ContainerComponent>
	);
};

export default AeoTab;
