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
	NoticeManager
} from '@zyra/components';
import { SUGGESTED_PROMPTS } from './copilotData';
import NeedsAttentionCard, {
	IssuesFilter,
} from './NeedsAttentionCard';
import RecentConversationsCard from './RecentConversationsCard';
import AiWorkflowsList from './AiWorkflowsList';
import AiUsageCard from './AiUsageCard';
import { useCopilotChat } from '../../services/useCopilotChat';

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
 * sidebar. Sending now really talks to `POST /copilot/chat`
 * (classes/RestAPI/Controllers/Copilot.php, shared via useCopilotChat.ts)
 * — a real reply grounded in this site's own open findings/automation
 * counts, not a canned response. "Recent conversations" stays static
 * placeholder content (RecentConversationsCard.tsx) since there's still no
 * persisted conversation entity to list past sessions from — each page
 * load starts a fresh, real conversation. Attaching files/adding context
 * stay honestly disabled — no upload/embedding pipeline exists for either.
 * The prompt grid still prefills the composer.
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
	const { turns, isSending, send } = useCopilotChat(
		'vulopilot-copilot-chat-error'
	);

	const handleSend = () => {
		send(message);
		onMessageChange('');
	};

	return (
		<ContainerComponent>
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

					{turns.map((turn, index) => (
						<ChatMessageComponent
							key={index}
							sender={'user' === turn.role ? 'user' : 'ai'}
						>
							{turn.content}
						</ChatMessageComponent>
					))}

					{isSending && (
						<ChatMessageComponent sender="ai" avatarIcon="ai">
							<i className="adminfont-refresh chat-thinking-spinner" />{' '}
							{__('Thinking…', 'vulopilot')}
						</ChatMessageComponent>
					)}

					<p className="chat-prompts-label">
						{__('Try asking me…', 'vulopilot')}
					</p>

					<ChatInputComponent
						value={message}
						onChange={onMessageChange}
						onSend={handleSend}
						disabled={isSending}
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
		</ContainerComponent>
	);
};

export default ChatTab;
