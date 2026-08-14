import React from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent, ModuleGuardComponent, ButtonInput} from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { HistoryRow, humanizeConversationExcerpt } from './historyTypes';

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
	onNavigateTab: (tab: string) => void;
	/** Called with a row's real id when clicked — the caller navigates to History with the "Conversations" filter active and this same row selected (AIAssistant.tsx's own goToTab, extended for this). */
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onSelectConversation: (id: number) => void;
}

/**
 * AI Copilot's "Recent conversations" card — the 5 most recent rows of
 * `GET /history?type=conversation` (Controllers/History.php,
 * AiHistoryRepository::get_conversations()) — the exact same real,
 * `surface`-scoped chat-turns-only source HistoryTab.tsx's own
 * "Conversations" filter now reads, rather than the previously-used
 * unfiltered `GET /ai-history` (which mixed in every other AI-assisted
 * feature's calls — GEO scoring, schema generation, content intelligence
 * — none of which are a "conversation"). Sharing the exact same source and
 * row ids is also what makes clicking a row here able to genuinely select
 * that same row over on History, not just navigate to the right tab.
 *
 * Titles use humanizeConversationExcerpt() (historyTypes.ts) — a real
 * chat turn's own stored reply is the orchestrator's strict JSON decision,
 * not natural language, so this unwraps it into the same human-readable
 * text History's own timeline row already shows, instead of raw JSON.
 * "View all history" reuses the same History tab every other sidebar
 * card's "View all" link already points at.
 */
const RecentConversationsCard: React.FC<RecentConversationsCardProps> = ({
	onNavigateTab,
	onSelectConversation,
}) => {
	const { data, isLoading, error, refetch } = useApiList<HistoryRow>(
		'history',
		{ type: 'conversation', per_page: 5, orderby: 'created_at', order: 'desc' }
	);

	return (
		<CardComponent
			title={__('Recent conversations', 'vulopilot')}
			titleIcon="live-chat"
			action={
				<ButtonInput
					buttons={{
						text: __('View all history', 'vulopilot'),
						rightIcon: 'arrow-right',
						color: 'text-purple',
						onClick: (e) => {
							e.preventDefault();
							onNavigateTab('history');
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
						title: row.conversation
							? humanizeConversationExcerpt(
									row.conversation.excerpt,
									row.conversation.status
								)
							: row.message,
						tags: (<> <div className='small desc'>{timeAgo(row.created_at)}</div></>),
						action: () =>
							onSelectConversation(Number(row.id)),
					}))}
				/>
			)}
		</CardComponent>
	);
};

export default RecentConversationsCard;
