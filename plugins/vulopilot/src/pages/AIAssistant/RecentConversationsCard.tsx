import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ListComponent, ModuleGuardComponent, ButtonInput} from '@zyra/components';
import { useApiList } from '../../services/useApiList';

interface AiHistoryRow {
	id: number;
	provider: string;
	model: string | null;
	status: 'success' | 'failure';
	response_excerpt: string | null;
	created_at: string;
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

/**
 * `vulopilot_ai_history` rows have no stored user prompt (only the AI's
 * own reply is ever persisted — DATABASE.md's own "audit trail, not a
 * cache" reasoning for `response_excerpt`), so there's no literal
 * "conversation" to title a row with. `response_excerpt` (a real,
 * truncated snippet of what the AI actually said, populated by
 * UsageTrackingProvider::record_success() for every real call, chat
 * included) is the closest real substitute when a call actually returned
 * one; otherwise fall back to describing what happened, honestly, from the
 * columns that do exist (e.g. a failed call, which never has a response to
 * excerpt).
 */
const rowTitle = (row: AiHistoryRow): string => {
	if (row.response_excerpt) {
		return row.response_excerpt.length > 60
			? `${row.response_excerpt.slice(0, 60)}…`
			: row.response_excerpt;
	}

	if (row.status === 'failure') {
		return sprintf(
			/* translators: %s: AI provider name, e.g. "groq" */
			__('%s request failed', 'vulopilot'),
			row.provider
		);
	}

	return sprintf(
		/* translators: %s: AI provider or model name, e.g. "groq" */
		__('AI response via %s', 'vulopilot'),
		row.model || row.provider
	);
};

interface RecentConversationsCardProps {
	onNavigateTab: (tab: string) => void;
}

/**
 * AI Copilot's "Recent conversations" card — the 5 most recent rows of
 * `vulopilot_ai_history` (GET /ai-history, the same real endpoint
 * HistoryTab.tsx's own table reads), not static placeholder copy —
 * including real Chat tab turns now that UsageTrackingProvider actually
 * writes `response_excerpt` (previously a real schema column no code path
 * ever populated, so every row here silently fell back to a generic
 * "AI response via X" line no matter what was actually said). "View all
 * history" reuses the same History tab every other sidebar card's
 * "View all" link already points at.
 */
const RecentConversationsCard: React.FC<RecentConversationsCardProps> = ({
	onNavigateTab,
}) => {
	const { data, isLoading, error, refetch } = useApiList<AiHistoryRow>(
		'ai-history',
		{ per_page: 5, orderby: 'created_at', order: 'desc' }
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
						title: rowTitle(row),
						tags: (<> <div className='small desc'>{timeAgo(row.created_at)}</div></>),
					}))}
				/>
			)}
		</CardComponent>
	);
};

export default RecentConversationsCard;
