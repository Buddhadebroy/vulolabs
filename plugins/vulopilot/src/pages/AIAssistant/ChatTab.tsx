import React from 'react';
import { __ } from '@wordpress/i18n';
import './AICopilot.scss';
import {
	CardComponent,
	ChatInputComponent,
	ChatMessageComponent,
	ColumnComponent,
	ContainerComponent,
	ListComponent,
	ModuleGuardComponent,
	NoticeManager,
} from '@zyra/components';
import { SUGGESTED_PROMPTS } from './copilotData';
import NeedsAttentionCard, {
	IssuesFilter,
} from './NeedsAttentionCard';
import RecentConversationsCard from './RecentConversationsCard';
import AiWorkflowsList from './AiWorkflowsList';
import AiUsageCard from './AiUsageCard';

interface ChatTabProps {
	onNavigateTab: (tab: string, filter?: IssuesFilter) => void;
	message: string;
	onMessageChange: (message: string) => void;
	autoApply: boolean;
	onAutoApplyChange: (autoApply: boolean) => void;
}

/**
 * The mockup's default "Chat" view — a welcome message, the "Try asking
 * me…" prompt grid, and the composer bar in the main column; a real
 * "Needs your attention" findings summary (`/findings/attention-summary`,
 * NeedsAttentionCard.tsx) + AI Workflows (`/automations`) preview in the
 * sidebar. "Recent conversations" stays static placeholder content
 * (RecentConversationsCard.tsx) since there's no conversational AI
 * endpoint yet (see AiHistory.php/ActionRunner.php — the AI Providers
 * engine exists but nothing routes a free-text message to it, so sending
 * is disabled with an honest explanation rather than faking a reply); the
 * prompt grid still really prefills the composer, since that part needs
 * no backend.
 *
 * `message`/`autoApply` are owned by AIAssistant.tsx rather than locally,
 * so the sidebar's "View all" links and this tab's own prompt grid can
 * both hand real state to the composer, not just switch the visible pane.
 */
const ChatTab: React.FC<ChatTabProps> = ({
	onNavigateTab,
	message,
	onMessageChange,
	autoApply,
	onAutoApplyChange,
}) => {
	return (
		<>
			<ColumnComponent grid={8}>
				<CardComponent>
					<ChatMessageComponent sender="ai" avatarIcon="ai">
						<strong>
							{__(
								"Hi! I'm VuloPilot, your AI website copilot. 👋",
								'vulopilot'
							)}
						</strong>
						<div>
							{__(
								'I monitor your site 24×7, find opportunities and help you improve it — automatically or with your approval.',
								'vulopilot'
							)}
						</div>
					</ChatMessageComponent>

					<p className="chat-prompts-label">
						{__('Try asking me…', 'vulopilot')}
					</p>

					<ChatInputComponent
						value={message}
						onChange={onMessageChange}
						onSend={() => onMessageChange('')}
						placeholder={__(
							'Ask VuloPilot anything about your website…',
							'vulopilot'
						)}
						onAttach={() =>
							NoticeManager.add({
								uniqueKey: 'vulopilot-chat-attach',
								type: 'error',
								position: 'float',
								message: __(
									"Attaching files isn't available yet — there's no connected assistant to send them to.",
									'vulopilot'
								),
							})
						}
						attachLabel={__('Attach', 'vulopilot')}
						onAddContext={() =>
							NoticeManager.add({
								uniqueKey: 'vulopilot-chat-add-context',
								type: 'error',
								position: 'float',
								message: __(
									"Adding context isn't available yet — there's no connected assistant to send it to.",
									'vulopilot'
								),
							})
						}
						addContextLabel={__('Add context', 'vulopilot')}
						sendDisabledReason={__(
							"AI chat replies aren't available yet — this is a preview of the composer, not a connected assistant.",
							'vulopilot'
						)}
						autoApply={{
							checked: autoApply,
							onChange: onAutoApplyChange,
							label: __(
								'Auto-applies (with approval)',
								'vulopilot'
							),
						}}
					/>

					<ListComponent
						className="chip-grid"
						items={SUGGESTED_PROMPTS.map((prompt) => ({
							id: prompt.id,
							icon: prompt.icon,
							title: prompt.title,
							action: () => onMessageChange(prompt.title),
						}))}
					/>
				</CardComponent>
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<NeedsAttentionCard onNavigateTab={onNavigateTab} />

			</ColumnComponent>	
					
			<ColumnComponent grid={8}>
				<CardComponent
					title={__('AI Workflows', 'vulopilot')}
					titleIcon="ai"
					action={
						<a
							href="#"
							onClick={(e) => {
								e.preventDefault();
								onNavigateTab('ai-workflows');
							}}
						>
							{__('View all', 'vulopilot')}{' '}
							<i className="adminfont-arrow-right" />
						</a>
					}
				>
					<AiWorkflowsList limit={4} />
				</CardComponent>
				<CardComponent
					title={__('Live Site Insights', 'vulopilot')}
					titleIcon="analytics"
				>
					<ModuleGuardComponent
						icon="analytics"
						title={__(
							'Live insights aren’t connected yet',
							'vulopilot'
						)}
						desc={__(
							'Traffic, Core Web Vitals, security, and store metrics will appear here once those data sources are connected.',
							'vulopilot'
						)}
					/>
				</CardComponent>
			</ColumnComponent>
		<ColumnComponent grid={4}>
				<RecentConversationsCard onNavigateTab={onNavigateTab} />

			</ColumnComponent>
			{/* <ColumnComponent grid={4}>
				<AiUsageCard />
			</ColumnComponent> */}
		</>
	);
};

export default ChatTab;
