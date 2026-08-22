import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import { NavigatorHeaderComponent, TabsComponent, ContainerComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import { pushSubtabUrl } from '../../services/pushSubtabUrl';
import OverviewTab from './OverviewTab';
import GeoTab from './GeoTab';
import AeoTab from './AeoTab';
import CrawlUrlsTab, { CrawlUrlsSectionId } from './CrawlUrlsTab';
import BrandVisibilityTab from './BrandVisibilityTab';
import SchemaKnowledgeTab, {
	SchemaKnowledgeSectionId,
} from './SchemaKnowledge/SchemaKnowledgeTab';
import SeoTab from './SeoTab';
import KeywordsTab from './KeywordsTab';

const TAB_IDS = [
	'overview',
	'brand-visibility',
	'seo',
	'geo',
	'aeo',
	'keywords',
	'crawl-urls',
	'schema-knowledge',
] as const;

/**
 * A bookmarked `?subtab=schema` or `?subtab=knowledge-graph` link (both
 * former standalone tabs, now sections inside `schema-knowledge`), or
 * `?subtab=crawler-traffic`/`broken-links`/`redirects` (3 more former
 * standalone tabs, now inner tabs of `crawl-urls` — see this file's own
 * docblock on the "Crawl & URLs" merge) must still resolve to a real tab
 * rather than silently falling back to Overview — see this file's own
 * docblock for why nothing actually links to either today (so this is a
 * safety net, not a live-break fix).
 */
const SUBTAB_ALIASES: Record<string, (typeof TAB_IDS)[number]> = {
	schema: 'schema-knowledge',
	'knowledge-graph': 'schema-knowledge',
	'crawler-traffic': 'crawl-urls',
	'broken-links': 'crawl-urls',
	redirects: 'crawl-urls',
};

/**
 * "SEO & Visibility" (WP menu slug `seo-visibility`) — a tab shell over Overview
 * (OverviewTab.tsx), and GEO/AEO/Crawl & URLs/Brand Visibility/
 * Schema & Knowledge/SEO/Keywords,
 * folded in as tabs instead of their own now-deleted standalone pages.
 * Keywords (KeywordsTab.tsx) was originally a `ModuleGuardComponent`
 * tucked into the SEO tab's own footer; split into its own tab per direct
 * instruction — see that file's own docblock for why it's still an
 * honest "not connected yet" state rather than fabricated rank data.
 * AEO/Crawler Traffic
 * were already grouped under `Admin.php`'s `legacy_submenus()` "Folded
 * into 'seo-visibility' ('SEO & Visibility')" comment (`group: 'ai-visibility'`);
 * Brand Visibility/Schema & Knowledge/SEO had no documented fold
 * destination there, so they land here too rather than as a second,
 * differently-scoped tab shell. "AI Content" was originally folded in
 * here too, then moved to "Create Content"
 * (`src/pages/Content/AiContentTab.tsx`); that tab has since been removed
 * — its one real section (the "Open Issues" glimpse) briefly lived on
 * Create Content's own Overview tab as its own card
 * (ContentOpenIssuesCard.tsx), then merged directly into that page's
 * `src/pages/Content/RecentContentCard.tsx`, which now shows each post's
 * own real open findings inline instead of a separate glimpse card.
 * Same shape as AI Copilot's own tab shell
 * (`src/pages/AIAssistant/AIAssistant.tsx`): a constant header above
 * `TabsComponent`, with `activeTab` owned here so Overview's own "AI
 * Opportunities"/"Discover" cards can jump to the GEO tab.
 *
 * "Knowledge Graph" and "Schema" were two more of these folded-in tabs
 * until they were merged into one "Schema & Knowledge" tab
 * (`SchemaKnowledge/SchemaKnowledgeTab.tsx`, its own 5-way internal
 * Overview/Structured Data/Knowledge Graph/Inspector/Issues navigation) —
 * `SUBTAB_ALIASES` above keeps `?subtab=schema`/`?subtab=knowledge-graph`
 * resolving to the merged tab (and to the matching inner section, via
 * `initialInnerSection` below) for any pre-existing bookmarked link,
 * exactly the same "old top-level slug still lands correctly" reasoning
 * `AuthorityCard.tsx`'s old `?tab=brand-visibility` link already relies
 * on for this whole tab shell.
 *
 * "Crawler Traffic", "Broken Links", and "Redirects" (which itself used
 * to bundle a real 404 log alongside its own redirect-rules table) were 3
 * more standalone tabs, each with a real but overlapping "URL
 * maintenance" concern — merged into one "Crawl & URLs" tab
 * (`CrawlUrlsTab.tsx`, its own 5-way internal Overview/Broken
 * Links/Redirects/404s/Robots & Sitemap navigation, real inner tabs this
 * time rather than Schema & Knowledge's own continuous-scroll pattern —
 * see that file's own docblock for why) per direct instruction: "Broken
 * Links + Redirects + Crawler Traffic are fragmented... That creates four
 * URL-maintenance concepts spread across three tabs... one main tab:
 * Crawl & URLs." `SUBTAB_ALIASES` resolves all 3 old top-level slugs to
 * `crawl-urls`, and `initialCrawlUrlsSection` below picks the matching
 * inner tab, same "old bookmarked link still lands correctly" reasoning
 * the Schema & Knowledge merge already established.
 *
 * Supports the same `subtab` deep-link convention
 * `src/pages/StatusAndTools/StatusAndTools.tsx` already established
 * (`?page=vulopilot#&tab=<page>&subtab=<inner-tab>`) so pre-existing
 * hardcoded links to a folded-in page's old top-level slug (e.g.
 * AuthorityCard.tsx's old `?tab=brand-visibility`) can still land on the
 * right tab instead of only the default Overview.
 */
const SeoVisibility = () => {
	const rawSubtab = new URLSearchParams(
		useLocation().hash.substring(1)
	).get('subtab');
	const resolvedSubtab = rawSubtab
		? (SUBTAB_ALIASES[rawSubtab] ?? rawSubtab)
		: null;
	const initialTab = (
		resolvedSubtab && (TAB_IDS as readonly string[]).includes(resolvedSubtab)
			? resolvedSubtab
			: 'overview'
	) as (typeof TAB_IDS)[number];
	const initialInnerSection: SchemaKnowledgeSectionId =
		'schema' === rawSubtab
			? 'structured-data'
			: 'knowledge-graph' === rawSubtab
				? 'knowledge-graph'
				: 'overview';
	const initialCrawlUrlsSection: CrawlUrlsSectionId =
		'crawler-traffic' === rawSubtab
			? 'overview'
			: 'broken-links' === rawSubtab
				? 'broken-links'
				: 'redirects' === rawSubtab
					? 'redirects'
					: 'overview';

	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		initialTab
	);
	// Which inner tab `<CrawlUrlsTab>` should land on the next time it's
	// (re)mounted — starts at whatever a bookmarked `?subtab=...` link
	// resolved to, and `goToTab`'s own optional second argument below can
	// update it for a same-session cross-tab jump (SeoTab.tsx's own
	// "Search engine access" link, which needs 'robots-sitemap'
	// specifically). Read once per mount by CrawlUrlsTab's own
	// `initialSection` prop, same contract SchemaKnowledgeTab.tsx's
	// `initialInnerSection` already has.
	const [crawlUrlsJumpSection, setCrawlUrlsJumpSection] =
		useState<CrawlUrlsSectionId>(initialCrawlUrlsSection);
	/**
	 * `crawlUrlsSection` is only meaningful when `tab` is `'crawl-urls'` —
	 * every other caller (OverviewTab.tsx's own `'geo' | 'aeo'`-typed
	 * `onNavigateTab`) never passes it, so `<CrawlUrlsTab>` just keeps
	 * whatever section it last had.
	 */
	const goToTab = (tab: string, crawlUrlsSection?: CrawlUrlsSectionId) => {
		if (!(TAB_IDS as readonly string[]).includes(tab)) {
			return;
		}

		if (crawlUrlsSection) {
			setCrawlUrlsJumpSection(crawlUrlsSection);
		}

		setActiveTab(tab as (typeof TAB_IDS)[number]);
	};

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="bar-chart"
				headerTitle={__('SEO & Visibility', 'vulopilot')}
				headerDescription={__(
					'Tell AI what you want to achieve. VuloPilot continuously improves your site’s visibility across Google, AI Search, and Answer Engines.',
					'vulopilot'
				)}
				headerCustomContent={
					<RunScanHeaderExtra
						categories={['geo', 'seo', 'images', 'schema', 'links']}
						settingsSubtab="seo-content"
					/>
				}
			/>
			<ContainerComponent general>
				<TabsComponent
					className="seo-visibility-tabs"
					activeIndex={TAB_IDS.indexOf(activeTab)}
					onTabChange={(index) => {
						setActiveTab(TAB_IDS[index]);
						pushSubtabUrl('seo-visibility', TAB_IDS[index]);
					}}
					tabs={[
						{
							label: __('Overview', 'vulopilot'),
							content: <OverviewTab onNavigateTab={goToTab} />,
						},
						{
							label: __('Brand Visibility', 'vulopilot'),
							content: <BrandVisibilityTab />,
						},
						{
							label: __('SEO', 'vulopilot'),
							content: <SeoTab onNavigateTab={goToTab} />,
						},
						{
							label: __('GEO', 'vulopilot'),
							content: <GeoTab />,
						},
						{
							label: __('AEO', 'vulopilot'),
							content: <AeoTab />,
						},
						{
							label: __('Keywords', 'vulopilot'),
							content: <KeywordsTab />,
						},
						{
							label: __('Crawl & URLs', 'vulopilot'),
							content: (
								<CrawlUrlsTab
									initialSection={crawlUrlsJumpSection}
								/>
							),
						},
						{
							label: __('Business Identity & Schema', 'vulopilot'),
							content: (
								<SchemaKnowledgeTab
									initialSection={initialInnerSection}
								/>
							),
						},
					]}
				/>
			</ContainerComponent>
		</>
	);
};

export default SeoVisibility;