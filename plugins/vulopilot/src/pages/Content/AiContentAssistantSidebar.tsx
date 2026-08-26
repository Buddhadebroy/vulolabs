/* global appLocalizer */
import { useState } from 'react';
import axios from 'axios';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink } from '@zyra/core';
import {
	ListComponent,
	NoticeManager,
} from '@zyra/components';
import { ChatMarkdown } from '../../components/ChatMarkdown';
import ChatComposerCard, { ChatInput, ChatMessage } from '../../components/ChatComposerCard';

interface ChatLink {
	url: string;
	label: string;
}

interface ChatTurn {
	role: 'user' | 'assistant';
	content: string;
	link?: ChatLink | null;
}

interface ChatResponse {
	content: string;
	link: ChatLink | null;
	provider: string | null;
	model: string | null;
}

/**
 * The shape WP_REST_Server::error_to_response() gives a WP_Error — what
 * actually arrives in `error.response.data` when ContentAssistant.php
 * returns one (e.g. "No AI provider is configured…", a safety-validator
 * rejection). Same reasoning as vulopilot-pro's OneClickFix module: raw
 * axios rather than @zyra/core's sendApiResponse() here on purpose, since
 * sendApiResponse() swallows the response body on any error and would
 * always show the same generic message no matter what actually went
 * wrong.
 */
interface WpRestErrorBody {
	code?: string;
	message?: string;
}

interface PromptChip {
	id: string;
	icon: string;
	/** The short label shown on the chip itself. */
	title: string;
	/** The clarifying question asked (as a local, non-AI chat turn) once this chip is picked. */
	ask: string;
	/** Combines the user's next reply into the real instruction actually sent to the AI. */
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	build: (answer: string) => string;
}

const PROMPT_CHIPS: PromptChip[] = [
	{
		id: 'blog',
		icon: 'document',
		title: __('Write a blog', 'vulopilot'),
		ask: __('What should the blog be about?', 'vulopilot'),
		build: (answer) =>
			sprintf(__('Write a blog about %s', 'vulopilot'), answer),
	},
	{
		id: 'product-description',
		icon: 'cart',
		title: __('Create a product description', 'vulopilot'),
		ask: __(
			'Which product is this for? Include the product name and a few key details.',
			'vulopilot'
		),
		build: (answer) =>
			sprintf(
				__('Create a product description for %s', 'vulopilot'),
				answer
			),
	},
	{
		id: 'faqs',
		icon: 'question',
		title: __('Generate FAQs', 'vulopilot'),
		ask: __('What topic or policy should these FAQs cover?', 'vulopilot'),
		build: (answer) =>
			sprintf(__('Generate FAQs for %s', 'vulopilot'), answer),
	},
	{
		id: 'meta-title',
		icon: 'price',
		title: __('Create meta title', 'vulopilot'),
		ask: __('Which page is this meta title for?', 'vulopilot'),
		build: (answer) =>
			sprintf(__('Create meta title for %s', 'vulopilot'), answer),
	},
	{
		id: 'cta',
		icon: 'edit',
		title: __('Write a call-to-action', 'vulopilot'),
		ask: __(
			'What product or service is this call-to-action for?',
			'vulopilot'
		),
		build: (answer) =>
			sprintf(
				__('Write a call-to-action for %s', 'vulopilot'),
				answer
			),
	},
];

/**
 * "AI Content Assistant" — a real chat, `POST /content-assistant/chat`
 * (classes/RestAPI/Controllers/ContentAssistant.php), which sends the
 * conversation through the same real AI-provider chain
 * (AIProviders\Support\SafeRequestSender) AI Actions/GEO scoring already
 * use. Whichever provider is configured under Settings → AI Providers
 * answers for real; when none is configured, the controller's own honest
 * error ("No AI provider is configured. Add one in Settings → AI
 * Providers.") is shown via NoticeManager rather than silently doing
 * nothing. The running conversation (`turns`) is kept client-side and
 * sent back as `history` on every call — there's no conversation entity
 * in this codebase to persist it against; every real call is still
 * recorded to `vulopilot_ai_history` server-side regardless (Reports'
 * own AI Usage report already reads that table). Prompt chips prefill
 * the composer only, same harmless pattern as AI Copilot's ChatTab.tsx.
 *
 * A "write a blog"/"create a landing page"/"create a product description"
 * style message doesn't come back as raw generated text: the controller
 * runs the real AIAction (generate-blog/generate-landing-page/
 * generate-product-description — the same ones ContentToolsGrid.tsx's own
 * tiles run), actually creates and saves the WordPress draft, and this
 * response's `link` carries the real edit URL, rendered below as a real
 * clickable `<a>` — never markdown-in-text, since ChatMessage
 * renders `content` as plain text.
 */
