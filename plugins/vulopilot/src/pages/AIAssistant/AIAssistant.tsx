import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	NavigatorHeaderComponent,
	PopupComponent,
	TabsComponent,
	ContainerComponent,
} from '@zyra/components';
import ChatTab from './ChatTab';
import HistoryTab from './HistoryTab';
import IssuesTab from './IssuesTab';
import AiWorkflowsTab from './AiWorkflowsTab';
import { IssuesFilter } from './NeedsAttentionCard';

const TAB_IDS = [
	'chat',
	'history',
	'issues',
	'ai-workflows',
] as const;

/**
 * "AI Copilot" — the Chat tab is the new conversational UI (ChatTab.tsx);
 * History is the page's original body (the real `vulopilot_ai_history`
 * audit-log table + Pro analytics panel), unchanged, just relocated under
 * its own tab instead of being the whole page. Issues/AI Workflows are
 * full-width versions of Chat's own sidebar previews.
 *
 * `activeTab`/`chatMessage`/`autoApply` live here (not inside ChatTab) so
 * the sidebar's "View all" links can both jump tabs and hand real state
 * to the Chat tab, not just switch the visible pane.
 */
const AIAssistant = () => {
	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		'chat'
	);
	const [chatMessage, setChatMessage] = useState('');
	const [autoApply, setAutoApply] = useState(true);
	const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
	// What NeedsAttentionCard's own group rows navigate here with — lets
	// the Issues tab filter to the exact same scanner_id the summary card
	// counted, instead of showing its own unrelated top-20 list. Reset
	// whenever a navigation arrives without one (e.g. the tab label itself,
	// or "View all issues"), so a stale filter never lingers silently.
	const [issuesFilter, setIssuesFilter] = useState<IssuesFilter | null>(
		null
	);

	const goToTab = (tab: string, filter?: IssuesFilter) => {
		if ((TAB_IDS as readonly string[]).includes(tab)) {
			setActiveTab(tab as (typeof TAB_IDS)[number]);

			if ('issues' === tab) {
				setIssuesFilter(filter ?? null);
			}
		}
	};

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="ai"
				headerTitle={__('AI Copilot', 'vulopilot')}
				headerDescription={__(
					'Your always-on AI assistant for WordPress. Ask anything, get intelligent answers and take action.',
					'vulopilot'
				)}
				badges={[{ text: `● ${__('Online', 'vulopilot')}`, color: 'green' }]}
				buttons={[
					{
						label: __('How it works', 'vulopilot'),
						icon: 'help',
						onClick: () => setIsHowItWorksOpen(true),
					},
				]}
			/>
			<PopupComponent
				open={isHowItWorksOpen}
				onClose={() => setIsHowItWorksOpen(false)}
				width={28}
				height="auto"
				position="lightbox"
			>
				<h2>{__('How AI Copilot works', 'vulopilot')}</h2>
				<p>
					{__(
						'Ask a question or pick a suggested prompt. VuloPilot checks your live site data — scans, traffic, security, and store health — and answers with real recommendations.',
						'vulopilot'
					)}
				</p>
				<p>
					{__(
						'When "Auto-applies" is on, safe fixes are applied automatically and logged to History. Turn it off to review and approve every change yourself.',
						'vulopilot'
					)}
				</p>
			</PopupComponent>
			<ContainerComponent general>
				<>
				<TabsComponent
						activeIndex={TAB_IDS.indexOf(activeTab)}
						onTabChange={(index) => setActiveTab(TAB_IDS[index])}
						tabs={[
						{
							label: __('Chat', 'vulopilot'),
							content: (
								<ChatTab
									onNavigateTab={goToTab}
									message={chatMessage}
									onMessageChange={setChatMessage}
									autoApply={autoApply}
									onAutoApplyChange={setAutoApply}
								/>
							),
						},
						{
							label: __('History', 'vulopilot'),
							content: <HistoryTab />,
						},
						{
							label: __('Issues', 'vulopilot'),
							content: (
								<IssuesTab
									filter={issuesFilter}
									onClearFilter={() =>
										setIssuesFilter(null)
									}
								/>
							),
						},
						{
							label: __('AI Workflows', 'vulopilot'),
							content: <AiWorkflowsTab />,
						},
					]}
				/>
				</>
				</ContainerComponent>
		</>
	);
};

export default AIAssistant;
