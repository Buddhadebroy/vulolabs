/* global vulopilotAppLocalizer */
import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	ListComponent,
	ModuleGuardComponent,
	PopupComponent,
} from '@zyra/components';
import { getApiLink, getApiResponse } from '@zyra/core';
import { useApiList } from '../../services/useApiList';
import { ChatMarkdown } from '../../components/ChatMarkdown';
import { ChatMessage } from '../../components/ChatComposerCard';

/** One row of `GET /copilot/conversations` (Copilot.php) - a real, reloadable conversation thread, not a single logged AI call. */
interface RecentConversationRow {
	id: number;
	title: string;
	updated_at: string;
}

/** One turn of `GET /copilot/conversations/{id}`. */
interface ConversationPreviewTurn {
	role: 'user' | 'assistant';
	content: string;
}

interface ConversationPreviewResponse {
	id: number;
	title: string;
	turns: ConversationPreviewTurn[];
}

/**
 * Relative "2h ago"/"3d ago" formatting - same local pattern already used by
 * RecentContentCard.tsx/RecentActivityCard.tsx.
 */
const timeAgo = (dateString: string): string => {
	const seconds = Math.max(
		0,
		Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
	);

	if (seconds < 60) {
		return __('just now', 'vulopilot');
	}
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
};

interface RecentConversationsCardProps {
	/** Called with a row's real `vulopilot_ai_conversations.id` when clicked. */
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onSelectConversation: (id: number) => void;
}

/**
 * AI Copilot's "Recent conversations" card - the 5 most recently-updated real.
 */
const RecentConversationsCard: React.FC<RecentConversationsCardProps> = ({
	onSelectConversation,
}) => {
	const { data, isLoading, error } = useApiList<RecentConversationRow>(
		'copilot/conversations',
		{ per_page: 5 }
	);
	/** The conversation currently shown in the preview popup - null closes it. */
	const [previewConversation, setPreviewConversation] = useState<{
		id: number;
		title: string;
		turns: ConversationPreviewTurn[];
	} | null>(null);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);

	/**
	 * Opens the popup immediately (with a loading state) and fetches the same real `GET
	 * /copilot/conversations/{id}` useCopilotChat.ts's own loadConversation() reads.
	 */
	const handlePreview = (
		row: RecentConversationRow,
		e: React.MouseEvent
	) => {
		e.stopPropagation();
		setPreviewConversation({ id: row.id, title: row.title, turns: [] });
		setIsLoadingPreview(true);

		getApiResponse<ConversationPreviewResponse>(
			getApiLink(vulopilotAppLocalizer, `copilot/conversations/${row.id}`),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setPreviewConversation({
						id: response.id,
						title: response.title,
						turns: response.turns,
					});
				}
			})
			.finally(() => setIsLoadingPreview(false));
	};

	return (
		<>
			{/* No own CardComponent wrapper - its title/desc/"View all history" action moved to AIAssistant.tsx's own PopupComponent header/footer (this card's only real caller, already inside a popup of its own), so the two don't double up their own separate header/action chrome. */}
			{error ? (
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load recent conversations', 'vulopilot')}
					desc={error}
				/>
			) : !isLoading && data.length === 0 ? (
				<ModuleGuardComponent
					icon="live-chat"
					title={__('No AI activity yet', 'vulopilot')}
					desc={__(
						'VuloPilot will log every AI-assisted action here.',
						'vulopilot'
					)}
				/>
			) : (
				<ListComponent
					className="mini-card report"
					isLoading={isLoading}
					items={data.map((row) => ({
						id: row.id,
						icon: 'live-chat',
						title: row.title,
						tags: (
							<>
								<div className="small desc">
									{timeAgo(row.updated_at)}
								</div>
								<i
									className="adminfont-eye recent-conversation-preview-icon"
									title={__('Preview', 'vulopilot')}
									onClick={(e) => handlePreview(row, e)}
								/>
							</>
						),
						action: () =>
							onSelectConversation(Number(row.id)),
					}))}
				/>
			)}

			<PopupComponent
				open={null !== previewConversation}
				onClose={() => setPreviewConversation(null)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{previewConversation && (
					<div className="recent-conversation-preview">
						<div className="recent-conversation-preview-title">
							{previewConversation.title}
						</div>
						{isLoadingPreview && 0 === previewConversation.turns.length ? (
							<p>{__('Loading…', 'vulopilot')}</p>
						) : (
							previewConversation.turns.map((turn, index) => (
								<ChatMessage
									key={index}
									sender={'user' === turn.role ? 'user' : 'ai'}
								>
									<ChatMarkdown text={turn.content} />
								</ChatMessage>
							))
						)}
					</div>
				)}
			</PopupComponent>
		</>
	);
};

export default RecentConversationsCard;
