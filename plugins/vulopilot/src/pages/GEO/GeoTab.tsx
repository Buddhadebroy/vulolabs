/* global appLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ColumnComponent, NoticeComponent, ContainerComponent } from '@zyra/components';
import { useFilterSlot } from '../../services/useFilterSlot';
import IssuesSection from './IssuesSection';
import ProLockedCard from '../../components/ProLockedCard';
import { useGeoFindingGroups, sumGroupCounts } from './useGeoFindingGroups';
import { useGeoTopicAffectedPages } from './useGeoTopicAffectedPages';
import { useGeoVisibilitySnapshot } from './useGeoVisibilitySnapshot';
import GeoVisibilitySummaryCard from './GeoVisibilitySummaryCard';
import GeoByTopicGrid from './GeoByTopicGrid';

/**
 * Which GEO_SECTIONS/GEO_TOPICS card each scanner's findings live under.
 * "AI Summary" and "FAQ-style Questions" are now their own separate
 * topics (previously one combined "summary" section) to match the
 * reference mockup's own 5-tile "By Topic" grid exactly (direct
 * instruction) — "Crawlability"/"Freshness" (the 2 scanners that only
 * exist while GeoInsights Pro is active) fold into a catch-all "Other
 * Signals" topic alongside the always-free entity/trust scanners, rather
 * than keeping their own dedicated, explicitly-locked section as the
 * previous 6-section grouping did. That's a deliberate trade for matching
 * the mockup's exact 5 topics: "Other Signals" is never marked `locked`
 * (it has real, always-free scanner ids in it too), so it no longer shows
 * an explicit "Unlock with Pro" card the way the old dedicated
 * Crawlability/Freshness sections did — those 2 scanners' findings simply
 * won't exist yet (contributing nothing to the real count) on a site
 * without GeoInsights active, same as any other not-yet-scanned signal.
 */
