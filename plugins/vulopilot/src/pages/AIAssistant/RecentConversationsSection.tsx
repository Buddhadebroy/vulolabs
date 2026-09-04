import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ButtonInput } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { useCopilotChatEnabled } from '../../services/useCopilotChatEnabled';

/** One row of `GET /copilot/conversations?with_excerpt=1` — same real threads RecentConversationsCard.tsx's popup list shows, plus a real `excerpt` (AiConversationRepository::get_recent_with_excerpt()). */
interface RecentConversationExcerptRow {
	id: number;
	title: string;
	excerpt: string;
	updated_at: string;
}

interface RecentConversationsSectionProps {
	/** Same real "load this thread back into the composer" callback ChatTab.tsx already passes to RecentConversationsCard.tsx's popup. */
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onSelectConversation: (id: number) => void;
}

/**
 * Relative time for a card's footer — "%dh ago" while under a day old,
 * "Yesterday"/"Today" on calendar-day boundaries (same boundary
 * historyTypes.ts's own dayLabel() uses for its date headings, not a naive
 * 24h window), else a short "Mon D" date. A different 3-tier scheme than
 * RecentConversationsCard.tsx's own local timeAgo() (Nm/Nh/Nd ago,
 * uncapped) — that popup list favors precision for a long history, this
 * inline section favors the mockup's compact "22h ago / Yesterday / Aug 20"
 * shape. Kept local rather than shared, same call this codebase's other
 * timeAgo()-style helpers already make (RecentConversationsCard.tsx's own
 * docblock).
 */
const formatCardTime = (dateString: string): string => {
	const date = new Date(dateString);
	const now = new Date();
	const hoursAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

	if (hoursAgo < 24) {
		return hoursAgo <= 0
			? __('Just now', 'vulopilot')
			: sprintf(__('%dh ago', 'vulopilot'), hoursAgo);
	}

	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startOfYesterday = new Date(startOfToday);
	startOfYesterday.setDate(startOfYesterday.getDate() - 1);

	if (date >= startOfYesterday && date < startOfToday) {
		return __('Yesterday', 'vulopilot');
	}

	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/**
 * AI Copilot's inline "Recent conversations" section — renders directly
 * below the chat window (unlike RecentConversationsCard.tsx, which only
 * ever shows inside the composer's history popup). Up to 3 most-recently-
 * updated real threads (`GET /copilot/conversations?per_page=3&with_excerpt=1`),
 * each a real title + a real one-line excerpt of that thread's own first
 * user message (AiConversationRepository::get_recent_with_excerpt()) — not
 * fabricated preview copy. Clicking a card's arrow reuses the exact same
 * onSelectConversation callback the popup list's rows already call, loading
 * that thread straight back into the composer. No conversations yet simply
 * renders nothing, rather than a fake "no activity" card with nothing real
 * to show.
 */
const RecentConversationsSection: React.FC<RecentConversationsSectionProps> = ({
	onSelectConversation,
}) => {
	// Called unconditionally (Rules of Hooks) even though this section
	// returns null below without a real Pro license either way — see
	// RecentConversationsCard.tsx's own docblock for why the GET simply
	// 404s in that case (the route itself isn't registered).
	const { data, isLoading } = useApiList<RecentConversationExcerptRow>(
		'copilot/conversations',
		{ per_page: 3, with_excerpt: 1 }
	);
	const isCopilotChatEnabled = useCopilotChatEnabled();

	if (!isCopilotChatEnabled || (!isLoading && 0 === data.length)) {
		return null;
	}

	return (
		<CardComponent
			className="dashboard-widget"
			titleIcon="live-chat"
			title={__('Recent conversations', 'vulopilot')}
			desc={__('Your last 3 conversations with AI Copilot.', 'vulopilot')}
			isLoading={isLoading}
			action={
				<ButtonInput
					buttons={{
						text: __('View all', 'vulopilot'),
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
			<div className="recent-conversations-grid">
				{data.map((row) => (
					<div className="recent-conversations-card" key={row.id}>
						<div className="recent-conversations-card-icon">
							<i className="recent-conversations-card-icon-glyph adminfont-live-chat" />
						</div>
						<div className="recent-conversations-card-title">{row.title}</div>
						<div className="recent-conversations-card-excerpt">{row.excerpt}</div>
						<div className="recent-conversations-card-footer">
							<span className="recent-conversations-card-time">
								{formatCardTime(row.updated_at)}
							</span>
							<button
								type="button"
								className="recent-conversations-card-cta"
								title={__('Continue this conversation', 'vulopilot')}
								onClick={() => onSelectConversation(row.id)}
							>
								<i className="adminfont-pagination-right-arrow" />
							</button>
						</div>
					</div>
				))}
			</div>
		</CardComponent>
	);
};

export default RecentConversationsSection;
