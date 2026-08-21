/* global appLocalizer */
import { useState } from 'react';
import axios from 'axios';
import { __ } from '@wordpress/i18n';
import { getApiLink } from '@zyra/core';
import { NoticeManager } from '@zyra/components';

/** A real, clickable edit link for content the AI just created and saved — see CopilotChatResponse's own docblock. */
export interface CopilotChatLink {
	url: string;
	label: string;
}

export interface CopilotChatTurn {
	role: 'user' | 'assistant';
	content: string;
	link?: CopilotChatLink | null;
	/** The real `vulopilot_ai_action_runs.id` this turn's content creation executed as — set only alongside `link`, lets ChatTab.tsx offer a real inline "Undo" right next to what it undoes (`POST /ai-action-runs/{id}/rollback`, the same endpoint HistoryDetailPanel.tsx's own Undo button already calls). */
	runId?: number | null;
	/** Set client-side once this turn's own run has been successfully rolled back, so the inline Undo button can honestly show "Undone" instead of staying clickable for an already-reverted run. */
	undone?: boolean;
	/** The real files this turn was sent with — user turns only, set from the composer's own `attachments` state at send time so ChatTab.tsx can still show what was attached after the composer clears it. */
	attachments?: CopilotAttachment[];
}

/**
 * A user-picked "Add context" item — always re-resolved against real,
 * current data server-side (Copilot.php's build_context_refs_block());
 * the extra fields here (label/category/count/severity, name) are for
 * rendering the chip client-side only, never trusted as-is by the server.
 */
export type CopilotContextRef =
	| {
			type: 'finding_group';
			scannerId: string;
			label: string;
			category: string;
			count: number;
			severity: string;
	  }
	| {
			type: 'automations';
			id: number;
			name: string;
	  };

/** A user-picked "Attach" file — a real WP Media Library attachment (zyra FileInput's wp.media() picker always returns a real id, never a client-only blob). */
export interface CopilotAttachment {
	id: number;
	url: string;
	name: string;
}

interface CopilotChatResponse {
	content: string;
	/** Set when this turn really created a WordPress draft (Copilot.php's own ContentCreationOrchestrator hand-off) — a real, clickable edit link, never present for an ordinary advisory reply. */
	link: CopilotChatLink | null;
	/** The real action run id behind that same draft — see CopilotChatTurn's own `runId` docblock. */
	run_id: number | null;
	provider: string;
	model: string;
}

/**
 * The shape WP_REST_Server::error_to_response() gives a WP_Error — what
 * actually arrives in `error.response.data` when Copilot.php returns one
 * (e.g. "No AI provider is configured…", a safety-validator rejection).
 * Raw axios rather than @zyra/core's sendApiResponse() here on purpose,
 * same reasoning as AiContentAssistantSidebar.tsx: sendApiResponse()
 * swallows the response body on any error.
 */
interface WpRestErrorBody {
	code?: string;
	message?: string;
}

/**
 * `POST /copilot/chat` (classes/RestAPI/Controllers/Copilot.php) — the one
 * real chat backend shared by AI Copilot's Chat tab (ChatTab.tsx) and Grow
 * My Traffic's "How would you like to grow today?" composer
 * (GEO/OverviewTab.tsx), both of which previously showed the identical
 * disabled "AI chat replies aren't available yet" composer. Deliberately
 * stateless server-side: the running conversation (`turns`) is kept here,
 * client-side, and sent back as `history` on every call — every real call
 * is still recorded to `vulopilot_ai_history` server-side regardless,
 * including a genuine `response_excerpt` of what the AI actually replied
 * (UsageTrackingProvider::record_success()), which is what lets
 * RecentConversationsCard.tsx show real recent activity even though this
 * hook's own `turns` state (the full back-and-forth) is lost on refresh.
 *
 * A message like "write a blog about X" now really creates and saves a
 * WordPress draft (Copilot.php's own ContentCreationOrchestrator hand-off,
 * shared with the separate "Create Content" page) — that reply's `link`
 * carries the real edit URL, which ChatTab.tsx renders as a real clickable
 * link, same as AiContentAssistantSidebar.tsx already does for its own
 * identical `link` field. Every other kind of request is still advice-only,
 * per build_messages()'s own system prompt.
 *
 * @param noticeKey Unique NoticeManager key for this composer's error banner, so two composers on the same page (if that ever happens) don't clobber each other's notice.
 */
export const useCopilotChat = ( noticeKey: string ) => {
	const [ turns, setTurns ] = useState< CopilotChatTurn[] >( [] );
	const [ isSending, setIsSending ] = useState( false );

	const send = (
		message: string,
		contextRefs: CopilotContextRef[] = [],
		attachments: CopilotAttachment[] = []
	) => {
		const trimmed = message.trim();

		if ( '' === trimmed || isSending ) {
			return;
		}

		const history = turns;

		setTurns( [
			...history,
			{
				role: 'user',
				content: trimmed,
				attachments: attachments.length > 0 ? attachments : undefined,
			},
		] );
		setIsSending( true );

		axios
			.post< CopilotChatResponse >(
				getApiLink( appLocalizer, 'copilot/chat' ),
				{
					message: trimmed,
					history,
					context_refs: contextRefs.map( ( ref ) =>
						'finding_group' === ref.type
							? { type: ref.type, scanner_id: ref.scannerId }
							: { type: ref.type, id: ref.id }
					),
					attachments: attachments.map( ( attachment ) => ( {
						id: attachment.id,
					} ) ),
				},
				{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
			)
			.then( ( response ) => {
				setTurns( ( current ) => [
					...current,
					{
						role: 'assistant',
						content: response.data.content,
						link: response.data.link,
						runId: response.data.run_id,
					},
				] );
			} )
			.catch( ( error ) => {
				NoticeManager.add( {
					uniqueKey: noticeKey,
					type: 'error',
					position: 'float',
					message:
						( error?.response?.data as WpRestErrorBody | undefined )
							?.message ??
						__(
							'Could not reach VuloPilot. Please try again.',
							'vulopilot'
						),
				} );
			} )
			.finally( () => setIsSending( false ) );
	};

	/**
	 * Marks one turn's own run as rolled back — called by ChatTab.tsx after
	 * a real, successful `POST /ai-action-runs/{id}/rollback` (same pattern
	 * HistoryDetailPanel.tsx's own Undo button already uses). Matched by
	 * `runId` rather than array index, since `turns` can grow between when
	 * a turn renders its Undo button and when that click resolves.
	 */
	const markTurnUndone = ( runId: number ) => {
		setTurns( ( current ) =>
			current.map( ( turn ) =>
				turn.runId === runId ? { ...turn, undone: true } : turn
			)
		);
	};

	return { turns, isSending, send, markTurnUndone };
};
