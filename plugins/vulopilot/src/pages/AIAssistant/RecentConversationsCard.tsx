/* global appLocalizer */
import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ListComponent,
	ModuleGuardComponent,
	ButtonInput,
	PopupComponent,
} from '@zyra/components';
import { getApiLink, getApiResponse } from '@zyra/core';
import { useApiList } from '../../services/useApiList';
import { ChatMarkdown } from '../../components/ChatMarkdown';
import { ChatMessage } from '../../components/ChatComposerCard';

/** One row of `GET /copilot/conversations` (Copilot.php's own get_conversations()) — a real, reloadable conversation thread, not a single logged AI call. */
interface RecentConversationRow {
	id: number;
	title: string;
	updated_at: string;
}

/** One turn of `GET /copilot/conversations/{id}` — same real endpoint/shape useCopilotChat.ts's own loadConversation() reads (StoredConversationTurn there), just the subset this read-only preview popup actually renders. */
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
 * Relative "2h ago"/"3d ago" formatting — same local pattern already used
 * by RecentContentCard.tsx/RecentActivityCard.tsx. No shared relative-time
 * utility exists in this codebase yet, and this is small enough to keep
 * local rather than add a new cross-page service for a third consumer.
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
	/** Called with a row's real `vulopilot_ai_conversations.id` when clicked — ChatTab.tsx's own onSelectConversation loads that thread's full history straight into the composer (useCopilotChat.ts's loadConversation()), no navigation involved since this card already lives on the same tab as the composer. */
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onSelectConversation: (id: number) => void;
}

/**
 * AI Copilot's "Recent conversations" card — the 5 most recently-updated
 * real, reloadable conversation threads (`GET /copilot/conversations`,
 * Copilot.php's own get_conversations() /
 * AiConversationRepository::get_recent()). Deliberately a different source
 * than History's own "Conversations" filter (`GET /history?type=conversation`,
 * `vulopilot_ai_history`) — that table is a permanent, excerpt-only audit
 * trail of individual AI calls, not grouped into threads and never storing
 * full text, so it can't back a real "load this conversation back into the
 * composer" click. `title` here is each thread's own real first message
 * (`AiConversationRepository::build_title()`), not an unwrapped AI-reply
 * excerpt, so no humanizeConversationExcerpt()-style unwrapping is needed.
 *
 * "View all history" now navigates to Reports' own History tab (moved
 * there from AI Copilot's own former tab shell) — a real page transition,
 * not a same-page tab switch, since this card and History no longer live
 * under the same top-level menu item.
 */
const RecentConversationsCard: React.FC<RecentConversationsCardProps> = ({
	onSelectConversation,
}) => {
	const { data, isLoading, error, refetch } = useApiList<RecentConversationRow>(
		'copilot/conversations',
		{ per_page: 5 }
	);
	/** The conversation currently shown in the preview popup — null closes it. `turns` starts empty while the fetch below is in flight. */
	const [previewConversation, setPreviewConversation] = useState<{
		id: number;
		title: string;
		turns: ConversationPreviewTurn[];
	} | null>(null);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);

	/**
	 * Opens the popup immediately (with a loading state) and fetches the
	 * same real `GET /copilot/conversations/{id}` useCopilotChat.ts's own
	 * loadConversation() reads — read-only here, unlike that hook: this
	 * never touches the composer's own `turns`/`conversationId` state, so
	 * previewing a thread never disturbs whatever the user is already
	 * composing. `e.stopPropagation()` keeps this icon's click from also
	 * bubbling up into the row's own `action` (ListComponent's item click
	 * handler), which would otherwise ALSO fire onSelectConversation and
	 * load this thread into the composer — the row itself still does that
	 * on its own click, unchanged.
	 */
	const handlePreview = (
		row: RecentConversationRow,
		e: React.MouseEvent
	) => {
		e.stopPropagation();
		setPreviewConversation({ id: row.id, title: row.title, turns: [] });
		setIsLoadingPreview(true);

		getApiResponse<ConversationPreviewResponse>(
			getApiLink(appLocalizer, `copilot/conversations/${row.id}`),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
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
			<CardComponent
				className="recent-conversations-card"
				title={__('Recent conversations', 'vulopilot')}
				titleIcon="live-chat"
				desc={__('Your past conversations with AI Copilot.', 'vulopilot')}
				action={
					<ButtonInput
						buttons={{
							text: __('View all history', 'vulopilot'),
							rightIcon: 'arrow-right',
							color: 'text-purple',
							onClick: (e) => {
								e.preventDefault();
								window.location.href =
									'?page=vulopilot#&tab=reports&subtab=history';
							},
						}}
					/>
				}
			>
				{error ? (
					<ModuleGuardComponent
						icon="error"
						title={__('Could not load recent conversations', 'vulopilot')}
						desc={error}
						buttonText={__('Retry', 'vulopilot')}
						onButtonClick={refetch}
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
			</CardComponent>

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