const GEO_TOPICS: {
	key: string;
	title: string;
	titleIcon: string;
	description: string;
	emptyMessage: string;
	scannerIds: string[];
}[] = [
	{
		key: 'ai-summary',
		title: __('AI Summary', 'vulopilot'),
		titleIcon: 'ai',
		description: __(
			'Whether pages have an extractable AI summary block an AI system can lift directly.',
			'vulopilot'
		),
		emptyMessage: __(
			'No AI summary findings yet — run a scan to check for summary blocks.',
			'vulopilot'
		),
		scannerIds: ['geo-summary-block'],
	},
	{
		key: 'faq-questions',
		title: __('FAQ-style Questions', 'vulopilot'),
		titleIcon: 'question',
		description: __(
			'Commonly-asked questions a page plausibly answers, but with no FAQ or Q&A block making that answer easy to extract.',
			'vulopilot'
		),
		emptyMessage: __(
			'No question-coverage findings yet — run a scan to check for FAQ opportunities.',
			'vulopilot'
		),
		scannerIds: ['geo-faq-opportunity'],
	},
	{
		key: 'evidence-citations',
		title: __('Evidence & Citations', 'vulopilot'),
		titleIcon: 'report',
		description: __(
			'Statistic-shaped claims with no citation or outbound link backing them up.',
			'vulopilot'
		),
		emptyMessage: __(
			'No evidence findings yet — run a scan to check for uncited claims.',
			'vulopilot'
		),
		scannerIds: ['geo-citation-opportunities'],
	},
	{
		key: 'ai-readable-structure',
		title: __('AI-Readable Structure', 'vulopilot'),
		titleIcon: 'blocks',
		description: __(
			'Paragraph length and heading hierarchy — how easily an AI system can extract a clean chunk of this content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No structure findings yet — run a scan to check paragraph length and heading hierarchy.',
			'vulopilot'
		),
		scannerIds: ['geo-chunking', 'geo-semantic-structure'],
	},
	{
		key: 'other-signals',
		title: __('Other Signals', 'vulopilot'),
		titleIcon: 'person',
		description: __(
			'Author credentials, naming consistency, trust pages, llms.txt, and content freshness.',
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

/**
 * Same `active_modules` gate CrawlerTraffic.tsx's isSeoModuleActive() /
 * BrandVisibility.tsx / KnowledgeGraph.tsx already use for their own
 * Pro-module-gated cards — 'geo-insights' is GeoInsights' folder name
 * kebab-cased (Modules.php::camel_to_kebab()).
 */
const isGeoInsightsActive = () =>
	appLocalizer.active_modules?.includes('geo-insights') ?? false;

/**
 * GEO = Generative Engine Optimization — how discoverable/citable this
 * site is to AI answer engines (distinct from classic search-engine SEO).
 * Reusing real data already fetched elsewhere on this tab rather than
 * duplicating it (direct instruction):
 *
 * 1. Two real info banners (static, honest explanatory copy).
 * 2. "Overall AI Visibility" (GeoVisibilitySummaryCard.tsx, Pro-gated) — one
 *    merged card, gauge-left/stat-rows-right same shape AeoTab.tsx's own
 *    "AEO Score" card uses, per direct instruction ("merge this sections
 *    and design like attached image" — that attached reference *is* the
 *    AEO Score card). Combines what used to be 2 separate full-width rows:
 *    GeoVisibilityOverviewRow.tsx's own "Overall AI Visibility" gauge + "The
 *    4 things AI checks for" grid, and GeoTrendCompactCard.tsx's own "Are
 *    You Getting Easier to Find?" sparkline card — see
 *    GeoVisibilitySummaryCard.tsx's own docblock for exactly which real
 *    number came from which. `snapshot`/`history` are the same real
 *    `useGeoVisibilitySnapshot()` data both former cards already used;
 *    `totalOpenFindings` is the same real total from the shared `groups`
 *    fetch "By Topic" below already uses. GeoVisibilityOverviewRow.tsx was
 *    deleted (fully superseded); GeoTrendCompactCard.tsx's own default
 *    component is still real code, just no longer rendered here — see its
 *    own docblock.
 * 3. "Fix These First" (GeoFixTheseFirstCard.tsx) and "Your Best & Worst
 *    Pages" (TopPagesCard.tsx) — removed from this tab per direct
 *    instruction (this tab has now gone back and forth on both a couple of
 *    times this session; this is the current, standing state). AeoTab.tsx
 *    used to render both too (its own "What Needs Your Attention" and "Top
 *    Pages by Answer Readiness" cards) — both since removed from there as
 *    well per direct instruction, so neither component is currently
 *    rendered anywhere; both are still real, just dead code for now.
 * 4. "How You Compare to Similar Sites" (Pro's own CompetitorVisibilityCard,
 *    given this site's own real score as `yourScore`) is its own
 *    full-width row.
 * 5. "A Closer Look, By Topic" (GeoByTopicGrid.tsx) — 5 tiles over the
 *    same `groups`/`GEO_TOPICS` the unified table below uses, so both
 *    always agree. Each tile also shows a real "Affected pages" stat
 *    (`useGeoTopicAffectedPages.ts`, a distinct-page count — deliberately
 *    NOT `groups`' own raw finding-row count, which can over-count a page
 *    hit by two scanners in the same topic) alongside "Open issues".
 * 6. "All GEO Issues" — `IssuesSection.tsx` (SeoTab.tsx's own real
 *    Site-wide Issues + Pages & Posts structure, generalized so this tab
 *    and AeoTab.tsx can reuse it too), kept at the bottom same as before.
 *    Its own filter bar is a real `TabsComponent` All/Important/per-category
 *    row + `IssuesSummaryCards.tsx`'s own priority stat cards, matching
 *    `SectionedIssuesTable.tsx`'s established real filter bar — see that
 *    component's own docblock for why. Its own `pageAnalysis` prop merges
 *    what used to be a separate standalone "Page-by-page analysis" table
 *    directly into the "Pages & Posts" table here.
 */
const GeoTab = () => {
	const [categoryFocus, setCategoryFocus] = useState<{
		key: string;
		token: number;
	} | null>(null);
	const { groups, isLoading: isLoadingGroups } = useGeoFindingGroups();
	const { snapshot, history, isLoading: isLoadingSnapshot } =
		useGeoVisibilitySnapshot();

	/**
	 * Competitor Visibility is vulopilot-pro's own GeoInsights slot —
	 * `useFilterSlot()` returns the component itself, so `yourScore` can be
	 * passed straight through as a normal prop (see that component's own
	 * docblock for why).
	 */
	const GeoCompetitorVisibility = useFilterSlot<
		(props: { yourScore?: number | null }) => JSX.Element
	>('vulopilot_geo_competitor_visibility');

	const allGeoScannerIds = GEO_TOPICS.flatMap((topic) => topic.scannerIds);
	const totalOpenFindings = sumGroupCounts(groups, allGeoScannerIds);
	const { affectedPagesByScanner, isLoading: isLoadingAffectedPages } =
		useGeoTopicAffectedPages(allGeoScannerIds);

	const withScore = history.filter((row) => null !== row.overall_score);
	const yourScore = withScore.length
		? withScore[withScore.length - 1].overall_score
		: null;

	/**
	 * Sets a fresh `categoryFocus` (a new `token` even for the same `key`
	 * twice in a row) — `IssuesSection.tsx`'s own effect both switches its
	 * active filter to that topic (or resets to unfiltered for the literal
	 * `'all'`) and scrolls itself into view, so this doesn't also need its
	 * own `scrollToId()` call the way the old `SectionedFindingsTab`-based
	 * version did.
	 */
	const goToIssuesTable = (key: string = 'all') => {
		setCategoryFocus({ key, token: Date.now() });
	};

	return (
		<ContainerComponent>
			{/* id kept on this wrapper, not NoticeComponent itself (no id prop) — real jump target for the bottom info banner's own "Learn more about this page" link, same real-anchor technique the top-of-page tab bar itself already relies on for in-page navigation. */}
			<div id="geo-top-banner">
				<NoticeComponent
					// type="banner"
					displayPosition="inline"
					message={sprintf(
						'<strong>%1$s</strong> %2$s',
						__('In plain English:', 'vulopilot'),
						__(
							'When someone asks ChatGPT, Gemini, or Google’s AI a question your site could answer, you’ll be more likely to get found and recommended.',
							'vulopilot'
						)
					)}
				/>
			</div>

			{/*
			 * `ColumnComponent grid={12}` alone, deliberately NOT also wrapped
			 * in a `<ContainerComponent>` — same real, confirmed-live layout
			 * bug the removed "Are You Getting Easier to Find?" row used to
			 * document here (ContainerComponent's own `.container-wrapper`
			 * has no sizing of its own, so a single-child ColumnComponent
			 * nested inside one just shrinks to its own content's natural
			 * width instead of the true available row width).
			 */}
			<ColumnComponent grid={12}>
				<GeoVisibilitySummaryCard
					snapshot={snapshot}
					history={history}
					isLoading={isLoadingSnapshot}
					totalOpenFindings={totalOpenFindings}
				/>
			</ColumnComponent>

			<GeoByTopicGrid
				topics={GEO_TOPICS}
				groups={groups}
				isLoading={isLoadingGroups || isLoadingAffectedPages}
				affectedPagesByScanner={affectedPagesByScanner}
				onViewTopic={(key) => goToIssuesTable(key)}
			/>

			<ColumnComponent grid={12}>
				{isGeoInsightsActive() && GeoCompetitorVisibility ? (
					<GeoCompetitorVisibility yourScore={yourScore} />
				) : (
					<CardComponent title={__('How You Compare to Similar Sites', 'vulopilot')}>
						<ProLockedCard moduleName="geo-insights" />
					</CardComponent>
				)}
			</ColumnComponent>

			<NoticeComponent
				// type="banner"
				displayPosition="inline"
				message={sprintf(
					'%1$s <a href="#geo-top-banner">%2$s ›</a>',
					__(
						'This page shows how easy it is for AI tools to find, understand, and recommend your website. Fixing the issues above helps you show up when people ask AI a question you could answer.',
						'vulopilot'
					),
					__('Learn more about this page', 'vulopilot')
				)}
			/>

			<IssuesSection
				id="geo-all-issues-table"
				scannerIds={allGeoScannerIds}
				categories={GEO_TOPICS}
				categoryFocus={categoryFocus}
				issuesColumnLabel={__('GEO Issues', 'vulopilot')}
				pageAnalysis={{
					scoreColumnLabel: __('AI Visibility', 'vulopilot'),
					exportFilename: 'geo-page-analysis.csv',
				}}
			/>
		</ContainerComponent>
	);
};

export default GeoTab;
