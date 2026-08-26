import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { ListComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ChatComposerCard, { ChatMessage } from '../../components/ChatComposerCard';
import { ChatMarkdown } from '../../components/ChatMarkdown';
import { CopilotChatTurn } from '../../services/useCopilotChat';
import { SuggestedPrompt } from './copilotData';


export interface CopilotChatComposerProps {
	guarded?: boolean;
	cardTitle?: ReactNode;
	cardTitleIcon?: string;
	cardDesc?: ReactNode;
	/** Opens AIAssistant.tsx's own history popup — the card's "Chat History" action calls this. */
	onOpenHistoryPopup: () => void;
	emptyIcon?: string;
	emptyTitle?: ReactNode;
	emptyDesc?: ReactNode;
	/** Suggested-prompt pills, rendered right below the empty-state text (only while `turns` is empty) — clicking one calls `onSelectPrompt(prompt.title)`. */
	prompts: SuggestedPrompt[];
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onSelectPrompt: (title: string) => void;
	turns: CopilotChatTurn[];
	isSending?: boolean;
	/** A turn's own `runId` currently being rolled back, or null — a turn's "Undo" link disables/relabels itself while its own rollback is in flight. */
	undoingRunId: number | null;
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onUndo: (runId: number) => void;
	/** Attachment/context chips + the Attach/Add context panels — still built by ChatTab.tsx itself (attachments/contextRefs/panel-open state all live there). */
	beforeComposer?: ReactNode;
	/** The fully-built `<ChatInput />` (wrapped in ChatTab.tsx's own event-propagation guard) — still passed in rather than built here, since its own props (attach/context handlers, auto-apply tooltip) are ChatTab-specific. */
	composer: ReactNode;
}

/** Matches the image extensions ATTACHMENT_ACCEPT (ChatTab.tsx) allows — used to decide whether a sent turn's attachment renders as an inline thumbnail or a plain file chip. */
const IMAGE_EXTENSION_RE = /\.(jpe?g|png|gif|webp)$/i;

/**
 * Every real bit of AI Copilot's own Chat tab UI — the card shell (title/
 * desc/"Chat History" action), the empty state ("How can I help you
 * today?" + the suggested-prompt pills, shown only before the first real
 * turn), and each turn's own bubble (attachment thumbnails/chips, real
 * Markdown, and a created-content turn's clickable link + inline "Undo") —
 * consolidated into one component instead of being assembled inline in
 * ChatTab.tsx. `beforeComposer`/`composer` stay pass-through: the
 * attach/context panels and the composer bar itself are still built by
 * ChatTab.tsx, which owns all the state behind them (attachments,
 * contextRefs, panel-open booleans, the auto-apply tooltip) — genuinely
 * page-specific, not part of this component's own "chat structure".
 */
const CopilotChatComposer: React.FC<CopilotChatComposerProps> = ({
	guarded = true,
	cardTitle = __('Chat with VuloPilot', 'vulopilot'),
	cardTitleIcon = 'ai',
	cardDesc = __(
		'Ask anything about your website, performance, security, content and more.',
		'vulopilot'
	),
	onOpenHistoryPopup,
	emptyIcon = 'ai',
	emptyTitle = __('How can I help you today?', 'vulopilot'),
	emptyDesc = __(
		'Ask me anything about your website, performance, security, content and more.',
		'vulopilot'
	),
	prompts,
	onSelectPrompt,
	turns,
	isSending = false,
	undoingRunId,
	onUndo,
	beforeComposer,
	composer,
}) => (
	<ChatComposerCard<CopilotChatTurn>
		guarded={guarded}
		sendingAvatarIcon="ai"
		cardClassName="ai-copilot-main-chat"
		cardTitle={cardTitle}
		cardTitleIcon={cardTitleIcon}
		cardDesc={cardDesc}
		cardAction={
			<ButtonInput
				buttons={{
					text: __('Chat History', 'vulopilot'),
					leftIcon: 'clock',
					color: 'text-purple',
					onClick: onOpenHistoryPopup,
				}}
			/>
		}
		emptyState={
			<div className="chat-empty-state">
				<span className="chat-empty-state-icon">
					<i className={`adminfont-${emptyIcon}`} />
				</span>
				<div className="chat-empty-state-title">{emptyTitle}</div>
				<div className="chat-empty-state-desc">{emptyDesc}</div>
				{prompts.length > 0 && (
					<ListComponent
						className="chip-grid"
						items={prompts.map((prompt) => ({
							id: prompt.id,
							icon: prompt.icon,
							title: prompt.title,
							action: () => onSelectPrompt(prompt.title),
							tags: (
								<i className="adminfont-pagination-next-arrow" />
							),
						}))}
					/>
				)}
			</div>
		}
		turns={turns}
		renderTurn={(turn, index) => (
			<ChatMessage
				key={index}
				sender={'user' === turn.role ? 'user' : 'ai'}
			>
				{turn.attachments && turn.attachments.length > 0 && (
					<div className="chat-message-attachments">
						{turn.attachments.map((attachment) =>
							IMAGE_EXTENSION_RE.test(attachment.name) ? (
								<img
									key={`sent-attachment-${attachment.id}`}
									className="chat-message-attachment-thumb"
									src={attachment.url}
									alt={attachment.name}
								/>
							) : (
								<span
									key={`sent-attachment-${attachment.id}`}
									className="chat-message-attachment-chip"
								>
									<i className="adminfont-attachment" />
									{attachment.name}
								</span>
							)
						)}
					</div>
				)}
				<ChatMarkdown text={turn.content} />
				{turn.link && (
					<div className="copilot-created-link">
						<a
							className="copilot-created-link-anchor"
							href={turn.link.url}
							target="_blank"
							rel="noopener noreferrer"
						>
							{turn.link.label}
						</a>
						{turn.runId && (
							<span
								className={`copilot-created-undo${turn.undone || undoingRunId === turn.runId ? ' disabled' : ''}`}
								role="button"
								tabIndex={0}
								onClick={() => {
									if (
										turn.runId &&
										!turn.undone &&
										undoingRunId !== turn.runId
									) {
										onUndo(turn.runId);
									}
								}}
								onKeyDown={(e) => {
									if (
										('Enter' === e.key ||
											' ' === e.key) &&
										turn.runId &&
										!turn.undone &&
										undoingRunId !== turn.runId
									) {
										e.preventDefault();
										onUndo(turn.runId);
									}
								}}
							>
								{turn.undone
									? __('Undone', 'vulopilot')
									: undoingRunId === turn.runId
										? __('Undoing…', 'vulopilot')
										: __('Undo', 'vulopilot')}
							</span>
						)}
					</div>
				)}
			</ChatMessage>
		)}
		isSending={isSending}
		beforeComposer={beforeComposer}
		composer={composer}
	/>
);

export default CopilotChatComposer;
