/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	NavigatorHeaderComponent,
} from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';
import TopPagesCard from './TopPagesCard';
import OpenIssuesGlimpse from '../../components/OpenIssuesGlimpse';
import ProLockedCard from '../../components/ProLockedCard';
import { useRunScan } from '../../services/useRunScan';
import { useFilterSlot } from '../../services/useFilterSlot';

/**
 * Which GEO_SECTIONS card (below) each scanner's findings live under — a
 * glimpse row only has a scanner_id, not a section key, so
 * OpenIssuesGlimpse needs this lookup supplied explicitly. Falls back to
 * 'entities' for a scanner id this map hasn't been extended for yet, rather
 * than silently not scrolling anywhere.
 */
const SCANNER_TO_SECTION: Record<string, string> = {
	'geo-summary-block': 'summary',
	'geo-faq-opportunity': 'summary',
	'geo-citation-opportunities': 'evidence',
	'geo-chunking': 'structure',
	'geo-semantic-structure': 'structure',
	'geo-author-info': 'entities',
	'geo-eeat-signals': 'entities',
	'geo-entity-naming-consistency': 'entities',
	'geo-trust-signals': 'entities',
	'llms-txt-missing': 'crawlability',
	'stale-content': 'freshness',
	'aeo-schema': 'aeo',
};

/**
 * Section → scanner_id grouping for GEO's 12 scanners (Free's original 9,
 * GEO-MODULE.md, plus GeoInsights' 2 Pro ones, plus Free's own
 * AeoSchemaScanner), mirroring the SEO.tsx SEO_SECTIONS pattern: each
 * section is its own independent
 * FindingsTable (own fetch/pagination/search/bulk actions) scoped by
 * scannerIds rather than one flat category="geo" table. Unlike SEO's
 * mixed categories, every GEO scanner already shares category 'geo' — the
 * split here is purely presentational, grouping by what a finding affects
 * (an AI summary block vs. heading structure vs. entity naming) rather
 * than a real backend distinction.
 */
