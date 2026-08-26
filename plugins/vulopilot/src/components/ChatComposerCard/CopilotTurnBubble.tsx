import React from 'react';
import { __ } from '@wordpress/i18n';
import ChatMessage from './ChatMessage';
import { ChatMarkdown } from '../ChatMarkdown';
import type { CopilotChatTurn } from '../../services/useCopilotChat';

/** Matches the image extensions AI Copilot's own ATTACHMENT_ACCEPT (ChatTab.tsx) allows — used to decide whether a sent turn's attachment renders as an inline thumbnail or a plain file chip. */
const IMAGE_EXTENSION_RE = /\.(jpe?g|png|gif|webp)$/i;

export interface CopilotTurnBubbleProps {
	turn: CopilotChatTurn;
	/**
	 * A turn's own `runId` currently being rolled back, or null — a turn's
	 * "Undo" link disables/relabels itself while its own rollback is in
	 * flight. Omit both this and `onUndo` for a composer that doesn't
	 * offer undo at all (the link itself still renders; just no Undo
	 * affordance next to it).
	 */
	undoingRunId?: number | null;
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onUndo?: (runId: number) => void;
}

/**
 * The standard `CopilotChatTurn` bubble — sent attachments (inline
 * thumbnail or file chip), real Markdown, and a created-content turn's
 * clickable link + inline "Undo" — shared by every real `useCopilotChat`
 * consumer (AI Copilot's own Chat tab, GEO's "How would you like to grow
 * today?" composer) instead of each hand-rolling its own copy. Used as a
 * `renderTurn` callback: `renderTurn={(turn, index) => <CopilotTurnBubble key={index} turn={turn} .../>}`.
 */
const CopilotTurnBubble: React.FC<CopilotTurnBubbleProps> = ({
	turn,
	undoingRunId = null,
	onUndo,
}) => (
	<ChatMessage sender={'user' === turn.role ? 'user' : 'ai'}>
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
				{turn.runId && onUndo && (
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
								('Enter' === e.key || ' ' === e.key) &&
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
);

export default CopilotTurnBubble;
