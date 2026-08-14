import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	PopupComponent,
	NavigatorComponent,
	ContainerComponent,
} from '@zyra/components';
import ChatTab from './ChatTab';
import HistoryTab from './HistoryTab';
import IssuesTab from './IssuesTab';
import AiWorkflowsTab from './AiWorkflowsTab';
import { IssuesFilter } from './NeedsAttentionCard';
import { Link } from 'react-router-dom';

const TAB_IDS = [
	'chat',
	'issues',
	'ai-workflows',
	'history',
] as const;

const AIAssistant = () => {
	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		'chat'
	);
	const [chatMessage, setChatMessage] = useState('');
	const [autoApply, setAutoApply] = useState(true);
	const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
	const [issuesFilter, setIssuesFilter] = useState<IssuesFilter | null>(
		null
	);
	// Set only when navigation came from RecentConversationsCard.tsx's own
	// click-through — a plain top-nav click to History passes no selectId
	// and HistoryTab.tsx falls back to its normal "all, first row" default.
	const [historySelectId, setHistorySelectId] = useState<number | null>(
		null
	);

	const goToTab = (tab: string, filter?: IssuesFilter, selectId?: number) => {
		if ((TAB_IDS as readonly string[]).includes(tab)) {
			setActiveTab(tab as (typeof TAB_IDS)[number]);

			if ('issues' === tab) {
				setIssuesFilter(filter ?? null);
			}

			if ('history' === tab) {
				setHistorySelectId(selectId ?? null);
			}
		}
	};

	const settingContent = TAB_IDS.map((tabId) => ({
		type: 'file' as const,
		content: {
			id: tabId,
			headerTitle: (() => {
				switch (tabId) {
					case 'chat':
						return __('Chat', 'vulopilot');
					case 'history':
						return __('History', 'vulopilot');
					case 'issues':
						return __('Issues', 'vulopilot');
					case 'ai-workflows':
						return __('AI Workflows', 'vulopilot');
					default:
						return tabId;
				}
			})(),
			headerIcon: (() => {
				switch (tabId) {
					case 'chat':
						return 'ai';
					case 'history':
						return 'history';
					case 'issues':
						return 'error';
					case 'ai-workflows':
						return 'workflow';
					default:
						return 'settings';
				}
			})(),
			hideSettingHeader: true,
		},
	}));

	const getForm = (tabId: string) => {
		switch (tabId) {
			case 'chat':
				return (
					<ChatTab
						onNavigateTab={goToTab}
						message={chatMessage}
						onMessageChange={setChatMessage}
						autoApply={autoApply}
						onAutoApplyChange={setAutoApply}
					/>
				);
			case 'issues':
				return (
					<IssuesTab
						filter={issuesFilter}
						onClearFilter={() => setIssuesFilter(null)}
					/>
				);
			case 'ai-workflows':
				return <AiWorkflowsTab />;
			case 'history':
				return (
					<HistoryTab
						initialFilter={
							historySelectId ? 'conversation' : undefined
						}
						initialSelectId={historySelectId}
					/>
				);
			default:
				return <div></div>;
		}
	};

	return (
		<>
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
						'Ask for a blog post, landing page, or product description and VuloPilot writes it and saves it as a real draft for you, logged to History with a real Undo. Everything else — SEO, performance, security, and other fixes — is advice only for now: VuloPilot will point you to exactly where to review and apply it yourself.',
						'vulopilot'
					)}
				</p>
			</PopupComponent>
			<NavigatorComponent
				settingContent={settingContent}
				currentSetting={activeTab}
				getForm={getForm}
				prepareUrl={(subTab: string) => 
					`?page=vulopilot#&tab=ai-assistant&subtab=${subTab}`
				}
				Link={Link}
				variant="tab"
				menuIcon={true}
				headerIcon="ai"
				headerTitle={__('AI Copilot', 'vulopilot')}
				headerDescription={__(
					'Your always-on AI assistant for WordPress. Ask anything, get intelligent answers and take action.',
					'vulopilot'
				)}
				showPremiumLink={false}
				badges={[
					{ 
						text: `● ${__('Online', 'vulopilot')}`, 
						color: 'green' 
					}
				]}
				buttons={[
					{
						label: __('How it works', 'vulopilot'),
						icon: 'help',
						onClick: () => setIsHowItWorksOpen(true),
					},
				]}
			/>
		</>
	);
};

export default AIAssistant;