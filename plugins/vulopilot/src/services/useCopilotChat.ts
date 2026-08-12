/* global appLocalizer */
import { useState } from 'react';
import axios from 'axios';
import { __ } from '@wordpress/i18n';
import { getApiLink } from '@zyra/core';
import { NoticeManager } from '@zyra/components';

export interface CopilotChatTurn {
	role: 'user' | 'assistant';
	content: string;
}

interface CopilotChatResponse {
	content: string;
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
 * is still recorded to `vulopilot_ai_history` server-side regardless.
 *
 * @param noticeKey Unique NoticeManager key for this composer's error banner, so two composers on the same page (if that ever happens) don't clobber each other's notice.
 */
export const useCopilotChat = ( noticeKey: string ) => {
	const [ turns, setTurns ] = useState< CopilotChatTurn[] >( [] );
	const [ isSending, setIsSending ] = useState( false );

	const send = ( message: string ) => {
		const trimmed = message.trim();

		if ( '' === trimmed || isSending ) {
			return;
		}

		const history = turns;

		setTurns( [ ...history, { role: 'user', content: trimmed } ] );
		setIsSending( true );

		axios
			.post< CopilotChatResponse >(
				getApiLink( appLocalizer, 'copilot/chat' ),
				{ message: trimmed, history },
				{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
			)
			.then( ( response ) => {
				setTurns( ( current ) => [
					...current,
					{ role: 'assistant', content: response.data.content },
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

	return { turns, isSending, send };
};
