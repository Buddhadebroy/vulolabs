/* global appLocalizer */
import { useState } from 'react';
import axios from 'axios';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink } from '@zyra/core';
import {
	CardComponent,
	ChatInputComponent,
	ChatMessageComponent,
	ListComponent,
	NoticeManager,
} from '@zyra/components';
import { ChatMarkdown } from '../../components/ChatMarkdown';
import AiCopilotGuard from '../../components/AiCopilotGuard';

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

const PROMPT_CHIPS = [
	{ id: 'blog-ai-ecommerce', icon: 'document', title: __('Write a blog about AI in eCommerce', 'vulopilot') },
	{ id: 'product-description-earbuds', icon: 'cart', title: __('Create a product description for wireless earbuds', 'vulopilot') },
	{ id: 'faq-return-policy', icon: 'question', title: __('Generate FAQs for return policy', 'vulopilot') },
	{ id: 'meta-title-landing-page', icon: 'price', title: __('Create meta title for a landing page', 'vulopilot') },
	{ id: 'cta-saas-product', icon: 'edit', title: __('Write a call-to-action for a SaaS product', 'vulopilot') },
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
 * clickable `<a>` — never markdown-in-text, since ChatMessageComponent
 * renders `content` as plain text.
 */
const AiContentAssistantSidebar = () => {
	const [message, setMessage] = useState('');
	const [turns, setTurns] = useState<ChatTurn[]>([]);
	const [isSending, setIsSending] = useState(false);

	const handleSend = () => {
		const trimmed = message.trim();

		if ('' === trimmed || isSending) {
			return;
		}

		const history = turns;

		setTurns([...history, { role: 'user', content: trimmed }]);
		setMessage('');
		setIsSending(true);

		axios
			.post<ChatResponse>(
				getApiLink(appLocalizer, 'content-assistant/chat'),
				{ message: trimmed, history },
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

	return (
		<CardComponent
			title={__('AI Content Assistant', 'vulopilot')}
			titleIcon="ai"
		>
			<AiCopilotGuard>
				<ChatMessageComponent>
					{sprintf(
						/* translators: %s: the real logged-in WP user's own display name */
						__(
							'Hi %s! I can help you create amazing content. Try one of these prompt ideas or ask your own.',
							'vulopilot'
						),
						appLocalizer.current_user_display_name
					)}
				</ChatMessageComponent>

				{turns.map((turn, index) => (
					<ChatMessageComponent
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
					</ChatMessageComponent>
				))}

				{isSending && (
					<ChatMessageComponent sender="ai">
						<i className="adminfont-refresh content-assistant-spinner" />{' '}
						{__('Thinking…', 'vulopilot')}
					</ChatMessageComponent>
				)}

				<ListComponent
					className="chip-grid"
					items={PROMPT_CHIPS.map((prompt) => ({
						id: prompt.id,
						icon: prompt.icon,
						title: prompt.title,
						action: () => setMessage(prompt.title),
					}))}
				/>
				<ChatInputComponent
					value={message}
					onChange={setMessage}
					onSend={handleSend}
					disabled={isSending}
					placeholder={__('Ask Anything…', 'vulopilot')}
				/>
			</AiCopilotGuard>
		</CardComponent>
	);
};

export default AiContentAssistantSidebar;
