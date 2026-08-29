import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { NoticeComponent, ContainerComponent, ColumnComponent } from '@zyra/components';
import IssuesSection from './IssuesSection';
import { useGeoFindingGroups } from './useGeoFindingGroups';
import { useGeoTopicAffectedPages } from './useGeoTopicAffectedPages';
import GeoScoreSection from './GeoScoreSection';
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
			titleIcon: 'ai violet',
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
			titleIcon: 'question green',
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
			titleIcon: 'report rose',
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
			titleIcon: 'blocks lime',
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
			titleIcon: 'person yellow',
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
 * GEO = Generative Engine Optimization — how discoverable/citable this
 * site is to AI answer engines (distinct from classic search-engine SEO).
 * Reusing real data already fetched elsewhere on this tab rather than
 * duplicating it (direct instruction):
 *
 * 1. Two real info banners (static, honest explanatory copy).
 * 2. "GEO Score" (GeoScoreSection.tsx) — a real, free, deterministic
 *    scorecard (`GET /geo/score`/`GET /geo/progress`, Geo.php), matching a
 *    reference mockup's own 4-part layout: score ring + "how calculated"
 *    list, a real day-range trend, a real per-signal breakdown table, and
 *    Competitor Comparison (absorbed from this tab's own former standalone
 *    "How You Compare to Similar Sites" row — see GeoScoreSection.tsx's own
 *    docblock). Replaces `GeoVisibilitySummaryCard`'s former "Overall AI
 *    Visibility" slot here, whose own real number came from Pro-only routes
 *    and silently read `0/100 Poor` with vulopilot-pro inactive —
 *    `GeoVisibilitySummaryCard.tsx`/`useGeoVisibilitySnapshot.ts`/
 *    `GeoTrendCompactCard.tsx` are left in place, still real, valid code,
 *    just no longer rendered on this tab (see GeoScoreSection.tsx's own
 *    docblock for the full reasoning).
 * 3. "Fix These First" (GeoFixTheseFirstCard.tsx) and "Your Best & Worst
 *    Pages" (TopPagesCard.tsx) — removed from this tab per direct
 *    instruction (this tab has now gone back and forth on both a couple of
 *    times this session; this is the current, standing state). AeoTab.tsx
 *    used to render both too (its own "What Needs Your Attention" and "Top
 *    Pages by Answer Readiness" cards) — both since removed from there as
 *    well per direct instruction, so neither component is currently
 *    rendered anywhere; both are still real, just dead code for now.
 * 4. "A Closer Look, By Topic" (GeoByTopicGrid.tsx) — 5 tiles over the
 *    same `groups`/`GEO_TOPICS` the unified table below uses, so both
 *    always agree. Each tile also shows a real "Affected pages" stat
 *    (`useGeoTopicAffectedPages.ts`, a distinct-page count — deliberately
 *    NOT `groups`' own raw finding-row count, which can over-count a page
 *    hit by two scanners in the same topic) alongside "Open issues".
 * 5. "All GEO Issues" — `IssuesSection.tsx` (SeoTab.tsx's own real
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

	const allGeoScannerIds = GEO_TOPICS.flatMap((topic) => topic.scannerIds);
	const { affectedPagesByScanner, isLoading: isLoadingAffectedPages } =
		useGeoTopicAffectedPages(allGeoScannerIds);

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

			<GeoScoreSection />

			<ColumnComponent>
				<GeoByTopicGrid
					topics={GEO_TOPICS}
					groups={groups}
					isLoading={isLoadingGroups || isLoadingAffectedPages}
					affectedPagesByScanner={affectedPagesByScanner}
					onViewTopic={(key) => goToIssuesTable(key)}
				/>
			</ColumnComponent>
			<NoticeComponent
				displayPosition="inline-notice"
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
