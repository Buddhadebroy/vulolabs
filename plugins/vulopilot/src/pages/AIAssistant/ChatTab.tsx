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
} from '@zyra/components';
import { SUGGESTED_PROMPTS } from './copilotData';
import SuggestedActionsList from './SuggestedActionsList';
import AiWorkflowsList from './AiWorkflowsList';

interface ChatTabProps {
	onNavigateTab: (tab: string) => void;
	message: string;
	onMessageChange: (message: string) => void;
	autoApply: boolean;
	onAutoApplyChange: (autoApply: boolean) => void;
}

/**
 * The mockup's default "Chat" view — a welcome message, the "Try asking
 * me…" prompt grid, and the composer bar in the main column; real
 * Suggested Actions (`/findings`)/AI Workflows (`/automations`) previews
 * in the sidebar. There's no conversational AI endpoint yet (see
 * AiHistory.php/ActionRunner.php — the AI Providers engine exists but
 * nothing routes a free-text message to it), so sending is disabled with
 * an honest explanation rather than faking a reply; the prompt grid still
 * really prefills the composer, since that part needs no backend.
 *
 * `message`/`autoApply` are owned by AIAssistant.tsx rather than locally,
 * so the Quick Commands tab can prefill a real message into this tab
 * instead of just switching to it.
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
			<ColumnComponent grid={8} fullHeight>
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
						onAttach={() => {}}
						attachLabel={__('Attach', 'vulopilot')}
						onAddContext={() => {}}
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
						className="badge-list"
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
				<CardComponent
					title={__('Suggested Actions', 'vulopilot')}
					titleIcon="ai"
					action={
						<a
							href="#"
							onClick={(e) => {
								e.preventDefault();
								onNavigateTab('suggested-actions');
							}}
						>
							{__('View all', 'vulopilot')}{' '}
							<i className="adminfont-arrow-right" />
						</a>
					}
				>
					<SuggestedActionsList limit={4} />
				</CardComponent>

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
			</ColumnComponent>

			<ColumnComponent grid={12}>
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
		</>
	);
};

export default ChatTab;
