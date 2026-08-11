import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import { NavigatorHeaderComponent, TabsComponent } from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import OverviewTab from './OverviewTab';
import AccessibilityTab from './AccessibilityTab';

const TAB_IDS = ['overview', 'accessibility'] as const;

/**
 * "Protect My Site" (WP menu slug `security`) — a tab shell over three
 * views: the mockup's new Overview (OverviewTab.tsx), today's real
 * category-'security' findings scanner (SecurityTab.tsx, kept rather than
 * replaced — same "keep the real page, add the new mockup alongside it"
 * move `GEO.tsx`/`Content.tsx`/`Performance.tsx` made for their own
 * Overview splits), and "Accessibility" (AccessibilityTab.tsx), moved here
 * from its own standalone page. The former "Performance" tab (the same
 * `PerformanceTab` component "Improve Speed" built) is gone — that same
 * category-'performance' findings data already lives on "Improve Speed"'s
 * own Overview tab, so showing it a second time here was redundant. Same
 * shape as those tab shells: a constant header above `TabsComponent`, with
 * the same `subtab` deep-link convention
 * (`?page=vulopilot#&tab=security&subtab=<inner-tab>`).
 */
const Security = () => {
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

	const goToSecurityTab = () => setActiveTab('security');

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="security"
				headerTitle={__('Protect My Site', 'vulopilot')}
				headerDescription={__(
					'AI continuously protects your website from threats and vulnerabilities.',
					'vulopilot'
				)}
				buttons={[runScanButton]}
			/>
			<TabsComponent
				className="protect-my-site-tabs"
				activeIndex={TAB_IDS.indexOf(activeTab)}
				onTabChange={(index) => setActiveTab(TAB_IDS[index])}
				tabs={[
					{
						label: __('Overview', 'vulopilot'),
						content: (
							<OverviewTab
								onNavigateToSecurityTab={goToSecurityTab}
							/>
						),
					},
					{
						label: __('Accessibility', 'vulopilot'),
						content: <AccessibilityTab />,
					},
				]}
			/>
		</>
	);
};

export default Security;
