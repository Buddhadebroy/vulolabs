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
import SuggestedActionsTab from './SuggestedActionsTab';
import QuickCommandsTab from './QuickCommandsTab';
import AiWorkflowsTab from './AiWorkflowsTab';

const TAB_IDS = [
	'chat',
	'history',
	'suggested-actions',
	'quick-commands',
	'ai-workflows',
] as const;

/**
 * "AI Copilot" — the Chat tab is the new conversational UI (ChatTab.tsx);
 * History is the page's original body (the real `vulopilot_ai_history`
 * audit-log table + Pro analytics panel), unchanged, just relocated under
 * its own tab instead of being the whole page. Suggested Actions/Quick
 * Commands/AI Workflows are full-width versions of Chat's own sidebar/
 * prompt-grid previews.
 *
 * `activeTab`/`chatMessage`/`autoApply` live here (not inside ChatTab)
 * so the sidebar's "View all" links and Quick Commands' prompt selection
 * can both jump tabs and hand real state to the Chat tab, not just switch
 * the visible pane.
 */
const AIAssistant = () => {
	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		'chat'
	);
	const [chatMessage, setChatMessage] = useState('');
	const [autoApply, setAutoApply] = useState(true);
	const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

	const goToTab = (tab: string) => {
		if ((TAB_IDS as readonly string[]).includes(tab)) {
			setActiveTab(tab as (typeof TAB_IDS)[number]);
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
							label: __('Suggested Actions', 'vulopilot'),
							content: <SuggestedActionsTab />,
						},
						{
							label: __('Quick Commands', 'vulopilot'),
							content: (
								<QuickCommandsTab
									onSelect={(prompt) => {
										setChatMessage(prompt);
										goToTab('chat');
									}}
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
