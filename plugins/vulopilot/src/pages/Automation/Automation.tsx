import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import {
	ContainerComponent,
	NavigatorHeaderComponent,
	TabsComponent,
} from '@zyra/components';
import AutomationOverviewTab from './AutomationOverviewTab';
import ManageAutomationsSection from './ManageAutomationsSection';
import './AutomateWork.scss';

const TAB_IDS = ['overview', 'automations'] as const;

/**
 * "Automate Work" — a tab shell over two views, same
 * subtab-deep-link/TabsComponent pattern this codebase's other
 * multi-tab pages already use (GEO.tsx/Content.tsx/Performance.tsx/
 * Security.tsx). "Overview" (AutomationOverviewTab.tsx) is the new
 * dashboard-style view merging the latest mockup with this page's real
 * cards; "Automations" is today's real list/create/enable/run management
 * UI (ManageAutomationsSection.tsx, unchanged, just given its own tab
 * instead of sitting at the bottom of one long page). Restores the
 * two-tab shape this page briefly moved away from for its previous
 * single-page rebuild — the new mockup itself shows an "Overview"/
 * "Automations" tab bar, so this isn't a new pattern, it's this page
 * catching back up to it.
 */
const Automation = () => {
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

	const goToAutomationsTab = () => setActiveTab('automations');

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="automation"
				headerTitle={__('Automate Work', 'vulopilot')}
				headerDescription={__(
					'Let AI continuously improve your website while you focus on growing your business.',
					'vulopilot'
				)}
			/>
			<ContainerComponent general>
				<TabsComponent
					className="automate-work-tabs"
					activeIndex={TAB_IDS.indexOf(activeTab)}
					onTabChange={(index) => setActiveTab(TAB_IDS[index])}
					tabs={[
						{
							label: __('Overview', 'vulopilot'),
							content: (
								<AutomationOverviewTab
									onManageAutomations={goToAutomationsTab}
								/>
							),
						},
						{
							label: __('Automations', 'vulopilot'),
							content: <ManageAutomationsSection />,
						},
					]}
				/>
			</ContainerComponent>
		</>
	);
};

export default Automation;
