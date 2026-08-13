import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import { NavigatorHeaderComponent, TabsComponent, ContainerComponent } from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import OverviewTab from './OverviewTab';
import GeoTab from './GeoTab';
import AeoTab from './AeoTab';
import CrawlerTrafficTab from './CrawlerTrafficTab';
import BrandVisibilityTab from './BrandVisibilityTab';
import KnowledgeGraphTab from './KnowledgeGraphTab';
import SeoTab from './SeoTab';
import SchemaTab from './SchemaTab';
import RedirectsTab from './RedirectsTab';

const TAB_IDS = [
	'overview',
	'geo',
	'aeo',
	'crawler-traffic',
	'brand-visibility',
	'knowledge-graph',
	'seo',
	'schema',
	'redirects',
] as const;

/**
 * "Grow My Traffic" (WP menu slug `geo`) — a tab shell over eight views:
 * the mockup's new Overview (OverviewTab.tsx), and GEO/AEO/Crawler
 * Traffic/Brand Visibility/Knowledge Graph/SEO/Schema, folded in as tabs
 * instead of their own now-deleted standalone pages. AEO/Crawler Traffic
 * were already grouped under `Admin.php`'s `legacy_submenus()` "Folded
 * into 'geo' ('Grow My Traffic')" comment (`group: 'ai-visibility'`);
 * Brand Visibility/Knowledge Graph/SEO/Schema had no documented fold
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
 * Supports the same `subtab` deep-link convention
 * `src/pages/StatusAndTools/StatusAndTools.tsx` already established
 * (`?page=vulopilot#&tab=<page>&subtab=<inner-tab>`) so pre-existing
 * hardcoded links to a folded-in page's old top-level slug (e.g.
 * AuthorityCard.tsx's old `?tab=brand-visibility`) can still land on the
 * right tab instead of only the default Overview.
 */
const GEO = () => {
	const subtab = new URLSearchParams(useLocation().hash.substring(1)).get(
		'subtab'
	);
	const initialTab = (
		subtab && (TAB_IDS as readonly string[]).includes(subtab)
			? subtab
			: 'overview'
	) as (typeof TAB_IDS)[number];

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
					onTabChange={(index) => setActiveTab(TAB_IDS[index])}
					tabs={[
						{
							label: __('Overview', 'vulopilot'),
							content: <OverviewTab onNavigateTab={goToTab} />,
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
							label: __('Crawler Traffic', 'vulopilot'),
							content: <CrawlerTrafficTab />,
						},
						{
							label: __('Brand Visibility', 'vulopilot'),
							content: <BrandVisibilityTab />,
						},
						{
							label: __('Knowledge Graph', 'vulopilot'),
							content: <KnowledgeGraphTab />,
						},
						{
							label: __('SEO', 'vulopilot'),
							content: <SeoTab />,
						},
						{
							label: __('Schema', 'vulopilot'),
							content: <SchemaTab />,
						},
						{
							label: __('Redirects & 404s', 'vulopilot'),
							content: <RedirectsTab />,
						},
					]}
				/>
			</ContainerComponent>
		</>
	);
};

export default GEO;