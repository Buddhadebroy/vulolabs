/* global appLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ContainerComponent, NoticeComponent } from '@zyra/components';
import { scrollToId } from '@zyra/core';
import TopPagesCard from './TopPagesCard';
import { useFilterSlot } from '../../services/useFilterSlot';
import SectionedFindingsTab from '../Security/SectionedFindingsTab';
import type { FindingsSection } from '../Security/SectionedFindingsTab';
import type { SectionedIssuesTab } from '../Security/SectionedIssuesTable';
import ProLockedCard from '../../components/ProLockedCard';
import { useGeoFindingGroups, sumGroupCounts } from './useGeoFindingGroups';
import { useGeoVisibilitySnapshot } from './useGeoVisibilitySnapshot';
import GeoVisibilityOverviewRow from './GeoVisibilityOverviewRow';
import GeoFixTheseFirstCard from './GeoFixTheseFirstCard';
import GeoTrendCompactCard from './GeoTrendCompactCard';
import GeoByTopicGrid from './GeoByTopicGrid';
import GeoPageAnalysisTable from './GeoPageAnalysisTable';

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
 * Rebuilt to match the reference mockup's own information architecture,
 * top to bottom, reusing real data already fetched elsewhere on this tab
 * rather than duplicating it (direct instruction):
 *
 * 1. Two real info banners (static, honest explanatory copy).
 * 2. "Overall AI Visibility" + "The 4 things AI checks for"
 *    (GeoVisibilityOverviewRow.tsx, Pro-gated) — real
 *    `useGeoVisibilitySnapshot()` data, `totalOpenFindings` passed in from
 *    the same `groups` fetch "Fix These First"/"By Topic" already use.
 * 3. "Fix These First" (GeoFixTheseFirstCard.tsx) + "Your Best & Worst
 *    Pages" (TopPagesCard.tsx, restyled) side by side.
 * 4. "Are You Getting Easier to Find?" (GeoTrendCompactCard.tsx, Pro-gated)
 *    + "How You Compare to Similar Sites" (Pro's own
 *    CompetitorVisibilityCard, given this site's own real score as
 *    `yourScore`) side by side.
 * 5. "A Closer Look, By Topic" (GeoByTopicGrid.tsx) — 5 tiles over the
 *    same `groups`/`GEO_TOPICS` the unified table below uses, so both
 *    always agree.
 * 6. "Page-by-page analysis" (GeoPageAnalysisTable.tsx) — every page, a
 *    real deterministic visibility % (GeoAnalyzer::score_from_failures()),
 *    Export CSV.
 * 7. "All GEO Issues" — the same real, unified findings table
 *    (SectionedFindingsTab.tsx) already built for this tab, kept as-is and
 *    relocated to the bottom rather than duplicated with a second table.
 */
const GeoTab = () => {
	const [activeTab, setActiveTab] = useState<SectionedIssuesTab>('all');
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

	const geoTopicSections: FindingsSection[] = GEO_TOPICS.map((topic) => ({
		key: topic.key,
		title: topic.title,
		description: topic.description,
		emptyMessage: topic.emptyMessage,
		scannerIds: topic.scannerIds,
	}));

	const allGeoScannerIds = GEO_TOPICS.flatMap((topic) => topic.scannerIds);
	const totalOpenFindings = sumGroupCounts(groups, allGeoScannerIds);

	const withScore = history.filter((row) => null !== row.overall_score);
	const yourScore = withScore.length
		? withScore[withScore.length - 1].overall_score
		: null;

	const goToIssuesTable = (tab: SectionedIssuesTab = 'all') => {
		setActiveTab(tab);
		setTimeout(() => scrollToId('geo-all-issues-table'), 50);
	};

	return (
		<>
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

			<GeoVisibilityOverviewRow
				snapshot={snapshot}
				history={history}
				isLoading={isLoadingSnapshot}
				totalOpenFindings={totalOpenFindings}
			/>

			<ContainerComponent>
				<GeoFixTheseFirstCard
					groups={groups}
					isLoading={isLoadingGroups}
					total={totalOpenFindings}
					onViewAll={() => goToIssuesTable('all')}
					onSelectScanner={(scannerId) => {
						const topic = GEO_TOPICS.find((t) =>
							t.scannerIds.includes(scannerId)
						);
						goToIssuesTable(topic?.key ?? 'all');
					}}
				/>
				<TopPagesCard onViewAll={() => scrollToId('geo-page-analysis')} />
			</ContainerComponent>

			<ContainerComponent>
				<GeoTrendCompactCard
					history={history}
					isLoading={isLoadingSnapshot}
					isGeoInsightsActive={isGeoInsightsActive()}
				/>
				{isGeoInsightsActive() && GeoCompetitorVisibility ? (
					<GeoCompetitorVisibility yourScore={yourScore} />
				) : (
					<CardComponent title={__('How You Compare to Similar Sites', 'vulopilot')}>
						<ProLockedCard moduleName="geo-insights" />
					</CardComponent>
				)}
			</ContainerComponent>

			<NoticeComponent
				// type="banner"
				displayPosition="inline"
				message={__(
					'This page shows how easy it is for AI tools to find, understand, and recommend your website. Fixing the issues above helps you show up when people ask AI a question you could answer.',
					'vulopilot'
				)}
			/>

			<GeoByTopicGrid
				topics={GEO_TOPICS}
				groups={groups}
				isLoading={isLoadingGroups}
				onViewTopic={(key) => goToIssuesTable(key)}
			/>

			<div id="geo-page-analysis">
				<GeoPageAnalysisTable />
			</div>

			<div id="geo-all-issues-table">
				<SectionedFindingsTab
					title={__('All GEO Issues', 'vulopilot')}
					sections={geoTopicSections}
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>
			</div>
		</>
	);
};

export default GeoTab;
