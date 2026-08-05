import React from 'react';
import { __ } from '@wordpress/i18n';
import './AICopilot.scss';
import {
	CardComponent,
	ChatInputComponent,
	ChatMessageComponent,
	ColumnComponent,
	ContainerComponent,
	InformationItemComponent,
	ListComponent,
	TrendStatComponent,
} from '@zyra/components';
import {
	AI_WORKFLOWS,
	LIVE_INSIGHTS,
	SUGGESTED_ACTIONS,
	SUGGESTED_PROMPTS,
} from './copilotData';

interface ChatTabProps {
	onNavigateTab: (tab: string) => void;
	message: string;
	onMessageChange: (message: string) => void;
	autoApply: boolean;
	onAutoApplyChange: (autoApply: boolean) => void;
}

/**
 * The mockup's default "Chat" view — a welcome message, the "Try asking
 * me…" prompt grid, and the composer bar in the main column; Suggested
 * Actions/AI Workflows previews in the sidebar; Live Site Insights across
 * the bottom. All placeholder content (see copilotData.ts's own docblock)
 * — there's no conversational AI endpoint to wire the composer to yet, so
 * sending just clears the field rather than faking a reply.
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
			<ContainerComponent general>
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
						<ListComponent
							className="chip-grid"
							items={SUGGESTED_PROMPTS.map((prompt) => ({
								id: prompt.id,
								icon: prompt.icon,
								title: prompt.title,
								action: () => onMessageChange(prompt.title),
							}))}
						/>

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
							autoApply={{
								checked: autoApply,
								onChange: onAutoApplyChange,
								label: __(
									'Auto-applies (with approval)',
									'vulopilot'
								),
							}}
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
						{SUGGESTED_ACTIONS.map((action) => (
							<InformationItemComponent
								key={action.id}
								title={action.title}
								avatar={{
									iconClass: action.icon,
									color: action.color,
								}}
								descriptions={[{ value: action.desc }]}
								rightContent={
									<i className="adminfont-arrow-right" />
								}
							/>
						))}
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
						{AI_WORKFLOWS.map((workflow) => (
							<InformationItemComponent
								key={workflow.id}
								title={workflow.title}
								avatar={{
									iconClass: workflow.icon,
									color: workflow.color,
								}}
								descriptions={[{ value: workflow.desc }]}
								rightContent={
									<button
										type="button"
										className="ai-workflow-run-btn"
										aria-label={__('Run now', 'vulopilot')}
									>
										<span className="dashicons dashicons-controls-play" />
									</button>
								}
							/>
						))}
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>

			<ContainerComponent general>
				<ColumnComponent grid={12}>
					<CardComponent
						title={__('Live Site Insights', 'vulopilot')}
						titleIcon="analytics"
					>
						<TrendStatComponent cols={4} items={LIVE_INSIGHTS} />
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>
		</>
	);
};

export default ChatTab;
