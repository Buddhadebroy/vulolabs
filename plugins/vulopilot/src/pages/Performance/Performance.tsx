import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import {
	ContainerComponent,
	NavigatorHeaderComponent,
	TabsComponent,
} from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import OverviewTab from './OverviewTab';
import SlowPagesTab from './SlowPagesTab';

const TAB_IDS = ['overview', 'slow-pages'] as const;

/**
 * "Improve Speed" (WP menu slug `performance`) — Overview (OverviewTab.tsx)
 * and a real "Slow Pages" tab (SlowPagesTab.tsx, a real per-page speed
 * report — Repositories\PageSpeedRepository, populated in the background by
 * Services\PageSpeedScanner). Its former sibling tabs are otherwise gone:
 * the standalone "Performance" tab (PerformanceTab.tsx, now deleted) had its
 * full category-'performance' FindingsTable moved down into Overview itself
 * (`#performance-section-findings`) rather than kept on its own tab;
 * "Redirects & 404s" moved to "Grow My Traffic"
 * (`src/pages/GEO/RedirectsTab.tsx`); "Performance Opportunities"
 * (PerformanceOpportunitiesTab.tsx, removed) surfaced the same
 * PageSpeedRepository::get_top_issues() data Slow Pages' own sidebar
 * already shows, as its own tab.
 *
 * `activeTab` is owned here (not left as TabsComponent's uncontrolled
 * default) so PerformanceScoreCard's "View Slow Pages" button can jump
 * straight to the Slow Pages tab — same `activeIndex`/`onTabChange` +
 * `subtab` deep-link shape GEO.tsx/Security.tsx already use. Passing a
 * fixed `activeIndex={0}` with no `onTabChange` (this component's own
 * prior shape, harmless while Overview was the only tab) silently makes
 * TabsComponent a controlled-but-never-updated component once a second
 * tab exists — clicking "Slow Pages" would never switch to it.
 */
const Performance = () => {
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
	// Scoped to this page's own 'performance' category — same "local tab"
	// scoping every other category page's header "Run scan" button uses.
	const { runScanButton } = useRunScan({ categories: ['performance'] });

	const goToSlowPages = () => setActiveTab('slow-pages');

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="bar-chart"
				headerTitle={__('Improve Speed', 'vulopilot')}
				headerDescription={__(
					'Make your website faster and deliver a better experience to your visitors.',
					'vulopilot'
				)}
				buttons={[
					{ ...runScanButton, label: __('Run Speed Test', 'vulopilot') },
				]}
			/>
			<ContainerComponent general>
				<TabsComponent
					className="improve-speed-tabs"
					activeIndex={TAB_IDS.indexOf(activeTab)}
					onTabChange={(index) => setActiveTab(TAB_IDS[index])}
					tabs={[
						{
							label: __('Overview', 'vulopilot'),
							content: <OverviewTab onNavigateToSlowPages={goToSlowPages} />,
						},
						{
							label: __('Slow Pages', 'vulopilot'),
							content: <SlowPagesTab />,
						},
					]}
				/>
			</ContainerComponent>
		</>
	);
};

export default Performance;
