import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import { NavigatorHeaderComponent, TabsComponent, ContainerComponent } from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import { pushSubtabUrl } from '../../services/pushSubtabUrl';
import OverviewTab from './OverviewTab';
import GeoTab from './GeoTab';
import AeoTab from './AeoTab';
import CrawlerTrafficTab from './CrawlerTrafficTab';
import BrandVisibilityTab from './BrandVisibilityTab';
import SchemaKnowledgeTab, {
	SchemaKnowledgeSectionId,
} from './SchemaKnowledge/SchemaKnowledgeTab';
import SeoTab from './SeoTab';
import KeywordsTab from './KeywordsTab';
import BrokenLinksTab from './BrokenLinksTab';
import RedirectsTab from './RedirectsTab';

const TAB_IDS = [
	'overview',
	'brand-visibility',
	'seo',
	'geo',
	'aeo',
	'keywords',
	'crawler-traffic',
	'schema-knowledge',
	'broken-links',
	'redirects',
] as const;

/**
 * A bookmarked `?subtab=schema` or `?subtab=knowledge-graph` link (both
 * former standalone tabs, now sections inside `schema-knowledge`) must
 * still resolve to a real tab rather than silently falling back to
 * Overview — see this file's own docblock for why nothing actually links
 * to either today (so this is a safety net, not a live-break fix).
 */
const SUBTAB_ALIASES: Record<string, (typeof TAB_IDS)[number]> = {
	schema: 'schema-knowledge',
	'knowledge-graph': 'schema-knowledge',
};

/**
 * "Grow My Traffic" (WP menu slug `geo`) — a tab shell over Overview
 * (OverviewTab.tsx), and GEO/AEO/Crawler Traffic/Brand Visibility/
 * Schema & Knowledge/SEO/Keywords/Broken Links/Redirects,
 * folded in as tabs instead of their own now-deleted standalone pages.
 * Keywords (KeywordsTab.tsx) was originally a `ModuleGuardComponent`
 * tucked into the SEO tab's own footer; split into its own tab per direct
 * instruction — see that file's own docblock for why it's still an
 * honest "not connected yet" state rather than fabricated rank data.
 * Broken Links (BrokenLinksTab.tsx), added after Schema per direct
 * instruction, is real `scanner_id: 'broken-links'` findings pulled out
 * of the SEO tab's own "Links & schema" section into their own tab, same
 * `useFindingsTable` hook every other findings-backed tab here uses —
 * see that file's own docblock.
 * AEO/Crawler Traffic
 * were already grouped under `Admin.php`'s `legacy_submenus()` "Folded
 * into 'geo' ('Grow My Traffic')" comment (`group: 'ai-visibility'`);
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
 * Supports the same `subtab` deep-link convention
 * `src/pages/StatusAndTools/StatusAndTools.tsx` already established
 * (`?page=vulopilot#&tab=<page>&subtab=<inner-tab>`) so pre-existing
 * hardcoded links to a folded-in page's old top-level slug (e.g.
 * AuthorityCard.tsx's old `?tab=brand-visibility`) can still land on the
 * right tab instead of only the default Overview.
 */
const GEO = () => {
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

	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		initialTab
	);
	// Scoped to this page's own categories — GeoTab/AeoTab are 'geo',
	// SeoTab's 17 scanners span 'seo'/'images'/'schema'/'links' (see its
	// own docblock) — same "local tab" scoping every other category page's
	// header "Run scan" button uses.
	const { runScanButton } = useRunScan({
		categories: ['geo', 'seo', 'images', 'schema', 'links'],
	});

	const goToTab = (tab: string) => {
		if ((TAB_IDS as readonly string[]).includes(tab)) {
			setActiveTab(tab as (typeof TAB_IDS)[number]);
		}
	};

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="bar-chart"
				headerTitle={__('Grow My Traffic', 'vulopilot')}
				headerDescription={__(
					'Tell AI what you want to achieve. VuloPilot continuously improves your site’s visibility across Google, AI Search, and Answer Engines.',
					'vulopilot'
				)}
				buttons={[runScanButton]}
			/>
			<ContainerComponent general>
				<TabsComponent
					className="grow-my-traffic-tabs"
					activeIndex={TAB_IDS.indexOf(activeTab)}
					onTabChange={(index) => {
						setActiveTab(TAB_IDS[index]);
						pushSubtabUrl('geo', TAB_IDS[index]);
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
							content: <SeoTab />,
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
							label: __('Crawler Traffic', 'vulopilot'),
							content: <CrawlerTrafficTab />,
						},
						{
							label: __('Schema & Knowledge', 'vulopilot'),
							content: (
								<SchemaKnowledgeTab
									initialSection={initialInnerSection}
								/>
							),
						},
						{
							label: __('Broken Links', 'vulopilot'),
							content: <BrokenLinksTab />,
						},
						{
							label: __('Redirects', 'vulopilot'),
							content: <RedirectsTab />,
						},
					]}
				/>
			</ContainerComponent>
		</>
	);
};

export default GEO;