const AiContentAssistantSidebar = () => {
	const [message, setMessage] = useState('');
	const [turns, setTurns] = useState<ChatTurn[]>([]);
	const [isSending, setIsSending] = useState(false);
	// Set the moment a chip is picked; cleared once the user's next message
	// has been folded into that chip's own build() and sent for real.
	const [pendingChip, setPendingChip] = useState<PromptChip | null>(null);

	const sendToAi = (realMessage: string, displayedTurns: ChatTurn[]) => {
		setIsSending(true);

		axios
			.post<ChatResponse>(
				getApiLink(appLocalizer, 'content-assistant/chat'),
				{ message: realMessage, history: displayedTurns },
				{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
			)
			.then((response) => {
				setTurns((current) => [
					...current,
					{
						role: 'assistant',
						content: response.data.content,
						link: response.data.link,
					},
				]);
			})
			.catch((error) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-content-assistant-error',
					type: 'error',
					position: 'float',
					message:
						(error?.response?.data as WpRestErrorBody | undefined)
							?.message ??
						__(
							'Could not reach the AI Content Assistant. Please try again.',
							'vulopilot'
						),
				});
			})
			.finally(() => setIsSending(false));
	};

	/**
	 * Picking a chip doesn't send anything to the AI yet — it asks the real
	 * follow-up question first (a local, scripted chat turn, not an AI
	 * response) and waits for the user's next message to answer it. That
	 * reply gets folded into the chip's own build() into one real, useful
	 * instruction (e.g. "Write a blog about eco-friendly packaging") —
	 * what's actually shown as the user's turn and sent to the AI, not the
	 * bare reply on its own.
	 */
	const handleChipClick = (chip: PromptChip) => {
		if (isSending) {
			return;
		}

		setPendingChip(chip);
		setMessage('');
		setTurns((current) => [
			...current,
			{ role: 'assistant', content: chip.ask },
		]);
	};

	const handleSend = () => {
		const trimmed = message.trim();

		if ('' === trimmed || isSending) {
			return;
		}

		const history = turns;
		const realMessage = pendingChip ? pendingChip.build(trimmed) : trimmed;

		setTurns([...history, { role: 'user', content: realMessage }]);
		setMessage('');
		setPendingChip(null);
		sendToAi(realMessage, history);
	};

	return (
		<ChatComposerCard<ChatTurn>
			guarded
			welcome={sprintf(
				/* translators: %s: the real logged-in WP user's own display name */
				__(
					'Hi %s! I can help you create amazing content. Try one of these prompt ideas or ask your own.',
					'vulopilot'
				),
				appLocalizer.current_user_display_name
			)}
			turns={turns}
			renderTurn={(turn, index) => (
				<ChatMessage
					key={index}
					sender={'user' === turn.role ? 'user' : 'ai'}
				>
					<ChatMarkdown text={turn.content} />
					{turn.link && (
						<div className="content-assistant-created-link">
							<a
								className="content-assistant-created-link-anchor"
								href={turn.link.url}
								target="_blank"
								rel="noopener noreferrer"
							>
								{turn.link.label}
							</a>
						</div>
					)}
				</ChatMessage>
			)}
			isSending={isSending}
			sendingSpinnerClassName="content-assistant-spinner"
			composer={
				<ChatInput
					value={message}
					onChange={setMessage}
					onSend={handleSend}
					disabled={isSending}
					placeholder={
						pendingChip
							? __('Type your answer…', 'vulopilot')
							: __('Ask Anything…', 'vulopilot')
					}
				/>
			}
			prompts={
				<ListComponent
					className="chip-grid"
					items={PROMPT_CHIPS.map((prompt) => ({
						id: prompt.id,
						icon: prompt.icon,
						title: prompt.title,
						action: () => handleChipClick(prompt),
					}))}
				/>
			}
		/>
	);
};

export default AiContentAssistantSidebar;