const GEO_SECTIONS: {
	key: string;
	title: string;
	description: string;
	emptyMessage: string;
	scannerIds: string[];
	/**
	 * Set when every scanner in `scannerIds` is only ever registered by a
	 * Pro module (vulopilot-pro's GeoInsights adds `llms-txt-missing` and
	 * `stale-content` — Free's own ScannerRegistry has no equivalent), so
	 * this section can never produce findings without it. Checked against
	 * `appLocalizer.active_modules` to show a locked-card upsell instead of
	 * a findings table that would otherwise sit permanently, misleadingly
	 * empty ("run a scan") on any install without that module active.
	 */
	proModule?: string;
}[] = [
	{
		key: 'summary',
		title: __('AI Summary', 'vulopilot'),
		description: __(
			'Whether pages have an extractable AI summary block or answer questions readers would plausibly ask.',
			'vulopilot'
		),
		emptyMessage: __(
			'No AI summary findings yet — run a scan to check for summary blocks and FAQ opportunities.',
			'vulopilot'
		),
		scannerIds: ['geo-summary-block', 'geo-faq-opportunity'],
	},
	{
		key: 'evidence',
		title: __('Evidence & Data', 'vulopilot'),
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
		key: 'structure',
		title: __('Structure', 'vulopilot'),
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
		key: 'entities',
		title: __('Entities & Trust', 'vulopilot'),
		description: __(
			'Author credentials, consistent naming, and baseline trust pages (About/Contact) AI systems weigh before citing a source.',
			'vulopilot'
		),
		emptyMessage: __(
			'No entity/trust findings yet — run a scan to check author info and naming consistency.',
			'vulopilot'
		),
		scannerIds: [
			'geo-author-info',
			'geo-eeat-signals',
			'geo-entity-naming-consistency',
			'geo-trust-signals',
		],
	},
	{
		key: 'crawlability',
		title: __('Crawlability', 'vulopilot'),
		description: __(
			'Whether AI crawlers can find a curated index of this site’s content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No crawlability findings yet — run a scan to check llms.txt.',
			'vulopilot'
		),
		scannerIds: ['llms-txt-missing'],
		proModule: 'geo-insights',
	},
	{
		key: 'freshness',
		title: __('Freshness', 'vulopilot'),
		description: __(
			'Pages that haven’t been updated recently — AI answer engines favor actively-maintained content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No freshness findings yet — run a scan to check for stale content.',
			'vulopilot'
		),
		scannerIds: ['stale-content'],
		proModule: 'geo-insights',
	},
	{
		key: 'aeo',
		title: __('AEO (Answer Engine Optimization)', 'vulopilot'),
		description: __(
			'Content already shaped like an FAQ or a how-to guide, but missing the schema.org markup that lets AI answer engines recognize it as one.',
			'vulopilot'
		),
		emptyMessage: __(
			'No AEO schema findings yet — run a scan to check FAQ/HowTo-shaped content for missing schema.',
			'vulopilot'
		),
		scannerIds: ['aeo-schema'],
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
 * Same header + findings-table shape every other category page (SEO,
 * Performance, Accessibility, WooCommerce, Security) already uses, plus
 * the two optional Pro widgets above the table (see their own docblocks).
 * llms.txt's toggle/preview/live-link live under Settings → GEO
 * (Scanning/Geo.ts + LlmsTxtCard.tsx), not on this page.
 */
const GEO = () => {
	const { runScanButton } = useRunScan();

	/**
	 * All 4 slots below are Pro's vulopilot-pro/modules/GeoInsights — same
	 * "register a source, don't modify the host" pattern already used for
	 * Reports'/Automation's own panel slots (see those pages' own
	 * docblocks). Read via useFilterSlot(), not a plain module-scope
	 * `applyFilters()` call — see that hook's own docblock for why: Pro's
	 * addFilter() calls always run strictly after this page's own code on
	 * a fresh load, so a one-time read here would permanently miss them.
	 *
	 * Rendered together, gated on isGeoInsightsActive(): when the module is
	 * active each registered slot renders itself; when it isn't, a single
	 * "AI Visibility Score" ProLockedCard takes their place below, same
	 * locked-card treatment GEO_SECTIONS' own Crawlability/Freshness
	 * entries already use, rather than the 4 slots simply rendering
	 * nothing.
	 *
	 * GeoScoreCard is GEO-MODULE.md's per-post "Generate GEO Score" card.
	 *
	 * Sitewide AI-visibility summary (GeoVisibilitySummary) —
	 * GeoInsights\VisibilitySnapshotBuilder's cached, sample-based average
	 * of GeoAnalyzer's 8 AI-judged dimensions across this site's most
	 * recently updated pages.
	 *
	 * Historical Trends (GeoVisibilityTrend, AI-VISIBILITY-MODULE.md) —
	 * sitewide GEO score over time, one point per day
	 * VisibilitySnapshotBuilder ran.
	 *
	 * Competitor Visibility (GeoCompetitorVisibility,
	 * AI-VISIBILITY-MODULE.md) — real, on-demand structural comparison
	 * against competitor URLs (Settings → GEO's `geo_competitor_urls`).
	 */
	const GeoVisibilitySummary = useFilterSlot('vulopilot_geo_visibility_summary');
	const GeoVisibilityTrend = useFilterSlot('vulopilot_geo_visibility_trend');
	const GeoCompetitorVisibility = useFilterSlot('vulopilot_geo_competitor_visibility');
	const GeoScoreCard = useFilterSlot('vulopilot_geo_score_card');

	return (
	<>
		<NavigatorHeaderComponent
			headerIcon="global-community"
			headerTitle={__('GEO', 'vulopilot')}
			headerDescription={__(
				'Generative Engine Optimization — how discoverable and citable this site is to AI answer engines.',
				'vulopilot'
			)}
			buttons={[runScanButton]}
		/>
		<ContainerComponent general>
			<ColumnComponent>
				{isGeoInsightsActive() ? (
					<>
						{GeoVisibilitySummary && <GeoVisibilitySummary />}
						{GeoVisibilityTrend && <GeoVisibilityTrend />}
						{GeoCompetitorVisibility && <GeoCompetitorVisibility />}
						{GeoScoreCard && <GeoScoreCard />}
					</>
				) : (
					<CardComponent
						title={__('AI Visibility Score', 'vulopilot')}
						desc={__(
							'Sitewide GEO score, historical trend, and competitor comparison.',
							'vulopilot'
						)}
					>
						<ProLockedCard moduleName="geo-insights" />
					</CardComponent>
				)}
				<OpenIssuesGlimpse
					category="geo"
					sectionMap={SCANNER_TO_SECTION}
					fallbackSection="entities"
					anchorPrefix="geo-section-"
					emptyTitle={__("You're all caught up", 'vulopilot')}
					emptyDesc={__('No open GEO findings right now.', 'vulopilot')}
				/>

				<TopPagesCard />
				{GEO_SECTIONS.map((section) => (
					<ColumnComponent grid={6} fullHeight>
						<CardComponent
							key={section.key}
							id={`geo-section-${section.key}`}
							title={section.title}
							desc={section.description}
						>
							{section.proModule && !isGeoInsightsActive() ? (
								<ProLockedCard moduleName={section.proModule} />
							) : (
								<FindingsTable
									title={section.title}
									description={section.emptyMessage}
									scannerIds={section.scannerIds}
									layout="compact"
								/>
							)}
						</CardComponent>
					</ColumnComponent>
				))}
			</ColumnComponent>
		</ContainerComponent>
	</>
	);
};

export default GEO;
