/* global vulopilotAppLocalizer */
import { useRef, useState } from 'react';
import axios from 'axios';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';
import { useAiCredits } from './useAiCredits';

/** A real, clickable edit link for content the AI just created and saved - see CopilotChatResponse's own docblock. */
export interface CopilotChatLink {
	url: string;
	label: string;
}

export interface CopilotChatTurn {
	role: 'user' | 'assistant';
	content: string;
	link?: CopilotChatLink | null;
	/** The real `vulopilot_ai_action_runs.id` this turn's content creation executed as. */
	runId?: number | null;
	/** Set client-side once this turn's own run has been successfully rolled back. */
	undone?: boolean;
	/** The real files this turn was sent with - user turns only. */
	attachments?: CopilotAttachment[];
}

/**
 * A user-picked "Add context" item - always re-resolved against real, current data server-side
 * (Copilot.php's build_context_refs_block()).
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

/** A user-picked "Attach" file - a real WP Media Library attachment (zyra FileInput's wp.media() picker always returns a real id, never a client-only blob). */
export interface CopilotAttachment {
	id: number;
	url: string;
	name: string;
}

interface CopilotChatResponse {
	content: string;
	/** Set when this turn really created a WordPress draft (Copilot.php's own ContentCreationOrchestrator hand-off). */
	link: CopilotChatLink | null;
	/** The real action run id behind that same draft - see CopilotChatTurn's own `runId` docblock. */
	run_id: number | null;
	/** The real `vulopilot_ai_conversations.id` this turn was just saved under (Copilot.php's own persist_conversation()). */
	conversation_id: number;
}

/** One turn as `GET /copilot/conversations/{id}` returns it - see CopilotChatTurn's own docblock for the client-side shape this maps onto. */
interface StoredConversationTurn {
	role: 'user' | 'assistant';
	content: string;
	link?: CopilotChatLink | null;
	run_id?: number | null;
	attachments?: CopilotAttachment[];
}

interface StoredConversation {
	id: number;
	title: string;
	turns: StoredConversationTurn[];
}

/**
 * The shape WP_REST_Server::error_to_response() gives a WP_Error.
 */
interface WpRestErrorBody {
	code?: string;
	message?: string;
}

/**
 * A message like "write a blog about X" creates and saves a WordPress draft.
 *
 * @param noticeKey Unique NoticeManager key for this composer's error banner.
 */
export const useCopilotChat = ( noticeKey: string ) => {
	const [ turns, setTurns ] = useState< CopilotChatTurn[] >( [] );
	const [ isSending, setIsSending ] = useState( false );
	/** The real `vulopilot_ai_conversations.id` this session is saving to. */
	const [ conversationId, setConversationId ] = useState< number | null >( null );
	const [ isLoadingConversation, setIsLoadingConversation ] = useState( false );
	/** True right after a real send was blocked (or failed) because no AI connection is configured - see this hook's own docblock. */
	const [ isCloudConnectPromptOpen, setIsCloudConnectPromptOpen ] = useState( false );
	const { status: creditsStatus } = useAiCredits();

	const dismissCloudConnectPrompt = () => setIsCloudConnectPromptOpen( false );
	/** Bumped by `startNewConversation()` - a reply still in flight from before that reset belongs to the abandoned thread and must not land in the fresh one. */
	const chatGeneration = useRef( 0 );

	const send = (
		message: string,
		contextRefs: CopilotContextRef[] = [],
		attachments: CopilotAttachment[] = [],
		autoApply: boolean = true
	) => {
		const trimmed = message.trim();

		if ( '' === trimmed || isSending ) {
			return;
		}

		if ( creditsStatus && ! creditsStatus.connected ) {
			setIsCloudConnectPromptOpen( true );
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
		const generation = chatGeneration.current;

		axios
			.post< CopilotChatResponse >(
				getApiLink( vulopilotAppLocalizer, 'copilot/chat' ),
				{
					message: trimmed,
					history,
					conversation_id: conversationId,
					auto_apply: autoApply,
					context_refs: contextRefs.map( ( ref ) =>
						'finding_group' === ref.type
							? { type: ref.type, scanner_id: ref.scannerId }
							: { type: ref.type, id: ref.id }
					),
					attachments: attachments.map( ( attachment ) => ( {
						id: attachment.id,
					} ) ),
				},
				{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
			)
			.then( ( response ) => {
				if ( generation !== chatGeneration.current ) {
					return;
				}

				setTurns( ( current ) => [
					...current,
					{
						role: 'assistant',
						content: response.data.content,
						link: response.data.link,
						runId: response.data.run_id,
					},
				] );
				setConversationId( response.data.conversation_id );
			} )
			.catch( ( error ) => {
				if ( generation !== chatGeneration.current ) {
					return;
				}

				const message = ( error?.response?.data as WpRestErrorBody | undefined )
					?.message;

				// Copilot.php's own real "No AI connection is configured." (AiRequestSender).
				if ( message?.includes( 'No AI connection is configured' ) && ! creditsStatus?.connected ) {
					setIsCloudConnectPromptOpen( true );
					return;
				}

				NoticeManager.add( {
					uniqueKey: noticeKey,
					type: 'error',
					position: 'float',
					message:
						message ??
						__(
							'Could not reach VuloPilot. Please try again.',
							'vulopilot'
						),
				} );
			} )
			.finally( () => {
				if ( generation === chatGeneration.current ) {
					setIsSending( false );
				}
			} );
	};

	/**
	 * Marks one turn's own run as rolled back - called by ChatTab.tsx after a real.
	 */
	const markTurnUndone = ( runId: number ) => {
		setTurns( ( current ) =>
			current.map( ( turn ) =>
				turn.runId === runId ? { ...turn, undone: true } : turn
			)
		);
	};

	/**
	 * Loads a real, past conversation's full turns back into this composer (`GET
	 * /copilot/conversations/{id}`, Copilot.php's own get_conversation()).
	 */
	const loadConversation = ( id: number ) => {
		setIsLoadingConversation( true );

		getApiResponse< StoredConversation >(
			getApiLink( vulopilotAppLocalizer, `copilot/conversations/${ id }` ),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		)
			.then( ( response ) => {
				if ( ! response ) {
					return;
				}

				setTurns(
					response.turns.map( ( turn ) => ( {
						role: turn.role,
						content: turn.content,
						link: turn.link ?? null,
						runId: turn.run_id ?? null,
						attachments: turn.attachments,
					} ) )
				);
				setConversationId( response.id );
			} )
			.finally( () => setIsLoadingConversation( false ) );
	};

	/**
	 * "New Chat": clears `turns` and drops `conversationId`, so the next `send()` starts a new
	 * conversation.
	 */
	const startNewConversation = () => {
		chatGeneration.current += 1;
		setTurns( [] );
		setConversationId( null );
		setIsSending( false );
	};

	return {
		turns,
		isSending,
		send,
		markTurnUndone,
		loadConversation,
		startNewConversation,
		isLoadingConversation,
		conversationId,
		isCloudConnectPromptOpen,
		dismissCloudConnectPrompt,
	};
};
