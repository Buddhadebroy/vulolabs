import { __ } from '@wordpress/i18n';
import {
	ColumnComponent,
	ContainerComponent,
	NavigatorHeaderComponent,
} from '@zyra/components';
import AutomationComposerCard from './AutomationComposerCard';
import AiForemanCard from './AiForemanCard';
import UpcomingJobsCard from './UpcomingJobsCard';
import ActiveWorkflowCard from './ActiveWorkflowCard';
import AutomationStatusCard from './AutomationStatusCard';
import AutomationLinksRow from './AutomationLinksRow';
import AiAgentsPlaceholderCard from './AiAgentsPlaceholderCard';
import AutomationActivityCard from './AutomationActivityCard';
import ManageAutomationsSection from './ManageAutomationsSection';
import './AutomateWork.scss';

const scrollToManageAutomations = () => {
	document
		.getElementById('automation-manage')
		?.scrollIntoView({ behavior: 'smooth' });
};

/**
 * "Automate Work" — rebuilt to match the mockup as a single page (no tab
 * split was requested and the mockup itself shows no tab bar, unlike the
 * last several rebuilds this session). See this folder's sibling files for
 * the per-section real-data mapping; each documents its own data source
 * and, where the mockup shows something with no real backend, its honest
 * fallback. ManageAutomationsSection.tsx is today's whole previous page
 * body, unchanged, just moved into its own section further down.
 */
const Automation = () => {
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
				<ColumnComponent grid={8}>
					<AutomationComposerCard />
					<ActiveWorkflowCard />
					<AutomationStatusCard
						onScrollToCreate={scrollToManageAutomations}
						onScrollToManage={scrollToManageAutomations}
					/>
					<AutomationLinksRow
						onScrollToCreate={scrollToManageAutomations}
					/>
					<AiAgentsPlaceholderCard />
					<AutomationActivityCard />
					<ManageAutomationsSection />
				</ColumnComponent>

				<ColumnComponent grid={4}>
					<AiForemanCard onScrollToCreate={scrollToManageAutomations} />
					<UpcomingJobsCard />
				</ColumnComponent>
			</ContainerComponent>
		</>
	);
};

export default Automation;
