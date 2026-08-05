import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import { NavigatorHeaderComponent, TabsComponent } from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import OverviewTab from './OverviewTab';
import PerformanceTab from './PerformanceTab';
import RedirectsTab from './RedirectsTab';

const TAB_IDS = ['overview', 'performance', 'redirects'] as const;

/**
 * "Improve Speed" (WP menu slug `performance`) — a tab shell over three
 * views: the mockup's new Overview (OverviewTab.tsx), today's real
 * category-'performance' findings scanner (PerformanceTab.tsx, kept
 * rather than replaced — same "keep the real page, add the new mockup
 * alongside it" move `GEO.tsx`/`Content.tsx` made for their own Overview
 * splits), and "Redirects & 404s" (RedirectsTab.tsx), moved here from
 * its own standalone page. Same shape as those two tab shells: a
 * constant header above `TabsComponent`, with the same `subtab`
 * deep-link convention (`?page=vulopilot#&tab=performance&subtab=<inner-tab>`).
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
	const { runScanButton } = useRunScan();

	const goToPerformanceTab = () => setActiveTab('performance');

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
			<TabsComponent
				className="improve-speed-tabs"
				activeIndex={TAB_IDS.indexOf(activeTab)}
				onTabChange={(index) => setActiveTab(TAB_IDS[index])}
				tabs={[
					{
						label: __('Overview', 'vulopilot'),
						content: (
							<OverviewTab
								onNavigateToPerformanceTab={goToPerformanceTab}
							/>
						),
					},
					{
						label: __('Performance', 'vulopilot'),
						content: <PerformanceTab />,
					},
					{
						label: __('Redirects & 404s', 'vulopilot'),
						content: <RedirectsTab />,
					},
				]}
			/>
		</>
	);
};

export default Performance;
