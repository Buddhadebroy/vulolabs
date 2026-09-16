import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { NoticeComponent, ContainerComponent, ColumnComponent } from '@zyra/components';
import IssuesSection from './IssuesSection';
import GeoAeoPageAnalysisPanel from './GeoAeoPageAnalysisPanel';
import GeoScoreSection from './GeoScoreSection';

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
 *    and silently read `0/100 Poor` with vulopilot-pro inactive.
 *    `GeoVisibilitySummaryCard.tsx` and `TopPagesCard.tsx` (this tab's own
 *    former "Your Best & Worst Pages") used to be kept in place as
 *    unrendered-but-real dead code once removed from this tab; both were
 *    later actually deleted in a file-count reduction pass, confirmed
 *    to have zero remaining consumers anywhere in the codebase first
 *    (`useGeoVisibilitySnapshot`/`useGeoFindingGroups`/etc. live on in
 *    `useGeoTabData.ts`, still in active use — only the dead components
 *    themselves are gone). `GeoTrendCompactCard.tsx`'s own dead component
 *    was trimmed the same way; its still-used `computeTrendChange()`
 *    export moved to `geoTrendChange.ts`.
 * 3. "Fix These First" (GeoFixTheseFirstCard.tsx) — removed from this tab's
 *    render per direct instruction (this tab has now gone back and forth on
 *    this a couple of times this session; this is the current, standing
 *    state), but the component itself is still real, active code —
 *    OverviewTab.tsx renders it. AeoTab.tsx used to render its own "What
 *    Needs Your Attention"/"Top Pages by Answer Readiness" cards too — both
 *    since removed from there as well per direct instruction; those two
 *    specific components had no other consumer anywhere, so — unlike
 *    GeoFixTheseFirstCard.tsx — they were deleted rather than kept dead.
 * 4. "A Closer Look, By Topic" (GeoByTopicGrid.tsx) — not currently
 *    rendered on this tab, same standing state as item 3's two cards; its
 *    own supporting `useGeoFindingGroups()`/`useGeoTopicAffectedPages()`
 *    calls were removed from here too (a real, live fetch whose result was
 *    otherwise discarded on every page load) rather than kept computing
 *    for nothing. The component itself is unchanged and still real —
 *    5 tiles over the same `groups`/`GEO_TOPICS` the unified table below
 *    uses, each also showing a real "Affected pages" distinct-page-count
 *    stat (deliberately NOT `groups`' own raw finding-row count, which can
 *    over-count a page hit by two scanners in the same topic) alongside
 *    "Open issues" — just needs both hooks called again if it's ever
 *    reintroduced here.
 * 5. "All GEO Findings" — `IssuesSection.tsx` (SeoTab.tsx's own real
 *    Site-wide Issues + Pages & Posts structure, generalized so this tab
 *    and AeoTab.tsx can reuse it too), kept at the bottom same as before.
 *    `title`/`desc`/`titleIcon` are overridden here (this tab's own real GEO
 *    findings, not `IssuesSection.tsx`'s own SEO-flavored defaults, which
 *    this tab was silently showing verbatim — "All SEO Findings"/"Every open
 *    SEO finding…"/the `search` icon — until this pass; `titleIcon="tools"`
 *    specifically matches the real icon every other card on this same tab
 *    already uses, GeoScoreSection.tsx's own "GEO Score"/"Score Snapshot"/
 *    "Competitor Comparison"). Its own filter bar is a real
 *    `TabsComponent` All/Important/per-category row +
 *    `IssuesSummaryCards.tsx`'s own priority stat cards, matching
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

	const allGeoScannerIds = GEO_TOPICS.flatMap((topic) => topic.scannerIds);

	/** Set by a real "Analyze" click in the "Pages & Posts" table below — opens `GeoAeoPageAnalysisPanel` as a real sidebar, same real "Analyze"/"Viewing" toggle + side panel SeoTab.tsx's own SEO table already has (see that panel's own docblock for why it shows real findings instead of a fabricated pass/fail checklist). */
	const [analyzingPostId, setAnalyzingPostId] = useState<number | null>(null);

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
			<GeoScoreSection onSelectSignal={goToIssuesTable} />
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

			<ColumnComponent grid={8}>
				<IssuesSection
					id="geo-all-issues-table"
					scannerIds={allGeoScannerIds}
					categories={GEO_TOPICS}
					categoryFocus={categoryFocus}
					title={__('All GEO Findings', 'vulopilot')}
					titleIcon="tools"
					desc={__('Every open GEO finding, filterable by priority.', 'vulopilot')}
					issuesColumnLabel={__('GEO Issues', 'vulopilot')}
					pageAnalysis={{
						scoreColumnLabel: __('AI Visibility', 'vulopilot'),
						exportFilename: 'geo-page-analysis.csv',
					}}
					onAnalyze={setAnalyzingPostId}
					activePostId={analyzingPostId}
				/>
			</ColumnComponent>
			{analyzingPostId && (
				<ColumnComponent grid={4}>
					<GeoAeoPageAnalysisPanel
						postId={analyzingPostId}
						scannerIds={allGeoScannerIds}
						title={__('Page Analysis', 'vulopilot')}
						desc={__(
							'A single page’s real GEO signals from your most recent scan.',
							'vulopilot'
						)}
						onClose={() => setAnalyzingPostId(null)}
					/>
				</ColumnComponent>
			)}
		</ContainerComponent>
	);
};

export default GeoTab;
